// ========== MÓDULO PUBLICAÇÕES (MANTIDO ORIGINAL) ==========
let pubTodasPublicacoes = [];
let pubPublicacoesFiltradas = [];
let pubCurrentPagePub = 1;
const pubPerPagePub = 8;
let pubFiltroAtivo = 'todos';
let pubDetalheAtual = null;
let pubEditingOabId = null;

const PUB_STORAGE_KEY = 'advboard_publicacoes';
const OAB_STORAGE_KEY = 'advboard_oabs';
const CFG_STORAGE_KEY = 'advboard_pub_config';
const LOG_STORAGE_KEY = 'advboard_pub_log';
const SYNC_KEY = 'advboard_last_sync';

const pubTiposUrgentes = ['despacho', 'decisão', 'sentença', 'acórdão', 'audiência', 'prazo', 'penhora', 'arresto', 'bloqueio'];

function pubSalvarStorage() {
  try { localStorage.setItem(PUB_STORAGE_KEY, JSON.stringify(pubTodasPublicacoes)); } catch(e){}
  // Sincroniza publicações no Firebase
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
    return Object.assign({ horario: '08:00', notifUrgentes: true, notifTodas: false, ultimaSync: null }, JSON.parse(localStorage.getItem(CFG_STORAGE_KEY) || '{}'));
  } catch(e){ return { horario: '08:00', notifUrgentes: true, notifTodas: false }; }
}
function cfgSavePub(cfg) { try { localStorage.setItem(CFG_STORAGE_KEY, JSON.stringify(cfg)); } catch(e){} }
function logGetPub() { try { return JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch(e){ return []; } }
function logAddPub(msg, tipo='info') {
  const log = logGetPub();
  const now = new Date();
  log.unshift({ ts: now.toISOString(), msg, tipo, fmt: now.toLocaleString('pt-BR') });
  if(log.length > 50) log.splice(50);
  try { localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log)); } catch(e){}
  renderAdminLog();
}
function setLastSyncPub() { const cfg = cfgGetPub(); cfg.ultimaSync = new Date().toISOString(); cfgSavePub(cfg); }
function getLastSyncPub() { const cfg = cfgGetPub(); return cfg.ultimaSync || null; }

function pubGerarDadosMock(oabs, periodoOverride = 30) {
  const tipos = ['Despacho', 'Decisão Interlocutória', 'Sentença', 'Audiência Designada', 'Juntada de Petição', 'Publicação de Pauta', 'Certidão', 'Despacho de Mero Expediente'];
  const tribunaisMap = { 'trt19':'TRT-19 (AL)', 'trt6':'TRT-6 (PE)', 'trt5':'TRT-5 (BA)', 'tst':'TST', 'tjal':'TJAL', 'trf5':'TRF-5' };
  const varas = ['1ª Vara do Trabalho', '2ª Vara do Trabalho', '3ª Vara do Trabalho', '4ª Vara do Trabalho'];
  const movimentos = [
    'Conclusão ao Juiz para Despacho. Os autos conclusos para o MM. Juiz(a) para despacho ordinário.',
    'Audiência Inaugural designada. Fica intimado(a) o(a) reclamante para comparecer à audiência inaugural.',
    'Decisão: Defiro a antecipação dos efeitos da tutela pleiteada. Intime-se.',
    'Sentença: Julgo procedente em parte o pedido formulado na inicial.'
  ];

  const procsComNumero = processos.filter(p => p.proc && p.proc !== 'Sem nº');
  const novasPublicacoes = [];
  const hoje = new Date();
  const idsExistentes = new Set(pubTodasPublicacoes.map(p => p.id));

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
        const id = `pub_${proc.id}_${oab.id}_${diasAtras}_${i}_${Date.now()}_${novasPublicacoes.length}`;
        if (!idsExistentes.has(id) && diasAtras < periodoOverride) {
          novasPublicacoes.push({
            id, processo: proc.proc, clienteNome: proc.clienteNome, tipo, tribunal: tribunalNome,
            orgaoJulgador: varas[Math.floor(Math.random() * varas.length)],
            dataPublicacao: dataPubl.toISOString(),
            dataPublicacaoFmt: dataPubl.toLocaleDateString('pt-BR'),
            movimento, lida: false, urgente: isUrgente, procId: proc.id, oabId: oab.id, nova: true,
            url: `https://datajud.cnj.jus.br/consulta?numero=${encodeURIComponent(proc.proc)}`
          });
        }
      }
    });
  });
  novasPublicacoes.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));
  return novasPublicacoes;
}

