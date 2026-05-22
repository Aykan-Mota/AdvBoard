async function initSystem() {
  // Mostra tela de carregamento enquanto busca dados do Firebase
  const loginEl = document.getElementById('login-screen');
  if (loginEl) {
    const loadMsg = document.createElement('div');
    loadMsg.id = 'firebase-loading-msg';
    loadMsg.style.cssText = 'position:fixed;inset:0;background:var(--bg1,#0f1117);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;color:var(--text1,#fff);gap:12px;font-size:15px;';
    loadMsg.innerHTML = '<div style="font-size:32px">☁️</div><div>Conectando ao servidor...</div>';
    document.body.appendChild(loadMsg);
  }

  await carregarDados();

  const loadEl = document.getElementById('firebase-loading-msg');
  if (loadEl) loadEl.remove();

  if (processos.length === 0) {
    const clientesMap = new Map();
    processosOriginais.forEach(p => {
      if (!clientesMap.has(p.clienteNome)) {
        clientesMap.set(p.clienteNome, { 
          id: clientesMap.size+1, 
          nome: p.clienteNome, 
          cpf: '', 
          telefone: '(00) 0000-0000', 
          email: 'cliente@exemplo.com', 
          endereco: '', 
          nascimento: '',
          history: [] 
        });
      }
    });
    clientes = Array.from(clientesMap.values());
    processos = processosOriginais.map(p => ({ ...p, clienteId: clientes.find(c => c.nome === p.clienteNome)?.id || 0, history: p.history || [] }));
  }

  if (usuarios.length === 0) {
    usuarios = [
      // ATENÇÃO: senhas removidas por segurança.
      // Gerencie usuários pelo painel Admin > Usuários após o primeiro login.
      { id:1, nome:'renataporto2@gmail.com', senha:'', setorId:1, nomeExibicao:'Renata Porto', iniciais:'RP' },
      { id:2, nome:'drielle@advboard.com', senha:'', setorId:1, nomeExibicao:'Dra. Drielle', iniciais:'DD' },
      { id:3, nome:'andrey@advboard.com', senha:'', setorId:2, nomeExibicao:'Dr. Andrey', iniciais:'DA' },
      { id:4, nome:'carlos@advboard.com', senha:'', setorId:3, nomeExibicao:'Carlos', iniciais:'CL' },
      { id:5, nome:'ana@advboard.com', senha:'', setorId:4, nomeExibicao:'Ana', iniciais:'AN' }
    ];
  }

  if (setores.length === 0) {
    setores = [
      { id:1, nome:'Gestor', permissoes:['dashboard','kanban','processos','clientes','agenda','relatorios','admin','publicacoes'] },
      { id:2, nome:'Advogado', permissoes:['dashboard','kanban','processos','clientes','agenda','relatorios','publicacoes'] },
      { id:3, nome:'Calculista', permissoes:['dashboard','kanban','processos','clientes','agenda','publicacoes'] },
      { id:4, nome:'Atendimento', permissoes:['dashboard','processos','clientes'] }
    ];
  }

  if (notifications.length === 0) {
    notifications = [
      { id:1, text:'Acordo homologado - Claudinete Ferreira (71 parcelas)', from:'Sistema', time:'Hoje', unread:true },
      { id:2, text:'Audiência de Josenilton Nascimento é amanhã', from:'Sistema', time:'Hoje', unread:true }
    ];
  }

  syncCalendarFromProcesses();
  salvarDados();

  // =====================================================
  // 🔐 CONFIGURAR FIREBASE AUTH
  // =====================================================

  // Observa mudanças de autenticação
  if (window._firebaseOnAuthStateChanged) {
    window._firebaseOnAuthStateChanged(async (user) => {
      if (user) {
        // Usuário autenticado: finaliza o login na interface
        const btnLogin = document.querySelector('.btn-login');
        if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Entrar'; }
        _finalizarLogin(user.email);
      } else {
        // Usuário deslogado: garante que a tela de login está visível
        if (currentUser) {
          currentUser = null;
          currentRole = null;
          document.getElementById('login-screen').style.display = 'flex';
          document.getElementById('app').style.display = 'none';
        }
      }
    });

    // Provisionar usuários no Firebase Auth (primeira execução)
    // Tenta criar cada usuário; se já existir, ignora silenciosamente
    _provisionarUsuariosFirebase();
  }
}

