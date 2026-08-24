(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("papaparse"));
  } else {
    root.NoHarmValidator = factory(root.Papa);
  }
})(typeof self !== "undefined" ? self : this, function (Papa) {
  "use strict";

  const FILE_TYPES = [
    { key: "prescricoes", label: "Prescricoes" },
    { key: "pessoa", label: "Pessoa/Atendimento" },
    { key: "medicamentos", label: "Medicamentos" },
    { key: "setores", label: "Setores" },
    { key: "unidades", label: "Unidades" },
    { key: "frequencia", label: "Frequencia" },
    { key: "exame", label: "Exames" },
    { key: "alergia", label: "Alergias" },
    { key: "cultura", label: "Culturas" },
  ];

  const NOHARM_SCHEMA = {
    label: "NoHarm",
    files: {
      prescricoes: {
        required: [
          "ALERGIA",
          "COMPLEMENTO",
          "CONVENIO",
          "DOSE",
          "DTCRIACAO_ORIGEM",
          "DTPRESCRICAO",
          "DTSUSPENSAO",
          "DTVIGENCIA",
          "FKFREQUENCIA",
          "FKMEDICAMENTO",
          "FKPESSOA",
          "FKPRESCRICAO",
          "FKPRESMED",
          "FKSETOR",
          "FKUNIDADEMEDIDA",
          "HORARIO",
          "LEITO",
          "NRATENDIMENTO",
          "ORIGEM",
          "PERIODO",
          "PERIODO_TOTAL",
          "PRESCRITOR",
          "SLACM",
          "SLAGRUPAMENTO",
          "SLDOSAGEM",
          "SLETAPAS",
          "SLTIPODOSAGEM",
          "VIA",
        ],
        allowed: [
          "ALERGIA",
          "COMPLEMENTO",
          "CONVENIO",
          "DOSE",
          "DS_UNIDADE_MEDIDA",
          "DTATUALIZACAO",
          "DTCRIACAO_ORIGEM",
          "DTPRESCRICAO",
          "DTSUSPENSAO",
          "DTVIGENCIA",
          "ESPECIALIDADE",
          "FKFREQUENCIA",
          "FKHOSPITAL",
          "FKMEDICAMENTO",
          "FKPESSOA",
          "FKPRESCRICAO",
          "FKPRESMED",
          "FKSETOR",
          "FKUNIDADEMEDIDA",
          "FREQUENCIADIA",
          "HORARIO",
          "LEITO",
          "NOMEMEDICAMENTO",
          "NRATENDIMENTO",
          "ORIGEM",
          "PERIODO",
          "PERIODO_TOTAL",
          "PRESCRITOR",
          "PRONTUARIO",
          "SLACM",
          "SLAGRUPAMENTO",
          "SLDOSAGEM",
          "SLETAPAS",
          "SLHORAFASE",
          "SLTEMPOAPLICACAO",
          "SLTIPODOSAGEM",
          "VIA",
        ],
        key: ["FKPRESMED"],
        typeHints: {
          number: [
            "DOSE",
            "FKHOSPITAL",
            "FKMEDICAMENTO",
            "FKPESSOA",
            "FKPRESCRICAO",
            "FKPRESMED",
            "FKSETOR",
            "FREQUENCIADIA",
            "NRATENDIMENTO",
            "PERIODO",
            "PERIODO_TOTAL",
            "SLAGRUPAMENTO",
            "SLDOSAGEM",
            "SLETAPAS",
          ],
          date: ["DTATUALIZACAO", "DTCRIACAO_ORIGEM", "DTPRESCRICAO", "DTSUSPENSAO", "DTVIGENCIA"],
          boolean: [],
          maxDigits: { NRATENDIMENTO: 9 },
          maxLength: {
            ALERGIA: 1,
            CONVENIO: 100,
            ESPECIALIDADE: 100,
            FKFREQUENCIA: 50,
            FKUNIDADEMEDIDA: 50,
            HORARIO: 600,
            LEITO: 16,
            ORIGEM: 13,
            PRESCRITOR: 255,
            SLACM: 1,
            SLTIPODOSAGEM: 16,
            VIA: 50,
          },
        },
        refs: {
          FKSETOR: "setores",
          FKMEDICAMENTO: "medicamentos",
          FKUNIDADEMEDIDA: "unidades",
          FKFREQUENCIA: "frequencia",
        },
      },
      pessoa: {
        required: ["FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "DTINTERNACAO"],
        allowed: [
          "ALTURA",
          "CIDADE",
          "COR",
          "DTALTA",
          "DTINTERNACAO",
          "DTNASCIMENTO",
          "DTPESO",
          "DT_ULTIMA_TRANSFERENCIA",
          "FKHOSPITAL",
          "FKPESSOA",
          "FKSETOR",
          "IDCID",
          "LEITO",
          "MEDICO_RESPONSAVEL",
          "MOTIVOALTA",
          "NOME",
          "NRATENDIMENTO",
          "PESO",
          "SEXO",
        ],
        key: ["NRATENDIMENTO"],
        typeHints: {
          number: ["ALTURA", "FKHOSPITAL", "FKPESSOA", "FKSETOR", "NRATENDIMENTO", "PESO"],
          date: ["DTALTA", "DTINTERNACAO", "DTNASCIMENTO", "DTPESO", "DT_ULTIMA_TRANSFERENCIA"],
          boolean: [],
          maxDigits: { NRATENDIMENTO: 9 },
          maxLength: {
            CIDADE: 250,
            COR: 100,
            IDCID: 50,
            LEITO: 16,
            MEDICO_RESPONSAVEL: 255,
            MOTIVOALTA: 100,
            SEXO: 1,
          },
        },
        refs: {
          FKSETOR: "setores",
        },
      },
      medicamentos: {
        required: ["CUSTO", "FKHOSPITAL", "FKMEDICAMENTO", "FKUNIDADEMEDIDACUSTO", "NAOPADRONIZADO", "NOME"],
        allowed: [
          "CUSTO",
          "CUSTO_PADRAO",
          "FKHOSPITAL",
          "FKMEDICAMENTO",
          "FKUNIDADEMEDIDACUSTO",
          "NAOPADRONIZADO",
          "NOME",
          "ORIGEM",
          "VL_FATOR",
        ],
        key: ["FKMEDICAMENTO"],
        typeHints: {
          number: ["CUSTO", "CUSTO_PADRAO", "FKHOSPITAL", "FKMEDICAMENTO", "VL_FATOR"],
          date: [],
          boolean: [],
          maxLength: {
            FKUNIDADEMEDIDACUSTO: 32,
            NOME: 250,
          },
        },
      },
      setores: {
        required: ["FKHOSPITAL", "FKSETOR", "NOME"],
        allowed: ["FKHOSPITAL", "FKSETOR", "NOME"],
        key: ["FKSETOR"],
        typeHints: {
          number: ["FKHOSPITAL", "FKSETOR"],
          date: [],
          boolean: [],
          maxLength: {
            NOME: 250,
          },
        },
      },
      unidades: {
        required: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
        allowed: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
        key: ["FKUNIDADEMEDIDA"],
        typeHints: {
          number: ["FKHOSPITAL"],
          date: [],
          boolean: [],
          notNumber: ["FKUNIDADEMEDIDA"],
          maxLength: {
            FKUNIDADEMEDIDA: 32,
            NOME: 250,
          },
        },
      },
      frequencia: {
        required: ["FKFREQUENCIA", "FKHOSPITAL", "NOME"],
        allowed: ["FKFREQUENCIA", "FKHOSPITAL", "NOME"],
        key: ["FKFREQUENCIA"],
        typeHints: {
          number: ["FKHOSPITAL"],
          date: [],
          boolean: [],
          notNumber: ["FKFREQUENCIA"],
          maxLength: {
            FKFREQUENCIA: 50,
            NOME: 250,
          },
        },
      },
      exame: {
        required: ["FKEXAME", "FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "DTEXAME", "TPEXAME", "RESULTADO"],
        allowed: ["FKEXAME", "FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "DTEXAME", "TPEXAME", "RESULTADO", "UNIDADE"],
        key: ["FKEXAME"],
        typeHints: {
          number: ["FKEXAME", "FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO"],
          date: ["DTEXAME"],
          boolean: [],
          maxDigits: { NRATENDIMENTO: 9 },
          maxLength: {
            TPEXAME: 100,
            RESULTADO: 250,
            UNIDADE: 50,
          },
        },
        refs: {
          NRATENDIMENTO: "pessoa",
        },
      },
      alergia: {
        required: ["FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "FKMEDICAMENTO", "NOME_MEDICAMENTO", "ATIVO"],
        allowed: [
          "FKHOSPITAL",
          "FKPESSOA",
          "NRATENDIMENTO",
          "DTINTERNACAO",
          "FKMEDICAMENTO",
          "NOME_MEDICAMENTO",
          "CREATED_AT",
          "CREATED_BY",
          "UPDATED_AT",
          "UPDATED_BY",
          "ATIVO",
        ],
        key: ["FKPESSOA", "FKMEDICAMENTO"],
        typeHints: {
          number: ["FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "FKMEDICAMENTO"],
          date: ["DTINTERNACAO", "CREATED_AT", "UPDATED_AT"],
          boolean: ["ATIVO"],
          maxDigits: { NRATENDIMENTO: 9 },
          maxLength: {
            NOME_MEDICAMENTO: 250,
            CREATED_BY: 255,
            UPDATED_BY: 255,
          },
        },
        refs: {
          FKMEDICAMENTO: "medicamentos",
          NRATENDIMENTO: "pessoa",
        },
      },
      cultura: {
        required: [
          "FKHOSPITAL",
          "FKEXAME",
          "FKITEMEXAME",
          "FKPESSOA",
          "NRATENDIMENTO",
          "FKSETOR",
          "NOMEEXAME",
          "FKMEDICAMENTO",
          "NOMEMEDICAMENTO",
          "FKMICROORGANISMO",
          "NOMEMICROORGANISMO",
          "RESULTADO",
        ],
        allowed: [
          "FKHOSPITAL",
          "FKEXAME",
          "FKITEMEXAME",
          "FKPESSOA",
          "NRATENDIMENTO",
          "DTPEDIDO",
          "DTCOLETA",
          "DTLIBERACAO",
          "FKSETOR",
          "NOMEEXAME",
          "NOMEMATERIAL",
          "NOMEMATERIALTIPO",
          "COMPLEMENTO",
          "DSCOLONIA",
          "GRAM",
          "NRCOLONIA",
          "RESULTPREVIO",
          "FKMEDICAMENTO",
          "NOMEMEDICAMENTO",
          "FKMICROORGANISMO",
          "NOMEMICROORGANISMO",
          "QTMICROORGANISMO",
          "RESULTADO",
        ],
        key: ["FKEXAME", "FKITEMEXAME", "FKMEDICAMENTO"],
        typeHints: {
          number: [
            "FKHOSPITAL",
            "FKEXAME",
            "FKITEMEXAME",
            "FKPESSOA",
            "NRATENDIMENTO",
            "FKSETOR",
            "FKMEDICAMENTO",
            "FKMICROORGANISMO",
            "QTMICROORGANISMO",
            "NRCOLONIA",
          ],
          date: ["DTPEDIDO", "DTCOLETA", "DTLIBERACAO"],
          boolean: [],
          maxDigits: { NRATENDIMENTO: 9 },
          maxLength: {
            NOMEEXAME: 250,
            NOMEMATERIAL: 250,
            NOMEMATERIALTIPO: 100,
            COMPLEMENTO: 250,
            DSCOLONIA: 250,
            GRAM: 50,
            RESULTPREVIO: 250,
            NOMEMEDICAMENTO: 250,
            NOMEMICROORGANISMO: 250,
            RESULTADO: 250,
          },
        },
        refs: {
          FKEXAME: "exame",
          FKMEDICAMENTO: "medicamentos",
          FKSETOR: "setores",
          NRATENDIMENTO: "pessoa",
        },
      },
    },
  };

  const MAX_ERRORS = 200;
  const MAX_SAMPLES = 5;
  const NORMALIZATION_MODE = "lower";

  const DATE_FORMAT_LABEL = "YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS";

  // Dicas para os erros que mais aparecem em extracao de hospital. A ideia e
  // dizer o que provavelmente esta errado no CSV, nao so que o valor falhou.
  const HINTS = {
    csvFieldCount: {
      title: "Linhas com quantidade de colunas diferente do cabecalho",
      detail:
        "Na maioria das vezes o CSV esta errado, nao o dado. A causa mais comum e numero decimal com virgula sem aspas: CUSTO 0,0909 vira duas colunas (0 e 0909). Exporte numeros com ponto decimal (0.0909) ou coloque aspas em todos os valores. Essas linhas ficam com as colunas deslocadas e sao ignoradas nas demais validacoes.",
    },
    csvDecimalComma: {
      title: "Suspeita de separador decimal virgula",
      detail:
        "As colunas extras encontradas sao apenas digitos, o que indica numero quebrado pela virgula decimal (ex.: DOSE 2,5 / PESO 78,5 / CUSTO 0,0909). Troque a virgula por ponto na origem ou envie o campo entre aspas.",
    },
    csvSingleColumn: {
      title: "Arquivo inteiro em uma unica coluna",
      detail:
        "O cabecalho foi lido como um campo so. Normalmente cada linha do arquivo foi envolvida por aspas e as aspas internas foram duplicadas (ex.: \"FKEXAME,\"\"FKPESSOA\"\",...\"). Reexporte sem esse escape extra: aspas so nos campos que precisam.",
    },
    csvDelimiter: {
      title: "Delimitador nao identificado",
      detail:
        "Nao foi possivel detectar o separador de colunas. Use virgula como delimitador e mantenha o cabecalho na primeira linha.",
    },
    encoding: {
      title: "Arquivo nao esta em UTF-8",
      detail:
        "Foram encontrados caracteres invalidos (Lact?rio, Dipirona S?dica). O arquivo provavelmente esta em Latin-1 / Windows-1252. Reexporte em UTF-8, senao acentos e cedilha chegam corrompidos na NoHarm.",
    },
    dateFormat: {
      title: "Formato de data fora do padrao",
      detail:
        "A NoHarm espera data em ISO: " +
        DATE_FORMAT_LABEL +
        ". Formatos com barra (dd/mm/aa) sao ambiguos: 06/08/26 tanto pode ser 6 de agosto quanto 8 de junho, e o ano de 2 digitos nao diz o seculo (25 = 1925 ou 2025?), o que e critico em DTNASCIMENTO. Converta as datas na origem.",
    },
    boolean: {
      title: "Valor booleano fora do padrao",
      detail:
        "Valores aceitos: true, false, 0, 1, S, N, SIM, NAO. Extracoes Oracle costumam mandar T/F, que nao e aceito hoje. Converta na origem (T -> 1, F -> 0).",
    },
    notNumber: {
      title: "Campo de sigla preenchido com numero",
      detail:
        "FKUNIDADEMEDIDA e FKFREQUENCIA devem trazer a sigla/codigo textual usado na prescricao (ex.: MG, AMP C/10ML, 8/8), nao o ID interno da tabela.",
    },
    missingFields: {
      title: "Campos obrigatorios ausentes",
      detail:
        "Confira o cabecalho contra os modelos disponiveis para download. Nomes de coluna sao comparados sem diferenciar maiusculas/minusculas, mas precisam existir.",
    },
    unexpectedFields: {
      title: "Campos fora do padrao NoHarm",
      detail:
        "Colunas nao previstas no padrao. Remova da extracao ou confirme com a NoHarm se devem ser incluidas no schema.",
    },
    refMissing: {
      title: "Referencia cruzada quebrada",
      detail:
        "O valor da chave estrangeira nao existe no arquivo referenciado. Ou o arquivo de dominio (setores, medicamentos, unidades, frequencia, exames) esta incompleto, ou os arquivos foram extraidos em momentos diferentes. Extraia todos no mesmo instante.",
    },
    keyEmpty: {
      title: "Chave primaria vazia",
      detail: "Todo registro precisa da chave preenchida, senao a NoHarm nao consegue identificar nem atualizar o registro.",
    },
    duplicateKey: {
      title: "Chaves duplicadas",
      detail: "A chave precisa ser unica no arquivo. Verifique se a view esta duplicando linhas por join.",
    },
    maxLength: {
      title: "Valor maior que o tamanho aceito",
      detail: "O campo excede o limite do padrao NoHarm e seria truncado na ingestao. Ajuste na origem.",
    },
    numberFormat: {
      title: "Valor nao numerico em campo numerico",
      detail:
        "Se o arquivo tambem acusou erro de quantidade de colunas, provavelmente e reflexo do deslocamento causado pela virgula decimal. Corrija o CSV primeiro e revalide.",
    },
    jsonRoot: {
      title: "JSON com estrutura errada",
      detail: "O JSON deve ser um array plano de objetos: [{...}, {...}]. Nao use envelope { data: [...] } nem hierarquia.",
    },
    parse: {
      title: "Falha na leitura do arquivo",
      detail: "O arquivo nao pode ser lido. Confira se ele esta completo e no formato declarado pela extensao.",
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
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(value)) return "formato dd/mm/aa (ano de 2 digitos, ambiguo)";
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) return "formato dd/mm/aaaa";
    if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(value)) return "formato dd-mm-aaaa";
    if (/^\d{4}\d{2}\d{2}$/.test(value)) return "formato aaaammdd sem separador";
    if (ISO_DATE_ONLY.test(value) || ISO_DATE_TIME.test(value)) return "data inexistente no calendario";
    return "formato nao reconhecido";
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
            : "menos colunas que o cabecalho";
        const detail = extras.length ? `, sobrou ${extras.map((v) => JSON.stringify(v)).join(" e ")}` : "";
        entries.push({
          group: `Linha com quantidade de colunas diferente do cabecalho (cabecalho tem ${headerCount}).`,
          sample: `${at}, ${found}${detail}`,
          hint: "csvFieldCount",
        });
        hintKeys.add("csvFieldCount");
        return;
      }

      if (err.code === "UndetectableDelimiter") {
        entries.push({ group: "Delimitador de colunas nao identificado.", sample: err.message, hint: "csvDelimiter" });
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
            throw new Error("JSON nao esta no formato esperado");
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
      add(group, sample, hintKey) {
        total += 1;
        let entry = groups.get(group);
        if (!entry) {
          entry = { message: group, count: 0, samples: [] };
          groups.set(group, entry);
        }
        entry.count += 1;
        if (sample && entry.samples.length < MAX_SAMPLES) entry.samples.push(sample);
        if (hintKey) hintKeys.add(hintKey);
      },
      get total() {
        return total;
      },
      get groupCount() {
        return groups.size;
      },
      toGroups() {
        return Array.from(groups.values()).sort((a, b) => b.count - a.count);
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

  const buildValidationForSchema = (activeSchema, parsedFiles) => {
    const validation = {};

    const indexes = {};
    FILE_TYPES.forEach((file) => {
      const fileSchema = activeSchema.files[file.key];
      const data = parsedFiles[file.key];
      const keyFields = normalizeFields(fileSchema.key);
      if (!data || !data.records) return;
      const index = new Set();
      data.records.forEach((record, idx) => {
        if (!record || typeof record !== "object") return;
        if (data.malformedRows && data.malformedRows.has(idx)) return;
        const key = buildKey(record, keyFields);
        if (!isEmptyValue(key)) index.add(key);
      });
      indexes[file.key] = index;
    });

    FILE_TYPES.forEach((file) => {
      const fileSchema = activeSchema.files[file.key];
      const data = parsedFiles[file.key];
      const collector = createIssueCollector();
      const warnings = [];

      if (!data) {
        validation[file.key] = {
          status: "error",
          issues: ["Arquivo nao carregado."],
          issueGroups: [{ message: "Arquivo nao carregado.", count: 1, samples: [] }],
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
          `Arquivo com ${data.replacementChars} caractere(s) invalido(s) de codificacao (nao esta em UTF-8).`,
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

      const unexpectedFields = data.normalizedFields.filter((field) => !allowedNormalized.includes(field));
      if (unexpectedFields.length) {
        collector.add(`Campos inesperados: ${unexpectedFields.join(", ")}`, null, "unexpectedFields");
      }

      const { typeHints } = fileSchema;
      if (typeHints && data.records.length) {
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object" || Array.isArray(record)) return;
          if (malformedRows.has(idx)) return;
          const at = `registro ${idx + 1}`;

          Object.entries(record).forEach(([field, value]) => {
            if (value && typeof value === "object") {
              collector.add(`${field.toUpperCase()} contem objeto/array (o dado precisa ser flat).`, at, "parse");
            }
          });

          (typeHints.number || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isNumberValue(value)) {
              collector.add(`${field} deve ser numero.`, `${at}, valor ${JSON.stringify(value)}`, "numberFormat");
            }
          });

          (typeHints.date || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isDateValue(value)) {
              collector.add(
                `${field} fora do formato de data aceito (use ${DATE_FORMAT_LABEL}).`,
                `${at}, valor ${JSON.stringify(value)} - ${describeDateProblem(value)}`,
                "dateFormat"
              );
            }
          });

          (typeHints.boolean || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isBooleanValue(value)) {
              collector.add(`${field} deve ser booleano.`, `${at}, valor ${JSON.stringify(value)}`, "boolean");
            }
          });

          (typeHints.notNumber || []).forEach((field) => {
            const value = record[normalizeField(field)];
            if (!isEmptyValue(value) && isNumberValue(value)) {
              collector.add(
                `${field} nao pode ser somente numero, deve ser a sigla/codigo (ex.: AMP C/10ML, 8/8).`,
                `${at}, valor ${JSON.stringify(value)}`,
                "notNumber"
              );
            }
          });

          Object.entries(typeHints.maxDigits || {}).forEach(([field, max]) => {
            const value = record[normalizeField(field)];
            if (isEmptyValue(value)) return;
            const digits = String(value).trim().replace(/\D/g, "");
            if (digits.length > max) {
              collector.add(
                `${field} deve ter no maximo ${max} digitos.`,
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
                `${field} deve ter no maximo ${max} caracteres.`,
                `${at}, ${String(value).length} caracteres`,
                "maxLength"
              );
            }
          });
        });
      }

      const duplicates = new Set();
      const keyFields = normalizeFields(fileSchema.key);
      const keyLabel = fileSchema.key.join(" + ");
      const seen = new Set();
      data.records.forEach((record, idx) => {
        if (!record || typeof record !== "object") return;
        if (malformedRows.has(idx)) return;
        const key = buildKey(record, keyFields);
        if (isEmptyValue(key) || key.includes("undefined") || key.includes("null")) {
          collector.add(`Chave obrigatoria vazia (${keyLabel}).`, `registro ${idx + 1}`, "keyEmpty");
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

      const refs = fileSchema.refs || {};
      Object.entries(refs).forEach(([field, refFile]) => {
        const refIndex = indexes[refFile];
        if (!refIndex) return;
        const fieldKey = normalizeField(field);
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object") return;
          if (malformedRows.has(idx)) return;
          const value = record[fieldKey];
          if (isEmptyValue(value)) return;
          if (!refIndex.has(String(value))) {
            collector.add(
              `${field} nao existe em ${refFile}.`,
              `registro ${idx + 1}, valor ${JSON.stringify(value)}`,
              "refMissing"
            );
          }
        });
      });

      if (malformedRows.size) {
        warnings.push(
          `${malformedRows.size} linha(s) ignorada(s) nas validacoes de conteudo por terem quantidade de colunas diferente do cabecalho.`
        );
      }

      const issueGroups = collector.toGroups();
      const issues = issueGroups.slice(0, MAX_ERRORS).map(formatGroupLine);
      if (issueGroups.length > MAX_ERRORS) {
        issues.push(`Mais ${issueGroups.length - MAX_ERRORS} tipo(s) de erro nao listado(s).`);
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
      };
    });

    const statusList = Object.values(validation).map((item) => item.status);
    let overall = "ok";
    if (statusList.includes("error")) overall = "error";
    else if (statusList.includes("warn")) overall = "warn";

    const errorCount = Object.values(validation).reduce((sum, item) => sum + (item.issueCount || 0), 0);
    const warningCount = Object.values(validation).reduce((sum, item) => sum + item.warnings.length, 0);

    return { validation, overall, errorCount, warningCount };
  };

  const validateParsed = (parsedFiles) => {
    const { validation, overall, errorCount, warningCount } = buildValidationForSchema(NOHARM_SCHEMA, parsedFiles);
    return {
      summary: {
        status: overall,
        errorCount,
        warningCount,
        message:
          overall === "ok"
            ? "Validacao concluida sem erros."
            : overall === "warn"
            ? "Validacao concluida com alertas."
            : `Validacao encontrou ${errorCount} erro(s).`,
      },
      files: validation,
      parsed: parsedFiles,
    };
  };

  // ---------------------------------------------------------------------------
  // Modelos de arquivo
  // ---------------------------------------------------------------------------
  // Lote coerente entre si (as chaves estrangeiras fecham), para servir de base
  // de importacao. O teste tests/validate_templates.js garante que este lote
  // continua passando com status ok.

  const TEMPLATES = {
    prescricoes: {
      fileName: "prescricoes",
      fields: [
        "FKHOSPITAL", "FKSETOR", "FKPRESCRICAO", "FKPESSOA", "NRATENDIMENTO", "DTPRESCRICAO", "DTVIGENCIA",
        "FKPRESMED", "FKUNIDADEMEDIDA", "FKMEDICAMENTO", "NOMEMEDICAMENTO", "DOSE", "FKFREQUENCIA", "VIA",
        "COMPLEMENTO", "DTSUSPENSAO", "ORIGEM", "SLAGRUPAMENTO", "SLETAPAS", "SLDOSAGEM", "SLTIPODOSAGEM",
        "SLACM", "HORARIO", "LEITO", "PRESCRITOR", "DTCRIACAO_ORIGEM", "CONVENIO", "PERIODO", "PERIODO_TOTAL",
        "ALERGIA",
      ],
      rows: [
        ["1", "10", "1001", "5001", "7001", "2026-02-07T10:00:00", "2026-02-08T10:00:00", "1001001", "MG", "2001",
          "AMOXICILINA 500MG", "500", "8/8", "VO", "Administrar com agua", "", "Medicamentos", "0", "0", "0", "",
          "N", "08:00 16:00 00:00", "A101", "DRA ANA", "2026-02-07T09:55:00", "PARTICULAR", "1", "5", "N"],
        ["1", "20", "1002", "5002", "7002", "2026-02-07T15:00:00", "2026-02-08T15:00:00", "1002001", "ML", "2002",
          "DIPIRONA SODICA 500MG/ML", "2", "12/12", "IV", "Diluir em 100ml de SF 0.9%", "", "Medicamentos", "0", "0",
          "0", "", "N", "08:00 20:00", "B204", "DR BRUNO", "2026-02-07T14:55:00", "SUS", "1", "3", "N"],
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
        ["1", "5001", "FULANO DE TAL", "7001", "1980-05-10", "2026-02-07T09:30:00", "PARDA", "M", "78.5",
          "2026-02-07T09:35:00", "1.75", "", "", "DRA ANA", "SAO PAULO", "A419", "10", "A101", "2026-02-07T09:30:00"],
        ["1", "5002", "CICLANA DE TAL", "7002", "1992-11-23", "2026-02-07T14:10:00", "BRANCA", "F", "64.2",
          "2026-02-07T14:20:00", "1.62", "", "", "DR BRUNO", "CAMPINAS", "J189", "20", "B204", "2026-02-07T14:10:00"],
      ],
    },
    medicamentos: {
      fileName: "medicamentos",
      fields: [
        "FKHOSPITAL", "ORIGEM", "FKMEDICAMENTO", "NOME", "NAOPADRONIZADO", "FKUNIDADEMEDIDACUSTO", "CUSTO_PADRAO",
        "VL_FATOR", "CUSTO",
      ],
      rows: [
        ["1", "Medicamentos", "2001", "AMOXICILINA 500MG", "0", "MG", "1.5", "1", "1.5"],
        ["1", "Medicamentos", "2002", "DIPIRONA SODICA 500MG/ML", "0", "ML", "0.75", "1", "0.75"],
      ],
    },
    setores: {
      fileName: "setores",
      fields: ["FKHOSPITAL", "FKSETOR", "NOME"],
      rows: [
        ["1", "10", "CLINICA MEDICA"],
        ["1", "20", "UTI ADULTO"],
      ],
    },
    unidades: {
      fileName: "unidades",
      fields: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
      rows: [
        ["1", "MG", "Miligramas"],
        ["1", "ML", "Mililitros"],
      ],
    },
    frequencia: {
      fileName: "frequencia",
      fields: ["FKHOSPITAL", "FKFREQUENCIA", "NOME"],
      rows: [
        ["1", "8/8", "8 em 8 horas"],
        ["1", "12/12", "12 em 12 horas"],
      ],
    },
    exame: {
      fileName: "exame",
      fields: ["FKHOSPITAL", "FKEXAME", "FKPESSOA", "NRATENDIMENTO", "DTEXAME", "TPEXAME", "RESULTADO", "UNIDADE"],
      rows: [
        ["1", "8001", "5001", "7001", "2026-02-07T08:00:00", "HEMOGLOBINA", "12.5", "g/dL"],
        ["1", "8002", "5002", "7002", "2026-02-07T16:00:00", "CREATININA", "0.9", "mg/dL"],
      ],
    },
    alergia: {
      fileName: "alergia",
      fields: [
        "FKHOSPITAL", "FKPESSOA", "NRATENDIMENTO", "DTINTERNACAO", "FKMEDICAMENTO", "NOME_MEDICAMENTO", "CREATED_AT",
        "CREATED_BY", "UPDATED_AT", "UPDATED_BY", "ATIVO",
      ],
      rows: [
        ["1", "5001", "7001", "2026-02-07T09:30:00", "2001", "AMOXICILINA 500MG", "2026-02-07T09:40:00", "INTEGRACAO",
          "2026-02-07T09:40:00", "INTEGRACAO", "1"],
        ["1", "5002", "7002", "2026-02-07T14:10:00", "2002", "DIPIRONA SODICA 500MG/ML", "2026-02-07T14:30:00",
          "INTEGRACAO", "", "", "0"],
      ],
    },
    cultura: {
      fileName: "cultura",
      fields: [
        "FKHOSPITAL", "FKEXAME", "FKITEMEXAME", "FKPESSOA", "NRATENDIMENTO", "DTPEDIDO", "DTCOLETA", "DTLIBERACAO",
        "FKSETOR", "NOMEEXAME", "NOMEMATERIAL", "NOMEMATERIALTIPO", "COMPLEMENTO", "DSCOLONIA", "GRAM", "NRCOLONIA",
        "RESULTPREVIO", "FKMEDICAMENTO", "NOMEMEDICAMENTO", "FKMICROORGANISMO", "NOMEMICROORGANISMO",
        "QTMICROORGANISMO", "RESULTADO",
      ],
      rows: [
        ["1", "8001", "9001", "5001", "7001", "2026-02-06T10:00:00", "2026-02-06T11:00:00", "2026-02-08T09:00:00",
          "10", "UROCULTURA", "URINA", "LIQUIDO", "", "COLONIAS BRANCAS", "NEGATIVO", "2", "NEGATIVO", "2001",
          "AMOXICILINA 500MG", "3001", "ESCHERICHIA COLI", "100000", "SENSIVEL"],
        ["1", "8002", "9002", "5002", "7002", "2026-02-07T10:00:00", "2026-02-07T11:00:00", "2026-02-09T09:00:00",
          "20", "HEMOCULTURA", "SANGUE", "LIQUIDO", "", "COLONIAS AMARELAS", "POSITIVO", "3", "POSITIVO", "2002",
          "DIPIRONA SODICA 500MG/ML", "3002", "STAPHYLOCOCCUS AUREUS", "50000", "RESISTENTE"],
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

  return {
    FILE_TYPES,
    NOHARM_SCHEMA,
    HINTS,
    TEMPLATES,
    DATE_FORMAT_LABEL,
    parseFileText,
    validateParsed,
    buildTemplateCsv,
    buildTemplateJson,
    getTemplateFileName,
  };
});