async function pubSincronizar(forcar = false) {
  const oabs = oabGetAll().filter(o => o.ativo);
  if (oabs.length === 0) {
    logAddPub('Nenhuma OAB ativa configurada.', 'warn');
    return 0;
  }
  logAddPub(`🔄 Iniciando sincronização para ${oabs.length} OAB(s)...`, 'info');
  await new Promise(r => setTimeout(r, 500));
  const periodo = parseInt(document.getElementById('pub-periodo')?.value || '30');
  const novas = pubGerarDadosMock(oabs, periodo);
  const qtdNovas = novas.length;
  if (qtdNovas > 0) {
    const existentes = pubTodasPublicacoes.map(p => ({ ...p, nova: false }));
    pubTodasPublicacoes = [...novas, ...existentes];
    const seen = new Set();
    pubTodasPublicacoes = pubTodasPublicacoes.filter(p => { if(seen.has(p.id)) return false; seen.add(p.id); return true; });
    pubSalvarStorage();
    const cfg = cfgGetPub();
    if (cfg.notifTodas) {
      novas.slice(0, 3).forEach(p => {
        notifications.unshift({ id: Date.now() + Math.random(), text: `📋 ${p.tipo}: ${p.clienteNome}`, from: 'DataJud', time: 'Agora', unread: true });
      });
    } else if (cfg.notifUrgentes) {
      const urgentes = novas.filter(p => p.urgente);
      urgentes.slice(0, 3).forEach(p => {
        notifications.unshift({ id: Date.now() + Math.random(), text: `🔴 Urgente: ${p.tipo} — ${p.clienteNome}`, from: 'DataJud', time: 'Agora', unread: true });
      });
    }
    updateNotifBadge();
    logAddPub(`✅ ${qtdNovas} nova(s) publicação(ões) encontrada(s).`, 'success');
  } else {
    logAddPub(`ℹ️ Nenhuma publicação nova encontrada.`, 'info');
  }
  setLastSyncPub();
  adminRenderSyncStatus();
  pubAtualizarStats();
  return qtdNovas;
}

function iniciarAutoSyncDiario() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(() => {
    const cfg = cfgGetPub();
    const agora = new Date();
    const [horaAlvo, minutoAlvo] = cfg.horario.split(':').map(Number);
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    if (horaAtual === horaAlvo && minutoAtual === minutoAlvo) {
      const ultimaSync = getLastSyncPub();
      if (ultimaSync) {
        const ultimaData = new Date(ultimaSync);
        if (ultimaData.getDate() === agora.getDate() && ultimaData.getHours() === horaAlvo) return;
      }
      pubSincronizar();
    }
    atualizarIndicadorSync();
  }, 60000);
  atualizarIndicadorSync();
}

function atualizarIndicadorSync() {
  const indicador = document.getElementById('auto-sync-indicator');
  if (!indicador) return;
  const cfg = cfgGetPub();
  const agora = new Date();
  const [hora, minuto] = cfg.horario.split(':').map(Number);
  const proxima = new Date(agora);
  proxima.setHours(hora, minuto, 0, 0);
  if (agora >= proxima) proxima.setDate(proxima.getDate() + 1);
  const diffMs = proxima - agora;
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  indicador.innerHTML = diffHoras > 0 ? `⏰ Próxima em ${diffHoras}h ${diffMinutos}min` : (diffMinutos > 0 ? `⏰ Próxima em ${diffMinutos}min` : `⏰ Sincronizando...`);
}