async function _provisionarUsuariosFirebase() {
  // Verifica se já foi provisionado (salva flag no Firestore)
  if (!window._firebaseReady || !window._firestore) return;
  try {
    const db = window._firestore;
    const flagRef = window._firestoreDoc(db, 'advboard', 'authProvisioned');
    const flagSnap = await window._firestoreGetDoc(flagRef);
    if (flagSnap.exists()) return; // Já provisionado

    // Lê credenciais do arquivo local credentials.js (não versionado no git).
    // Se o arquivo não existir, pula a criação e usa o Firebase Console.
    const usersToCreate = window._ADVBOARD_CREDENTIALS || [];

    for (const u of usersToCreate) {
      try {
        await window._firebaseCreateUser(u.email, u.password);
        console.log(`✅ Usuário criado no Firebase Auth: ${u.email}`);
      } catch(e) {
        // Ignora se usuário já existe (auth/email-already-in-use)
        if (e.code !== 'auth/email-already-in-use') {
          console.warn(`Aviso ao criar ${u.email}:`, e.message);
        }
      }
    }

    // Salva flag de provisionamento concluído
    await window._firestoreSetDoc(flagRef, { done: true, at: new Date().toISOString() });
    console.log('✅ Provisionamento de usuários concluído.');
  } catch(e) {
    console.warn('Erro no provisionamento:', e.message);
  }
}
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-password').value;
  
  const btnLogin = document.querySelector('.btn-login');
  if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Entrando...'; }

  try {
    // Autentica via Firebase Auth
    await window._firebaseSignIn(email, senha);
    // O onAuthStateChanged vai cuidar do resto do fluxo
  } catch(e) {
    document.getElementById('login-error').innerText = 'E-mail ou senha incorretos';
    document.getElementById('login-error').style.display = 'block';
    setTimeout(() => document.getElementById('login-error').style.display = 'none', 3000);
    if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Entrar'; }
  }
}

function _finalizarLogin(email) {
  const found = usuarios.find(u => u.nome === email);
  if (!found) return;
  currentUser = found;
  currentRole = setores.find(s=>s.id===currentUser.setorId)?.nome.toLowerCase() || 'gestor';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('top-name').textContent = currentUser.nomeExibicao || currentUser.nome;
  _refreshTopbarAvatar();
  if(currentRole !== 'gestor') document.getElementById('nav-admin').style.display = 'none';
  renderAll();
  updateNotifBadge();
  pubCarregarStorage();
  pubAtualizarStats();
  pubPreencherOabsNoModulo();
  adminCarregarConfigPub();
  iniciarAutoSyncDiario();
  const encResp = document.getElementById('enc-responsavel');
  if(encResp) {
    encResp.innerHTML = '<option value="">--- Manter atual ---</option>' + usuarios.map(u => `<option value="${u.nomeExibicao || u.nome}">${u.nomeExibicao || u.nome}</option>`).join('');
  }
}

async function doLogout() {
  if (window._firebaseSignOut) {
    try { await window._firebaseSignOut(); } catch(e) { console.warn('Erro no logout:', e); }
  }
  location.reload();
}
function hasPermission(perm) { const sector = setores.find(s=>s.id===currentUser.setorId); return sector?.permissoes.includes(perm) || false; }

// =====================================================
// 🔑 ESQUECI A SENHA
// =====================================================

function toggleForgotForm() {
  const form = document.getElementById('forgot-form');
  const isVisible = form.classList.contains('visible');
  form.classList.toggle('visible');
  if (!isVisible) {
    // pré-preenche com o e-mail que já foi digitado
    const emailDigitado = document.getElementById('login-email').value.trim();
    if (emailDigitado) document.getElementById('forgot-email').value = emailDigitado;
    document.getElementById('forgot-msg').className = 'forgot-msg';
    document.getElementById('forgot-msg').textContent = '';
  }
}

async function doForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const msgEl = document.getElementById('forgot-msg');
  if (!email) { msgEl.className = 'forgot-msg error'; msgEl.textContent = 'Informe seu e-mail.'; return; }

  msgEl.className = 'forgot-msg'; msgEl.textContent = 'Enviando...';

  try {
    await window._firebaseSendPasswordReset(email);
    msgEl.className = 'forgot-msg success';
    msgEl.textContent = '✅ E-mail enviado! Verifique sua caixa de entrada.';
  } catch(e) {
    const msgs = {
      'auth/user-not-found': 'Nenhuma conta encontrada com este e-mail.',
      'auth/invalid-email':  'E-mail inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.'
    };
    msgEl.className = 'forgot-msg error';
    msgEl.textContent = msgs[e.code] || 'Erro ao enviar. Tente novamente.';
  }
}

