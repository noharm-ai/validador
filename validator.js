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
    { key: "medicamentos", label: "Medicamentos" },
    { key: "setores", label: "Setores" },
    { key: "unidades", label: "Unidades" },
    { key: "frequencia", label: "Frequencia" },
  ];

  const getRequiredFields = (fileSchema) => {
    if (fileSchema.requiredGroups) {
      const all = new Set();
      Object.values(fileSchema.requiredGroups).forEach((group) => {
        group.forEach((field) => all.add(field));
      });
      return Array.from(all);
    }
    return fileSchema.required || [];
  };

  const SCHEMAS = {
    mv: {
      label: "MV",
      files: {
        prescricoes: {
          required: [
            "FKHOSPITAL",
            "FKSETOR",
            "FKPRESCRICAO",
            "FKPESSOA",
            "NRATENDIMENTO",
            "DTPRESCRICAO",
            "DTVIGENCIA",
            "FKPRESMED",
            "FKUNIDADEMEDIDA",
            "FKMEDICAMENTO",
            "NOMEMEDICAMENTO",
            "DOSE",
            "FKFREQUENCIA",
            "VIA",
            "COMPLEMENTO",
            "DTSUSPENSAO",
            "ORIGEM",
            "SLAGRUPAMENTO",
            "SLETAPAS",
            "SLDOSAGEM",
            "SLTIPODOSAGEM",
            "SLACM",
            "HORARIO",
            "LEITO",
            "PRESCRITOR",
            "DTCRIACAO_ORIGEM",
            "CONVENIO",
            "PERIODO",
            "PERIODO_TOTAL",
            "ALERGIA",
          ],
          key: ["FKPRESMED"],
          typeHints: {
            number: [
              "FKHOSPITAL",
              "FKSETOR",
              "FKPRESCRICAO",
              "FKPESSOA",
              "NRATENDIMENTO",
              "FKPRESMED",
              "DOSE",
              "SLAGRUPAMENTO",
              "SLETAPAS",
              "SLDOSAGEM",
              "PERIODO",
              "PERIODO_TOTAL",
            ],
            date: ["DTPRESCRICAO", "DTVIGENCIA", "DTSUSPENSAO", "DTCRIACAO_ORIGEM"],
          },
          refs: {
            FKSETOR: "setores",
            FKMEDICAMENTO: "medicamentos",
            FKUNIDADEMEDIDA: "unidades",
            FKFREQUENCIA: "frequencia",
          },
        },
        medicamentos: {
          required: [
            "FKHOSPITAL",
            "ORIGEM",
            "FKMEDICAMENTO",
            "NOME",
            "NAOPADRONIZADO",
            "FKUNIDADEMEDIDACUSTO",
            "CUSTO_PADRAO",
            "VL_FATOR",
            "CUSTO",
          ],
          key: ["FKMEDICAMENTO"],
          typeHints: {
            number: ["FKHOSPITAL", "FKMEDICAMENTO", "CUSTO_PADRAO", "VL_FATOR", "CUSTO"],
          },
        },
        setores: {
          required: ["FKHOSPITAL", "FKSETOR", "NOME"],
          key: ["FKSETOR"],
          typeHints: { number: ["FKHOSPITAL", "FKSETOR"] },
        },
        unidades: {
          required: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
          key: ["FKUNIDADEMEDIDA"],
          typeHints: { number: ["FKHOSPITAL"] },
        },
        frequencia: {
          required: ["FKHOSPITAL", "FKFREQUENCIA", "NOME"],
          key: ["FKFREQUENCIA"],
          typeHints: { number: ["FKHOSPITAL"] },
        },
      },
    },
    tasy: {
      label: "Tasy",
      files: {
        prescricoes: {
          required: [
            "ORIGEM",
            "NRATENDIMENTO",
            "FKPRESCRICAO",
            "SLAGRUPAMENTO",
            "SLACM",
            "SLETAPAS",
            "SLHORAFASE",
            "SLTEMPOAPLICACAO",
            "SLDOSAGEM",
            "SLTIPODOSAGEM",
            "FKPRESMED",
            "FKPESSOA",
            "FKSETOR",
            "DTPRESCRICAO",
            "DTCRIACAO_ORIGEM",
            "DTATUALIZACAO",
            "DTSUSPENSAO",
            "DTVIGENCIA",
            "HORARIO",
            "FREQUENCIADIA",
            "COMPLEMENTO",
            "FKMEDICAMENTO",
            "DOSE",
            "FKUNIDADEMEDIDA",
            "DS_UNIDADE_MEDIDA",
            "FKFREQUENCIA",
            "VIA",
            "LEITO",
            "PRONTUARIO",
            "PRESCRITOR",
            "ALERGIA",
            "PERIODO",
            "PERIODO_TOTAL",
            "CONVENIO",
          ],
          key: ["FKPRESMED"],
          typeHints: {
            number: [
              "NRATENDIMENTO",
              "FKPRESCRICAO",
              "FKPRESMED",
              "FKPESSOA",
              "FKSETOR",
              "FREQUENCIADIA",
              "FKMEDICAMENTO",
              "DOSE",
              "PERIODO",
              "PERIODO_TOTAL",
            ],
            date: ["DTPRESCRICAO", "DTCRIACAO_ORIGEM", "DTATUALIZACAO", "DTSUSPENSAO", "DTVIGENCIA"],
          },
          refs: {
            FKSETOR: "setores",
            FKMEDICAMENTO: "medicamentos",
            FKUNIDADEMEDIDA: "unidades",
            FKFREQUENCIA: "frequencia",
          },
        },
        medicamentos: {
          required: [
            "FKHOSPITAL",
            "FKMEDICAMENTO",
            "NOME",
            "NAOPADRONIZADO",
            "FKUNIDADEMEDIDACUSTO",
            "CUSTO",
          ],
          key: ["FKMEDICAMENTO"],
          typeHints: {
            number: ["FKHOSPITAL", "FKMEDICAMENTO", "CUSTO"],
          },
        },
        setores: {
          required: ["FKHOSPITAL", "FKSETOR", "NOME"],
          key: ["FKSETOR"],
          typeHints: { number: ["FKHOSPITAL", "FKSETOR"] },
        },
        unidades: {
          required: ["FKHOSPITAL", "FKUNIDADEMEDIDA", "NOME"],
          key: ["FKUNIDADEMEDIDA"],
          typeHints: { number: ["FKHOSPITAL"] },
        },
        frequencia: {
          required: ["FKHOSPITAL", "FKFREQUENCIA", "NOME"],
          key: ["FKFREQUENCIA"],
          typeHints: { number: ["FKHOSPITAL"] },
        },
      },
    },
  };

  const mergeTypeHints = (a = {}, b = {}) => {
    const mergeList = (key) => Array.from(new Set([...(a[key] || []), ...(b[key] || [])]));
    return {
      number: mergeList("number"),
      date: mergeList("date"),
      boolean: mergeList("boolean"),
    };
  };

  const NOHARM_SCHEMA = (() => {
    const files = {};
    FILE_TYPES.forEach((file) => {
      const mv = SCHEMAS.mv.files[file.key];
      const tasy = SCHEMAS.tasy.files[file.key];
      const mvFields = getRequiredFields(mv);
      const tasyFields = getRequiredFields(tasy);
      const allowed = Array.from(new Set([...mvFields, ...tasyFields]));
      const required = mvFields.filter((field) => tasyFields.includes(field));
      files[file.key] = {
        required,
        allowed,
        key: mv.key || tasy.key,
        typeHints: mergeTypeHints(mv.typeHints, tasy.typeHints),
        refs: { ...(mv.refs || {}), ...(tasy.refs || {}) },
      };
    });
    return { label: "NoHarm", files };
  })();

  const MAX_ERRORS = 200;
  const NORMALIZATION_MODE = "lower";

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

  const isDateValue = (val) => {
    if (isEmptyValue(val)) return true;
    const date = new Date(val);
    return !Number.isNaN(date.getTime());
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

  const parseFileText = async (fileName, text) => {
    const format = guessFormat(fileName);
    const currentErrors = [];
    let records = [];
    let fields = [];
    let detectedFormat = format;
    let root = null;

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
        if (csv.errors && csv.errors.length) {
          currentErrors.push(...csv.errors.map((e) => `CSV: ${e.message}`));
        }
        records = csv.data || [];
        fields = (csv.meta && csv.meta.fields) || [];
        detectedFormat = "csv";
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
      currentErrors.push(`Erro ao ler arquivo: ${err.message}`);
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
      parseErrors: currentErrors,
    };
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
      data.records.forEach((record) => {
        if (!record || typeof record !== "object") return;
        const key = buildKey(record, keyFields);
        if (!isEmptyValue(key)) index.add(key);
      });
      indexes[file.key] = index;
    });

    FILE_TYPES.forEach((file) => {
      const fileSchema = activeSchema.files[file.key];
      const data = parsedFiles[file.key];
      let issues = [];
      let warnings = [];

      if (!data) {
        validation[file.key] = { status: "error", issues: ["Arquivo nao carregado."], warnings: [] };
        return;
      }

      if (data.parseErrors.length) {
        data.parseErrors.forEach((msg) => issues.push(msg));
      }

      if (data.format === "json" && data.root === "object-data") {
        issues.push("JSON possui raiz com campo data. O formato deve ser um array direto de registros.");
      }

      if (data.format === "json" && data.root === "object") {
        issues.push("JSON deve ser um array de objetos (lista de registros).");
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
        issues.push(`Campos faltando: ${missingFields.join(", ")}`);
      }

      const unexpectedFields = data.normalizedFields.filter((field) => !allowedNormalized.includes(field));
      if (unexpectedFields.length) {
        issues.push(`Campos inesperados: ${unexpectedFields.join(", ")}`);
      }

      const invalidTypes = [];
      const { typeHints } = fileSchema;
      if (typeHints && data.records.length) {
        data.records.forEach((record, idx) => {
          if (!record || typeof record !== "object" || Array.isArray(record)) return;
          Object.values(record).forEach((value) => {
            if (value && typeof value === "object") {
              invalidTypes.push(`Registro ${idx + 1}: valores nao podem ser objetos/arrays.`);
            }
          });

          (typeHints.number || []).forEach((field) => {
            const fieldKey = normalizeField(field);
            if (!isNumberValue(record[fieldKey])) {
              invalidTypes.push(`Registro ${idx + 1}: ${field} deve ser numero.`);
            }
          });

          (typeHints.date || []).forEach((field) => {
            const fieldKey = normalizeField(field);
            if (!isDateValue(record[fieldKey])) {
              invalidTypes.push(`Registro ${idx + 1}: ${field} deve ser data/hora valida.`);
            }
          });

          (typeHints.boolean || []).forEach((field) => {
            const fieldKey = normalizeField(field);
            if (!isBooleanValue(record[fieldKey])) {
              invalidTypes.push(`Registro ${idx + 1}: ${field} deve ser booleano.`);
            }
          });
        });
      }

      invalidTypes.slice(0, MAX_ERRORS).forEach((item) => issues.push(item));

      const duplicates = new Set();
      const keyFields = normalizeFields(fileSchema.key);
      const seen = new Set();
      data.records.forEach((record) => {
        if (!record || typeof record !== "object") return;
        const key = buildKey(record, keyFields);
        if (isEmptyValue(key) || key.includes("undefined") || key.includes("null")) {
          issues.push(`Chave obrigatoria vazia (${fileSchema.key.join(" + ")}).`);
          return;
        }
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
      });
      if (duplicates.size) {
        issues.push(`Chaves duplicadas (${fileSchema.key.join(" + ")}): ${Array.from(duplicates).slice(0, 5).join(", ")}`);
      }

      const refs = fileSchema.refs || {};
      Object.entries(refs).forEach(([field, refFile]) => {
        const refIndex = indexes[refFile];
        if (!refIndex) return;
        data.records.forEach((record, idx) => {
          const fieldKey = normalizeField(field);
          const value = record[fieldKey];
          if (isEmptyValue(value)) return;
          if (!refIndex.has(String(value))) {
            issues.push(`Registro ${idx + 1}: ${field} (${value}) nao existe em ${refFile}.`);
          }
        });
      });

      if (issues.length > MAX_ERRORS) {
        issues = issues.slice(0, MAX_ERRORS).concat(["Muitos erros. Mostrando somente os primeiros."]);
      }

      const status = issues.length ? "error" : warnings.length ? "warn" : "ok";
      validation[file.key] = {
        status,
        issues,
        warnings,
        recordCount: data.records.length,
        columnCount: data.normalizedFields.length,
      };
    });

    const statusList = Object.values(validation).map((item) => item.status);
    let overall = "ok";
    if (statusList.includes("error")) overall = "error";
    else if (statusList.includes("warn")) overall = "warn";

    const errorCount = Object.values(validation).reduce((sum, item) => sum + item.issues.length, 0);
    const warningCount = Object.values(validation).reduce((sum, item) => sum + item.warnings.length, 0);

    return { validation, overall, errorCount, warningCount };
  };

  const validateParsed = (parsedFiles) => {
    const { validation, overall } = buildValidationForSchema(NOHARM_SCHEMA, parsedFiles);
    return {
      summary: {
        status: overall,
        message:
          overall === "ok"
            ? "Validacao concluida sem erros."
            : overall === "warn"
            ? "Validacao concluida com alertas."
            : "Validacao encontrou erros.",
      },
      files: validation,
      parsed: parsedFiles,
    };
  };

  return {
    FILE_TYPES,
    NOHARM_SCHEMA,
    parseFileText,
    validateParsed,
  };
});
