function filterTableDebounced() { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { tableSearch = document.getElementById('searchProcesso').value; procCurrentPage = 1; renderTable(); }, 300); }
function filterByStatus(v) { tableStatus = v; procCurrentPage = 1; renderTable(); }

function renderTable() {
  let procs = [...processos];
  if(tableSearch) procs = procs.filter(p=>p.clienteNome.toLowerCase().includes(tableSearch.toLowerCase()) || p.proc.toLowerCase().includes(tableSearch.toLowerCase()));
  if(tableStatus) procs = procs.filter(p=>p.stage===tableStatus);
  const total = procs.length, totalPages = Math.ceil(total/procPerPage), start = (procCurrentPage-1)*procPerPage, paginated = procs.slice(start, start+procPerPage);
  const getTagClass = (stage)=>({ 'Triagem':'tag-orange','Análise Jurídica':'tag-purple','Cálculo Trabalhista':'tag-teal','Elaboração de Petição':'tag-blue','Peticionado':'tag-green','Audiência Agendada':'tag-red','Acordo / Sentença':'tag-green','Execução':'tag-blue' }[stage]||'tag-blue');
  document.getElementById('proc-table-body').innerHTML = paginated.map(p=>`<tr onclick="openDetail(${p.id})" style="border-left-color:${stageColors[p.stage]||'#6c7bff'};"><td style="font-weight:500;">${p.clienteNome}</td><td style="font-family:monospace;font-size:11px;">${p.proc !== 'Sem nº' ? p.proc : '—'}</td><td><span class="tag ${getTagClass(p.stage)}"><i>●</i> ${p.stage}</span></td><td>${p.resp}</td><td>${p.valorCausa||'—'}</td><td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();openEditProcess(${p.id})">Editar</button></td></tr>`).join('');
  const pagContainer = document.getElementById('proc-pagination');
  if(total===0){ pagContainer.innerHTML=''; return; }
  pagContainer.innerHTML = `<span>Mostrar</span><select onchange="procPerPage=parseInt(this.value); procCurrentPage=1; renderTable();"><option value="10" ${procPerPage===10?'selected':''}>10</option><option value="25" ${procPerPage===25?'selected':''}>25</option><option value="50" ${procPerPage===50?'selected':''}>50</option><option value="${total}" ${procPerPage===total?'selected':''}>Todos</option></select><span>por página</span><button onclick="procCurrentPage=Math.max(1,procCurrentPage-1); renderTable();" ${procCurrentPage===1?'disabled':''}>Anterior</button><span>Pág. ${procCurrentPage} de ${totalPages}</span><button onclick="procCurrentPage=Math.min(totalPages,procCurrentPage+1); renderTable();" ${procCurrentPage===totalPages?'disabled':''}>Próxima</button>`;
}

function openDetail(id) { 
  const p = processos.find(x=>x.id===id); if(!p) return;
  document.getElementById('detail-body').innerHTML = `<div class="info-grid"><div><strong>Cliente:</strong> ${p.clienteNome}</div><div><strong>Processo:</strong> ${p.proc}</div><div><strong>Valor Causa:</strong> ${p.valorCausa||'Não informado'}</div><div><strong>Forma Pagamento:</strong> ${p.formaPagamento||'—'}</div><div><strong>Parcelas:</strong> ${p.parcelas||0}</div><div><strong>Entrada:</strong> ${p.entrada||'—'}</div><div><strong>Status:</strong> ${p.stage}</div><div><strong>Próx. Data:</strong> ${p.dataProx||'—'}</div></div><div class="timeline">${p.history?.map(h=>`<div>${h.date} - ${h.action}</div>`).join('')||'Sem histórico'}</div>`;
  document.getElementById('detail-footer').innerHTML = `<button class="btn btn-secondary" onclick="closeModal('modal-detail')">Fechar</button><button class="btn btn-primary" onclick="openEncaminhar(${id})">Encaminhar</button><button class="btn btn-primary" onclick="openEditProcess(${id})">Editar</button>`;
  openModal('modal-detail');
}

