// ========== MÓDULO PUBLICAÇÕES — AUTO-CONSULTA INTELIGENTE ==========
let pubTodasPublicacoes = [];
let pubPublicacoesFiltradas = [];
let pubCurrentPagePub = 1;
const pubPerPagePub = 8;
let pubFiltroAtivo = 'todos';
let pubDetalheAtual = null;
let pubEditingOabId = null;

// ---- Chaves de storage ----
const PUB_STORAGE_KEY    = 'advboard_publicacoes';
const OAB_STORAGE_KEY    = 'advboard_oabs';
const CFG_STORAGE_KEY    = 'advboard_pub_config';
const LOG_STORAGE_KEY    = 'advboard_pub_log';
const SYNC_KEY           = 'advboard_last_sync';
const SEEN_HASH_KEY      = 'advboard_pub_seen_hash'; // hash por id para detectar modificação

const pubTiposUrgentes = ['despacho', 'decisão', 'sentença', 'acórdão', 'audiência', 'prazo', 'penhora', 'arresto', 'bloqueio'];

// ---- Intervalo de auto-sync ----
let _pubAutoSyncTimer = null;
let _pubCountdownTimer = null;
let _pubProximaSyncTs = null;

// =========================================================
// STORAGE
// =========================================================
function pubSalvarStorage() {
  try { localStorage.setItem(PUB_STORAGE_KEY, JSON.stringify(pubTodasPublicacoes)); } catch(e){}
  if (window._firebaseReady && window._firestore) {
    const db = window._firestore;
    window._firestoreSetDoc(window._firestoreDoc(db, 'advboard', 'publicacoes'), {
      dados: JSON.stringify(pubTodasPublicacoes),
      updatedAt: new Date().toISOString()
    }).catch(e => console.warn('Erro ao salvar publicações no Firebase:', e));
  }
}

async function pubCarregarStorage() {
  try { const d = localStorage.getItem(PUB_STORAGE_KEY); if(d) pubTodasPublicacoes = JSON.parse(d); } catch(e){}
  if (window._firebaseReady && window._firestore) {
    try {
      const snap = await window._firestoreGetDoc(window._firestoreDoc(window._firestore, 'advboard', 'publicacoes'));
      if (snap.exists() && snap.data().dados) {
        pubTodasPublicacoes = JSON.parse(snap.data().dados);
        localStorage.setItem(PUB_STORAGE_KEY, snap.data().dados);
      }
    } catch(e) { console.warn('Erro ao carregar publicações do Firebase:', e); }
  }
}

function oabGetAll() { try { return JSON.parse(localStorage.getItem(OAB_STORAGE_KEY) || '[]'); } catch(e){ return []; } }

function oabSaveAll(list) {
  try { localStorage.setItem(OAB_STORAGE_KEY, JSON.stringify(list)); } catch(e){}
  if (window._firebaseReady && window._firestore) {
    window._firestoreSetDoc(window._firestoreDoc(window._firestore, 'advboard', 'oabs'), {
      dados: JSON.stringify(list), updatedAt: new Date().toISOString()
    }).catch(e => console.warn('Erro ao salvar OABs no Firebase:', e));
  }
}

function cfgGetPub() {
  try {
    return Object.assign(
      { horario: '08:00', intervalMinutos: 30, notifUrgentes: true, notifTodas: false, ultimaSync: null, autoSyncAtivo: true },
      JSON.parse(localStorage.getItem(CFG_STORAGE_KEY) || '{}')
    );
  } catch(e){ return { horario: '08:00', intervalMinutos: 30, notifUrgentes: true, notifTodas: false, autoSyncAtivo: true }; }
}

function cfgSavePub(cfg) { try { localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg)); } catch(e){} }
function logGetPub() { try { return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch(e){ return []; } }
function logAddPub(msg, tipo='info') {
  const log = logGetPub();
  const now = new Date();
  log.unshift({ ts: now.toISOString(), msg, tipo, fmt: now.toLocaleString('pt-BR') });
  if(log.length > 100) log.splice(100);
  try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log)); } catch(e){}
  renderAdminLog();
}
function setLastSyncPub() { const cfg = cfgGetPub(); cfg.ultimaSync = new Date().toISOString(); cfgSavePub(cfg); }
function getLastSyncPub() { const cfg = cfgGetPub(); return cfg.ultimaSync || null; }

