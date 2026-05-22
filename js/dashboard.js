function renderDashboard() {
  const total = processos.length;
  const urgentes = processos.filter(p=>p.priority==='urgent').length;
  const emAndamento = processos.filter(p=>['Triagem','Análise Jurídica','Cálculo Trabalhista','Elaboração de Petição'].includes(p.stage)).length;
  const audiencias = processos.filter(p=>p.stage==='Audiência Agendada').length;
  const acordos = processos.filter(p=>p.stage==='Acordo / Sentença').length;
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">TOTAL DE PROCESSOS</div><div class="stat-value" style="color: var(--blue);">${total}</div><div class="stat-sub">Ativos no escritório</div></div>
    <div class="stat-card"><div class="stat-label">URGENTES</div><div class="stat-value" style="color: var(--red);">${urgentes}</div><div class="stat-sub">Requerem ação imediata</div></div>
    <div class="stat-card"><div class="stat-label">EM ANDAMENTO</div><div class="stat-value" style="color: var(--orange);">${emAndamento}</div><div class="stat-sub">Pendentes de ação interna</div></div>
    <div class="stat-card"><div class="stat-label">AUDIÊNCIAS</div><div class="stat-value" style="color: var(--green);">${audiencias}</div><div class="stat-sub">Agendadas</div></div>
    <div class="stat-card"><div class="stat-label">ACORDOS</div><div class="stat-value" style="color: var(--green-dark);">${acordos}</div><div class="stat-sub">Encerrados com êxito</div></div>`;
  const urgentList = processos.filter(p=>p.priority==='urgent').sort((a,b)=> (a.dataProx||'').localeCompare(b.dataProx||''));
  document.getElementById('urgent-list').innerHTML = urgentList.map(p=>`<div onclick="openDetail(${p.id})" style="padding:12px; border-bottom:1px solid var(--border); cursor:pointer;"><div style="font-weight:600;">${p.clienteNome}</div><div style="display:flex; gap:8px; margin-top:4px;"><span class="tag tag-red">${p.stage}</span> <span>${p.dataProx}</span></div></div>`).join('');
  const audList = processos.filter(p=>p.stage==='Audiência Agendada' && p.dataProx).sort((a,b)=> a.dataProx.split('/').reverse().join('-').localeCompare(b.dataProx.split('/').reverse().join('-'))).slice(0,6);
  document.getElementById('audiencias-list').innerHTML = audList.map(p=>`<div onclick="openDetail(${p.id})" style="padding:12px; border-bottom:1px solid var(--border); cursor:pointer;"><div style="font-weight:600;">${p.clienteNome}</div><div style="display:flex; gap:8px; margin-top:4px;"><span class="tag tag-green">${p.dataProx}</span> <span>${(p.obs||'').substring(0,40)}${(p.obs||'').length>40?'...':''}</span></div></div>`).join('');
}

