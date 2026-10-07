/*
 * O exemplo da tela: como a prescricao fica na NoHarm quando tudo chegou
 * certo. So aparece com o botao "Ver exemplo" ligado — o estado normal da
 * tela e receber o dado do cliente.
 *
 * Como os itens viram linhas:
 *   { linha: ... }                      -> uma linha solta
 *   { complemento: true, grupo: [...] } -> faixa AZUL: o item e o complemento
 *                                          dele (diluente, veiculo...)
 *   { solucao: true, grupo: [...] }     -> faixa ROXA: grupo de solucao
 */
window.NOHARM_UI_EXEMPLO = (function () {
  const item = (o) =>
    Object.assign(
      {
        score: "",
        scoreColor: "none",
        flag: "0",
        flagColor: "green",
        period: "",
        dose: "",
        freq: "",
        time: "",
        via: "INTRAVENOSA",
        tags: [],
        aware: null,
        msg: false,
        suspenso: false,
        whitelist: false,
        aba: "drugs",
      },
      o
    );

  const paciente = {
    nome: "Paciente 62694",
    completo: true,
    dados: [
      { label: "Idade", valor: "68a", small: "(12/03/1958)" },
      { label: "Sexo", valor: "Masculino" },
      { label: "Altura", valor: "174 cm" },
      { label: "Peso", valor: "81 Kg", small: "(01/10/2026 09:37)" },
      { label: "IMC", valor: "26.75 kg/m²" },
      { label: "Cor da pele", valor: "BRANCA" },
      { label: "Setor", valor: "UTI ADULTO" },
      { label: "Leito", valor: "30202" },
    ],
    atendimento: [
      { label: "Atendimento", valor: "1740192026" },
      { label: "Data de internação", valor: "28/09/2026 14:22" },
      { label: "Setor", valor: "UTI ADULTO" },
      { label: "Setor anterior", valor: "EMERGENCIA" },
      { label: "Leito", valor: "30202" },
      { label: "Segmento", valor: "Adulto" },
      { label: "Prontuário", valor: "19421" },
      { label: "Prescritor", valor: "FERNANDA DE SOUZA LIMA ALVES" },
      { label: "Convênio", valor: "PARTICULAR" },
      { label: "Médico responsável", valor: "CHRISTIAN DE ESCOBAR PRADO" },
    ],
    tags: [
      { key: "info", label: "Dados" },
      { key: "signs", label: "Sinais" },
      { key: "acesso", label: "Acesso" },
      { key: "diseases", label: "Doenças" },
      { key: "complication", label: "Eventos adversos" },
    ],
  };

  const exames = {
    doAtendimento: true,
    lista: [
      { sigla: "CR", valor: "1,84 mg/dL", alerta: true },
      { sigla: "CKD-EPI", valor: "38 mL/min", alerta: true },
      { sigla: "UR", valor: "72 mg/dL", alerta: true },
      { sigla: "K", valor: "4,2 mEq/L" },
      { sigla: "NA", valor: "137 mEq/L" },
      { sigla: "HB", valor: "9,4 g/dL", alerta: true },
      { sigla: "LEUCO", valor: "14.300 /mm³", alerta: true },
      { sigla: "PLAQ", valor: "212.000 /mm³" },
      { sigla: "PCR", valor: "86 mg/L", alerta: true },
      { sigla: "TGO", valor: "34 U/L" },
      { sigla: "TGP", valor: "41 U/L" },
      { sigla: "INR", valor: "1,2" },
    ],
  };

  const alertas = [
    { icon: "fork", valor: 0 },
    { icon: "interacao", valor: 2, alerta: true },
    { icon: "max", valor: 4, alerta: true },
    { icon: "experiment", valor: 1, alerta: true },
    { icon: "hourglass", valor: 0 },
    { icon: "iv", valor: 0 },
    { icon: "alergia", valor: 0 },
    { icon: "sonda", valor: 0 },
    { icon: "duplicidade", valor: 1, alerta: true },
    { icon: "protocolo", valor: 0 },
  ];

  const evolucoes = {
    doAtendimento: true,
    total: 3,
    indicadores: [
      { key: "diseases", valor: 12 },
      { key: "complication", valor: 3 },
      { key: "germes", valor: 1 },
      { key: "medications", valor: 18 },
      { key: "symptoms", valor: 6 },
    ],
    textos: [
      {
        data: "02/10/2026 08:14",
        autor: "Enfermagem",
        texto:
          "Paciente consciente, orientado, afebril. Mantem acesso venoso central em subclavia direita, sem sinais flogisticos. Diurese espontanea.",
      },
      {
        data: "01/10/2026 19:02",
        autor: "Médico assistente",
        texto:
          "Mantida antibioticoterapia com vancomicina. Funcao renal em queda, ajustar dose conforme clearance. Aguardando resultado de cultura.",
      },
      {
        data: "01/10/2026 09:40",
        autor: "Farmacia clínica",
        texto:
          "Revisada prescrição. Sugerida reducao de dose de enoxaparina pelo clearance estimado de 38 mL/min.",
      },
    ],
  };

  const escore = { valor: 87, variacao: "+9,4%", cor: "#f57f17" };

  // o que o "Ver mais" abre: os cartoes de Dados e Sinais, extraidos da
  // evolucao pela NoHarm
  const verMais = {
    info: { texto: "Paciente em uso de acesso venoso central em subclavia direita desde 29/09.", data: "02/10/2026 09:40" },
    sinais: { texto: "eupneico, cabeceira elevada em 30 graus, PA 128x76, FC 82, SpO2 96%", data: "02/10/2026 11:21" },
  };

  const prescricao = {
    id: "17401920262",
    atendimento: "1740192026",
    inicio: "01/10/2026 15:01",
    fim: "02/10/2026 15:59",
    leito: "30202",
    prescritor: "FERNANDA DE SOUZA LIMA ALVES",
    outras: 0,
    codigos: { medicamentos: 14, frequencia: 6, unidades: 5, setores: 1 },
    itens: [
      { linha: item({ nome: "DIPIRONA 500MG/ML 2ML AMP EV", score: "2", scoreColor: "orange", dose: "1 AMP", freq: "06/06h", time: "06:00, 12:00, 18:00, 00:00" }) },
      { linha: item({ nome: "OMEPRAZOL 40MG FA EV", score: "1", scoreColor: "orange", dose: "1 FA", freq: "24/24h", time: "08:00" }) },
      {
        complemento: true,
        grupo: [
          item({ nome: "VANCOMICINA 500MG FA EV", score: "3", scoreColor: "red", flag: "2", flagColor: "red", tags: [["AM", "green"]], aware: 2, period: "D3/10", dose: "1 FA", freq: "12/12h", time: "10:00, 22:00", msg: true }),
          item({ nome: "SORO FISIOLOGICO 0,9% 100ML FR", dose: "1 FR", freq: "12/12h", time: "10:00, 22:00", whitelist: true }),
        ],
      },
      { linha: item({ nome: "ENOXAPARINA 40MG/0,4ML SER SC", score: "2", scoreColor: "red", tags: [["AV", "red"]], dose: "1 SER", freq: "24/24h", time: "20:00", via: "SUBCUTÂNEA", msg: true }) },
      { linha: item({ nome: "METOCLOPRAMIDA 5MG/ML 2ML AMP EV", score: "1", scoreColor: "orange", tags: [["HC", "gold"]], dose: "1 AMP", freq: "08/08h", time: "08:00, 16:00, 00:00", msg: true }) },
      { linha: item({ nome: "MORFINA 10MG/ML 1ML AMP EV", score: "2", scoreColor: "red", tags: [["AV", "red"], ["C", "orange"], ["Q3", "volcano"]], dose: "1 AMP", freq: "06/06h", time: "06:00, 12:00, 18:00, 00:00" }) },
      {
        complemento: true,
        grupo: [
          item({ nome: "INSULINA REGULAR 100UI/ML FA SC", score: "2", scoreColor: "orange", tags: [["AV", "red"], ["Q2", "volcano"]], dose: "6 UI", freq: "Se necessário", via: "SUBCUTÂNEA", msg: true }),
          item({ nome: "AGUA DESTILADA 10ML AMP", dose: "1 AMP", freq: "Se necessário", via: "SUBCUTÂNEA", whitelist: true }),
        ],
      },
      { linha: item({ nome: "FUROSEMIDA 10MG/ML 2ML AMP EV", score: "1", scoreColor: "orange", dose: "2 AMP", freq: "12/12h", time: "08:00, 20:00" }) },
      { linha: item({ nome: "ONDANSETRONA 4MG/2ML AMP EV", dose: "1 AMP", freq: "Dose única", time: "16:00", suspenso: true }) },
      {
        solucao: true,
        grupo: [
          item({ nome: "NORADRENALINA 2MG/ML 4ML AMP EV", score: "3", scoreColor: "red", flag: "2", flagColor: "red", tags: [["AV", "red"]], period: "D2", dose: "4 AMP", freq: "0,3 mcg/kg/min | 12,0 ml/h", msg: true }),
          item({ nome: "SORO GLICOSADO 5% 250ML FR", dose: "1 FR", freq: "12,0 ml/h", whitelist: true }),
        ],
      },
      { linha: item({ nome: "CLORETO DE SÓDIO 0,9% 500ML FR", dose: "1 FR", freq: "12/12h", time: "08:00, 20:00", whitelist: true }) },

      /* aba Procedimentos/Exames — mesmas colunas dos medicamentos */
      { linha: item({ aba: "procedures", nome: "HEMOGRAMA COMPLETO", dose: "1 UN", freq: "24/24h", time: "06:00", via: "-", score: "1", scoreColor: "orange" }) },
      { linha: item({ aba: "procedures", nome: "GASOMETRIA ARTERIAL", dose: "1 UN", freq: "12/12h", time: "06:00, 18:00", via: "-" }) },
      { linha: item({ aba: "procedures", nome: "RAIO-X DE TÓRAX - LEITO", dose: "1 UN", freq: "Dose única", time: "08:00", via: "-" }) },
      { linha: item({ aba: "procedures", nome: "CURATIVO DE ACESSO VENOSO CENTRAL", dose: "1 UN", freq: "24/24h", time: "09:00", via: "-" }) },
      { linha: item({ aba: "procedures", nome: "ELETROCARDIOGRAMA", dose: "1 UN", freq: "Dose única", time: "10:00", via: "-", suspenso: true }) },

      /* aba Dietas/Recomendações — sem score e sem Per. */
      { linha: item({ aba: "diet", nome: "DIETA BRANDA HIPOSSODICA", dose: "1 UN", freq: "06/06h", time: "08:00, 12:00, 18:00, 22:00", via: "ORAL" }) },
      { linha: item({ aba: "diet", nome: "SUPLEMENTO HIPERPROTEICO 200ML", dose: "1 FR", freq: "08/08h", time: "10:00, 16:00, 22:00", via: "ORAL", msg: true }) },
      { linha: item({ aba: "diet", nome: "CONTROLE DE DIURESE", dose: "1 UN", freq: "24/24h", time: "07:00", via: "-" }) },
      { linha: item({ aba: "diet", nome: "CABECEIRA ELEVADA 30 GRAUS", dose: "1 UN", freq: "Contínuo", via: "-" }) },
    ],
  };

  return { paciente, exames, alertas, evolucoes, escore, verMais, prescricao };
})();