// =========================================================
// HASH PARA DETECTAR MODIFICAÇÃO
// Gera um "fingerprint" de uma publicação baseado nos campos relevantes.
// Se o hash mudar entre syncs, a publicação foi modificada.
// =========================================================
function pubGerarHash(p) {
  return [p.tipo, p.tribunal, p.movimento, p.dataPublicacao].join('|');
}

function pubGetSeenHashes() {
  try { return JSON.parse(localStorage.getItem(SEEN_HASH_KEY) || '{}'); } catch(e){ return {}; }
}

function pubSaveSeenHash(id, hash) {
  const hashes = pubGetSeenHashes();
  hashes[id] = hash;
  try { localStorage.setItem(SEEN_HASH_KEY, JSON.stringify(hashes)); } catch(e){}
}

function pubSaveAllSeenHashes(obj) {
  try { localStorage.setItem(SEEN_HASH_KEY, JSON.stringify(obj)); } catch(e){}
}

// =========================================================
// GERAÇÃO DE DADOS (MOCK — substitua pela API real do DataJud)
// =========================================================
function pubGerarDadosMock(oabs, periodoOverride = 30) {
  const tipos = ['Despacho', 'Decisão Interlocutória', 'Sentença', 'Audiência Designada', 'Juntada de Petição', 'Publicação de Pauta', 'Certidão', 'Despacho de Mero Expediente'];
  const tribunaisMap = { 'trt19':'TRT-19 (AL)', 'trt6':'TRT-6 (PE)', 'trt5':'TRT-5 (BA)', 'tst':'TST', 'tjal':'TJAL', 'trf5':'TRF-5' };
  const varas = ['1ª Vara do Trabalho', '2ª Vara do Trabalho', '3ª Vara do Trabalho', '4ª Vara do Trabalho'];
  const movimentos = [
    'Conclusão ao Juiz para Despacho. Os autos conclusos para o MM. Juiz(a) para despacho ordinário.',
    'Audiência Inaugural designada. Fica intimado(a) o(a) reclamante para comparecer à audiência inaugural.',
    'Decisão: Defiro a antecipação dos efeitos da tutela pleiteada. Intime-se.',
    'Sentença: Julgo procedente em parte o pedido formulado na inicial.',
    'Despacho: Cite-se o(a) reclamado(a) para contestar no prazo legal.',
    'Pauta de audiência publicada. Verificar data e local de realização.'
  ];

  const procsComNumero = processos.filter(p => p.proc && p.proc !== 'Sem nº');
  const novasOuModificadas = [];
  const hoje = new Date();

  oabs.filter(o => o.ativo).forEach(oab => {
    const tribunalNome = tribunaisMap[oab.tribunal] || 'TRT';
    procsComNumero.forEach((proc) => {
      const qtd = Math.floor(Math.random() * 2);
      for (let i = 0; i <= qtd; i++) {
        const diasAtras = Math.floor(Math.random() * periodoOverride);
        const dataPubl = new Date(hoje);
        dataPubl.setDate(hoje.getDate() - diasAtras);
        const tipo = tipos[Math.floor(Math.random() * tipos.length)];
        const movimento = movimentos[Math.floor(Math.random() * movimentos.length)];
        const isUrgente = pubTiposUrgentes.some(u => tipo.toLowerCase().includes(u));
        // ID estável baseado no processo + oab + dia (sem timestamp volátil)
        const id = `pub_${proc.id}_${oab.id}_${diasAtras}_${i}`;
        if (diasAtras < periodoOverride) {
          novasOuModificadas.push({
            id, processo: proc.proc, clienteNome: proc.clienteNome, tipo, tribunal: tribunalNome,
            orgaoJulgador: varas[Math.floor(Math.random() * varas.length)],
            dataPublicacao: dataPubl.toISOString(),
            dataPublicacaoFmt: dataPubl.toLocaleDateString('pt-BR'),
            movimento, urgente: isUrgente, procId: proc.id, oabId: oab.id,
            url: `https://datajud.cnj.jus.br/consulta?numero=${encodeURIComponent(proc.proc)}`
          });
        }
      }
    });
  });
  novasOuModificadas.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));
  return novasOuModificadas;
}