function openEditProcess(id) {
  const p = processos.find(x => x.id === id);
  if (!p) return;
  function dataParaInput(dataBr) { if (!dataBr) return ''; const partes = dataBr.split('/'); if (partes.length !== 3) return ''; return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`; }
  const html = `
    <div class="form-row">
      <div><label>Etapa</label>
        <select id="edit-stage">
          <option ${p.stage === 'Triagem' ? 'selected' : ''}>Triagem</option>
          <option ${p.stage === 'Análise Jurídica' ? 'selected' : ''}>Análise Jurídica</option>
          <option ${p.stage === 'Cálculo Trabalhista' ? 'selected' : ''}>Cálculo Trabalhista</option>
          <option ${p.stage === 'Elaboração de Petição' ? 'selected' : ''}>Elaboração de Petição</option>
          <option ${p.stage === 'Peticionado' ? 'selected' : ''}>Peticionado</option>
          <option ${p.stage === 'Audiência Agendada' ? 'selected' : ''}>Audiência Agendada</option>
          <option ${p.stage === 'Acordo / Sentença' ? 'selected' : ''}>Acordo / Sentença</option>
          <option ${p.stage === 'Execução' ? 'selected' : ''}>Execução</option>
        </select>
      </div>
      <div><label>Data da Audiência (se aplicável)</label>
        <input type="date" id="edit-data" value="${dataParaInput(p.dataProx)}" />
      </div>
    </div>
    <div class="form-row">
      <div><label>Valor Causa</label><input id="edit-valor" value="${p.valorCausa || ''}" /></div>
      <div><label>Forma Pagamento</label>
        <select id="edit-forma">
          <option ${p.formaPagamento === 'À vista' ? 'selected' : ''}>À vista</option>
          <option ${p.formaPagamento === 'Parcelado' ? 'selected' : ''}>Parcelado</option>
          <option ${p.formaPagamento === 'Acordo' ? 'selected' : ''}>Acordo</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div><label>Nº Parcelas</label><input id="edit-parcelas" type="number" value="${p.parcelas || 0}" /></div>
      <div><label>Valor Entrada</label><input id="edit-entrada" value="${p.entrada || ''}" /></div>
    </div>
    <div class="form-row single">
      <div><label>Observações</label><textarea id="edit-obs">${p.obs || ''}</textarea></div>
    </div>
  `;
  document.getElementById('edit-process-body').innerHTML = html;
  window.editProcId = id;
  openModal('modal-edit-process');
}

function saveEditProcess() {
  const id = window.editProcId;
  const p = processos.find(x => x.id === id);
  if (!p) return;

  const oldStage = p.stage;
  const oldDataProx = p.dataProx;
  const oldValorCausa = p.valorCausa;
  const oldFormaPagamento = p.formaPagamento;
  const oldParcelas = p.parcelas;
  const oldEntrada = p.entrada;
  const oldObs = p.obs;

  p.stage = document.getElementById('edit-stage').value;
  const dataRaw = document.getElementById('edit-data').value;
  if (dataRaw && p.stage === 'Audiência Agendada') {
    const [ano, mes, dia] = dataRaw.split('-');
    p.dataProx = `${dia}/${mes}/${ano}`;
  } else if (p.stage !== 'Audiência Agendada') {
    p.dataProx = '';
  } else if (!dataRaw) {
    p.dataProx = '';
  }
  p.valorCausa = document.getElementById('edit-valor').value;
  p.formaPagamento = document.getElementById('edit-forma').value;
  p.parcelas = parseInt(document.getElementById('edit-parcelas').value) || 0;
  p.entrada = document.getElementById('edit-entrada').value;
  p.obs = document.getElementById('edit-obs').value;

  let changes = [];
  if (oldStage !== p.stage) changes.push(`Etapa: ${oldStage} → ${p.stage}`);
  if (oldDataProx !== p.dataProx) changes.push(`Data: ${oldDataProx || 'vazio'} → ${p.dataProx || 'vazio'}`);
  if (oldValorCausa !== p.valorCausa) changes.push(`Valor: ${oldValorCausa || '—'} → ${p.valorCausa || '—'}`);
  if (oldFormaPagamento !== p.formaPagamento) changes.push(`Pagamento: ${oldFormaPagamento || '—'} → ${p.formaPagamento || '—'}`);
  if (oldParcelas !== p.parcelas) changes.push(`Parcelas: ${oldParcelas} → ${p.parcelas}`);
  if (oldEntrada !== p.entrada) changes.push(`Entrada: ${oldEntrada || '—'} → ${p.entrada || '—'}`);
  if (oldObs !== p.obs) changes.push(`Observação atualizada`);

  if (changes.length > 0) {
    if (!p.history) p.history = [];
    p.history.push({
      date: new Date().toLocaleString(),
      action: `Editado por ${currentUser.nomeExibicao || currentUser.nome}: ` + changes.join('; '),
      user: currentUser.nomeExibicao || currentUser.nome,
      stage: p.stage
    });
  }

  closeModal('modal-edit-process');
  renderAll();
  syncCalendarFromProcesses();
  salvarDados();
  showToast('Processo atualizado');
}

function openEncaminhar(id) {
  encaminharId = id;
  const etapaSelect = document.getElementById('enc-etapa');
  const dataGroup = document.getElementById('enc-data-group');
  const encResp = document.getElementById('enc-responsavel');
  if(encResp) encResp.value = '';
  document.getElementById('enc-data').value = '';
  function toggleDataField() {
    dataGroup.style.display = etapaSelect.value === 'Audiência Agendada' ? 'block' : 'none';
  }
  etapaSelect.onchange = toggleDataField;
  toggleDataField();
  openModal('modal-encaminhar');
}

function confirmEncaminhar() {
  const p = processos.find(x => x.id === encaminharId);
  if (!p) return;
  const novaEtapa = document.getElementById('enc-etapa').value;
  const novoResponsavel = document.getElementById('enc-responsavel').value;
  const dataRaw = document.getElementById('enc-data').value;
  const observacao = document.getElementById('enc-obs').value;

  let acao = `Encaminhado para ${novaEtapa}`;
  if (novoResponsavel && novoResponsavel !== p.resp) {
    acao += ` e responsável alterado de ${p.resp} para ${novoResponsavel}`;
    p.resp = novoResponsavel;
  }
  if (observacao.trim()) acao += `. Obs: ${observacao.trim()}`;

  p.stage = novaEtapa;
  if (novaEtapa === 'Audiência Agendada' && dataRaw) {
    const [ano, mes, dia] = dataRaw.split('-');
    p.dataProx = `${dia}/${mes}/${ano}`;
  } else {
    p.dataProx = '';
  }
  if (!p.history) p.history = [];
  p.history.push({
    date: new Date().toLocaleString(),
    action: acao,
    user: currentUser.nomeExibicao || currentUser.nome,
    stage: p.stage
  });
  closeModal('modal-encaminhar');
  renderAll();
  syncCalendarFromProcesses();
  salvarDados();
  showToast(`Processo encaminhado para ${p.stage}`);
}

function openNewProcess(){
  const clientesHtml = clientes.map(c=>`<option value="${c.id}">${c.nome}</option>`).join('');
  document.getElementById('new-process-body').innerHTML = `
    <div class="form-row">
      <div style="flex:1;">
        <label>Cliente</label>
        <div style="display:flex; gap:8px;">
          <select id="new-cliente" style="flex:1;">${clientesHtml}</select>
          <button type="button" class="btn btn-secondary btn-sm" onclick="abrirCadastroRapidoCliente()" style="white-space:nowrap;">➕ Novo</button>
        </div>
      </div>
      <div><label>Nº Processo</label><input id="new-proc" /></div>
    </div>
    <div class="form-row">
      <div><label>Etapa</label>
        <select id="new-stage">
          <option>Triagem</option>
          <option>Análise Jurídica</option>
          <option>Cálculo Trabalhista</option>
          <option>Elaboração de Petição</option>
        </select>
      </div>
      <div><label>Responsável</label>
        <select id="new-resp">${usuarios.map(u=>`<option>${u.nomeExibicao||u.nome}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div><label>Valor Causa</label><input id="new-valor" /></div>
      <div><label>Prioridade</label>
        <select id="new-prio">
          <option value="ok">Normal</option>
          <option value="attention">Atenção</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>
    </div>
    <div class="form-row single">
      <div><label>Tipo de Ação</label><input id="new-tipo" placeholder="Ex: Reclamação Trabalhista" /></div>
    </div>
    <div id="rapid-client-form" style="display:none; margin-top:16px; padding:12px; background:var(--bg3); border-radius:var(--radius);">
      <div style="font-weight:600; margin-bottom:8px;">Novo Cliente</div>
      <div class="form-row">
        <div><label>Nome *</label><input id="rapid-nome" placeholder="Nome completo" /></div>
        <div><label>CPF/CNPJ</label><input id="rapid-cpf" /></div>
      </div>
      <div class="form-row">
        <div><label>Telefone</label><input id="rapid-tel" /></div>
        <div><label>Email</label><input id="rapid-email" /></div>
      </div>
      <div class="form-row single">
        <div><label>Data de Nascimento</label><input type="date" id="rapid-nascimento" /></div>
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn btn-secondary btn-sm" onclick="fecharCadastroRapido()">Cancelar</button>
        <button class="btn btn-primary btn-sm" onclick="salvarClienteRapido()">Salvar e usar</button>
      </div>
    </div>
  `;
  openModal('modal-new');
}

function abrirCadastroRapidoCliente() {
  document.getElementById('rapid-client-form').style.display = 'block';
}
function fecharCadastroRapido() {
  document.getElementById('rapid-client-form').style.display = 'none';
  document.getElementById('rapid-nome').value = '';
  document.getElementById('rapid-cpf').value = '';
  document.getElementById('rapid-tel').value = '';
  document.getElementById('rapid-email').value = '';
  document.getElementById('rapid-nascimento').value = '';
}
function salvarClienteRapido() {
  const nome = document.getElementById('rapid-nome').value.trim();
  if (!nome) { alert('Nome é obrigatório'); return; }
  const nascimento = document.getElementById('rapid-nascimento').value;
  const novoId = clientes.length > 0 ? Math.max(...clientes.map(c=>c.id)) + 1 : 1;
  const novoCliente = {
    id: novoId,
    nome: nome,
    cpf: document.getElementById('rapid-cpf').value || '',
    telefone: document.getElementById('rapid-tel').value || '',
    email: document.getElementById('rapid-email').value || '',
    endereco: '',
    nascimento: nascimento,
    history: []
  };
  clientes.push(novoCliente);
  adicionarLogCliente(novoId, `Cliente criado via cadastro rápido: ${nome}`, currentUser?.nomeExibicao || currentUser?.nome);
  salvarDados();
  const selectCliente = document.getElementById('new-cliente');
  const option = document.createElement('option');
  option.value = novoId;
  option.textContent = nome;
  selectCliente.appendChild(option);
  selectCliente.value = novoId;
  fecharCadastroRapido();
  showToast(`Cliente "${nome}" cadastrado e selecionado`);
  renderClientes();
}

function saveNewProcess(){
  const clienteId = parseInt(document.getElementById('new-cliente').value);
  const cliente = clientes.find(c=>c.id===clienteId);
  const novoId = processos.length > 0 ? Math.max(...processos.map(p=>p.id)) + 1 : 1;
  const novo = {
    id: novoId,
    clienteNome: cliente.nome,
    clienteId,
    proc: document.getElementById('new-proc').value || 'Sem nº',
    tipo: document.getElementById('new-tipo').value || 'Reclamação Trabalhista',
    stage: document.getElementById('new-stage').value,
    resp: document.getElementById('new-resp').value,
    priority: document.getElementById('new-prio').value,
    valorCausa: document.getElementById('new-valor').value,
    formaPagamento: '',
    parcelas: 0,
    entrada: '',
    dataProx: '',
    obs: '',
    history: []
  };
  novo.history.push({
    date: new Date().toLocaleString(),
    action: `Processo criado por ${currentUser.nomeExibicao || currentUser.nome}`,
    user: currentUser.nomeExibicao || currentUser.nome,
    stage: novo.stage
  });
  processos.push(novo);
  closeModal('modal-new');
  renderAll();
  syncCalendarFromProcesses();
  salvarDados();
  showToast('Processo criado');
}