async function pubBuscarPublicacoes() {
  const oabs = oabGetAll().filter(o => o.ativo);
  if (oabs.length === 0) { showToast('⚠️ Nenhuma OAB configurada'); return; }
  const container = document.getElementById('pub-container');
  container.innerHTML = `<div class="pub-loading"><div class="pub-spinner"></div><div>Consultando DataJud...</div></div>`;
  await pubSincronizar();
  if (pubTodasPublicacoes.length === 0) {
    container.innerHTML = `<div class="pub-empty"><div class="pub-empty-icon">🔍</div><div class="pub-empty-title">Nenhuma publicação encontrada</div></div>`;
    return;
  }
  pubFiltroAtivo = 'todos';
  pubCurrentPagePub = 1;
  document.querySelectorAll('.pub-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pub-filter-btn')?.classList.add('active');
  pubAplicarFiltros();
}

function pubAplicarFiltros() {
  const busca = (document.getElementById('pub-search')?.value || '').toLowerCase();
  pubPublicacoesFiltradas = pubTodasPublicacoes.filter(p => {
    const matchFiltro = pubFiltroAtivo === 'todos' ? true :
      pubFiltroAtivo === 'nao_lida' ? !p.lida :
      pubFiltroAtivo === 'nova' ? p.nova :
      pubFiltroAtivo === 'urgente' ? p.urgente :
      pubFiltroAtivo === 'despacho' ? p.tipo.toLowerCase().includes('despacho') :
      pubFiltroAtivo === 'decisao' ? (p.tipo.toLowerCase().includes('decisão') || p.tipo.toLowerCase().includes('sentença')) :
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
  const statusClass = p.nova ? 'nao-lida' : (!p.lida ? (p.urgente ? 'urgente' : 'nao-lida') : 'lida');
  const badge = p.nova ? '<span class="pub-badge pub-badge-novo">✨ Nova</span>' : (!p.lida ? (p.urgente ? '<span class="pub-badge pub-badge-urgente">🔴 Urgente</span>' : '<span class="pub-badge pub-badge-novo">Não lida</span>') : '<span class="pub-badge pub-badge-lido">✓ Lida</span>');
  return `<div class="pub-card ${statusClass}" onclick="pubAbrirDetalhe('${p.id}')">
    <div class="pub-card-top"><div><div class="pub-card-proc">📄 ${p.processo}</div><div class="pub-card-cliente">${p.clienteNome}</div></div><div class="pub-card-date">${p.dataPublicacaoFmt}</div></div>
    <div class="pub-card-resumo">${p.movimento}</div>
    <div class="pub-card-footer">${badge}<span class="pub-badge pub-badge-tipo">${p.tipo}</span></div>
  </div>`;
}

function pubAbrirDetalhe(id) {
  const pub = pubTodasPublicacoes.find(p => p.id === id);
  if (!pub) return;
  pub.lida = true; pub.nova = false;
  pubDetalheAtual = pub;
  pubSalvarStorage();
  pubAplicarFiltros();
  pubAtualizarStats();
  const body = document.getElementById('pub-detail-body');
  body.innerHTML = `<div style="padding:20px;"><div class="pub-detail-section"><div class="pub-detail-label">Processo</div><div class="pub-detail-value">${pub.processo}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Cliente</div><div class="pub-detail-value">${pub.clienteNome}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Data</div><div class="pub-detail-value">${pub.dataPublicacaoFmt}</div></div>
    <div class="pub-detail-section"><div class="pub-detail-label">Movimentação</div><div class="pub-detail-value">${pub.movimento}</div></div></div>`;
  openModal('modal-pub-detail');
}
function pubAbrirNoDataJud() { if(pubDetalheAtual) window.open(pubDetalheAtual.url, '_blank'); }

function pubAtualizarStats() {
  const total = pubTodasPublicacoes.length;
  const novas = pubTodasPublicacoes.filter(p => p.nova).length;
  const naoLidas = pubTodasPublicacoes.filter(p => !p.lida).length;
  const urgentes = pubTodasPublicacoes.filter(p => p.urgente && !p.lida).length;
  const procs = new Set(pubTodasPublicacoes.map(p => p.processo)).size;
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('pub-stat-total', total || '—');
  setEl('pub-stat-novas', novas || '0');
  setEl('pub-stat-nao-lidas', naoLidas || '—');
  setEl('pub-stat-urgentes', urgentes || '—');
  setEl('pub-stat-procs', procs || '—');
  const navBtn = document.getElementById('nav-publicacoes');
  if(navBtn) navBtn.textContent = (novas > 0 || naoLidas > 0) ? `📋 Publicações (${novas || naoLidas})` : '📋 Publicações';
}

function pubMarcarTodasLidas() {
  pubTodasPublicacoes.forEach(p => { p.lida = true; p.nova = false; });
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
  document.getElementById('oab-numero').value = oab?.numero || '';
  document.getElementById('oab-uf').value = oab?.uf || 'AL';
  document.getElementById('oab-nome').value = oab?.nome || '';
  document.getElementById('oab-tribunal').value = oab?.tribunal || 'trt19';
  document.getElementById('oab-ativo').value = oab?.ativo !== false ? '1' : '0';
  openModal('modal-oab');
}

function adminSalvarOab() {
  const numero = document.getElementById('oab-numero').value.trim();
  const uf = document.getElementById('oab-uf').value;
  const nome = document.getElementById('oab-nome').value.trim();
  const tribunal = document.getElementById('oab-tribunal').value;
  const ativo = document.getElementById('oab-ativo').value === '1';
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

function adminSalvarConfigPub() {
  const cfg = {
    horario: document.getElementById('admin-pub-horario')?.value || '08:00',
    notifUrgentes: document.getElementById('admin-pub-notif-urgentes')?.checked !== false,
    notifTodas: document.getElementById('admin-pub-notif-todas')?.checked === true,
    ultimaSync: cfgGetPub().ultimaSync
  };
  cfgSavePub(cfg);
  showToast('✅ Configurações salvas');
  adminRenderSyncStatus();
  atualizarIndicadorSync();
}

async function adminForceSyncPub() {
  const oabs = oabGetAll().filter(o=>o.ativo);
  if(oabs.length===0) { showToast('⚠️ Nenhuma OAB ativa'); return; }
  showToast('🔄 Sincronizando...');
  await pubSincronizar();
  showToast('✅ Sincronização concluída');
  pubRenderLista();
}

function adminLimparLog() { localStorage.removeItem(LOG_STORAGE_KEY); renderAdminLog(); }
function renderAdminLog() {
  const container = document.getElementById('admin-pub-log');
  if(!container) return;
  const log = logGetPub();
  if(log.length===0) { container.innerHTML = '<div style="padding:20px;text-align:center;">Nenhuma atividade</div>'; return; }
  container.innerHTML = log.map(l => `<div style="padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">${l.fmt} — ${l.msg}</div>`).join('');
}
function adminRenderSyncStatus() {
  const ultima = getLastSyncPub();
  const cfg = cfgGetPub();
  const elUltima = document.getElementById('admin-pub-ultima-sync');
  const elProxima = document.getElementById('admin-pub-proxima-sync');
  if(elUltima) elUltima.textContent = ultima ? new Date(ultima).toLocaleString('pt-BR') : 'Nunca';
  if(elProxima) {
    const agora = new Date();
    const [hora, minuto] = cfg.horario.split(':').map(Number);
    const proxima = new Date(agora);
    proxima.setHours(hora, minuto, 0, 0);
    if(agora >= proxima) proxima.setDate(proxima.getDate() + 1);
    elProxima.textContent = proxima.toLocaleString('pt-BR');
  }
}
function adminCarregarConfigPub() {
  const cfg = cfgGetPub();
  const h = document.getElementById('admin-pub-horario');
  const nu = document.getElementById('admin-pub-notif-urgentes');
  const nt = document.getElementById('admin-pub-notif-todas');
  if(h) h.value = cfg.horario;
  if(nu) nu.checked = cfg.notifUrgentes;
  if(nt) nt.checked = cfg.notifTodas;
  adminRenderSyncStatus();
}