// =========================================================
// SINCRONIZAÇÃO INTELIGENTE
// Compara o resultado novo com o que já existe:
//   - ID nunca visto antes → marca como "nova"
//   - ID já existe mas hash mudou → marca como "modificada"
//   - ID já existe e hash igual → mantém estado atual (lida/não lida)
// =========================================================
async function pubSincronizar(forcar = false) {
  const oabs = oabGetAll().filter(o => o.ativo);
  if (oabs.length === 0) {
    logAddPub('Nenhuma OAB ativa configurada.', 'warn');
    return { novas: 0, modificadas: 0 };
  }
  logAddPub(`🔄 Consultando publicações para ${oabs.length} OAB(s)...`, 'info');
  await new Promise(r => setTimeout(r, 400));

  const periodo = parseInt(document.getElementById('pub-periodo')?.value || '30');
  const resultadosApi = pubGerarDadosMock(oabs, periodo);

  // Mapa das publicações existentes por id
  const existentesMap = {};
  pubTodasPublicacoes.forEach(p => { existentesMap[p.id] = p; });

  // Mapa de hashes já vistos
  const seenHashes = pubGetSeenHashes();
  const novosHashes = { ...seenHashes };

  let qtdNovas = 0;
  let qtdModificadas = 0;

  const resultadoFinal = resultadosApi.map(pubApi => {
    const hashAtual = pubGerarHash(pubApi);
    const existente = existentesMap[pubApi.id];

    if (!existente) {
      // Publicação nunca vista
      qtdNovas++;
      novosHashes[pubApi.id] = hashAtual;
      return { ...pubApi, lida: false, nova: true, modificada: false };
    }

    const hashAnterior = seenHashes[pubApi.id];
    if (hashAnterior && hashAnterior !== hashAtual) {
      // Publicação já existia, mas teve modificação
      qtdModificadas++;
      novosHashes[pubApi.id] = hashAtual;
      return { ...existente, ...pubApi, lida: false, nova: false, modificada: true };
    }

    // Sem mudança — mantém estado atual (lida/nova/etc.)
    novosHashes[pubApi.id] = hashAtual;
    return { ...pubApi, lida: existente.lida, nova: existente.nova, modificada: existente.modificada || false };
  });

  // IDs que vieram da API agora
  const idsApi = new Set(resultadosApi.map(p => p.id));

  // Mantém publicações antigas que não vieram na consulta atual (podem ter sumido do período)
  pubTodasPublicacoes.forEach(p => {
    if (!idsApi.has(p.id)) resultadoFinal.push(p);
  });

  // Deduplica
  const seen = new Set();
  pubTodasPublicacoes = resultadoFinal.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  pubTodasPublicacoes.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));

  pubSaveAllSeenHashes(novosHashes);
  pubSalvarStorage();

  // Notificações
  const cfg = cfgGetPub();
  const novidades = pubTodasPublicacoes.filter(p => p.nova || p.modificada);
  if (cfg.notifTodas) {
    novidades.slice(0, 3).forEach(p => {
      const icone = p.modificada ? '🔄' : '✨';
      notifications.unshift({ id: Date.now() + Math.random(), text: `${icone} ${p.tipo}: ${p.clienteNome}`, from: 'DataJud', time: 'Agora', unread: true });
    });
  } else if (cfg.notifUrgentes) {
    novidades.filter(p => p.urgente).slice(0, 3).forEach(p => {
      notifications.unshift({ id: Date.now() + Math.random(), text: `🔴 Urgente: ${p.tipo} — ${p.clienteNome}`, from: 'DataJud', time: 'Agora', unread: true });
    });
  }
  if (novidades.length > 0) updateNotifBadge();

  setLastSyncPub();
  adminRenderSyncStatus();
  pubAtualizarStats();

  const resumo = [];
  if (qtdNovas > 0) resumo.push(`${qtdNovas} nova(s)`);
  if (qtdModificadas > 0) resumo.push(`${qtdModificadas} modificada(s)`);
  const msg = resumo.length > 0
    ? `✅ ${resumo.join(' e ')} publicação(ões) encontrada(s).`
    : `ℹ️ Nenhuma publicação nova ou modificada.`;
  logAddPub(msg, resumo.length > 0 ? 'success' : 'info');

  return { novas: qtdNovas, modificadas: qtdModificadas };
}

