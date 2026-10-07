// Persistencia local do progresso da validacao.
//
// Fica tudo em localStorage, no browser do cliente: nenhum dado sai da maquina.
// O conteudo dos arquivos NÃO e guardado (prescricao de hospital real passa
// facil de centenas de MB). O que persiste e:
//   - a resposta sobre quais views opcionais o cliente tem;
//   - o resultado de cada view ja validada (status, contagens, erros agrupados);
//   - o indice de chaves das views que servem de alvo de referencia cruzada,
//     para os passos seguintes validarem FK sem precisar do arquivo de novo.
(function (root) {
  "use strict";

  const STORAGE_KEY = "noharm-validador-progresso";
  const VERSION = 1;

  // Indice muito grande estoura a cota do localStorage. Acima disso o passo
  // seguinte pede o arquivo de novo em vez de quebrar o armazenamento.
  const MAX_INDEX_KEYS = 20000;

  const emptyState = () => ({
    version: VERSION,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // O que o cliente respondeu sobre ter ou nao cada view opcional.
    // { [fileKey]: true | false }
    optionals: {},
    steps: {},
    indexes: {},
  });

  const isAvailable = () => {
    try {
      const probe = "__noharm_probe__";
      root.localStorage.setItem(probe, "1");
      root.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  };

  const available = isAvailable();

  const read = () => {
    if (!available) return emptyState();
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return emptyState();
      return Object.assign(emptyState(), parsed);
    } catch (err) {
      return emptyState();
    }
  };

  // Se a cota estourar, vai soltando os indices (do maior para o menor) ate
  // caber. O progresso e os resultados sao mais importantes que os indices:
  // sem indice o passo seguinte so pede o arquivo de origem de novo.
  const write = (state) => {
    if (!available) return state;
    const next = Object.assign({}, state, { updatedAt: new Date().toISOString() });

    const attempt = (candidate) => {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    };

    try {
      attempt(next);
      return next;
    } catch (err) {
      const indexes = Object.assign({}, next.indexes);
      const bySize = Object.keys(indexes).sort((a, b) => indexes[b].length - indexes[a].length);
      for (const key of bySize) {
        delete indexes[key];
        const reduced = Object.assign({}, next, { indexes });
        try {
          attempt(reduced);
          return reduced;
        } catch (innerErr) {
          // continua soltando indice
        }
      }
      try {
        const semIndices = Object.assign({}, next, { indexes: {} });
        attempt(semIndices);
        return semIndices;
      } catch (finalErr) {
        return next;
      }
    }
  };

  // Grupos de erro sem nenhum valor vindo do arquivo. Mantem a contagem de
  // valores distintos, que e numero, nao dado.
  const semValores = (grupos) =>
    (grupos || []).map((grupo) => {
      const limpo = Object.assign({}, grupo);
      delete limpo.samples;
      delete limpo.distinctValues;
      return limpo;
    });

  const Storage = {
    available,
    MAX_INDEX_KEYS,

    load() {
      return read();
    },

    save(state) {
      return write(state);
    },

    clear() {
      if (available) {
        try {
          root.localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          // nada a fazer
        }
      }
      return emptyState();
    },

    hasProgress(state) {
      const current = state || read();
      return Object.keys(current.steps || {}).length > 0;
    },

    // Guarda o resultado de um passo. `index` e a lista de chaves da view,
    // guardada so quando ela e alvo de referencia cruzada e cabe no limite.
    // O cliente le, no rodape da tela, que "o conteudo dos arquivos nao e
    // guardado". Isso tem que ser verdade: nome, nascimento, CID e leito sao
    // dado sensivel de saude (LGPD art. 11) e o navegador de hospital costuma
    // ser de estacao compartilhada.
    //
    // Entao fica de fora daqui tudo que carrega valor vindo do arquivo:
    // - `preview` (as 5 primeiras linhas do arquivo, com nome e nascimento);
    // - `samples` e `distinctValues` dos grupos de erro, que citam o valor do
    //   campo ('registro 1, valor "12/03/1958"').
    //
    // O que fica: status, contagens e a MENSAGEM do erro — suficiente para o
    // relatorio e para o cliente saber o que corrigir. Os valores continuam na
    // tela enquanto a sessao vive (vem de `stepResults`, que e memoria).
    // `tests/validate_storage.js` tranca isso.
    saveStep(state, fileKey, result, meta, index, preview) {
      const steps = Object.assign({}, state.steps);
      const indexes = Object.assign({}, state.indexes);

      const storeIndex = Array.isArray(index) && index.length > 0 && index.length <= MAX_INDEX_KEYS;
      if (storeIndex) {
        indexes[fileKey] = index;
      } else {
        delete indexes[fileKey];
      }

      steps[fileKey] = {
        status: result.status,
        skipped: false,
        fileName: (meta && meta.fileName) || null,
        fileSize: (meta && meta.fileSize) || null,
        format: (meta && meta.format) || null,
        // "previa" quando o arquivo entrou pela tela de Prescricao
        origem: (meta && meta.origem) || null,
        recordCount: result.recordCount ?? null,
        columnCount: result.columnCount ?? null,
        malformedRowCount: result.malformedRowCount ?? 0,
        issueCount: result.issueCount ?? 0,
        issueGroups: semValores(result.issueGroups),
        hints: result.hints || [],
        warnings: result.warnings || [],
        extraFields: result.extraFields || [],
        indexStored: storeIndex,
        indexTruncated: Array.isArray(index) && index.length > MAX_INDEX_KEYS,
        validatedAt: new Date().toISOString(),
      };

      return write(Object.assign({}, state, { steps, indexes }));
    },

    // Resposta do cliente sobre quais views opcionais de um grupo ele tem.
    // O que ele nao marcou ja entra como pulada, sem virar passo.
    setOptionals(state, fileKeys, chosen) {
      const optionals = Object.assign({}, state.optionals);
      const steps = Object.assign({}, state.steps);
      const indexes = Object.assign({}, state.indexes);
      const marcadas = new Set(chosen);

      fileKeys.forEach((fileKey) => {
        const tem = marcadas.has(fileKey);
        optionals[fileKey] = tem;
        if (tem) {
          // Mudou de ideia: volta a ser um passo pendente.
          if (steps[fileKey] && steps[fileKey].skipped) delete steps[fileKey];
        } else {
          delete indexes[fileKey];
          steps[fileKey] = { status: "skipped", skipped: true, validatedAt: new Date().toISOString() };
        }
      });

      return write(Object.assign({}, state, { optionals, steps, indexes }));
    },

    skipStep(state, fileKey) {
      const steps = Object.assign({}, state.steps);
      const indexes = Object.assign({}, state.indexes);
      delete indexes[fileKey];
      steps[fileKey] = {
        status: "skipped",
        skipped: true,
        validatedAt: new Date().toISOString(),
      };
      return write(Object.assign({}, state, { steps, indexes }));
    },

    resetStep(state, fileKey) {
      const steps = Object.assign({}, state.steps);
      const indexes = Object.assign({}, state.indexes);
      delete steps[fileKey];
      delete indexes[fileKey];

      return write(Object.assign({}, state, { steps, indexes }));
    },

    // Respondeu sobre as opcionais deste grupo?
    hasAnswered(state, fileKeys) {
      return fileKeys.every((fileKey) => typeof (state.optionals || {})[fileKey] === "boolean");
    },

    externalIndexes(state) {
      return state.indexes || {};
    },

    // Exportar/reimportar o progresso permite continuar a validacao em outra
    // maquina, ou mandar o andamento para a NoHarm junto do relatorio.
    exportJson(state) {
      return `${JSON.stringify(state, null, 2)}\n`;
    },

    importJson(text) {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Arquivo de progresso inválido.");
      if (parsed.version !== VERSION) throw new Error("Arquivo de progresso de uma versão diferente do validador.");
      return write(Object.assign(emptyState(), parsed));
    },
  };

  root.NoHarmStorage = Storage;
})(typeof self !== "undefined" ? self : this);