// =====================================================
// 👁️ TOGGLE VISIBILIDADE DE SENHA (olhinho)
// =====================================================

function toggleSenhaVisivel(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  // Troca o ícone: olho aberto ↔ olho com risco
  btn.innerHTML = isHidden
    ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:18px;height:18px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:18px;height:18px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
      </svg>`;
}

// =====================================================
// 👤 MENU DO USUÁRIO (dropdown)
// =====================================================

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  const isOpen = dropdown.classList.contains('open');
  if (isOpen) { closeUserMenu(); } else { openUserMenu(); }
}

function openUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.classList.add('open');

  // Popula avatar grande no dropdown
  _updateDropdownHeader();

  // Fecha ao clicar fora
  setTimeout(() => {
    document.addEventListener('click', _closeUserMenuOnOutside, { once: true });
  }, 0);
}

function closeUserMenu() {
  document.getElementById('user-dropdown').classList.remove('open');
}

function _closeUserMenuOnOutside(e) {
  const wrap = document.getElementById('user-chip-wrap');
  if (!wrap.contains(e.target)) { closeUserMenu(); }
  else {
    // ainda dentro do chip — escuta mais uma vez
    document.addEventListener('click', _closeUserMenuOnOutside, { once: true });
  }
}

function _updateDropdownHeader() {
  if (!currentUser) return;

  const nameEl   = document.getElementById('dropdown-name');
  const roleEl   = document.getElementById('dropdown-role');
  const avatarEl = document.getElementById('dropdown-avatar-wrap');

  nameEl.textContent = currentUser.nomeExibicao || currentUser.nome;
  const setor = setores.find(s => s.id === currentUser.setorId);
  roleEl.textContent = setor ? setor.nome : '—';

  // Foto ou iniciais
  const foto = currentUser.foto;
  const cor  = currentUser.cor || 'var(--accent)';
  const ini  = currentUser.iniciais || (currentUser.nomeExibicao || currentUser.nome).substring(0,2).toUpperCase();
  if (foto) {
    avatarEl.innerHTML = `<img src="${foto}" alt="Foto de perfil">`;
    avatarEl.style.background = 'transparent';
  } else {
    avatarEl.innerHTML = ini;
    avatarEl.style.background = cor + '33';
    avatarEl.style.color = cor;
  }
}

// =====================================================
// 🖼️ DADOS PESSOAIS — foto + nome + iniciais
// =====================================================

function openDadosPessoais() {
  if (!currentUser) return;

  document.getElementById('perfil-nome').value    = currentUser.nomeExibicao || '';
  document.getElementById('perfil-email').value   = currentUser.nome;
  document.getElementById('perfil-iniciais').value = currentUser.iniciais || '';
  document.getElementById('perfil-cor').value     = currentUser.cor || '#6c7bff';

  // Preview da foto atual
  _renderProfilePreview();
  openModal('modal-dados-pessoais');
}

function _renderProfilePreview() {
  const preview  = document.getElementById('profile-photo-preview');
  const initialsEl = document.getElementById('profile-photo-initials');
  const foto = currentUser.foto;
  const cor  = currentUser.cor || '#6c7bff';
  const ini  = currentUser.iniciais || (currentUser.nomeExibicao || currentUser.nome || 'U').substring(0,2).toUpperCase();

  if (foto) {
    preview.innerHTML = `<img src="${foto}" alt="Foto">`;
    preview.style.background = 'transparent';
  } else {
    preview.innerHTML = `<span id="profile-photo-initials" style="color:${cor};font-size:32px;font-weight:700;">${ini}</span>`;
    preview.style.background = cor + '22';
  }
}

function previewProfilePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('⚠️ Foto muito grande. Máximo: 2 MB.'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Redimensiona para no máximo 256×256 para não inflar o storage
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height, 256);
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Centraliza e corta
      const sx = (img.width  - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      // Mostra o preview
      const preview = document.getElementById('profile-photo-preview');
      preview.innerHTML = `<img src="${dataUrl}" alt="Foto">`;
      preview.style.background = 'transparent';
      // Armazena temporariamente
      window._pendingProfilePhoto = dataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveDadosPessoais() {
  const nome    = document.getElementById('perfil-nome').value.trim();
  const iniciais = document.getElementById('perfil-iniciais').value.trim().toUpperCase().substring(0,3);
  const cor     = document.getElementById('perfil-cor').value;

  if (!nome) { showToast('⚠️ Informe um nome de exibição.'); return; }

  // Atualiza o objeto do usuário logado
  currentUser.nomeExibicao = nome;
  currentUser.iniciais = iniciais || nome.substring(0,2).toUpperCase();
  currentUser.cor = cor;
  if (window._pendingProfilePhoto) {
    currentUser.foto = window._pendingProfilePhoto;
    window._pendingProfilePhoto = null;
  }

  // Persiste no array e salva
  const u = usuarios.find(u => u.id === currentUser.id);
  if (u) { Object.assign(u, { nomeExibicao: currentUser.nomeExibicao, iniciais: currentUser.iniciais, cor, foto: currentUser.foto }); }

  salvarDados();

  // Atualiza topbar
  _refreshTopbarAvatar();
  closeModal('modal-dados-pessoais');
  showToast('✅ Perfil atualizado!');
}

function _refreshTopbarAvatar() {
  if (!currentUser) return;
  const avatarEl = document.getElementById('top-avatar');
  const nameEl   = document.getElementById('top-name');
  nameEl.textContent = currentUser.nomeExibicao || currentUser.nome;

  const foto = currentUser.foto;
  const cor  = currentUser.cor || 'var(--accent)';
  const ini  = currentUser.iniciais || (currentUser.nomeExibicao || currentUser.nome).substring(0,2).toUpperCase();

  if (foto) {
    avatarEl.style.background = 'transparent';
    avatarEl.innerHTML = `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    avatarEl.innerHTML = ini;
    avatarEl.style.background = cor + '33';
    avatarEl.style.color = cor;
  }
}