// =========================================================
// AUTO-SYNC PERIÓDICO POR INTERVALO (em minutos)
// =========================================================
function iniciarAutoSyncDiario() {
  // Limpa timers antigos
  if (_pubAutoSyncTimer) clearTimeout(_pubAutoSyncTimer);
  if (_pubCountdownTimer) clearInterval(_pubCountdownTimer);

  const cfg = cfgGetPub();
  if (!cfg.autoSyncAtivo) {
    atualizarIndicadorSync();
    return;
  }

  const intervaloMs = (cfg.intervalMinutos || 30) * 60 * 1000;
  _pubProximaSyncTs = Date.now() + intervaloMs;

  _pubAutoSyncTimer = setTimeout(function tick() {
    pubSincronizar().then(({ novas, modificadas }) => {
      const total = novas + modificadas;
      if (total > 0) {
        const partes = [];
        if (novas > 0) partes.push(`${novas} nova(s)`);
        if (modificadas > 0) partes.push(`${modificadas} modificada(s)`);
        showToast(`🔔 ${partes.join(' e ')} publicação(ões)!`);
        pubRenderLista();
      }
    });

    // Agenda o próximo ciclo
    const cfgAtual = cfgGetPub();
    if (cfgAtual.autoSyncAtivo) {
      const nextMs = (cfgAtual.intervalMinutos || 30) * 60 * 1000;
      _pubProximaSyncTs = Date.now() + nextMs;
      _pubAutoSyncTimer = setTimeout(tick, nextMs);
    }
    atualizarIndicadorSync();
  }, intervaloMs);

  // Contador regressivo no indicador (atualiza a cada 30s)
  _pubCountdownTimer = setInterval(atualizarIndicadorSync, 30000);
  atualizarIndicadorSync();
}

function atualizarIndicadorSync() {
  const indicador = document.getElementById('auto-sync-indicator');
  if (!indicador) return;
  const cfg = cfgGetPub();
  if (!cfg.autoSyncAtivo) {
    indicador.innerHTML = '⏸️ Auto-sync desativado';
    return;
  }
  if (!_pubProximaSyncTs) {
    indicador.innerHTML = '⏰ Aguardando...';
    return;
  }
  const diffMs = _pubProximaSyncTs - Date.now();
  if (diffMs <= 0) { indicador.innerHTML = '⏰ Sincronizando...'; return; }
  const diffMin = Math.floor(diffMs / 60000);
  const diffSec = Math.floor((diffMs % 60000) / 1000);
  indicador.innerHTML = diffMin > 0
    ? `⏰ Próxima em ${diffMin}min`
    : `⏰ Próxima em ${diffSec}s`;
}

// =========================================================
// BUSCA MANUAL
// =========================================================
async function pubBuscarPublicacoes() {
  const oabs = oabGetAll().filter(o => o.ativo);
  if (oabs.length === 0) { showToast('⚠️ Nenhuma OAB configurada'); return; }
  const container = document.getElementById('pub-container');
  container.innerHTML = `<div class="pub-loading"><div class="pub-spinner"></div><div>Consultando DataJud...</div></div>`;
  const { novas, modificadas } = await pubSincronizar();
  if (pubTodasPublicacoes.length === 0) {
    container.innerHTML = `<div class="pub-empty"><div class="pub-empty-icon">🔍</div><div class="pub-empty-title">Nenhuma publicação encontrada</div></div>`;
    return;
  }
  pubFiltroAtivo = 'todos';
  pubCurrentPagePub = 1;
  document.querySelectorAll('.pub-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pub-filter-btn')?.classList.add('active');
  pubAplicarFiltros();
  const partes = [];
  if (novas > 0) partes.push(`${novas} nova(s)`);
  if (modificadas > 0) partes.push(`${modificadas} modificada(s)`);
  if (partes.length > 0) showToast(`✅ ${partes.join(' e ')} publicação(ões) encontrada(s)!`);
  else showToast('ℹ️ Nenhuma novidade.');
}

