function showPage(id, btn) {
  if(!hasPermission(id)) { alert('Acesso negado para seu perfil'); return; }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if(btn) document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); if(btn) btn.classList.add('active');
  if(id==='agenda') renderCalendar();
  if(id==='relatorios') renderReports();
  if(id==='clientes') renderClientes();
  if(id==='processos') renderTable();
  if(id==='admin') renderAdminPage();
  if(id==='publicacoes') { pubAtualizarStats(); pubAplicarFiltros(); }
}

function renderAll() { renderDashboard(); renderKanban(); renderTable(); renderClientes(); renderReports(); syncBirthdaysToCalendar(); }

function renderAdminPage() { 
  renderAdminUsers(); 
  renderAdminSetores(); 
  carregarSetoresNoSelectPermissao(); 
  adminRenderOabList(); 
  adminCarregarConfigPub(); 
  renderAdminLog(); 
}

function closeModal(id){ document.getElementById(id).classList.remove('open'); }
function openModal(id){ document.getElementById(id).classList.add('open'); }
function showToast(msg){ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:20px;right:20px;background:var(--bg2);padding:12px;border-radius:8px;z-index:999'; document.body.appendChild(t); setTimeout(()=>t.remove(),3000); }