// =====================================================
// 🔒 ALTERAR SENHA
// =====================================================

function checkPasswordStrength(password) {
  const bar   = document.getElementById('strength-bar');
  const label = document.getElementById('strength-label');
  if (!bar) return;

  const hasUpper  = /[A-Z]/.test(password);
  const hasLower  = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const len = password.length;

  const score = (len >= 8 ? 1 : 0) + (len >= 12 ? 1 : 0) +
                (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) +
                (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);

  if (len === 0) { bar.className = 'password-strength-bar'; bar.style.width = '0'; label.textContent = ''; return; }
  if (score <= 2) { bar.className = 'password-strength-bar strength-weak';   label.textContent = 'Fraca'; }
  else if (score <= 4) { bar.className = 'password-strength-bar strength-medium'; label.textContent = 'Média'; }
  else { bar.className = 'password-strength-bar strength-strong'; label.textContent = 'Forte 💪'; }
}

function openAlterarSenha() {
  document.getElementById('senha-atual').value     = '';
  document.getElementById('senha-nova').value      = '';
  document.getElementById('senha-confirmar').value = '';
  const bar = document.getElementById('strength-bar');
  if (bar) { bar.className = 'password-strength-bar'; bar.style.width = '0'; }
  const label = document.getElementById('strength-label');
  if (label) label.textContent = '';
  openModal('modal-alterar-senha');
}

async function saveAlterarSenha() {
  const atual      = document.getElementById('senha-atual').value;
  const nova       = document.getElementById('senha-nova').value;
  const confirmar  = document.getElementById('senha-confirmar').value;
  const btn        = document.getElementById('btn-salvar-senha');

  if (!atual)    { showToast('⚠️ Informe a senha atual.'); return; }
  if (!nova)     { showToast('⚠️ Informe a nova senha.'); return; }
  if (nova.length < 6) { showToast('⚠️ A nova senha deve ter ao menos 6 caracteres.'); return; }
  if (nova !== confirmar) { showToast('⚠️ As senhas não coincidem.'); return; }

  btn.disabled = true; btn.textContent = 'Salvando...';

  try {
    // Re-autentica antes de alterar (exigência do Firebase)
    await window._firebaseReauth(currentUser.nome, atual);
    await window._firebaseUpdatePassword(nova);

    // Atualiza também no array local (para o login local fallback)
    const u = usuarios.find(u => u.id === currentUser.id);
    if (u) u.senha = nova;
    salvarDados();

    closeModal('modal-alterar-senha');
    showToast('✅ Senha alterada com sucesso!');
  } catch(e) {
    const msgs = {
      'auth/wrong-password':       '❌ Senha atual incorreta.',
      'auth/weak-password':        '❌ Nova senha muito fraca. Use ao menos 6 caracteres.',
      'auth/requires-recent-login':'❌ Sessão expirada. Faça login novamente.',
      'auth/too-many-requests':    '❌ Muitas tentativas. Aguarde e tente novamente.'
    };
    showToast(msgs[e.code] || '❌ Erro ao alterar senha: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Salvar senha';
  }
}
