// ========== LOG DE CLIENTE ==========
function adicionarLogCliente(clienteId, acao, usuario) {
  const cliente = clientes.find(c => c.id === clienteId);
  if (!cliente) return;
  if (!cliente.history) cliente.history = [];
  cliente.history.push({
    date: new Date().toLocaleString(),
    action: acao,
    user: usuario || (currentUser?.nomeExibicao || currentUser?.nome || 'Sistema')
  });
  salvarDados();
}

function adicionarLogProcesso(procId, acao, usuario) {
  const processo = processos.find(p => p.id === procId);
  if (!processo) return;
  if (!processo.history) processo.history = [];
  processo.history.push({
    date: new Date().toLocaleString(),
    action: acao,
    user: usuario || (currentUser?.nomeExibicao || currentUser?.nome || 'Sistema')
  });
  salvarDados();
}

function limparFormularioCliente() {
  document.getElementById('cli-nome').value = '';
  document.getElementById('cli-cpf').value = '';
  document.getElementById('cli-tel').value = '';
  document.getElementById('cli-email').value = '';
  document.getElementById('cli-nascimento').value = '';
  document.getElementById('cli-end').value = '';
}

function filterClientesDebounced() { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { clienteSearch = document.getElementById('searchCliente').value; clienteCurrentPage = 1; renderClientes(); }, 300); }