// =========================================================
// FILTROS E RENDERIZAÇÃO
// =========================================================
function pubAplicarFiltros() {
  const busca = (document.getElementById('pub-search')?.value || '').toLowerCase();
  pubPublicacoesFiltradas = pubTodasPublicacoes.filter(p => {
    const matchFiltro =
      pubFiltroAtivo === 'todos'     ? true :
      pubFiltroAtivo === 'nao_lida'  ? (!p.lida && !p.nova && !p.modificada) :
      pubFiltroAtivo === 'nova'      ? p.nova :
      pubFiltroAtivo === 'modificada'? p.modificada :
      pubFiltroAtivo === 'urgente'   ? p.urgente :
      pubFiltroAtivo === 'despacho'  ? p.tipo.toLowerCase().includes('despacho') :
      pubFiltroAtivo === 'decisao'   ? (p.tipo.toLowerCase().includes('decisão') || p.tipo.toLowerCase().includes('sentença')) :
      pubFiltroAtivo === 'audiencia' ? p.tipo.toLowerCase().includes('audiência') : true;
    const matchBusca = !busca || p.processo.toLowerCase().includes(busca) || p.clienteNome.toLowerCase().includes(busca);
    return matchFiltro && matchBusca;
  });
  pubCurrentPagePub = 1;
  pubRenderLista();
}

