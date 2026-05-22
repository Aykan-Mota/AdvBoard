function syncCalendarFromProcesses() {
  calendarEvents = [];
  processos.forEach(p => {
    if (p.stage === 'Audiência Agendada' && p.dataProx) {
      const partes = p.dataProx.split('/');
      if (partes.length === 3) {
        const dataISO = `${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
        calendarEvents.push({
          id: p.id,
          title: `Audiência - ${p.clienteNome}`,
          date: dataISO,
          time: '',
          type: 'audiencia',
          procId: p.id,
          obs: p.obs
        });
      }
    }
  });
  syncBirthdaysToCalendar();
  renderCalendar();
}

function syncBirthdaysToCalendar() {
  calendarEvents = calendarEvents.filter(ev => ev.type !== 'aniversario');
  clientes.forEach(cliente => {
    if(cliente.nascimento && cliente.nascimento.trim() !== '') {
      const nascDate = new Date(cliente.nascimento);
      if(isNaN(nascDate.getTime())) return;
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      let anoEvento = anoAtual;
      let dataEvento = new Date(anoAtual, nascDate.getMonth(), nascDate.getDate());
      if(dataEvento < hoje) {
        anoEvento = anoAtual + 1;
        dataEvento = new Date(anoEvento, nascDate.getMonth(), nascDate.getDate());
      }
      const dateStr = dataEvento.toISOString().split('T')[0];
      calendarEvents.push({
        id: `birth_${cliente.id}_${anoEvento}`,
        title: `🎂 Aniversário - ${cliente.nome}`,
        date: dateStr,
        time: '',
        type: 'aniversario',
        clienteId: cliente.id,
        obs: `Desejar parabéns para ${cliente.nome}`,
        isBirthday: true
      });
    }
  });
  renderCalendar();
}

function iniciarConclusaoEvento(eventId, eventDate, procId) {
  pendingConcluirEvent = { eventId, eventDate, procId };
  document.getElementById('descricao-conclusao').value = '';
  openModal('modal-concluir-evento');
}

function confirmarConclusaoComDescricao() {
  if (!pendingConcluirEvent) return;
  const descricao = document.getElementById('descricao-conclusao').value.trim();
  if (!descricao) {
    alert('Por favor, descreva o motivo da conclusão.');
    return;
  }
  
  const { eventId, eventDate, procId } = pendingConcluirEvent;
  
  if (procId) {
    adicionarLogProcesso(procId, `Agendamento concluído. Motivo: ${descricao}`, currentUser?.nomeExibicao || currentUser?.nome);
  }
  
  let concluidos = JSON.parse(localStorage.getItem('eventosConcluidosPermanente') || '[]');
  if (!concluidos.includes(eventId)) {
    concluidos.push(eventId);
    localStorage.setItem('eventosConcluidosPermanente', JSON.stringify(concluidos));
  }
  
  closeModal('modal-concluir-evento');
  pendingConcluirEvent = null;
  showEventsForDay(eventDate);
  renderCalendar();
  showToast('Agendamento concluído e registrado no histórico do processo!');
}

function toggleExibirConcluidos() {
  exibirConcluidos = !exibirConcluidos;
  const btn = document.getElementById('toggleConcluidosBtn');
  if (btn) btn.textContent = exibirConcluidos ? '📋 Ocultar concluídos' : '📋 Ver concluídos';
  renderCalendar();
  if (calendarSelectedDate) showEventsForDay(calendarSelectedDate);
}

function renderCalendar() {
  const container = document.getElementById('calendarDays');
  if (!container) return;
  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('currentMonthLabel').innerText = `${monthNames[calendarCurrentMonth]} ${calendarCurrentYear}`;
  const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1).getDay();
  const daysInMonth = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();
  const today = new Date();
  let html = '';
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStrISO = `${calendarCurrentYear}-${String(calendarCurrentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = (today.getFullYear() === calendarCurrentYear && today.getMonth() === calendarCurrentMonth && today.getDate() === d);
    const isSelected = (calendarSelectedDate === dateStrISO);
    let dayEvents = calendarEvents.filter(ev => ev.date === dateStrISO);
    const idsConcluidos = JSON.parse(localStorage.getItem('eventosConcluidosPermanente') || '[]');
    dayEvents = dayEvents.filter(ev => !idsConcluidos.includes(ev.id));
    const eventDots = dayEvents.map(ev => `<div class="dot ${ev.type}"></div>`).join('');
    html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalendarDate('${dateStrISO}')">
      <div class="day-number">${d}</div>
      <div class="event-dots">${eventDots}</div>
    </div>`;
  }
  container.innerHTML = html;
  if (!calendarSelectedDate) {
    const todayStr = today.toISOString().split('T')[0];
    showEventsForDay(todayStr);
  } else {
    showEventsForDay(calendarSelectedDate);
  }
}

function selectCalendarDate(dateStr) {
  calendarSelectedDate = dateStr;
  renderCalendar();
  showEventsForDay(dateStr);
}

function showEventsForDay(dateStrISO) {
  let dayEvents = calendarEvents.filter(ev => ev.date === dateStrISO);
  const container = document.getElementById('eventsList');
  const idsConcluidos = JSON.parse(localStorage.getItem('eventosConcluidosPermanente') || '[]');
  
  let eventosPendentes = dayEvents.filter(ev => !idsConcluidos.includes(ev.id));
  let eventosConcluidos = dayEvents.filter(ev => idsConcluidos.includes(ev.id));
  
  if (!exibirConcluidos) {
    dayEvents = eventosPendentes;
  } else {
    dayEvents = [...eventosPendentes, ...eventosConcluidos];
  }
  
  if (dayEvents.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#aaa">Nenhum evento neste dia</div>';
    return;
  }
  
  container.innerHTML = dayEvents.map(ev => {
    const isConcluido = idsConcluidos.includes(ev.id);
    let onclickAttr = '';
    if (!isConcluido) {
      if(ev.type === 'aniversario' && ev.clienteId) {
        onclickAttr = `onclick="editCliente(${ev.clienteId})"`;
      } else if(ev.procId) {
        onclickAttr = `onclick="openDetail(${ev.procId})"`;
      }
    } else {
      onclickAttr = '';
    }
    
    const concluirBtn = (!isConcluido && (ev.type === 'audiencia' || ev.type === 'aniversario'))
      ? `<button class="btn-concluir" onclick="event.stopPropagation(); iniciarConclusaoEvento('${ev.id}', '${dateStrISO}', ${ev.procId || null})">✓ Concluir</button>`
      : (isConcluido ? '<span class="concluido-badge"><i>✓</i> Concluído</span>' : '');
    
    return `<div class="event-item ${isConcluido ? 'concluido' : ''}" ${onclickAttr} style="cursor:${isConcluido ? 'default' : 'pointer'}">
      <div class="event-time">${ev.time || '—'}</div>
      <div class="event-title">${ev.title}</div>
      <span class="event-type">${ev.type === 'aniversario' ? '🎂 Aniversário' : (ev.type === 'audiencia' ? 'Audiência' : 'Outro')}</span>
      ${concluirBtn}
    </div>`;
  }).join('');
}

function agendaChangeMonth(delta) {
  calendarCurrentMonth += delta;
  if (calendarCurrentMonth < 0) { calendarCurrentMonth = 11; calendarCurrentYear--; }
  if (calendarCurrentMonth > 11) { calendarCurrentMonth = 0; calendarCurrentYear++; }
  renderCalendar();
}

function agendaGoToday() {
  const today = new Date();
  calendarCurrentYear = today.getFullYear();
  calendarCurrentMonth = today.getMonth();
  calendarSelectedDate = today.toISOString().split('T')[0];
  renderCalendar();
}

function agendaOpenEventModal(editId = null) {
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDate').value = calendarSelectedDate || new Date().toISOString().split('T')[0];
  document.getElementById('eventTime').value = '';
  document.getElementById('eventType').value = 'audiencia';
  document.getElementById('eventObs').value = '';
  window.agendaEditingEventId = editId;
  openModal('agendaEventModal');
}

function agendaSaveEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) return alert('Título obrigatório');
  const eventDate = document.getElementById('eventDate').value;
  const eventTime = document.getElementById('eventTime').value;
  const eventType = document.getElementById('eventType').value;
  const eventObs = document.getElementById('eventObs').value;
  calendarEvents.push({
    id: Date.now(),
    title,
    date: eventDate,
    time: eventTime,
    type: eventType,
    procId: null,
    obs: eventObs
  });
  agendaCloseEventModal();
  renderCalendar();
  salvarDados();
}

function agendaCloseEventModal() { closeModal('agendaEventModal'); window.agendaEditingEventId = null; }
