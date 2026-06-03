function filterRelatorioByResp(resp) { relatorioFilterResp = resp; renderReports(); document.getElementById('report-filter-bar').style.display = 'flex'; document.getElementById('active-filter-tag').innerHTML = `📌 Filtrando por: ${resp} <button onclick="clearRelatorioFilter()">✕</button>`; }
function clearRelatorioFilter() { relatorioFilterResp = null; renderReports(); document.getElementById('report-filter-bar').style.display = 'none'; }

function renderReports() {
  let filtrados = processos;
  if(relatorioFilterResp) filtrados = filtrados.filter(p=>p.resp===relatorioFilterResp);
  const respCount = {}; processos.forEach(p=>{ respCount[p.resp]=(respCount[p.resp]||0)+1; });
  const responsaveis = Object.keys(respCount).map(nome=>({ nome, count: respCount[nome], role: setores.find(s=>s.id===usuarios.find(u=>u.nomeExibicao===nome)?.setorId)?.nome || 'Advogado' }));
  const cardColors = ['#a855f7', '#3b82f6', '#f97316', '#ec4899'];
  document.getElementById('report-cards').innerHTML = responsaveis.map((r,idx)=>`<div class="report-card" style="border-top:3px solid ${cardColors[idx%cardColors.length]};${relatorioFilterResp===r.nome?'background:var(--bg4);border-color:var(--accent);':''}" onclick="filterRelatorioByResp('${r.nome}')"><div class="report-card-title">${r.nome}</div><div class="report-card-number" style="color:${cardColors[idx%cardColors.length]};">${r.count}</div><div class="report-card-role">${r.role}</div></div>`).join('');
  const stagesList = ['Triagem','Análise Jurídica','Cálculo Trabalhista','Elaboração de Petição','Peticionado','Audiência Agendada','Acordo / Sentença','Execução'];
  const total = filtrados.length;
  const stagesData = stagesList.map(stage=>{ const count=filtrados.filter(p=>p.stage===stage).length; const percent=total?Math.round((count/total)*100):0; return {stage,count,percent,color:stageColors[stage]||'#6c7bff'}; }).filter(s=>s.count>0);
  document.getElementById('report-stages-list').innerHTML = stagesData.map(s=>`<div class="stage-item"><div class="stage-header"><span class="stage-name" style="color:${s.color};">${s.stage}</span><span class="stage-stats">${s.count} (${s.percent}%)</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${s.percent}%; background:${s.color};"></div></div></div>`).join('');
}