function pubFiltrar(filtro, btn) {
  pubFiltroAtivo = filtro;
  document.querySelectorAll('.pub-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pubAplicarFiltros();
}
function pubFiltrarBusca() { pubAplicarFiltros(); }

function pubRenderLista() {
  const container = document.getElementById('pub-container');
  if (!container) return;
  if (pubTodasPublicacoes.length === 0) {
    container.innerHTML = `<div class="pub-empty"><div class="pub-empty-icon">📋</div><div class="pub-empty-title">Nenhuma publicação</div><div class="pub-empty-sub">Clique em "Atualizar" para buscar.</div></div>`;
    return;
  }
  if (pubPublicacoesFiltradas.length === 0) {
    container.innerHTML = `<div class="pub-empty"><div class="pub-empty-icon">🔍</div><div class="pub-empty-title">Nenhuma publicação encontrada</div></div>`;
    return;
  }
  const totalPages = Math.ceil(pubPublicacoesFiltradas.length / pubPerPagePub);
  const start = (pubCurrentPagePub - 1) * pubPerPagePub;
  const slice = pubPublicacoesFiltradas.slice(start, start + pubPerPagePub);
  container.innerHTML = '<div class="pub-list">' + slice.map(p => pubRenderCard(p)).join('') + '</div>';
  const info = document.getElementById('pub-pag-info');
  if (info) info.textContent = `Mostrando ${start + 1}–${Math.min(start + pubPerPagePub, pubPublicacoesFiltradas.length)} de ${pubPublicacoesFiltradas.length}`;
  const pb = document.getElementById('pub-btn-prev'), nb = document.getElementById('pub-btn-next');
  if(pb) pb.disabled = pubCurrentPagePub <= 1;
  if(nb) nb.disabled = pubCurrentPagePub >= totalPages;
  document.getElementById('pub-pagination').style.display = pubPublicacoesFiltradas.length > pubPerPagePub ? 'flex' : 'none';
}

function pubRenderCard(p) {
  let statusClass, badge;
  if (p.nova) {
    statusClass = 'nao-lida';
    badge = '<span class="pub-badge pub-badge-novo">✨ Nova</span>';
  } else if (p.modificada && !p.lida) {
    statusClass = 'modificada';
    badge = '<span class="pub-badge pub-badge-modificada">🔄 Atualizada</span>';
  } else if (p.urgente && !p.lida) {
    statusClass = 'urgente';
    badge = '<span class="pub-badge pub-badge-urgente">🔴 Urgente</span>';
  } else if (!p.lida) {
    statusClass = 'nao-lida';
    badge = '<span class="pub-badge pub-badge-novo">Não lida</span>';
  } else {
    statusClass = 'lida';
    badge = '<span class="pub-badge pub-badge-lido">✓ Lida</span>';
  }

  const badgeUrgente = (p.urgente && !p.lida && !p.nova) ? '<span class="pub-badge pub-badge-urgente">🔴 Urgente</span>' : '';

  return `<div class="pub-card ${statusClass}" onclick="pubAbrirDetalhe('${p.id}')">
    <div class="pub-card-top">
      <div>
        <div class="pub-card-proc">📄 ${p.processo}</div>
        <div class="pub-card-cliente">${p.clienteNome}</div>
      </div>
      <div class="pub-card-date">${p.dataPublicacaoFmt}</div>
    </div>
    <div class="pub-card-resumo">${p.movimento}</div>
    <div class="pub-card-footer">${badge}${badgeUrgente}<span class="pub-badge pub-badge-tipo">${p.tipo}</span></div>
  </div>`;
}

function pubAbrirDetalhe(id) {
  const pub = pubTodasPublicacoes.find(p => p.id === id);
  if (!pub) return;
  const eraNovaOuModificada = pub.nova || pub.modificada;
  pub.lida = true;
  pub.nova = false;
  pub.modificada = false;
  pubDetalheAtual = pub;
  // Salva o hash como "visto" para esta publicação
  pubSaveSeenHash(id, pubGerarHash(pub));
  pubSalvarStorage();
  pubAplicarFiltros();
  pubAtualizarStats();
  const body = document.getElementById('pub-detail-body');
  body.innerHTML = `<div style="padding:20px;">
    <div class="pub-detail-section"><div class="pub-detail-label">Processo</div><div class="pub-detail-value">${pub.processo}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Cliente</div><div class="pub-detail-value">${pub.clienteNome}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Tribunal</div><div class="pub-detail-value">${pub.tribunal || '—'}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Órgão Julgador</div><div class="pub-detail-value">${pub.orgaoJulgador || '—'}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Tipo</div><div class="pub-detail-value">${pub.tipo}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Data de Publicação</div><div class="pub-detail-value">${pub.dataPublicacaoFmt}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Movimentação</div><div class="pub-detail-value" style="white-space:pre-wrap;">${pub.movimento}</div></div>
    ${eraNovaOuModificada ? '<div style="margin-top:12px;padding:8px 12px;background:var(--accent-light,#f0f4ff);border-radius:6px;font-size:12px;color:var(--accent,#6c7bff);">📌 Marcada como lida agora</div>' : ''}
  </div>`;
  openModal('modal-pub-detail');
}

function pubAbrirNoDataJud() { if(pubDetalheAtual) window.open(pubDetalheAtual.url, '_blank'); }

// =========================================================
// ESTATÍSTICAS (com modificadas)
// =========================================================
function pubAtualizarStats() {
  const total      = pubTodasPublicacoes.length;
  const novas      = pubTodasPublicacoes.filter(p => p.nova).length;
  const modificadas= pubTodasPublicacoes.filter(p => p.modificada && !p.lida).length;
  const naoLidas   = pubTodasPublicacoes.filter(p => !p.lida).length;
  const urgentes   = pubTodasPublicacoes.filter(p => p.urgente && !p.lida).length;
  const procs      = new Set(pubTodasPublicacoes.map(p => p.processo)).size;
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('pub-stat-total',     total      || '—');
  setEl('pub-stat-novas',     novas      || '0');
  setEl('pub-stat-modificadas', modificadas || '0');
  setEl('pub-stat-nao-lidas', naoLidas   || '—');
  setEl('pub-stat-urgentes',  urgentes   || '—');
  setEl('pub-stat-procs',     procs      || '—');

  // Badge na aba de navegação
  const navBtn = document.getElementById('nav-publicacoes');
  const totalPendente = novas + modificadas;
  if (navBtn) {
    navBtn.innerHTML = totalPendente > 0
      ? `📋 Publicações <span class="nav-badge">${totalPendente}</span>`
      : '📋 Publicações';
  }

  // Atualiza o filtro de "modificadas" na barra de filtros
  _pubAtualizarBotaoFiltroModificadas(modificadas);
}

function _pubAtualizarBotaoFiltroModificadas(qtd) {
  const btn = document.getElementById('pub-filtro-modificada-btn');
  if (!btn) return;
  btn.innerHTML = qtd > 0
    ? `🔄 Atualizadas <span class="pub-badge-count">${qtd}</span>`
    : '🔄 Atualizadas';
  btn.style.display = qtd > 0 ? '' : '';
}

function pubMarcarTodasLidas() {
  pubTodasPublicacoes.forEach(p => { p.lida = true; p.nova = false; p.modificada = false; });
  pubSalvarStorage();
  pubAplicarFiltros();
  pubAtualizarStats();
  showToast('✓ Todas marcadas como lidas');
}

function pubChangePage(delta) {
  const total = Math.ceil(pubPublicacoesFiltradas.length / pubPerPagePub);
  pubCurrentPagePub = Math.max(1, Math.min(total, pubCurrentPagePub + delta));
  pubRenderLista();
}

// =========================================================
// ADMIN — OABs
// =========================================================
function pubPreencherOabsNoModulo() {
  const oabs = oabGetAll().filter(o => o.ativo);
  const infoEl = document.getElementById('pub-oab-sub-info');
  if(infoEl) {
    if(oabs.length === 0) infoEl.innerHTML = '⚠️ Nenhuma OAB configurada. Acesse Admin → OABs / DataJud';
    else infoEl.innerHTML = `Monitorando: ${oabs.map(o => `<strong>OAB ${o.numero}/${o.uf}</strong>`).join(', ')}`;
  }
}

function adminRenderOabList() {
  const container = document.getElementById('admin-oab-list');
  if(!container) return;
  const oabs = oabGetAll();
  if(oabs.length === 0) { container.innerHTML = '<div style="padding:24px;text-align:center;">Nenhuma OAB cadastrada</div>'; return; }
  container.innerHTML = oabs.map(o => `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);"><div><strong>${o.nome}</strong><br><span style="font-size:11px;">OAB ${o.numero}/${o.uf}</span></div><div><span class="tag ${o.ativo ? 'tag-green' : 'tag-red'}">${o.ativo ? 'Ativa' : 'Inativa'}</span> <button class="btn btn-secondary btn-sm" onclick="adminOabOpenModal(${o.id})">Editar</button> <button class="btn btn-danger btn-sm" onclick="adminOabDelete(${o.id})">Excluir</button></div></div>`).join('');
}

function adminOabOpenModal(id=null) {
  pubEditingOabId = id;
  const oab = id ? oabGetAll().find(o=>o.id===id) : null;
  document.getElementById('oab-modal-title').textContent = id ? '✏️ Editar OAB' : '📋 Nova OAB';
  document.getElementById('oab-numero').value  = oab?.numero  || '';
  document.getElementById('oab-uf').value      = oab?.uf      || 'AL';
  document.getElementById('oab-nome').value    = oab?.nome    || '';
  document.getElementById('oab-tribunal').value= oab?.tribunal|| 'trt19';
  document.getElementById('oab-ativo').value   = oab?.ativo !== false ? '1' : '0';
  openModal('modal-oab');
}

function adminSalvarOab() {
  const numero   = document.getElementById('oab-numero').value.trim();
  const uf       = document.getElementById('oab-uf').value;
  const nome     = document.getElementById('oab-nome').value.trim();
  const tribunal = document.getElementById('oab-tribunal').value;
  const ativo    = document.getElementById('oab-ativo').value === '1';
  if(!numero || !nome) { showToast('Preencha número e nome'); return; }
  const oabs = oabGetAll();
  if(pubEditingOabId) {
    const idx = oabs.findIndex(o=>o.id===pubEditingOabId);
    if(idx>=0) oabs[idx] = {...oabs[idx], numero, uf, nome, tribunal, ativo};
  } else {
    oabs.push({ id: Date.now(), numero, uf, nome, tribunal, ativo, criadaEm: new Date().toISOString() });
  }
  oabSaveAll(oabs);
  closeModal('modal-oab');
  adminRenderOabList();
  pubPreencherOabsNoModulo();
  showToast(`OAB ${numero}/${uf} ${pubEditingOabId ? 'atualizada' : 'cadastrada'}`);
  logAddPub(`OAB ${numero}/${uf} ${pubEditingOabId ? 'editada' : 'cadastrada'}`, 'info');
}

function adminOabDelete(id) {
  if(!confirm('Excluir esta OAB?')) return;
  const oabs = oabGetAll().filter(o=>o.id!==id);
  oabSaveAll(oabs);
  adminRenderOabList();
  pubPreencherOabsNoModulo();
  showToast('OAB removida');
}

// =========================================================
// ADMIN — Configurações
// =========================================================
function adminSalvarConfigPub() {
  const cfg = {
    horario:         document.getElementById('admin-pub-horario')?.value || '08:00',
    intervalMinutos: parseInt(document.getElementById('admin-pub-interval')?.value || '30'),
    autoSyncAtivo:   document.getElementById('admin-pub-auto-sync')?.checked !== false,
    notifUrgentes:   document.getElementById('admin-pub-notif-urgentes')?.checked !== false,
    notifTodas:      document.getElementById('admin-pub-notif-todas')?.checked === true,
    ultimaSync:      cfgGetPub().ultimaSync
  };
  cfgSavePub(cfg);
  showToast('✅ Configurações salvas');
  adminRenderSyncStatus();
  // Reinicia o auto-sync com o novo intervalo
  iniciarAutoSyncDiario();
}

async function adminForceSyncPub() {
  const oabs = oabGetAll().filter(o=>o.ativo);
  if(oabs.length===0) { showToast('⚠️ Nenhuma OAB ativa'); return; }
  showToast('🔄 Sincronizando...');
  const { novas, modificadas } = await pubSincronizar();
  const partes = [];
  if (novas > 0) partes.push(`${novas} nova(s)`);
  if (modificadas > 0) partes.push(`${modificadas} modificada(s)`);
  showToast(partes.length > 0 ? `✅ ${partes.join(' e ')} publicação(ões)!` : '✅ Nenhuma novidade.');
  pubRenderLista();
  // Reinicia o timer do auto-sync
  iniciarAutoSyncDiario();
}

function adminLimparLog() { localStorage.removeItem(LOG_STORAGE_KEY); renderAdminLog(); }

function renderAdminLog() {
  const container = document.getElementById('admin-pub-log');
  if(!container) return;
  const log = logGetPub();
  if(log.length===0) { container.innerHTML = '<div style="padding:20px;text-align:center;">Nenhuma atividade</div>'; return; }
  const corTipo = { info:'#6c7bff', success:'#22c55e', warn:'#f97316', error:'#ef4444' };
  container.innerHTML = log.map(l => `<div style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:${corTipo[l.tipo]||'#888'};margin-right:6px;">●</span>${l.fmt} — ${l.msg}</div>`).join('');
}

function adminRenderSyncStatus() {
  const ultima = getLastSyncPub();
  const cfg    = cfgGetPub();
  const elUltima  = document.getElementById('admin-pub-ultima-sync');
  const elProxima = document.getElementById('admin-pub-proxima-sync');
  const elStatus  = document.getElementById('admin-pub-sync-status');
  if(elUltima)  elUltima.textContent  = ultima ? new Date(ultima).toLocaleString('pt-BR') : 'Nunca';
  if(elStatus)  elStatus.textContent  = cfg.autoSyncAtivo ? `🟢 Ativo — a cada ${cfg.intervalMinutos || 30} min` : '🔴 Desativado';
  if(elProxima && _pubProximaSyncTs) {
    elProxima.textContent = new Date(_pubProximaSyncTs).toLocaleString('pt-BR');
  } else if(elProxima) {
    elProxima.textContent = cfg.autoSyncAtivo ? '—' : 'Desativado';
  }
}

function adminCarregarConfigPub() {
  const cfg = cfgGetPub();
  const h   = document.getElementById('admin-pub-horario');
  const iv  = document.getElementById('admin-pub-interval');
  const as  = document.getElementById('admin-pub-auto-sync');
  const nu  = document.getElementById('admin-pub-notif-urgentes');
  const nt  = document.getElementById('admin-pub-notif-todas');
  if(h)  h.value    = cfg.horario;
  if(iv) iv.value   = cfg.intervalMinutos || 30;
  if(as) as.checked = cfg.autoSyncAtivo !== false;
  if(nu) nu.checked = cfg.notifUrgentes;
  if(nt) nt.checked = cfg.notifTodas;
  adminRenderSyncStatus();
}
