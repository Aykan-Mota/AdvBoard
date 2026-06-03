// Cache local para fallback caso Firebase não esteja disponível
function _localSave(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){} }
function _localLoad(key, def) { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : def; } catch(e) { return def; } }

// Debounce para evitar muitas gravações simultâneas
let _saveTimer = null;
function salvarDados() {
  // Salva localmente como backup imediato
  _localSave('advboard_processos', processos);
  _localSave('advboard_clientes', clientes);
  _localSave('advboard_usuarios', usuarios);
  _localSave('advboard_setores', setores);
  _localSave('advboard_notifications', notifications);
  _localSave('advboard_events', calendarEvents);

  // Salva no Firebase com debounce de 800ms
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (!window._firebaseReady || !window._firestore) {
      console.warn('Firebase não pronto, dados salvos apenas localmente.');
      return;
    }
    try {
      const db = window._firestore;
      const docRef = window._firestoreDoc(db, 'advboard', 'dados');
      await window._firestoreSetDoc(docRef, {
        processos: JSON.stringify(processos),
        clientes: JSON.stringify(clientes),
        usuarios: JSON.stringify(usuarios),
        setores: JSON.stringify(setores),
        notifications: JSON.stringify(notifications),
        calendarEvents: JSON.stringify(calendarEvents),
        updatedAt: new Date().toISOString()
      });
      // Pequeno indicador visual de sincronizado
      const ind = document.getElementById('sync-status-indicator');
      if (ind) { ind.textContent = '☁️ Sincronizado'; ind.style.color = 'var(--success, #4ade80)'; }
    } catch(e) {
      console.error('Erro ao salvar no Firebase:', e);
      const ind = document.getElementById('sync-status-indicator');
      if (ind) { ind.textContent = '⚠️ Offline'; ind.style.color = 'var(--warning, #facc15)'; }
    }
  }, 800);
}

async function carregarDados() {
  // Primeiro carrega do cache local para exibir algo imediatamente
  const procLocal = _localLoad('advboard_processos', null);
  const cliLocal  = _localLoad('advboard_clientes', null);
  const usuLocal  = _localLoad('advboard_usuarios', null);
  const setLocal  = _localLoad('advboard_setores', null);
  const notLocal  = _localLoad('advboard_notifications', null);
  const evtLocal  = _localLoad('advboard_events', null);

  if (procLocal) processos = procLocal;
  if (cliLocal)  clientes  = cliLocal;
  if (usuLocal)  usuarios  = usuLocal;
  if (setLocal)  setores   = setLocal;
  if (notLocal)  notifications = notLocal;
  if (evtLocal)  calendarEvents = evtLocal;

  // Depois carrega do Firebase (fonte da verdade)
  if (!window._firebaseReady || !window._firestore) {
    // Firebase ainda não carregou, aguarda o evento
    await new Promise(resolve => {
      if (window._firebaseReady) { resolve(); return; }
      window.addEventListener('firebase-ready', resolve, { once: true });
      setTimeout(resolve, 5000); // timeout de 5s para não travar
    });
  }

  if (!window._firestore) {
    console.warn('Firebase indisponível, usando dados locais.');
    return;
  }

  try {
    const db = window._firestore;
    const docRef = window._firestoreDoc(db, 'advboard', 'dados');
    const snap = await window._firestoreGetDoc(docRef);
    if (snap.exists()) {
      const d = snap.data();
      if (d.processos)      processos      = JSON.parse(d.processos);
      if (d.clientes)       clientes       = JSON.parse(d.clientes);
      if (d.usuarios)       usuarios       = JSON.parse(d.usuarios);
      if (d.setores)        setores        = JSON.parse(d.setores);
      if (d.notifications)  notifications  = JSON.parse(d.notifications);
      if (d.calendarEvents) calendarEvents = JSON.parse(d.calendarEvents);

      // Atualiza cache local com dados do servidor
      _localSave('advboard_processos', processos);
      _localSave('advboard_clientes', clientes);
      _localSave('advboard_usuarios', usuarios);
      _localSave('advboard_setores', setores);
      _localSave('advboard_notifications', notifications);
      _localSave('advboard_events', calendarEvents);

      console.log('✅ Dados carregados do Firebase. Última atualização:', d.updatedAt);
    }

    // Escuta atualizações em tempo real de outras máquinas
    window._firestoreOnSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const d = docSnap.data();
      let changed = false;
      if (d.processos)      { processos      = JSON.parse(d.processos);      changed = true; }
      if (d.clientes)       { clientes       = JSON.parse(d.clientes);       changed = true; }
      if (d.setores)        { setores        = JSON.parse(d.setores);        changed = true; }
      if (d.notifications)  { notifications  = JSON.parse(d.notifications);  changed = true; }
      if (d.calendarEvents) { calendarEvents = JSON.parse(d.calendarEvents); changed = true; }
      // Usuários só atualiza se não houver usuário logado ainda (evita deslogar)
      if (d.usuarios && !window.currentUser) { usuarios = JSON.parse(d.usuarios); }

      if (changed) {
        // Re-renderiza as views abertas
        if (typeof renderKanban === 'function') renderKanban();
        if (typeof renderProcessos === 'function') renderProcessos();
        if (typeof renderClientes === 'function') renderClientes();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof updateNotifBadge === 'function') updateNotifBadge();
        const ind = document.getElementById('sync-status-indicator');
        if (ind) { ind.textContent = '☁️ Atualizado'; ind.style.color = 'var(--success, #4ade80)'; }
      }
    });

  } catch(e) {
    console.error('Erro ao carregar dados do Firebase:', e);
    console.warn('Usando dados do cache local.');
  }
}