function renderClientes() {
  let lista = [...clientes];
  if (clienteSearch) lista = lista.filter(c => c.nome.toLowerCase().includes(clienteSearch.toLowerCase()));
  const total = lista.length, totalPages = Math.ceil(total/clientePerPage), start = (clienteCurrentPage-1)*clientePerPage, paginated = lista.slice(start, start+clientePerPage);
  const tbody = document.getElementById('clientes-table-body');
  if (total === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">Nenhum cliente cadastrado</td></tr>'; }
  else {
    tbody.innerHTML = paginated.map(c => `<tr onclick="editCliente(${c.id})"><td style="font-weight:500;">${c.nome}</td><td>${c.cpf || '—'}</td><td>${c.telefone || '—'} ${c.email ? `/ ${c.email}` : ''}</td><td><span class="tag tag-blue">${processos.filter(p => p.clienteId === c.id).length} processo(s)</span></td><td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();editCliente(${c.id})">Editar</button></td></tr>`).join('');
  }
  const pagContainer = document.getElementById('cliente-pagination');
  if(total===0){ pagContainer.innerHTML=''; return; }
  pagContainer.innerHTML = `<span>Mostrar</span><select onchange="clientePerPage=parseInt(this.value); clienteCurrentPage=1; renderClientes();"><option value="10" ${clientePerPage===10?'selected':''}>10</option><option value="25" ${clientePerPage===25?'selected':''}>25</option><option value="50" ${clientePerPage===50?'selected':''}>50</option><option value="${total}" ${clientePerPage===total?'selected':''}>Todos</option></select><span>por página</span><button onclick="clienteCurrentPage=Math.max(1,clienteCurrentPage-1); renderClientes();" ${clienteCurrentPage===1?'disabled':''}>Anterior</button><span>Pág. ${clienteCurrentPage} de ${totalPages}</span><button onclick="clienteCurrentPage=Math.min(totalPages,clienteCurrentPage+1); renderClientes();" ${clienteCurrentPage===totalPages?'disabled':''}>Próxima</button>`;
}

function editCliente(id) {
  const c = clientes.find(c=>c.id===id); if(!c) return;
  document.getElementById('cli-nome').value = c.nome;
  document.getElementById('cli-cpf').value = c.cpf || '';
  document.getElementById('cli-tel').value = c.telefone || '';
  document.getElementById('cli-email').value = c.email || '';
  document.getElementById('cli-nascimento').value = c.nascimento || '';
  document.getElementById('cli-end').value = c.endereco || '';
  window.editandoClienteId = id;
  openModal('modal-cliente');
  setTimeout(() => {
    switchClienteTab('dados');
  }, 50);
}

function openNewCliente() {
  window.editandoClienteId = null;
  document.getElementById('cli-nome').value = '';
  document.getElementById('cli-cpf').value = '';
  document.getElementById('cli-tel').value = '';
  document.getElementById('cli-email').value = '';
  document.getElementById('cli-nascimento').value = '';
  document.getElementById('cli-end').value = '';
  openModal('modal-cliente');
  setTimeout(() => {
    switchClienteTab('dados');
  }, 50);
}

function saveCliente(){
  const nome = document.getElementById('cli-nome').value.trim();
  if(!nome) return alert("Nome obrigatório");
  const nascimento = document.getElementById('cli-nascimento').value;
  
  if(window.editandoClienteId) {
    const cliente = clientes.find(c => c.id === window.editandoClienteId);
    if(cliente) {
      let changes = [];
      if (cliente.nome !== nome) changes.push(`nome: "${cliente.nome}" → "${nome}"`);
      if (cliente.cpf !== document.getElementById('cli-cpf').value) changes.push(`CPF: "${cliente.cpf || 'vazio'}" → "${document.getElementById('cli-cpf').value}"`);
      if (cliente.telefone !== document.getElementById('cli-tel').value) changes.push(`telefone: "${cliente.telefone || 'vazio'}" → "${document.getElementById('cli-tel').value}"`);
      if (cliente.email !== document.getElementById('cli-email').value) changes.push(`email: "${cliente.email || 'vazio'}" → "${document.getElementById('cli-email').value}"`);
      if (cliente.nascimento !== nascimento) changes.push(`data de nascimento: "${cliente.nascimento || 'não informado'}" → "${nascimento || 'não informado'}"`);
      if (cliente.endereco !== document.getElementById('cli-end').value) changes.push(`endereço: "${cliente.endereco || 'vazio'}" → "${document.getElementById('cli-end').value}"`);
      
      if (changes.length > 0) {
        const acao = `Cliente editado: ` + changes.join('; ');
        adicionarLogCliente(cliente.id, acao, currentUser?.nomeExibicao || currentUser?.nome);
      }
      
      cliente.nome = nome;
      cliente.cpf = document.getElementById('cli-cpf').value || '';
      cliente.telefone = document.getElementById('cli-tel').value || '';
      cliente.email = document.getElementById('cli-email').value || '';
      cliente.nascimento = nascimento;
      cliente.endereco = document.getElementById('cli-end').value || '';
      processos.forEach(p => { if(p.clienteId === cliente.id) p.clienteNome = cliente.nome; });
      showToast("Cliente atualizado!");
    }
    window.editandoClienteId = null;
  } else {
    const novoId = clientes.length > 0 ? Math.max(...clientes.map(c=>c.id)) + 1 : 1;
    const novoCliente = {
      id: novoId,
      nome: nome,
      cpf: document.getElementById('cli-cpf').value || '',
      telefone: document.getElementById('cli-tel').value || '',
      email: document.getElementById('cli-email').value || '',
      nascimento: nascimento,
      endereco: document.getElementById('cli-end').value || '',
      history: []
    };
    clientes.push(novoCliente);
    adicionarLogCliente(novoId, `Cliente criado: ${nome}`, currentUser?.nomeExibicao || currentUser?.nome);
    showToast("Cliente cadastrado!");
  }
  closeModal('modal-cliente');
  renderClientes();
  syncBirthdaysToCalendar();
  limparFormularioCliente();
  salvarDados();
}

function exportarICS(){
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AdvBoard//NONSGML v1.0//EN\n";
  processos.filter(p=>p.stage==='Audiência Agendada' && p.dataProx).forEach(p=>{
    let [dia,mes,ano]=p.dataProx.split('/');
    let dataStr=`${ano}${mes}${dia}`;
    ics+=`BEGIN:VEVENT\nSUMMARY:Audiência - ${p.clienteNome}\nDTSTART;VALUE=DATE:${dataStr}\nDTEND;VALUE=DATE:${dataStr}\nEND:VEVENT\n`;
  });
  ics+="END:VCALENDAR";
  const blob=new Blob([ics],{type:"text/calendar"});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download="audiencias.ics";
  link.click();
  showToast("Arquivo ICS gerado! Importe no Google Calendar.");
}

function syncGoogleCalendar() { window.open('https://calendar.google.com/calendar/u/0/r', '_blank'); alert('Após adicionar eventos no Google Agenda, você pode importá-los manualmente.\nPara integração total é necessário configurar OAuth2 no Google Cloud Console.'); }
function switchClienteTab(tab) {
  document.querySelectorAll('.cliente-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.cliente-tab-content').forEach(content => content.classList.remove('active'));
  if (tab === 'dados') {
    document.querySelector('.cliente-tab-btn[data-tab="dados"]').classList.add('active');
    document.getElementById('cliente-tab-dados').classList.add('active');
  } else if (tab === 'historico') {
    document.querySelector('.cliente-tab-btn[data-tab="historico"]').classList.add('active');
    document.getElementById('cliente-tab-historico').classList.add('active');
    if (window.editandoClienteId) {
      const cliente = clientes.find(c => c.id === window.editandoClienteId);
      const listaDiv = document.getElementById('cliente-historico-lista');
      if (cliente && cliente.history && cliente.history.length > 0) {
        listaDiv.innerHTML = cliente.history.map(h => `
          <div style="padding: 8px 0; border-bottom: 1px solid var(--border);">
            <strong>${h.date}</strong> — ${h.action}<br>
            <span style="font-size: 11px; color: var(--text3);">por ${h.user}</span>
          </div>
        `).join('');
      } else {
        listaDiv.innerHTML = '<div style="padding: 20px; text-align: center;">Nenhuma movimentação registrada ainda.</div>';
      }
    } else {
      document.getElementById('cliente-historico-lista').innerHTML = '<div style="padding: 20px; text-align: center;">Salve o cliente para ver o histórico.</div>';
    }
  }
}
