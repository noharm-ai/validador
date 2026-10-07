(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("papaparse"));
  } else {
    root.NoHarmValidator = factory(root.Papa);
  }
})(typeof self !== "undefined" ? self : this, function (Papa) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Padrao NoHarm - Anexo I do Contrato (Integracao de Dados)
  // ---------------------------------------------------------------------------
  // Este bloco e a transcricao literal das tabelas do Anexo I. Campo, tipo,
  // obrigatoriedade (not null) e descricao saem de la e nada mais entra aqui:
  // o documento e o que vai para o cliente, entao o validador tem que cobrar
  // exatamente o que o documento pede.
  //
  // Grupos da validacao (ordem topologica das chaves estrangeiras: Cadastros
  // nao depende de ninguem, Pacientes depende de Cadastros, Prescricoes depende
  // dos dois). O passo a passo do app segue essa ordem.

  const GROUPS = [
    {
      key: "cadastros",
      label: "Cadastros",
      description: "Tabelas auxiliares, consultadas uma vez por dia.",
    },
    {
      key: "pacientes",
      label: "Pacientes",
      description: "Tabelas principais do atendimento, consultadas de 5 em 5 minutos.",
    },
    {
      key: "prescricoes",
      label: "Prescrições",
      description: "Tabelas principais da prescrição, consultadas de 5 em 5 minutos.",
    },
  ];

  // Tipos do Anexo I (referencia PostgreSQL). O motor deriva as regras daqui:
  // numerico, data, booleano e tamanho maximo.
  const NUMBER_TYPES = ["smallint", "integer", "int", "bigint", "float"];

  const parseFieldType = (type) => {
    const raw = String(type).trim().toLowerCase();
    const sized = raw.match(/^(varchar|char)\((\d+)\)$/);
    if (sized) return { kind: "text", maxLength: Number(sized[2]) };
    if (raw === "text" || raw === "varchar") return { kind: "text" };
    if (raw === "boolean") return { kind: "boolean" };
    if (raw === "date" || raw === "datetime") return { kind: "date" };
    if (NUMBER_TYPES.includes(raw)) return { kind: "number" };
    return { kind: "text" };
  };

  // f(nome, tipo, obrigatorio, descricao, extras)
  // extras.sigla     -> campo que carrega sigla/codigo textual, nao pode ser so numero
  // extras.maxDigits -> limite de digitos citado no Anexo I
  const f = (name, type, required, description, extra) =>
    Object.assign({ name, type, required: !!required, description }, extra || {});

  const VIEWS = {
    // -------------------------------------------------------------------------
    // Grupo 1 - Cadastros (Tabelas Auxiliares, consultadas uma vez dia)
    // -------------------------------------------------------------------------
    hospitais: {
      label: "Hospitais",
      view: "View de Hospitais",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      key: ["FKHOSPITAL"],
      // Unica view em que FKHOSPITAL é dado, nao a constante da plataforma:
      // ela e o catalogo e traz os codigos reais das multi-empresas.
      fkhospitalLivre: true,
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("NOME", "varchar(250)", true, "Nome do Hospital"),
      ],
    },
    setores: {
      label: "Setores / Departamentos",
      view: "View de Setores / Departamentos",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      key: ["FKSETOR"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKSETOR", "integer", true, "Identificador único do setor / departamento"),
        f("NOME", "varchar(250)", true, "Nome do Departamento"),
      ],
    },
    unidades: {
      label: "Unidades",
      view: "View de Unidades",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      key: ["FKUNIDADEMEDIDA"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKUNIDADEMEDIDA", "varchar(32)", true, "Identificador da unidade de medida, por exemplo, AMP C/10ML", {
          sigla: true,
        }),
        f("NOME", "varchar(250)", true, "Descrição da unidade"),
      ],
    },
    frequencia: {
      label: "Frequências",
      view: "View de Frequências",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      key: ["FKFREQUENCIA"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKFREQUENCIA", "varchar(50)", true, "Identificador da frequência, por exemplo, 6HS/6HS - 6HS/6HS", {
          sigla: true,
        }),
        f("NOME", "varchar(250)", true, "Descrição da unidade"),
      ],
    },
    vias: {
      label: "Vias",
      view: "View de Vias",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      // View de parametro: uma linha so, com todas as vias num array JSON na
      // coluna VALOR. O `id` e o `value` do Anexo I sao as chaves de dentro do
      // JSON, nao colunas da view.
      key: ["TIPO"],
      fields: [
        f("TIPO", "varchar(50)", true, "Identificador do parâmetro. Valor padrão = 'map-routes'"),
        f("VALOR", "text", true, "Array JSON com as vias: [{\"id\": ..., \"value\": ...}]", {
          jsonList: ["id", "value"],
        }),
        f("UPDATE_AT", "datetime", false, "Data/Hora da última atualização"),
        f("UPDATE_BY", "integer", false, "Identificador do usuário que atualizou. Valor padrão = 0"),
      ],
    },
    medicamentos: {
      label: "Medicamento",
      view: "View de Medicamento",
      group: "cadastros",
      criticality: "essencial",
      frequency: "diaria",
      key: ["FKMEDICAMENTO"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKMEDICAMENTO", "bigint", true, "Identificador único do medicamento do item"),
        f("NOME", "varchar(250)", true, "Nome do medicamento"),
        f("CUSTO", "float", false, "Custo medio do medicamento"),
        f("FKUNIDADEMEDIDACUSTO", "varchar(32)", false, "Unidade de medida do custo"),
        f("NAOPADRONIZADO", "boolean", false, "Indica que o produto não é padronizado"),
      ],
    },
    // -------------------------------------------------------------------------
    // Grupo 2 - Pacientes (Tabelas Principais, consultadas de 5 em 5 minutos)
    // -------------------------------------------------------------------------
    pessoa: {
      label: "Pessoa / Atendimento",
      view: "View de Pessoa / Atendimento",
      group: "pacientes",
      criticality: "essencial",
      frequency: "5min",
      key: ["NRATENDIMENTO"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NOME", "varchar", false, "Nome do paciente (uso apenas dentro da rede do cliente)"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("DTNASCIMENTO", "date", false, "Data de nascimento"),
        f("DTINTERNACAO", "datetime", true, "Data/Hora de internação"),
        f("COR", "varchar(100)", false, "Cor de pele do paciente"),
        f("SEXO", "varchar(1)", false, "Sexo biologico do paciente"),
        f("PESO", "float", false, "Peso cadastrado no atendimento"),
        f("DTPESO", "datetime", false, "Data do peso cadastrado"),
        f("ALTURA", "float", false, "Altura do paciente"),
        f("DTALTA", "datetime", false, "Data/Hora de Alta"),
        f("MOTIVOALTA", "varchar(100)", false, "Motivo da Alta"),
        f("MEDICO_RESPONSAVEL", "varchar(255)", false, "Médico responsável pelo atendimento"),
        f("CIDADE", "varchar(250)", false, "Cidade do paciente"),
        f("IDCID", "varchar(50)", false, "Código do CID do atendimento"),
        f("FKSETOR", "integer", false, "Identificador único do setor / departamento onde o paciente esta em atendimento no momento"),
        f("LEITO", "varchar(16)", false, "Identificador do leito"),
        f("DT_ULTIMA_TRANSFERENCIA", "datetime", false, "Data da última transferência do paciente"),
      ],
      refs: {
        FKSETOR: "setores",
      },
    },
    exame: {
      label: "Exames",
      view: "View de Exames",
      group: "pacientes",
      criticality: "opcional",
      frequency: "5min",
      key: ["FKEXAME"],
      fields: [
        f("FKEXAME", "bigint", true, "Identificador único do exame"),
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento"),
        f("DTEXAME", "datetime", true, "Data/Hora do exame"),
        f("TPEXAME", "varchar(100)", true, "Nome do Exame e Subtipo do Exame (se houver)"),
        f("RESULTADO", "float", false, "Resultado numérico"),
        f("UNIDADE", "varchar(250)", false, "Unidade de medida do exame"),
      ],
      refs: {
        NRATENDIMENTO: "pessoa",
      },
    },
    cultura: {
      label: "Culturas",
      view: "View de Cultura",
      group: "pacientes",
      criticality: "opcional",
      frequency: "5min",
      // O Anexo I nao define chave primaria para esta view.
      key: [],
      fields: [
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("FKEXAME", "bigint", true, "Identificador único do exame"),
        f("FKITEMEXAME", "bigint", true, "Identificador único do item de exame"),
        f("DTPEDIDO", "datetime", true, "Data/Hora do pedido do exame"),
        f("DTCOLETA", "datetime", true, "Data/Hora da coleta do exame"),
        f("DTLIBERACAO", "datetime", true, "Data/Hora da liberacao do laudo do exame"),
        f("NOMEEXAME", "varchar(250)", true, "Nome do exame"),
        f("NOMEMATERIAL", "varchar(250)", true, "Nome do material analisado"),
        f("NOMEMATERIALTIPO", "varchar(250)", true, "Nome do subtipo de material analisado"),
        f("FKMEDICAMENTO", "bigint", false, "Identificador único do medicamento em culturas"),
        f("NOMEMEDICAMENTO", "varchar(250)", false, "Nome do medicamento, caso não fk seja diferente da tabela"),
        f("FKMICROORGANISMO", "bigint", false, "Identificador único do microrganismo em culturas"),
        f("NOMEMICROORGANISMO", "varchar(250)", true, "Nome do microrganismo"),
        f("QTMICROORGANISMO", "float", false, "Quantidade se houver"),
        f("RESULTADO", "varchar(250)", true, "Sensivel ou Resistente"),
        f("SENSIVEL", "boolean", false, "False, True"),
        f("COMPLEMENTO", "varchar(250)", true, "Complemento textual"),
      ],
      refs: {
        NRATENDIMENTO: "pessoa",
        FKMEDICAMENTO: "medicamentos",
      },
    },
    alergia: {
      label: "Alergias",
      view: "View de Alergias",
      group: "pacientes",
      criticality: "opcional",
      frequency: "5min",
      // O Anexo I nao define chave primaria para esta view.
      key: [],
      fields: [
        f("FKPESSOA", "smallint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("DTINTERNACAO", "datetime", true, "Data/Hora de internação"),
        f("FKMEDICAMENTO", "bigint", true, "Identificador único do medicamento do item"),
        f("NOMEMEDICAMENTO", "varchar(250)", true, "Nome do medicamento"),
        f("CREATED_AT", "datetime", true, "Data/Hora de cadastro da alergia"),
        f("CREATED_BY", "int", true, "Registra id do usuário que cadastrou a alergia"),
        f("UPDATED_AT", "datetime", true, "Data/Hora de cancelamento da alergia"),
        f("ATIVO", "boolean", false, "False, True"),
      ],
      refs: {
        NRATENDIMENTO: "pessoa",
        FKMEDICAMENTO: "medicamentos",
      },
    },
    evolucao: {
      label: "Evolução",
      view: "View de Evolução",
      group: "pacientes",
      criticality: "opcional",
      frequency: "5min",
      key: ["FKEVOLUCAO"],
      fields: [
        f("FKEVOLUCAO", "bigint", true, "Identificador único da evolução"),
        f("DTEVOLUCAO", "datetime", true, "Data da Evolução"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento"),
        f("NOME", "varchar(255)", false, "Nome do Profissional"),
        f("CARGO", "varchar(255)", false, "Cargo do Profissional"),
        f("TEXTO", "text", false, "Texto completo da Evolução"),
      ],
      refs: {
        NRATENDIMENTO: "pessoa",
      },
    },
    transferencia: {
      label: "Transferências",
      view: "View de Transferências",
      group: "pacientes",
      criticality: "opcional",
      frequency: "5min",
      // O Anexo I nao define chave primaria para esta view.
      key: [],
      fields: [
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("FKSETOR", "integer", true, "Identificador único do setor / departamento"),
        f("NOMESETOR", "varchar(250)", true, "Nome do Departamento"),
        f("LEITO", "varchar(16)", false, "Identificador do leito"),
        f("DTENTRADA", "datetime", true, "Data/Hora de entrada no departamento"),
        f("DTSAIDA", "datetime", true, "Data/Hora de saída do departamento"),
        f("AGRUPADA", "boolean", false, "Valor padrão = True"),
      ],
      refs: {
        NRATENDIMENTO: "pessoa",
        FKSETOR: "setores",
      },
    },

    // -------------------------------------------------------------------------
    // Grupo 3 - Prescricoes (Tabelas Principais, consultadas de 5 em 5 minutos)
    // -------------------------------------------------------------------------
    prescricoes: {
      label: "Prescrições e Itens",
      view: "View de Prescrições e Itens da Prescrição",
      group: "prescricoes",
      criticality: "essencial",
      frequency: "5min",
      key: ["FKPRESMED"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKSETOR", "integer", true, "Identificador único do setor / departamento"),
        f("FKPRESCRICAO", "bigint", true, "Identificador único da prescrição"),
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("DTPRESCRICAO", "datetime", true, "Data/Hora de liberacao da prescrição (início da vigencia)"),
        f("DTCRIACAO_ORIGEM", "datetime", true, "Data/Hora de criacao da prescrição"),
        f("DTVIGENCIA", "datetime", true, "Data/Hora de fim de vigencia da prescrição"),
        f("DTATUALIZACAO", "datetime", true, "Data/Hora de atualização do item prescrito (caso exista)"),
        f("LEITO", "varchar(16)", false, "Identificador do leito"),
        f("PRONTUARIO", "integer", false, "Identificador do prontuario"),
        // O Anexo I lista PRESCRITOR duas vezes, varchar(250) e varchar(255).
        // Usamos o maior para nao reprovar dado que o documento aceita.
        f("PRESCRITOR", "varchar(255)", false, "Nome do prescritor / Médico prescritor"),
        f("FKPRESMED", "bigint", true, "Identificador único do item prescrito (pode ser uma composicao concat(fkprescricao, nritem)"),
        f("FKMEDICAMENTO", "bigint", true, "Identificador único do medicamento do item"),
        f("FKUNIDADEMEDIDA", "varchar(50)", true, "Identificador único da unidade de medida do item (sigla da unidade de medida)", {
          sigla: true,
        }),
        f("FKFREQUENCIA", "varchar(50)", true, "Identificador único da frequência do item (sigla da frequência)", {
          sigla: true,
        }),
        f("DOSE", "float", true, "Dose prescrita do item"),
        f("VIA", "varchar(50)", false, "Via prescrita do item"),
        f("HORARIO", "varchar(600)", false, "Horario / Aprazamento prescrito do item"),
        f("COMPLEMENTO", "text", false, "Observações, Justificativa, Recomendações, Protocolo e demais textos concatenados."),
        f("ORIGEM", "varchar(13)", false, "Medicamentos / Solucoes / Proced/Exames / Dietas"),
        f("DTSUSPENSAO", "datetime", false, "Data da Suspensao do item"),
        f("SLAGRUPAMENTO", "smallint", false, "Grupo de solução que o item pertence"),
        f("SLACM", "varchar(1)", false, "Se item da solução é ACM ou SN (S ou N)"),
        f("SLETAPAS", "smallint", false, "Em quantas etapas a solução será administrada"),
        f("SLHORAFASE", "float", false, "Horario de aplicação da solução"),
        f("SLTEMPOAPLICACAO", "smallint", false, "Tempo de aplicação da solução"),
        f("SLDOSAGEM", "float", false, "Dose de aplicação da solução"),
        f("SLTIPODOSAGEM", "varchar(16)", false, "Unidade de aplicação da solução"),
        f("CONVENIO", "varchar(100)", false, "Convenio do paciente"),
        f("PERÍODO", "int", false, "Duracao (em dias) do período atual de uso do medicamento."),
        f("PERIODO_TOTAL", "int", false, "Duracao total (em dias) prevista para o uso do medicamento."),
        f("ALERGIA", "char(1)", false, "Se paciente tem alergia S ou não N"),
        f("ESPECIALIDADE", "varchar(100)", false, "Especialidade médica do prescritor"),
      ],
      refs: {
        FKSETOR: "setores",
        FKMEDICAMENTO: "medicamentos",
        FKUNIDADEMEDIDA: "unidades",
        FKFREQUENCIA: "frequencia",
      },
    },
    conciliacao: {
      label: "Conciliação",
      view: "View de Conciliação",
      group: "prescricoes",
      criticality: "opcional",
      frequency: "5min",
      key: ["FKPRESMED"],
      fields: [
        f("FKHOSPITAL", "smallint", true, "Identificador único do hospital"),
        f("FKSETOR", "integer", true, "Identificador único do setor / departamento"),
        f("FKPRESCRICAO", "bigint", true, "Identificador único da prescrição"),
        f("FKPESSOA", "bigint", true, "Identificador único do paciente"),
        f("NRATENDIMENTO", "bigint", true, "Identificador único do atendimento", { maxDigits: 9 }),
        f("CONVENIO", "varchar(100)", false, "Convenio do paciente"),
        f("DTPRESCRICAO", "datetime", true, "Data/Hora de liberacao da prescrição"),
        f("DTSUSPENSAO", "datetime", true, "Data/Hora de suspensao do item da conciliação"),
        f("LEITO", "varchar(16)", false, "Identificador do leito"),
        f("PRONTUARIO", "integer", false, "Identificador do prontuario"),
        f("FKPRESMED", "bigint", true, "Identificador único do item prescrito (pode ser uma composicao concat(fkprescricao, nritem)"),
        f("PRESCRITOR", "varchar(250)", false, "Nome do prescritor"),
        f("FKMEDICAMENTO", "bigint", true, "Identificador único do medicamento do item, se for apenas texto sem cadastro associado, valor padrão = 0"),
        f("FKUNIDADEMEDIDA", "varchar(32)", false, "Identificador único da unidade de medida do item (sigla da unidade de medida)", {
          sigla: true,
        }),
        f("FKFREQUENCIA", "varchar(50)", false, "Identificador único da frequência do item (sigla da frequência)", {
          sigla: true,
        }),
        f("DOSE", "float", false, "Dose prescrita do item"),
        f("VIA", "varchar(50)", false, "Via prescrita do item"),
        f("HORARIO", "varchar(600)", false, "Descrição do nome do medicamento se for texto escrito em campo aberto"),
        f("ORIGEM", "varchar(13)", false, "Valor padrão = 'Medicamentos'"),
        f("CONCILIA", "char(1)", false, "Valor padrão = 'S'"),
      ],
      refs: {
        FKSETOR: "setores",
        FKMEDICAMENTO: "medicamentos",
        FKUNIDADEMEDIDA: "unidades",
        FKFREQUENCIA: "frequencia",
      },
      // O Anexo I define 0 como valor padrao de FKMEDICAMENTO quando o item e
      // texto livre sem cadastro, entao 0 nao e cobrado na referencia cruzada.
      refIgnore: {
        FKMEDICAMENTO: ["0"],
      },
    },
  };

  const FILE_TYPES = Object.keys(VIEWS).map((key) => ({
    key,
    label: VIEWS[key].label,
    view: VIEWS[key].view,
    group: VIEWS[key].group,
    criticality: VIEWS[key].criticality,
    frequency: VIEWS[key].frequency,
  }));

  // Deriva as regras do motor a partir da transcricao do Anexo I. Nada de
  // regra escrita a mao aqui: mudou o documento, muda o array de fields.
  const buildFileSchema = (view) => {
    const required = [];
    const allowed = [];
    const number = [];
    const date = [];
    const boolean = [];
    const notNumber = [];
    const maxLength = {};
    const maxDigits = {};
    const jsonList = {};

    view.fields.forEach((field) => {
      allowed.push(field.name);
      if (field.required) required.push(field.name);

      const parsed = parseFieldType(field.type);
      if (parsed.kind === "number") number.push(field.name);
      if (parsed.kind === "date") date.push(field.name);
      if (parsed.kind === "boolean") boolean.push(field.name);
      if (parsed.maxLength) maxLength[field.name] = parsed.maxLength;
      if (field.sigla) notNumber.push(field.name);
      if (field.maxDigits) maxDigits[field.name] = field.maxDigits;
      if (field.jsonList) jsonList[field.name] = field.jsonList;
    });

    return {
      label: view.label,
      view: view.view,
      group: view.group,
      criticality: view.criticality,
      frequency: view.frequency,
      fields: view.fields,
      required,
      allowed,
      key: view.key || [],
      typeHints: { number, date, boolean, notNumber, maxLength, maxDigits, jsonList },
      refs: view.refs || {},
      refIgnore: view.refIgnore || {},
      fkhospitalLivre: !!view.fkhospitalLivre,
    };
  };

  const NOHARM_SCHEMA = {
    label: "NoHarm",
    groups: GROUPS,
    files: Object.keys(VIEWS).reduce((acc, key) => {
      acc[key] = buildFileSchema(VIEWS[key]);
      return acc;
    }, {}),
  };

  const MAX_ERRORS = 200;
  const MAX_SAMPLES = 5;
  // Valores distintos guardados por grupo. Servem para dizer ao cliente, na
  // etapa de origem do erro, exatamente o que incluir. Limitado para nao
  // inchar o progresso salvo no localStorage.
  const MAX_DISTINCT_VALUES = 100;
  const NORMALIZATION_MODE = "lower";

  const DATE_FORMAT_LABEL = "YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS";

  // FKHOSPITAL é constante, nao dado: a NoHarm identifica o hospital como 1 por
  // integridade da plataforma. Rede com varios hospitais se resolve no filtro da
  // view (WHERE), nunca no SELECT.
  const FKHOSPITAL_FIXO = "1";

  // Dicas para os erros que mais aparecem em extracao de hospital. A ideia e
  // dizer o que provavelmente está errado no CSV, nao so que o valor falhou.
  const HINTS = {
    csvFieldCount: {
      title: "Linhas com quantidade de colunas diferente do cabeçalho",
      detail:
        "Na maioria das vezes o CSV está errado, não o dado. A causa mais comum é número decimal com vírgula sem aspas: CUSTO 0,0909 vira duas colunas (0 e 0909). Exporte números com ponto decimal (0.0909) ou coloque aspas em todos os valores. Essas linhas ficam com as colunas deslocadas e são ignoradas nas demais validações.",
    },
    csvDecimalComma: {
      title: "Suspeita de separador decimal vírgula",
      detail:
        "As colunas extras encontradas são apenas dígitos, o que indica número quebrado pela vírgula decimal (ex.: DOSE 2,5 / PESO 78,5 / CUSTO 0,0909). Troque a vírgula por ponto na origem ou envie o campo entre aspas.",
    },
    csvSingleColumn: {
      title: "Arquivo inteiro em uma única coluna",
      detail:
        "O cabeçalho foi lido como um campo só. Normalmente cada linha do arquivo foi envolvida por aspas e as aspas internas foram duplicadas (ex.: \"FKEXAME,\"\"FKPESSOA\"\",...\"). Reexporte sem esse escape extra: aspas só nos campos que precisam.",
    },
    csvDelimiter: {
      title: "Delimitador não identificado",
      detail:
        "Não foi possível detectar o separador de colunas. Use vírgula como delimitador e mantenha o cabeçalho na primeira linha.",
    },
    encoding: {
      title: "Arquivo não esta em UTF-8",
      detail:
        "Foram encontrados caracteres inválidos (Lact?rio, Dipirona S?dica). O arquivo provavelmente está em Latin-1 / Windows-1252. Reexporte em UTF-8, senao acentos e cedilha chegam corrompidos na NoHarm.",
    },
    dateFormat: {
      title: "Formato de data fora do padrão",
      detail:
        "A NoHarm espera data em ISO: " +
        DATE_FORMAT_LABEL +
        ". Formatos com barra (dd/mm/aa) são ambíguos: 06/08/26 tanto pode ser 6 de agosto quanto 8 de junho, e o ano de 2 dígitos não diz o século (25 = 1925 ou 2025?), o que é crítico em DTNASCIMENTO. Converta as datas na origem.",
    },
    boolean: {
      title: "Valor booleano fora do padrão",
      detail:
        "Valores aceitos: true, false, 0, 1, S, N, SIM, NÃO. Extrações Oracle costumam mandar T/F, que não é aceito hoje. Converta na origem (T -> 1, F -> 0).",
    },
    notNumber: {
      title: "Campo de sigla preenchido com número",
      detail:
        "FKUNIDADEMEDIDA e FKFREQUENCIA devem trazer a sigla/código textual usado na prescrição (ex.: MG, AMP C/10ML, 8/8), não o ID interno da tabela.",
    },
    missingFields: {
      title: "Campos obrigatórios ausentes",
      detail:
        "Confira o cabeçalho contra os modelos disponíveis para download. Nomes de coluna são comparados sem diferenciar maiusculas/minusculas, mas precisam existir. Colunas a mais na view não são problema: o validador ignora o que não precisa.",
    },
    fkhospital: {
      title: "FKHOSPITAL tem que ser 1",
      detail:
        "Não é erro da sua view: a NoHarm identifica o hospital como 1, sempre. Esse número é fixo por integridade da plataforma, não é o código do hospital no seu sistema. Mesmo com vários hospitais na rede, todos entram como 1 — o recorte de quais hospitais participam fica no filtro da view (WHERE CD_MULTI_EMPRESA IN ...), nunca no SELECT. As tabelas de domínio (unidades, frequências, medicamentos) são uma só, com DISTINCT, porque não há frequência nem medicamento duplicado por hospital. A única exceção é a view de Hospitais, que é o catálogo e traz os códigos reais. Trocar o 1 pelo código real do hospital nas demais views quebra a integração.",
    },
    refMissing: {
      title: "Referência cruzada quebrada",
      detail:
        "O valor da chave estrangeira não existe no arquivo referenciado. A causa mais comum é o filtro da view de domínio: se a view de setores traz só uma multi-empresa (WHERE CD_MULTI_EMPRESA = 1) mas os pacientes vêm de várias, os setores das outras faltam. Inclua todas as unidades da integração no filtro. Também acontece quando os arquivos foram extraídos em momentos diferentes — extraia todos no mesmo instante.",
    },
    keyEmpty: {
      title: "Chave primária vazia",
      detail: "Todo registro precisa da chave preenchida, senao a NoHarm não consegue identificar nem atualizar o registro.",
    },
    duplicateKey: {
      title: "Chaves duplicadas",
      detail: "A chave precisa ser única no arquivo. Verifique se a view esta duplicando linhas por join.",
    },
    maxLength: {
      title: "Valor maior que o tamanho aceito",
      detail: "O campo excede o limite do padrão NoHarm e seria truncado na ingestão. Ajuste na origem.",
    },
    numberFormat: {
      title: "Valor não numérico em campo numérico",
      detail:
        "Se o arquivo também acusou erro de quantidade de colunas, provavelmente é reflexo do deslocamento causado pela vírgula decimal. Corrija o CSV primeiro e revalide.",
    },
    jsonList: {
      title: "Coluna com array JSON fora do formato",
      detail:
        "A view de Vias manda todas as vias numa linha só, com o array JSON na coluna VALOR. Se você usou a variante com LISTAGG (Oracle 12.1 ou inferior), confira o escape: nome de via com aspas, acento ou vírgula quebra a montagem manual do JSON. Nas versoes 12c/19c prefira JSON_ARRAYAGG + JSON_OBJECT, que escapa sozinho.",
    },
    jsonRoot: {
      title: "JSON com estrutura errada",
      detail: "O JSON deve ser um array plano de objetos: [{...}, {...}]. Não use envelope { data: [...] } nem hierarquia.",
    },
    parse: {
      title: "Falha na leitura do arquivo",
      detail: "O arquivo não pode ser lido. Confira se ele está completo e no formato declarado pela extensão.",
    },
  };

  const normalizeField = (name) => {
    if (!name) return "";
    return String(name).trim().toLowerCase();
  };

  const normalizeFields = (fields) => fields.map((field) => normalizeField(field));

  const isEmptyValue = (val) => val === null || val === undefined || String(val).trim() === "";

  const isNumberValue = (val) => {
    if (isEmptyValue(val)) return true;
    const num = Number(String(val).replace(",", "."));
    return Number.isFinite(num);
  };

  // Formatos ISO aceitos. new Date() nao serve aqui: ele le "06/08/26" como
  // mm/dd e aceita silenciosamente a data com dia e mes trocados, reprovando
  // so quando o dia passa de 12.
  const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/;

  const isDateValue = (val) => {
    if (isEmptyValue(val)) return true;
    const value = String(val).trim();
    if (!ISO_DATE_ONLY.test(value) && !ISO_DATE_TIME.test(value)) return false;

    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(5, 7));
    const day = Number(value.slice(8, 10));
    if (month < 1 || month > 12 || day < 1) return false;
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day > daysInMonth) return false;

    if (value.length > 10) {
      const hour = Number(value.slice(11, 13));
      const minute = Number(value.slice(14, 16));
      const second = value.length > 16 ? Number(value.slice(17, 19)) : 0;
      if (hour > 23 || minute > 59 || second > 59) return false;
    }
    return true;
  };

  // Diz por que a data nao passou, para a mensagem ficar acionavel.
  const describeDateProblem = (val) => {
    const value = String(val).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) return "formato dd/mm/aa (ano de 2 dígitos, ambíguo)";
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) return "formato dd/mm/aaaa";
    if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(value)) return "formato dd-mm-aaaa";
    if (/^\d{4}\d{2}\d{2}$/.test(value)) return "formato aaaammdd sem separador";
    if (ISO_DATE_ONLY.test(value) || ISO_DATE_TIME.test(value)) return "data inexistente no calendario";
    return "formato não reconhecido";
  };

  const isBooleanValue = (val) => {
    if (isEmptyValue(val)) return true;
    const v = String(val).trim().toLowerCase();
    return ["true", "false", "0", "1", "s", "n", "sim", "nao"].includes(v);
  };

  const guessFormat = (fileName) => {
    const parts = fileName.split(".");
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
    if (ext === "json") return "json";
    if (ext === "csv") return "csv";
    return "auto";
  };

  const parseJson = (text) => {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return { records: parsed, root: "array" };
    }
    if (parsed && Array.isArray(parsed.data)) {
      return { records: parsed.data, root: "object-data" };
    }
    return { records: null, root: "object" };
  };

  const parseCsv = (text) =>
    new Promise((resolve) => {
      if (!Papa) {
        resolve({ data: [], errors: [{ message: "PapaParse not available" }], meta: { fields: [] } });
        return;
      }
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimitersToGuess: [",", ";", "\t", "|"],
        complete: (results) => resolve(results),
      });
    });

  const buildKey = (record, keyFields) => keyFields.map((field) => record[field]).join("|");

  const EXTRA_FIELD_KEY = "__parsed_extra";

  // Transforma os erros crus do PapaParse em ocorrencias agrupaveis que
  // apontam a linha do arquivo e o que sobrou nela.
  const describeCsvErrors = (csvErrors, records, headerCount) => {
    const entries = [];
    const hintKeys = new Set();
    let numericExtras = 0;
    let fieldCountErrors = 0;

    csvErrors.forEach((err) => {
      const at = typeof err.row === "number" ? `linha ${err.row + 2}` : "arquivo";

      if (err.code === "TooManyFields" || err.code === "TooFewFields") {
        fieldCountErrors += 1;
        const record = typeof err.row === "number" ? records[err.row] : null;
        const extras = record && Array.isArray(record[EXTRA_FIELD_KEY]) ? record[EXTRA_FIELD_KEY] : [];
        if (extras.length && extras.every((value) => /^\d+$/.test(String(value).trim()))) {
          numericExtras += 1;
        }
        const found =
          err.code === "TooManyFields"
            ? `${headerCount + extras.length} colunas`
            : "menos colunas que o cabeçalho";
        const detail = extras.length ? `, sobrou ${extras.map((v) => JSON.stringify(v)).join(" e ")}` : "";
        entries.push({
          group: `Linha com quantidade de colunas diferente do cabeçalho (cabeçalho tem ${headerCount}).`,
          sample: `${at}, ${found}${detail}`,
          hint: "csvFieldCount",
        });
        hintKeys.add("csvFieldCount");
        return;
      }

      if (err.code === "UndetectableDelimiter") {
        entries.push({ group: "Delimitador de colunas não identificado.", sample: err.message, hint: "csvDelimiter" });
        hintKeys.add("csvDelimiter");
        return;
      }

      entries.push({ group: `Erro de leitura do CSV: ${err.code || "desconhecido"}.`, sample: `${at}, ${err.message}`, hint: "parse" });
      hintKeys.add("parse");
    });

    if (fieldCountErrors && numericExtras / fieldCountErrors > 0.5) {
      hintKeys.add("csvDecimalComma");
    }

    return { entries, hintKeys: Array.from(hintKeys) };
  };

  const parseFileText = async (fileName, text) => {
    const format = guessFormat(fileName);
    const parseIssues = [];
    const parseHints = new Set();
    let records = [];
    let fields = [];
    let detectedFormat = format;
    let root = null;
    let malformedRows = new Set();

    // O browser le o arquivo como UTF-8. Byte invalido vira U+FFFD, entao a
    // presenca desse caractere denuncia arquivo em Latin-1 / Windows-1252.
    const replacementChars = (String(text).match(/�/g) || []).length;

    try {
      if (format === "json" || format === "auto") {
        try {
          const parsed = parseJson(text);
          root = parsed.root;
          if (!parsed.records) {
            throw new Error("JSON não esta no formato esperado");
          }
          records = parsed.records;
          detectedFormat = "json";
        } catch (err) {
          if (format === "json") {
            throw err;
          }
        }
      }

      if (detectedFormat !== "json") {
        const csv = await parseCsv(text);
        records = csv.data || [];
        fields = (csv.meta && csv.meta.fields) || [];
        detectedFormat = "csv";

        if (csv.errors && csv.errors.length) {
          const described = describeCsvErrors(csv.errors, records, fields.length);
          parseIssues.push(...described.entries);
          described.hintKeys.forEach((hint) => parseHints.add(hint));
        }

        // Linha com contagem de colunas diferente do cabecalho tem os valores
        // deslocados: validar tipo/refs nela so gera ruido derivado.
        records.forEach((record, idx) => {
          if (record && typeof record === "object" && EXTRA_FIELD_KEY in record) {
            malformedRows.add(idx);
            delete record[EXTRA_FIELD_KEY];
          }
        });

        if (fields.length === 1 && /[,;|\t]/.test(fields[0])) {
          parseHints.add("csvSingleColumn");
        }
      } else {
        fields = Array.from(
          records.reduce((acc, row) => {
            if (row && typeof row === "object" && !Array.isArray(row)) {
              Object.keys(row).forEach((key) => acc.add(key));
            }
            return acc;
          }, new Set())
        );
      }
    } catch (err) {
      parseIssues.push({ group: `Erro ao ler arquivo: ${err.message}`, sample: null, hint: "parse" });
      parseHints.add("parse");
    }

    if (replacementChars) {
      parseHints.add("encoding");
    }

    const normalizedFields = fields.map((fieldName) => normalizeField(fieldName));
    const normalizedRecords = records.map((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return record;
      const out = {};
      Object.entries(record).forEach(([key, value]) => {
        out[normalizeField(key)] = value;
      });
      return out;
    });

    return {
      fileName,
      format: detectedFormat,
      root,
      fields,
      normalizedFields,
      records: normalizedRecords,
      rawRecords: records,
      parseIssues,
      parseErrors: parseIssues.map((issue) => (issue.sample ? `${issue.group} (${issue.sample})` : issue.group)),
      parseHints: Array.from(parseHints),
      malformedRows,
      replacementChars,
    };
  };

  // Agrupa ocorrencias iguais para o relatorio nao virar 10 mil linhas
  // repetidas, mantendo a contagem real e alguns exemplos.
  const createIssueCollector = () => {
    const groups = new Map();
    const hintKeys = new Set();
    let total = 0;

    return {
      // `extra` anexa dado estruturado ao grupo. Hoje serve para `refFile`: a
      // view que precisa ser corrigida quando a chave estrangeira quebra — e o
      // que deixa a UI oferecer o atalho para a etapa certa.
      // `sampleKey` deduplica: 52 linhas apontando para o mesmo setor 809 sao
      // um problema so. O que o cliente precisa ver e quais valores distintos
      // estao quebrados, nao as primeiras linhas em que apareceram.
      add(group, sample, hintKey, extra, sampleKey) {
        total += 1;
        let entry = groups.get(group);
        if (!entry) {
          entry = { message: group, count: 0, samples: [], distinct: new Set(), distinctValues: [] };
          groups.set(group, entry);
        }
        entry.count += 1;

        if (sampleKey === undefined) {
          if (sample && entry.samples.length < MAX_SAMPLES) entry.samples.push(sample);
        } else if (!entry.distinct.has(sampleKey)) {
          entry.distinct.add(sampleKey);
          if (entry.distinctValues.length < MAX_DISTINCT_VALUES) entry.distinctValues.push(sampleKey);
          if (sample && entry.samples.length < MAX_SAMPLES) entry.samples.push(sample);
        }

        if (hintKey) hintKeys.add(hintKey);
        if (extra) Object.assign(entry, extra);
      },
      get total() {
        return total;
      },
      get groupCount() {
        return groups.size;
      },
      toGroups() {
        return Array.from(groups.values())
          .map((entry) => {
            const { distinct, distinctValues, ...rest } = entry;
            // distinctCount e distinctValues so existem quando a regra
            // deduplica por valor.
            return distinct.size ? Object.assign(rest, { distinctCount: distinct.size, distinctValues }) : rest;
          })
          .sort((a, b) => b.count - a.count);
      },
      toHints() {
        return Array.from(hintKeys)
          .filter((key) => HINTS[key])
          .map((key) => ({ key, title: HINTS[key].title, detail: HINTS[key].detail }));
      },
    };
  };

  const formatGroupLine = (group) => {
    const base = group.count > 1 ? `${group.count}x ${group.message}` : group.message;
    if (!group.samples.length) return base;
    return `${base} | ex.: ${group.samples[0]}`;
  };

  const buildValidationForSchema = (activeSchema, parsedFiles, options) => {
    const validation = {};
    const settings = options || {};

    // Views ja validadas em passos anteriores entram so como indice de chaves,
    // sem precisar do arquivo de novo.
    const externalIndexes = settings.externalIndexes || {};
    const only = settings.only ? new Set(settings.only) : null;

    const indexes = {};
    Object.entries(externalIndexes).forEach(([fileKey, keys]) => {
      if (Array.isArray(keys)) indexes[fileKey] = new Set(keys.map((key) => String(key)));
    });

    FILE_TYPES.forEach((file) => {
      const fileSchema = activeSchema.files[file.key];
      const data = parsedFiles[file.key];
      const keyFields = normalizeFields(fileSchema.key);
      if (!data || !data.records) return;
      if (!keyFields.length) return;
      const index = new Set();
      // O arquivo recem-enviado tem prioridade sobre o indice persistido.
      data.records.forEach((record, idx) => {
        if (!record || typeof record !== "object") return;
        if (data.malformedRows && data.malformedRows.has(idx)) return;
        const key = buildKey(record, keyFields);
        if (!isEmptyValue(key)) index.add(key);
      });
      indexes[file.key] = index;
    });

    FILE_TYPES.forEach((file) => {
      if (only && !only.has(file.key)) return;
      const fileSchema = activeSchema.files[file.key];
      const data = parsedFiles[file.key];
      const collector = createIssueCollector();
      const warnings = [];

      // View OPCIONAL no Anexo I que o cliente escolheu nao enviar sai da conta:
      // nao e erro, nao e alerta, so nao foi validada.
      if (!data && fileSchema.criticality === "opcional") {
        validation[file.key] = {
          status: "skipped",
          issues: [],
          issueGroups: [],
          issueCount: 0,
          hints: [],
          warnings: [],
        };
        return;
      }

      if (!data) {
        validation[file.key] = {
          status: "error",
          issues: ["Arquivo não carregado."],
          issueGroups: [{ message: "Arquivo não carregado.", count: 1, samples: [] }],
          issueCount: 1,
          hints: [],
          warnings: [],
        };
        return;
      }

      const malformedRows = data.malformedRows || new Set();

      (data.parseIssues || []).forEach((issue) => collector.add(issue.group, issue.sample, issue.hint));

      if (data.replacementChars) {
        collector.add(
          `Arquivo com ${data.replacementChars} caractere(s) inválido(s) de codificação (não esta em UTF-8).`,
          null,
          "encoding"
        );
      }

      if (data.format === "json" && data.root === "object-data") {
        collector.add(
          "JSON possui raiz com campo data. O formato deve ser um array direto de registros.",
          null,
          "jsonRoot"
        );
      }

      if (data.format === "json" && data.root === "object") {
        collector.add("JSON deve ser um array de objetos (lista de registros).", null, "jsonRoot");
      }

      if (data.records.length === 0) {
        warnings.push("Arquivo sem registros.");
      }

      const requiredAll = fileSchema.required || [];
      const allowedAll = fileSchema.allowed || requiredAll;
      const requiredNormalized = normalizeFields(requiredAll);
      const allowedNormalized = normalizeFields(allowedAll);
      const fieldSet = new Set(data.normalizedFields);

      const missingFields = requiredAll.filter((field, idx) => !fieldSet.has(requiredNormalized[idx]));
      if (missingFields.length) {
        collector.add(`Campos faltando: ${missingFields.join(", ")}`, null, "missingFields");
      }

      // Coluna fora do Anexo I nao e erro: o cliente pode ter campos proprios na
      // view. O validador so olha os campos que precisa usar, contanto que os
      // obrigatorios estejam la.
      const extraFields = data.fields.filter((field, idx) => !allowedNormalized.includes(data.normalizedFields[idx]));

      // FKHOSPITAL é constante da plataforma, nao dado do hospital: rede com
      // varios hospitais se resolve no filtro da view, nunca no SELECT. A view
      // de Hospitais e a excecao — ela e o catalogo e traz os codigos reais.
      if (!fileSchema.fkhospitalLivre && allowedNormalized.includes("fkhospital") && fieldSet.has("fkhospital")) {
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object" || Array.isArray(record)) return;
          if (malformedRows.has(idx)) return;
          const value = record.fkhospital;
          if (isEmptyValue(value)) return;
          if (String(value).trim() !== FKHOSPITAL_FIXO) {
            collector.add(
              `FKHOSPITAL deve ser ${FKHOSPITAL_FIXO} (valor fixo da plataforma).`,
              `registro ${idx + 1}, valor ${JSON.stringify(value)}`,
              "fkhospital",
              null,
              String(value)
            );
          }
        });
      }

      const { typeHints } = fileSchema;
      if (typeHints && data.records.length) {
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object" || Array.isArray(record)) return;
          if (malformedRows.has(idx)) return;
          const at = `registro ${idx + 1}`;

          const camposJson = typeHints.jsonList || {};
          const normalizadosJson = Object.keys(camposJson).map((field) => normalizeField(field));

          Object.entries(record).forEach(([field, value]) => {
            if (normalizadosJson.includes(field)) return;
            if (value && typeof value === "object") {
              collector.add(`${field.toUpperCase()} contem objeto/array (o dado precisa ser flat).`, at, "parse");
            }
          });

          // Coluna que carrega um array JSON (a view de Vias manda todas as vias
          // numa linha so). Aceita tanto o texto quanto o array ja parseado,
          // porque depende de como o cliente exportou.
          Object.entries(camposJson).forEach(([field, chaves]) => {
            const value = record[normalizeField(field)];
            if (isEmptyValue(value)) return;

            let lista = value;
            if (typeof value === "string") {
              try {
                lista = JSON.parse(value);
              } catch (err) {
                collector.add(`${field} não é um JSON válido.`, `${at}, ${err.message}`, "jsonList");
                return;
              }
            }

            if (!Array.isArray(lista)) {
              collector.add(`${field} deve ser um array JSON.`, at, "jsonList");
              return;
            }
            if (!lista.length) {
              collector.add(`${field} veio com o array vazio.`, at, "jsonList");
              return;
            }

            const faltando = new Set();
            lista.forEach((item) => {
              if (!item || typeof item !== "object" || Array.isArray(item)) {
                faltando.add("__item__");
                return;
              }
              const presentes = Object.keys(item).map((key) => normalizeField(key));
              chaves.forEach((chave) => {
                if (!presentes.includes(normalizeField(chave))) faltando.add(chave);
              });
            });

            if (faltando.has("__item__")) {
              collector.add(`${field} deve ser um array de objetos.`, at, "jsonList");
              faltando.delete("__item__");
            }
            if (faltando.size) {
              collector.add(
                `${field}: item sem ${Array.from(faltando).join(" e ")}. Esperado [{${chaves
                  .map((chave) => `"${chave}": ...`)
                  .join(", ")}}].`,
                at,
                "jsonList"
              );
            }
          });

          (typeHints.number || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isNumberValue(value)) {
              collector.add(
                `${field} deve ser número.`,
                `${at}, valor ${JSON.stringify(value)}`,
                "numberFormat",
                null,
                String(value)
              );
            }
          });

          (typeHints.date || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isDateValue(value)) {
              collector.add(
                `${field} fora do formato de data aceito (use ${DATE_FORMAT_LABEL}).`,
                `${at}, valor ${JSON.stringify(value)} - ${describeDateProblem(value)}`,
                "dateFormat",
                null,
                String(value)
              );
            }
          });

          (typeHints.boolean || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isBooleanValue(value)) {
              collector.add(
                `${field} deve ser booleano.`,
                `${at}, valor ${JSON.stringify(value)}`,
                "boolean",
                null,
                String(value)
              );
            }
          });

          (typeHints.notNumber || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isEmptyValue(value) && isNumberValue(value)) {
              collector.add(
                `${field} não pode ser somente número, deve ser a sigla/código (ex.: AMP C/10ML, 8/8).`,
                `${at}, valor ${JSON.stringify(value)}`,
                "notNumber",
                null,
                String(value)
              );
            }
          });

          Object.entries(typeHints.maxDigits || {}).forEach(([field, max]) => {
            const value = record[normalizeField(field)];
            if (isEmptyValue(value)) return;
            const digits = String(value).trim().replace(/\D/g, "");
            if (digits.length > max) {
              collector.add(
                `${field} deve ter no máximo ${max} dígitos.`,
                `${at}, valor ${JSON.stringify(value)}`,
                "maxLength"
              );
            }
          });

          Object.entries(typeHints.maxLength || {}).forEach(([field, max]) => {
            const value = record[normalizeField(field)];
            if (isEmptyValue(value)) return;
            if (String(value).length > max) {
              collector.add(
                `${field} deve ter no máximo ${max} caracteres.`,
                `${at}, ${String(value).length} caracteres`,
                "maxLength"
              );
            }
          });
        });
      }

      // Chave primaria so e cobrada nas views em que o Anexo I define um
      // identificador unico. Onde o documento nao define, nao inventamos chave
      // e portanto nao ha checagem de duplicidade.
      const keyFields = normalizeFields(fileSchema.key);
      if (keyFields.length) {
        const duplicates = new Set();
        const keyLabel = fileSchema.key.join(" + ");
        const seen = new Set();
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object") return;
          if (malformedRows.has(idx)) return;
          const key = buildKey(record, keyFields);
          if (isEmptyValue(key) || key.includes("undefined") || key.includes("null")) {
            collector.add(`Chave obrigatória vazia (${keyLabel}).`, `registro ${idx + 1}`, "keyEmpty");
            return;
          }
          if (seen.has(key)) duplicates.add(key);
          seen.add(key);
        });
        if (duplicates.size) {
          collector.add(
            `Chaves duplicadas (${keyLabel}): ${duplicates.size} chave(s) repetida(s).`,
            Array.from(duplicates).slice(0, MAX_SAMPLES).join(", "),
            "duplicateKey"
          );
        }
      }

      const refs = fileSchema.refs || {};
      const refIgnore = fileSchema.refIgnore || {};
      Object.entries(refs).forEach(([field, refFile]) => {
        const refIndex = indexes[refFile];
        if (!refIndex) return;
        const fieldKey = normalizeField(field);
        const ignored = new Set(refIgnore[field] || []);
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object") return;
          if (malformedRows.has(idx)) return;
          const value = record[fieldKey];
          if (isEmptyValue(value)) return;
          if (ignored.has(String(value).trim())) return;
          if (!refIndex.has(String(value))) {
            collector.add(
              `${field} não existe em ${refFile}.`,
              `registro ${idx + 1}, valor ${JSON.stringify(value)}`,
              "refMissing",
              { refFile, refField: field },
              String(value)
            );
          }
        });
      });

      if (malformedRows.size) {
        warnings.push(
          `${malformedRows.size} linha(s) ignorada(s) nas validações de conteúdo por terem quantidade de colunas diferente do cabeçalho.`
        );
      }

      const issueGroups = collector.toGroups();
      const issues = issueGroups.slice(0, MAX_ERRORS).map(formatGroupLine);
      if (issueGroups.length > MAX_ERRORS) {
        issues.push(`Mais ${issueGroups.length - MAX_ERRORS} tipo(s) de erro não listado(s).`);
      }

      const hints = collector.toHints();
      (data.parseHints || []).forEach((hintKey) => {
        if (HINTS[hintKey] && !hints.some((hint) => hint.key === hintKey)) {
          hints.push({ key: hintKey, title: HINTS[hintKey].title, detail: HINTS[hintKey].detail });
        }
      });

      const status = collector.total ? "error" : warnings.length ? "warn" : "ok";
      validation[file.key] = {
        status,
        issues,
        issueGroups,
        issueCount: collector.total,
        hints,
        warnings,
        recordCount: data.records.length,
        columnCount: data.normalizedFields.length,
        malformedRowCount: malformedRows.size,
        extraFields,
      };
    });

    const statusList = Object.values(validation).map((item) => item.status);
    let overall = "ok";
    if (statusList.includes("error")) overall = "error";
    else if (statusList.includes("warn")) overall = "warn";

    const errorCount = Object.values(validation).reduce((sum, item) => sum + (item.issueCount || 0), 0);
    const warningCount = Object.values(validation).reduce((sum, item) => sum + item.warnings.length, 0);
    const skippedCount = statusList.filter((status) => status === "skipped").length;

    return { validation, overall, errorCount, warningCount, skippedCount };
  };

  const validateParsed = (parsedFiles, options) => {
    const { validation, overall, errorCount, warningCount, skippedCount } = buildValidationForSchema(
      NOHARM_SCHEMA,
      parsedFiles,
      options
    );
    const skippedNote = skippedCount ? ` ${skippedCount} view(s) opcional(is) não enviada(s).` : "";
    return {
      summary: {
        status: overall,
        errorCount,
        warningCount,
        skippedCount,
        message:
          (overall === "ok"
            ? "Validação concluida sem erros."
            : overall === "warn"
            ? "Validação concluida com alertas."
            : `Validação encontrou ${errorCount} erro(s).`) + skippedNote,
      },
      files: validation,
      parsed: parsedFiles,
    };
  };

  // ---------------------------------------------------------------------------
  // Modelos de arquivo
  // ---------------------------------------------------------------------------
  // Lote coerente entre si (as chaves estrangeiras fecham entre as 15 views),
  // na mesma ordem de campos do Anexo I. tests/validate_templates.js garante que
  // este lote continua passando com status ok.

  // ---------------------------------------------------------------------
  // Modelos de download
  // ---------------------------------------------------------------------
  //
  // O lote e um caso clinico so, e de proposito: e exatamente o recorte que o
  // validador recomenda ao cliente — um atendimento (5001 / 7001, pneumonia
  // em UTI) com a prescricao, os exames e as evolucoes dele, mais um segundo
  // atendimento menor (5002 / 7002) para a view nao parecer de paciente unico.
  //
  // Toda chave estrangeira aponta para uma linha que existe no proprio lote:
  // `tests/validate_templates.js` reprova se isso deixar de valer.

  // Os 11 primeiros campos de uma linha de prescricao sao do cabecalho e se
  // repetem item a item. O helper evita reescrever tudo em cada item e deixa
  // visivel so o que muda.
  const itemPrescricao = (cabecalho, item) => [
    ...cabecalho.topo,
    item.fkpresmed,
    item.medicamento,
    item.unidade,
    item.frequencia,
    item.dose,
    item.via || "",
    item.horario || "",
    item.complemento || "",
    item.origem,
    item.suspensao || "",
    item.agrupamento || "0",
    item.acm || "N",
    item.etapas || "0",
    item.horafase || "0",
    item.tempo || "0",
    item.dosagem || "0",
    item.tipoDosagem || "",
    cabecalho.convenio,
    item.periodo || "1",
    item.periodoTotal || "1",
    "N",
    cabecalho.especialidade,
  ];

  const PRESC_7001 = {
    topo: [
      "1", "20", "1001", "5001", "7001",
      "2026-02-07T07:00:00", "2026-02-07T06:52:00", "2026-02-08T06:59:00", "2026-02-07T07:04:00",
      "20-A", "4417", "DRA FERNANDA ALVES",
    ],
    convenio: "SUS",
    especialidade: "PNEUMOLOGIA",
  };

  const PRESC_7002 = {
    topo: [
      "1", "10", "1002", "5002", "7002",
      "2026-02-07T08:00:00", "2026-02-07T07:48:00", "2026-02-08T07:59:00", "2026-02-07T08:03:00",
      "102-B", "4418", "DR BRUNO MENDES",
    ],
    convenio: "PARTICULAR",
    especialidade: "CIRURGIA GERAL",
  };

  const TEMPLATES = {
    hospitais: {
      fileName: "hospitais",
      fields: ["FKHOSPITAL", "NOME"],
      rows: [["1", "HOSPITAL EXEMPLO"]],
    },
    setores: {
      fileName: "setores",
      fields: ["FKHOSPITAL", "FKSETOR", "NOME"],
      rows: [
        ["1", "10", "CLÍNICA MÉDICA"],
        ["1", "20", "UTI ADULTO"],
        ["1", "30", "PRONTO SOCORRO"],
        ["1", "40", "CENTRO CIRÚRGICO"],
      ],
    },
    unidades: {
      fileName: "unidades",
      fields: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
      rows: [
        ["1", "MG", "Miligrama"],
        ["1", "ML", "Mililitro"],
        ["1", "AMP", "Ampola"],
        ["1", "FA", "Frasco-ampola"],
        ["1", "SER", "Seringa"],
        ["1", "CP", "Comprimido"],
        ["1", "UI", "Unidade internacional"],
        ["1", "UND", "Unidade"],
      ],
    },
    frequencia: {
      fileName: "frequencia",
      fields: ["FKHOSPITAL", "FKFREQUENCIA", "NOME"],
      rows: [
        ["1", "6/6", "6 em 6 horas"],
        ["1", "8/8", "8 em 8 horas"],
        ["1", "12/12", "12 em 12 horas"],
        ["1", "24/24", "24 em 24 horas"],
        ["1", "SN", "Se necessário"],
        ["1", "CONT", "Infusao continua"],
      ],
    },
    vias: {
      fileName: "vias",
      // Uma linha so: todas as vias vao no array JSON da coluna VALOR.
      fields: ["TIPO", "VALOR", "UPDATE_AT", "UPDATE_BY"],
      rows: [
        [
          "map-routes",
          JSON.stringify([
            { id: "VO", value: "Via oral" },
            { id: "IV", value: "Intravenosa" },
            { id: "IM", value: "Intramuscular" },
            { id: "SC", value: "Subcutânea" },
            { id: "SNE", value: "Sonda nasoenteral" },
            { id: "INAL", value: "Inalatória" },
          ]),
          "2026-02-07T03:00:00",
          "0",
        ],
      ],
    },
    medicamentos: {
      fileName: "medicamentos",
      fields: ["FKHOSPITAL", "FKMEDICAMENTO", "NOME", "CUSTO", "FKUNIDADEMEDIDACUSTO", "NAOPADRONIZADO"],
      rows: [
        ["1", "2001", "DIPIRONA SÓDICA 500MG/ML AMP 2ML", "0.74", "AMP", "0"],
        ["1", "2002", "CEFTRIAXONA SÓDICA 1G FA", "8.42", "FA", "0"],
        ["1", "2003", "OMEPRAZOL SODICO 40MG FA", "4.19", "FA", "0"],
        ["1", "2004", "ENOXAPARINA SÓDICA 40MG/0.4ML SER", "21.80", "SER", "0"],
        ["1", "2005", "FUROSEMIDA 10MG/ML AMP 2ML", "1.06", "AMP", "0"],
        ["1", "2006", "INSULINA REGULAR 100UI/ML FA 10ML", "0.31", "UI", "0"],
        ["1", "2007", "NORADRENALINA 4MG/4ML AMP", "12.55", "AMP", "0"],
        ["1", "2008", "CLORETO DE SÓDIO 0.9% 250ML BOLSA", "3.90", "ML", "0"],
        ["1", "2009", "DIETA ENTERAL HIPERPROTEICA 1000ML", "28.70", "ML", "0"],
        ["1", "2010", "HEMOGRAMA COMPLETO", "9.15", "UND", "0"],
        ["1", "2011", "RAIO-X DE TÓRAX PA E PERFIL", "26.40", "UND", "0"],
        ["1", "2012", "LOSARTANA POTÁSSICA 50MG CP", "0.18", "CP", "0"],
        ["1", "2013", "METOCLOPRAMIDA 5MG/ML AMP 2ML", "0.92", "AMP", "0"],
        ["1", "2014", "SULFAMETOXAZOL + TRIMETOPRIMA 400/80MG CP", "0.27", "CP", "1"],
      ],
    },
    pessoa: {
      fileName: "pessoa",
      fields: [
        "FKHOSPITAL", "FKPESSOA", "NOME", "NRATENDIMENTO", "DTNASCIMENTO", "DTINTERNACAO", "COR", "SEXO", "PESO",
        "DTPESO", "ALTURA", "DTALTA", "MOTIVOALTA", "MEDICO_RESPONSAVEL", "CIDADE", "IDCID", "FKSETOR", "LEITO",
        "DT_ULTIMA_TRANSFERENCIA",
      ],
      rows: [
        ["1", "5001", "JOAO BATISTA DOS SANTOS", "7001", "1958-03-12", "2026-02-05T22:40:00", "PARDA", "M", "81.4",
          "2026-02-06T07:10:00", "1.74", "", "", "DRA FERNANDA ALVES", "PORTO ALEGRE", "J189", "20", "20-A",
          "2026-02-06T04:15:00"],
        ["1", "5002", "MARIA APARECIDA LIMA", "7002", "1991-07-28", "2026-02-06T10:15:00", "BRANCA", "F", "64.2",
          "2026-02-06T10:40:00", "1.62", "", "", "DR BRUNO MENDES", "CAMPINAS", "K802", "10", "102-B",
          "2026-02-06T10:15:00"],
      ],
    },
    exame: {
      fileName: "exame",
      fields: ["FKEXAME", "FKPESSOA", "NRATENDIMENTO", "DTEXAME", "TPEXAME", "RESULTADO", "UNIDADE"],
      // O painel de um paciente de UTI: hemograma, funcao renal, eletrolitos,
      // inflamatorio e hepatico, todos da mesma coleta.
      rows: [
        ["8001", "5001", "7001", "2026-02-07T06:30:00", "HB", "9.4", "g/dL"],
        ["8002", "5001", "7001", "2026-02-07T06:30:00", "HT", "29.1", "%"],
        ["8003", "5001", "7001", "2026-02-07T06:30:00", "LEUCO", "14300", "/mm3"],
        ["8004", "5001", "7001", "2026-02-07T06:30:00", "PLAQ", "212000", "/mm3"],
        ["8005", "5001", "7001", "2026-02-07T06:30:00", "CR", "1.84", "mg/dL"],
        ["8006", "5001", "7001", "2026-02-07T06:30:00", "UR", "72", "mg/dL"],
        ["8007", "5001", "7001", "2026-02-07T06:30:00", "NA", "137", "mEq/L"],
        ["8008", "5001", "7001", "2026-02-07T06:30:00", "K", "4.2", "mEq/L"],
        ["8009", "5001", "7001", "2026-02-07T06:30:00", "PCR", "86", "mg/L"],
        ["8010", "5001", "7001", "2026-02-07T06:30:00", "TGO", "34", "U/L"],
        ["8011", "5001", "7001", "2026-02-07T06:30:00", "TGP", "41", "U/L"],
        ["8012", "5001", "7001", "2026-02-07T06:30:00", "INR", "1.2", ""],
        // A coleta do dia anterior fica na view: a NoHarm usa a mais recente.
        ["8013", "5001", "7001", "2026-02-06T06:30:00", "CR", "1.52", "mg/dL"],
        ["8014", "5002", "7002", "2026-02-07T07:20:00", "HB", "12.8", "g/dL"],
        ["8015", "5002", "7002", "2026-02-07T07:20:00", "LEUCO", "8200", "/mm3"],
        ["8016", "5002", "7002", "2026-02-07T07:20:00", "CR", "0.8", "mg/dL"],
      ],
    },
    cultura: {
      fileName: "cultura",
      fields: [
        "FKPESSOA", "NRATENDIMENTO", "FKEXAME", "FKITEMEXAME", "DTPEDIDO", "DTCOLETA", "DTLIBERACAO", "NOMEEXAME",
        "NOMEMATERIAL", "NOMEMATERIALTIPO", "FKMEDICAMENTO", "NOMEMEDICAMENTO", "FKMICROORGANISMO",
        "NOMEMICROORGANISMO", "QTMICROORGANISMO", "RESULTADO", "SENSIVEL", "COMPLEMENTO",
      ],
      // Uma hemocultura, duas linhas: o antibiograma traz um medicamento por
      // linha, com o mesmo FKEXAME.
      rows: [
        ["5001", "7001", "8101", "9101", "2026-02-05T23:10:00", "2026-02-05T23:40:00", "2026-02-07T05:50:00",
          "HEMOCULTURA", "SANGUE", "LIQUIDO", "2002", "CEFTRIAXONA SÓDICA 1G FA", "3001",
          "STREPTOCOCCUS PNEUMONIAE", "0", "SENSIVEL", "1", "Positiva em 2 de 2 amostras"],
        ["5001", "7001", "8101", "9102", "2026-02-05T23:10:00", "2026-02-05T23:40:00", "2026-02-07T05:50:00",
          "HEMOCULTURA", "SANGUE", "LIQUIDO", "2014", "SULFAMETOXAZOL + TRIMETOPRIMA 400/80MG CP", "3001",
          "STREPTOCOCCUS PNEUMONIAE", "0", "RESISTENTE", "0", "Positiva em 2 de 2 amostras"],
        ["5002", "7002", "8102", "9103", "2026-02-06T11:00:00", "2026-02-06T11:30:00", "2026-02-08T09:00:00",
          "UROCULTURA", "URINA", "LIQUIDO", "2002", "CEFTRIAXONA SÓDICA 1G FA", "3002", "ESCHERICHIA COLI",
          "100000", "SENSIVEL", "1", "Crescimento de 100000 UFC/ml"],
      ],
    },
    alergia: {
      fileName: "alergia",
      fields: [
        "FKPESSOA", "NRATENDIMENTO", "DTINTERNACAO", "FKMEDICAMENTO", "NOMEMEDICAMENTO", "CREATED_AT", "CREATED_BY",
        "UPDATED_AT", "ATIVO",
      ],
      rows: [
        ["5001", "7001", "2026-02-05T22:40:00", "2014", "SULFAMETOXAZOL + TRIMETOPRIMA 400/80MG CP",
          "2026-02-05T23:05:00", "1", "2026-02-05T23:05:00", "1"],
        ["5002", "7002", "2026-02-06T10:15:00", "2001", "DIPIRONA SÓDICA 500MG/ML AMP 2ML",
          "2026-02-06T10:30:00", "1", "2026-02-06T10:30:00", "1"],
      ],
    },
    evolucao: {
      fileName: "evolucao",
      fields: ["FKEVOLUCAO", "DTEVOLUCAO", "NRATENDIMENTO", "NOME", "CARGO", "TEXTO"],
      rows: [
        ["6001", "2026-02-07T07:30:00", "7001", "DRA FERNANDA ALVES", "MÉDICO",
          "Paciente no 2o dia de internação em UTI por pneumonia adquirida na comunidade. " +
          "Mantem-se febril (37.9C), em cateter nasal de O2 a 3 L/min, saturando 94%. " +
          "Ausculta com estertores em base direita. Hemocultura positiva para S. pneumoniae, " +
          "sensivel a ceftriaxona - mantida a antibioticoterapia. Creatinina em elevacao " +
          "(1.52 para 1.84): reavaliar doses ajustadas a funcao renal."],
        ["6002", "2026-02-07T10:15:00", "7001", "CARLA MENEZES", "FARMACÊUTICO",
          "Revisão da prescrição. Ceftriaxona 1g 12/12h adequada ao foco e ao antibiograma. " +
          "Clearance estimado em 41 ml/min: sugerida reducao da furosemida para 1 ampola 12/12h " +
          "e monitorizacao de potassio. Paciente alérgico a sulfametoxazol + trimetoprima - " +
          "nenhum item da prescrição conflita. Orientada a enfermagem quanto a diluicao da " +
          "ceftriaxona em 100 ml de SF e infusao em 30 minutos."],
        ["6003", "2026-02-07T19:00:00", "7001", "PAULO RICARDO SOUZA", "ENFERMEIRO",
          "Plantao sem intercorrencias. Dieta enteral em infusao continua, boa tolerancia, " +
          "sem residuo gastrico significativo. Diurese de 1450 ml nas últimas 24h. " +
          "Metoclopramida suspensa as 14h20 conforme avaliacao médica. Acesso venoso central " +
          "em jugular direita, sem sinais flogisticos."],
        ["6004", "2026-02-07T09:40:00", "7002", "DR BRUNO MENDES", "MÉDICO",
          "Pos-operatorio imediato de colecistectomia videolaparoscopica, sem intercorrencias. " +
          "Dor controlada com dipirona. Aceita dieta liquida. Previsao de alta em 24 horas."],
      ],
    },
    transferencia: {
      fileName: "transferencia",
      fields: ["FKPESSOA", "NRATENDIMENTO", "FKSETOR", "NOMESETOR", "LEITO", "DTENTRADA", "DTSAIDA", "AGRUPADA"],
      // O caminho do paciente: entrou pelo pronto socorro e subiu para a UTI.
      rows: [
        ["5001", "7001", "30", "PRONTO SOCORRO", "PS-07", "2026-02-05T22:40:00", "2026-02-06T04:15:00", "1"],
        ["5001", "7001", "20", "UTI ADULTO", "20-A", "2026-02-06T04:15:00", "", "1"],
        ["5002", "7002", "40", "CENTRO CIRÚRGICO", "CC-02", "2026-02-06T14:00:00", "2026-02-06T16:30:00", "1"],
        ["5002", "7002", "10", "CLÍNICA MÉDICA", "102-B", "2026-02-06T16:30:00", "", "1"],
      ],
    },
    prescricoes: {
      fileName: "prescricoes",
      fields: [
        "FKHOSPITAL", "FKSETOR", "FKPRESCRICAO", "FKPESSOA", "NRATENDIMENTO", "DTPRESCRICAO", "DTCRIACAO_ORIGEM",
        "DTVIGENCIA", "DTATUALIZACAO", "LEITO", "PRONTUARIO", "PRESCRITOR", "FKPRESMED", "FKMEDICAMENTO",
        "FKUNIDADEMEDIDA", "FKFREQUENCIA", "DOSE", "VIA", "HORARIO", "COMPLEMENTO", "ORIGEM", "DTSUSPENSAO",
        "SLAGRUPAMENTO", "SLACM", "SLETAPAS", "SLHORAFASE", "SLTEMPOAPLICACAO", "SLDOSAGEM", "SLTIPODOSAGEM",
        "CONVENIO", "PERÍODO", "PERIODO_TOTAL", "ALERGIA", "ESPECIALIDADE",
      ],
      // Uma prescricao de UTI com as quatro origens que a tela separa em abas:
      // Medicamentos, Solucoes (as duas linhas do mesmo SLAGRUPAMENTO),
      // Proced/Exames e Dietas.
      rows: [
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001001", medicamento: "2002", unidade: "FA", frequencia: "12/12", dose: "1", via: "IV",
          horario: "06:00 18:00", origem: "Medicamentos", periodo: "3", periodoTotal: "7",
          complemento: "Diluir em 100 ml de SF 0.9% e infundir em 30 minutos",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001002", medicamento: "2001", unidade: "AMP", frequencia: "6/6", dose: "1", via: "IV",
          horario: "06:00 12:00 18:00 00:00", origem: "Medicamentos", periodo: "2", periodoTotal: "3",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001003", medicamento: "2003", unidade: "FA", frequencia: "24/24", dose: "1", via: "IV",
          horario: "08:00", origem: "Medicamentos", periodo: "2", periodoTotal: "7",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001004", medicamento: "2004", unidade: "SER", frequencia: "24/24", dose: "1", via: "SC",
          horario: "20:00", origem: "Medicamentos", periodo: "2", periodoTotal: "7",
          complemento: "Profilaxia de tromboembolismo venoso",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001005", medicamento: "2005", unidade: "AMP", frequencia: "12/12", dose: "2", via: "IV",
          horario: "08:00 20:00", origem: "Medicamentos", periodo: "2", periodoTotal: "5",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001006", medicamento: "2006", unidade: "UI", frequencia: "SN", dose: "6", via: "SC",
          origem: "Medicamentos", complemento: "Conforme glicemia capilar de 6 em 6 horas",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001007", medicamento: "2013", unidade: "AMP", frequencia: "SN", dose: "1", via: "IV",
          origem: "Medicamentos", suspensao: "2026-02-07T14:20:00",
        }),
        // As duas linhas da mesma solucao: mesmo SLAGRUPAMENTO.
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001008", medicamento: "2007", unidade: "AMP", frequencia: "CONT", dose: "4", via: "IV",
          horario: "07:00", origem: "Solucoes", agrupamento: "1", etapas: "2", horafase: "24",
          tempo: "60", dosagem: "0.2", tipoDosagem: "mcg/kg/min", periodo: "2", periodoTotal: "2",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001009", medicamento: "2008", unidade: "ML", frequencia: "CONT", dose: "250", via: "IV",
          horario: "07:00", origem: "Solucoes", agrupamento: "1", etapas: "2", horafase: "24",
          tempo: "60", periodo: "2", periodoTotal: "2",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001010", medicamento: "2010", unidade: "UND", frequencia: "24/24", dose: "1",
          horario: "06:00", origem: "Proced/Exames", periodo: "2", periodoTotal: "7",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001011", medicamento: "2011", unidade: "UND", frequencia: "24/24", dose: "1",
          horario: "09:00", origem: "Proced/Exames", complemento: "Aparelho portatil, no leito",
          periodo: "1", periodoTotal: "3",
        }),
        itemPrescricao(PRESC_7001, {
          fkpresmed: "1001012", medicamento: "2009", unidade: "ML", frequencia: "CONT", dose: "1000", via: "SNE",
          horario: "08:00", origem: "Dietas", complemento: "Infusao continua em bomba, 42 ml/h",
          periodo: "2", periodoTotal: "7",
        }),
        itemPrescricao(PRESC_7002, {
          fkpresmed: "1002001", medicamento: "2012", unidade: "CP", frequencia: "24/24", dose: "1", via: "VO",
          horario: "08:00", origem: "Medicamentos", complemento: "Medicamento de uso domiciliar, mantido",
        }),
        itemPrescricao(PRESC_7002, {
          fkpresmed: "1002002", medicamento: "2001", unidade: "AMP", frequencia: "6/6", dose: "1", via: "IV",
          horario: "06:00 12:00 18:00 00:00", origem: "Medicamentos",
        }),
        itemPrescricao(PRESC_7002, {
          fkpresmed: "1002003", medicamento: "2003", unidade: "FA", frequencia: "24/24", dose: "1", via: "IV",
          horario: "08:00", origem: "Medicamentos",
        }),
      ],
    },
    conciliacao: {
      fileName: "conciliacao",
      fields: [
        "FKHOSPITAL", "FKSETOR", "FKPRESCRICAO", "FKPESSOA", "NRATENDIMENTO", "CONVENIO", "DTPRESCRICAO",
        "DTSUSPENSAO", "LEITO", "PRONTUARIO", "FKPRESMED", "PRESCRITOR", "FKMEDICAMENTO", "FKUNIDADEMEDIDA",
        "FKFREQUENCIA", "DOSE", "VIA", "HORARIO", "ORIGEM", "CONCILIA",
      ],
      // O que o paciente usava em casa, registrado na admissao.
      rows: [
        ["1", "20", "1051", "5001", "7001", "SUS", "2026-02-06T05:10:00", "", "20-A", "4417", "1051001",
          "DRA FERNANDA ALVES", "2012", "CP", "24/24", "1", "VO", "08:00", "Medicamentos", "S"],
        // FKMEDICAMENTO 0: item de texto livre sem cadastro associado, conforme
        // o valor padrao definido no Anexo I.
        ["1", "20", "1051", "5001", "7001", "SUS", "2026-02-06T05:10:00", "", "20-A", "4417", "1051002",
          "DRA FERNANDA ALVES", "0", "CP", "24/24", "1", "VO", "ATENOLOL 25MG USO DOMICILIAR", "Medicamentos", "S"],
        ["1", "10", "1052", "5002", "7002", "PARTICULAR", "2026-02-06T11:05:00", "", "102-B", "4418", "1052001",
          "DR BRUNO MENDES", "2012", "CP", "24/24", "1", "VO", "08:00", "Medicamentos", "S"],
      ],
    },
  };

  const escapeCsvValue = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const buildTemplateCsv = (fileKey) => {
    const template = TEMPLATES[fileKey];
    if (!template) return "";
    const lines = [template.fields.join(",")];
    template.rows.forEach((row) => lines.push(row.map(escapeCsvValue).join(",")));
    return `${lines.join("\n")}\n`;
  };

  const buildTemplateJson = (fileKey) => {
    const template = TEMPLATES[fileKey];
    if (!template) return "";
    const records = template.rows.map((row) => {
      const out = {};
      template.fields.forEach((field, idx) => {
        out[field] = row[idx];
      });
      return out;
    });
    return `${JSON.stringify(records, null, 2)}\n`;
  };

  const getTemplateFileName = (fileKey, format) => {
    const template = TEMPLATES[fileKey];
    if (!template) return "";
    return `${template.fileName}.${format === "json" ? "json" : "csv"}`;
  };

  // ---------------------------------------------------------------------------
  // Apoio ao passo a passo
  // ---------------------------------------------------------------------------

  // Valida uma view sozinha, no passo em que ela e enviada. As referências
  // cruzadas usam os índices das views já validadas (em memória ou persistidas).
  // -------------------------------------------------------------------------
  // Reconhecer de qual view e um arquivo
  // -------------------------------------------------------------------------
  //
  // O cliente tem os 14 arquivos numa pasta e quer soltar todos de uma vez.
  // Para isso o validador precisa descobrir sozinho quem e quem.
  //
  // O **cabeçalho decide**, não o nome do arquivo: o export sai como
  // `VW_NOHARM_01.csv`, `export (3).csv`, `Setores.CSV` — o nome e um palpite,
  // as colunas sao a identidade da view. O nome entra so para desempatar.

  const semAcento = (texto) =>
    String(texto === null || texto === undefined ? "" : texto)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const chaveDoNome = (texto) => semAcento(texto).replace(/[^a-z0-9]+/g, "");

  // Como o arquivo pode se chamar, por view. Vale a chave, o rotulo e o nome
  // da view no Anexo I ("View de Setores / Departamentos" -> "setores").
  const apelidosDaView = (fileKey) => {
    const schema = NOHARM_SCHEMA.files[fileKey];
    const apelidos = new Set([chaveDoNome(fileKey)]);
    [schema.label, schema.view].forEach((texto) => {
      if (!texto) return;
      semAcento(texto)
        .replace(/^view (de|da|do) /, "")
        .split(/[^a-z0-9]+/)
        .filter((parte) => parte.length >= 4)
        .forEach((parte) => apelidos.add(parte));
    });
    return Array.from(apelidos);
  };

  // 0 a 1, medindo a semelhanca nos DOIS sentidos (intersecao / uniao). Contar
  // so "quanto da view existe no arquivo" nao serve: a de Hospitais tem duas
  // colunas (FKHOSPITAL, NOME) que quase toda view tem, entao ela dava 100%
  // para qualquer arquivo. A uniao penaliza a view que ignora metade do
  // cabecalho e desempata na hora.
  const notaDoCabecalho = (fileKey, campos) => {
    const schema = NOHARM_SCHEMA.files[fileKey];
    const presentes = new Set(campos.map((campo) => String(campo).toLowerCase()));
    const esperadas = schema.allowed.map((coluna) => coluna.toLowerCase());

    // Obrigatorio que falta elimina a view: o arquivo nem poderia ser aquela.
    const faltaObrigatorio = schema.fields
      .filter((campo) => campo.required)
      .some((campo) => !presentes.has(campo.name.toLowerCase()));
    if (faltaObrigatorio) return 0;

    const comuns = esperadas.filter((coluna) => presentes.has(coluna)).length;
    const uniao = new Set(esperadas.concat(Array.from(presentes))).size;
    return uniao ? comuns / uniao : 0;
  };

  // Devolve { key, score, porNome } ou null quando nao dá para afirmar.
  // O corte de 0.6 e para nao chutar: arquivo que nao e de nenhuma view volta
  // sem palpite e a tela pergunta ao cliente, em vez de gravar no lugar errado.
  const guessFileKey = (fileName, fields) => {
    const nome = chaveDoNome(String(fileName || "").replace(/\.[a-z0-9]+$/i, ""));
    const campos = Array.isArray(fields) ? fields : [];

    const notas = FILE_TYPES.map((file) => {
      const cabecalho = notaDoCabecalho(file.key, campos);
      const porNome = apelidosDaView(file.key).some((apelido) => nome.includes(apelido));
      return { key: file.key, cabecalho, porNome, score: cabecalho + (porNome ? 0.05 : 0) };
    }).sort((a, b) => b.score - a.score);

    const melhor = notas[0];
    const segunda = notas[1];
    // Aceita quando a melhor se destaca. Coluna a mais do cliente derruba a
    // nota absoluta (e nao e erro), entao o que vale e a distancia para a
    // segunda colocada, nao um corte fixo alto.
    const destacada =
      melhor &&
      melhor.cabecalho > 0 &&
      (melhor.cabecalho >= 0.7 || !segunda || melhor.score - segunda.score >= 0.15);
    if (!destacada) {
      // Sem cabecalho reconhecivel ainda dá para aceitar um nome sem ambiguidade
      // (arquivo vazio, por exemplo, que precisa chegar na view certa para o
      // erro ser o de verdade: "faltam colunas", e nao "não reconheci").
      const soPeloNome = notas.filter((nota) => nota.porNome);
      if (soPeloNome.length === 1) return { key: soPeloNome[0].key, score: 0.5, porNome: true };
      return null;
    }
    return { key: melhor.key, score: melhor.score, porNome: melhor.porNome };
  };

  const validateFile = (fileKey, parsed, options) => {
    const settings = options || {};
    const parsedFiles = Object.assign({}, settings.parsedFiles || {});
    parsedFiles[fileKey] = parsed;
    const result = buildValidationForSchema(NOHARM_SCHEMA, parsedFiles, {
      externalIndexes: settings.externalIndexes,
      only: [fileKey],
    });
    return result.validation[fileKey];
  };

  // Indice de chaves de uma view, para persistir e usar na validacao cruzada dos
  // passos seguintes sem precisar do arquivo de novo.
  const buildKeyIndex = (fileKey, parsed) => {
    const fileSchema = NOHARM_SCHEMA.files[fileKey];
    if (!fileSchema || !fileSchema.key.length || !parsed || !Array.isArray(parsed.records)) return [];
    const keyFields = normalizeFields(fileSchema.key);
    const index = new Set();
    parsed.records.forEach((record, idx) => {
      if (!record || typeof record !== "object") return;
      if (parsed.malformedRows && parsed.malformedRows.has(idx)) return;
      const key = buildKey(record, keyFields);
      if (!isEmptyValue(key)) index.add(key);
    });
    return Array.from(index);
  };

  // Amostra so com as colunas do Anexo I que existem no arquivo, na ordem do
  // documento. Coluna opcional entra se o cliente mandou; coluna propria dele
  // fica de fora. Serve para conferir que o dado certo caiu na coluna certa.
  const buildPreview = (fileKey, parsed, limit) => {
    const fileSchema = NOHARM_SCHEMA.files[fileKey];
    if (!fileSchema || !parsed || !Array.isArray(parsed.records)) return null;

    const presentes = new Set(parsed.normalizedFields || []);
    const columns = fileSchema.fields.map((field) => field.name).filter((name) => presentes.has(normalizeField(name)));
    if (!columns.length) return null;

    const max = limit || 5;
    const rows = [];
    for (let idx = 0; idx < parsed.records.length && rows.length < max; idx += 1) {
      const record = parsed.records[idx];
      if (!record || typeof record !== "object" || Array.isArray(record)) continue;
      if (parsed.malformedRows && parsed.malformedRows.has(idx)) continue;
      rows.push(columns.map((name) => {
        const value = record[normalizeField(name)];
        return isEmptyValue(value) ? "" : String(value);
      }));
    }

    return {
      columns,
      rows,
      usedColumns: columns.length,
      totalColumns: (parsed.normalizedFields || []).length,
    };
  };

  // As views que servem de alvo de referencia cruzada em algum lugar do schema.
  const REFERENCED_FILES = Array.from(
    FILE_TYPES.reduce((acc, file) => {
      Object.values(NOHARM_SCHEMA.files[file.key].refs || {}).forEach((target) => acc.add(target));
      return acc;
    }, new Set())
  );

  return {
    FILE_TYPES,
    GROUPS,
    NOHARM_SCHEMA,
    HINTS,
    TEMPLATES,
    DATE_FORMAT_LABEL,
    FKHOSPITAL_FIXO,
    REFERENCED_FILES,
    parseFileText,
    validateParsed,
    validateFile,
    guessFileKey,
    buildKeyIndex,
    buildPreview,
    buildTemplateCsv,
    buildTemplateJson,
    getTemplateFileName,
  };
});
