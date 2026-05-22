function renderKanban() {
  const stagesOrder = ['Triagem','Análise Jurídica','Cálculo Trabalhista','Elaboração de Petição','Peticionado','Audiência Agendada','Acordo / Sentença','Execução'];
  let procs = [...processos];
  if (kanbanFilter === 'meus') procs = procs.filter(p=>p.resp === (currentUser.nomeExibicao||currentUser.nome));
  if (kanbanFilter === 'urgente') procs = procs.filter(p=>p.priority === 'urgent');
  document.getElementById('kanban-board').innerHTML = stagesOrder.map(stage => {
    const cards = procs.filter(p=>p.stage===stage);
    const color = stageColors[stage]||'#6c7bff';
    return `<div class="kanban-col"><div class="col-header" style="background:${color}20; border-bottom-color:${color}; color:${color};">${stage}</div><div class="col-cards">${cards.map(p=>{const usuario=usuarios.find(u=>u.nomeExibicao===p.resp)||{iniciais:'??'}; const priorityLabel=p.priority==='urgent'?'Urgente':(p.priority==='attention'?'Atenção':''); const priorityClass=p.priority==='urgent'?'tag-red':(p.priority==='attention'?'tag-orange':''); return `<div class="kanban-card" onclick="openDetail(${p.id})" style="border-left-color:${color};"><div class="card-client">${p.clienteNome}</div><div class="card-processo">${p.proc !== 'Sem nº' ? p.proc : '— Sem nº —'}</div><div class="card-tags"><span class="tag tag-blue">${p.tipo||'Reclamação'}</span>${priorityLabel?`<span class="tag ${priorityClass}">${priorityLabel}</span>`:''}</div><div class="card-footer"><div class="card-assignee">${usuario.iniciais}</div></div></div>`}).join('')}${cards.length===0?'<div style="padding:12px;text-align:center;color:var(--text3);">Nenhum processo</div>':''}</div></div>`;
  }).join('');
}

function filterKanban(f, btn) { kanbanFilter = f; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderKanban(); }

