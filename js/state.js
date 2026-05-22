// ========== DADOS COM LOCALSTORAGE ==========
let processos = [];
let clientes = [];
let usuarios = [];
let setores = [];
let notifications = [];
let encaminharId = null;
let currentUser = null, currentRole = null;
let tableSearch = '', tableStatus = '';
let kanbanFilter = 'todos';
let clienteSearch = '';
let procCurrentPage = 1, procPerPage = 10;
let clienteCurrentPage = 1, clientePerPage = 10;
let relatorioFilterResp = null;
let debounceTimer;
let calendarEvents = [];
let calendarCurrentYear = new Date().getFullYear();
let calendarCurrentMonth = new Date().getMonth();
let calendarSelectedDate = null;
let autoSyncInterval = null;

let exibirConcluidos = false;
let pendingConcluirEvent = null;

const stageColors = {
  'Triagem': '#f97316', 'Análise Jurídica': '#a855f7', 'Cálculo Trabalhista': '#14b8a6',
  'Elaboração de Petição': '#3b82f6', 'Peticionado': '#22c55e', 'Audiência Agendada': '#ef4444',
  'Acordo / Sentença': '#15803d', 'Execução': '#6c7bff'
};

const processosOriginais = [
  { id:1, clienteNome:'Lorena Lima Peixoto', proc:'0001124-85.2025.5.19.0002', tipo:'Reclamação Trabalhista', stage:'Execução', resp:'Dra. Drielle', dataProx:'', priority:'ok', obs:'Aguardando execução', valorCausa:'R$ 45.000,00', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:2, clienteNome:'José Febronio e Maria de Fátima', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Elaboração de Petição', resp:'Dr. Andrey', dataProx:'', priority:'attention', obs:'Aguardando petição', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:3, clienteNome:'Walter da Silva', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Elaboração de Petição', resp:'Dr. Andrey', dataProx:'', priority:'attention', obs:'Aguardando petição', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:4, clienteNome:'Josenilton Nascimento dos Santos', proc:'0000638-32.2025.5.19.0057', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'28/01/2026', priority:'urgent', obs:'Telepresencial – 28/01/2026 09:00', valorCausa:'R$ 12.000,00', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:5, clienteNome:'Erick Melo de Oliveira', proc:'0000499-86.2025.5.19.0055', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'03/02/2026', priority:'urgent', obs:'Audiência 03/02/2026 11:00', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:6, clienteNome:'Gilson Araújo da Silva', proc:'0001424-32.2025.5.19.0007', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'29/01/2026', priority:'urgent', obs:'Presencial 29/01/2026', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:7, clienteNome:'Claudinete Ferreira dos Santos', proc:'0001693-65.2025.5.19.0009', tipo:'Reclamação Trabalhista', stage:'Acordo / Sentença', resp:'Dra. Drielle', dataProx:'12/03/2026', priority:'ok', obs:'Acordo 71 parcelas', valorCausa:'R$ 28.000,00', formaPagamento:'Parcelado', parcelas:71, entrada:'R$ 3.500,00', history:[] },
  { id:8, clienteNome:'Tarsya', proc:'0000275-67.2026.5.19.0006', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'03/06/2026', priority:'ok', obs:'Telepresencial', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:9, clienteNome:'Adeilson dos Santos Araújo', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Elaboração de Petição', resp:'Dr. Andrey', dataProx:'', priority:'attention', obs:'Aguardando petição', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:10, clienteNome:'Rogaciano Ferreira da Silva', proc:'0000727-83.2026.5.19.0004', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'25/05/2026', priority:'ok', obs:'Audiência 25/05/2026', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:11, clienteNome:'Rodrigo Daniel dos Santos Silva', proc:'0001498-95.2025.5.19.0004', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'26/02/2026', priority:'ok', obs:'Audiência 26/02/2026', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:12, clienteNome:'LARISSA NOGUEIRA DA SILVA', proc:'0001623-60.2025.5.19.0005', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'09/04/2026', priority:'ok', obs:'Audiência 09/04/2026', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:13, clienteNome:'Gabriella Amorim Lessa de Vasconcelos', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Análise Jurídica', resp:'Dra. Drielle', dataProx:'', priority:'attention', obs:'Analisar', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:14, clienteNome:'José Jean Amorim da Silva', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Análise Jurídica', resp:'Dra. Drielle', dataProx:'', priority:'attention', obs:'Analisar', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:15, clienteNome:'EDUARDO DA SILVA NASCIMENTO', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Análise Jurídica', resp:'Dra. Drielle', dataProx:'', priority:'attention', obs:'Analisar', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:16, clienteNome:'Natanael Santos de Oliveira', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Triagem', resp:'Ana', dataProx:'', priority:'attention', obs:'Falta CNPJ', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:17, clienteNome:'M Policarpo', proc:'0001677-17.2025.5.19.0008', tipo:'Consignação em Pagamento', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'30/01/2026', priority:'urgent', obs:'Telepresencial', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:18, clienteNome:'ALONSO TEODORO DO ROSARIO JUNIOR', proc:'0001586-21.2025.5.19.0009', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'30/04/2026', priority:'ok', obs:'Presencial', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:19, clienteNome:'LÍVIA CEDRIM MELO DOS SANTOS', proc:'0000245-76.2026.5.19.0056', tipo:'Reclamação Trabalhista', stage:'Peticionado', resp:'Dra. Drielle', dataProx:'', priority:'ok', obs:'Peticionado', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:20, clienteNome:'Gabriel dos Santos Ribeiro Silva', proc:'0000327-51.2026.5.19.0010', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'01/06/2026', priority:'ok', obs:'Audiência 01/06/2026 às 09:20', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:21, clienteNome:'Leandro Marcelo dos Santos Inacio', proc:'0000833-24.2026.5.19.0011', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'03/06/2026', priority:'ok', obs:'Videoconferência – 03/06/2026 – 09:00', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:22, clienteNome:'Cloves de Lima Silva', proc:'0001436-46.2025.5.19.0007', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'03/02/2026', priority:'ok', obs:'03/02/2026 às 08:50h', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:23, clienteNome:'Leonardo Torres', proc:'0000362-14.2026.5.19.0009', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'09/06/2026', priority:'ok', obs:'Audiência em: 09/06/2026 às 08:05', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:24, clienteNome:'Erick da Silva Barbosa', proc:'0000588-12.2025.5.19.0055', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'16/06/2026', priority:'ok', obs:'Audiência em: 16/06/2026 às 09:00', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:25, clienteNome:'Josenildo Ferreira de Araújo', proc:'Sem nº', tipo:'Reclamação Trabalhista', stage:'Elaboração de Petição', resp:'Dr. Andrey', dataProx:'17/06/2026', priority:'attention', obs:'Audiência em: 17/06/2026 às 11:30h – petição urgente', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:26, clienteNome:'Giseli Caroline de Sales Santos', proc:'0000194-40.2025.5.19.0011', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'04/03/2026', priority:'ok', obs:'Presencial dia 04/03/2026 – 10:20h', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:27, clienteNome:'Lilian Jouse dos Santos Silva', proc:'0001670-22.2025.5.19.0009', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'23/06/2026', priority:'ok', obs:'Audiência em: 23/06/2026 às 11:00', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:28, clienteNome:'TARCISIO CORREIA DA SILVA', proc:'0001608-03.2025.5.19.0002', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dr. Andrey', dataProx:'10/02/2026', priority:'ok', obs:'Audiência em: 10/02/2026 08:40', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:29, clienteNome:'Josenilda Lins Normando', proc:'0001598-38.2025.5.19.0008', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'30/01/2026', priority:'ok', obs:'Audiência 30/01/2026 – 10:20h', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] },
  { id:30, clienteNome:'Amanda Lays Albuquerque de Lima', proc:'0000351-22.2026.5.06.0146', tipo:'Reclamação Trabalhista', stage:'Audiência Agendada', resp:'Dra. Drielle', dataProx:'29/06/2026', priority:'ok', obs:'Presencial – 29/06/2026 às 09:30h', valorCausa:'', formaPagamento:'', parcelas:0, entrada:'', history:[] }
];
