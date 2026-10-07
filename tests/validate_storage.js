const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// storage.js roda no browser. Aqui damos a ele um localStorage de mentira para
// poder testar as regras de progresso em Node.
// Os valores que o teste procura saem do PROPRIO arquivo de exemplo, nunca de
// uma lista fixa. Uma lista fixa ja envelheceu em silencio: quando os nomes do
// exemplo mudaram, a asserção que procurava "JOAO BATISTA DOS SANTOS" virou
// tautologia e deixou de testar o que mais importava.
//
// Ignora celula curta (um "1", um "M") porque esses caracteres aparecem na
// estrutura do JSON gravado e dariam falso positivo.
const valoresDoPrimeiroRegistro = (csv) => {
  const linhas = csv.split("\n").filter((linha) => linha.trim() !== "");
  const primeira = (linhas[1] || "").split(",");
  const valores = primeira.map((celula) => celula.trim()).filter((celula) => celula.length >= 4);
  assert.ok(valores.length >= 4, "O exemplo precisa ter valores longos o bastante para o teste valer.");
  return valores;
};

// Igual ao `carregarStorage`, mas devolve tambem o mapa, para o teste poder
// olhar o que foi efetivamente gravado.
const carregarStorageComMemoria = () => {
  const memoria = new Map();
  const escopo = {
    localStorage: {
      getItem: (key) => (memoria.has(key) ? memoria.get(key) : null),
      setItem: (key, value) => memoria.set(key, String(value)),
      removeItem: (key) => memoria.delete(key),
    },
  };
  escopo.self = escopo;
  vm.createContext(escopo);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8"), escopo);
  return { storage: escopo.NoHarmStorage, memoria };
};

const carregarStorage = () => {
  const memoria = new Map();
  const escopo = {
    localStorage: {
      getItem: (key) => (memoria.has(key) ? memoria.get(key) : null),
      setItem: (key, value) => memoria.set(key, String(value)),
      removeItem: (key) => memoria.delete(key),
    },
  };
  escopo.self = escopo;
  vm.createContext(escopo);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8"), escopo);
  return escopo.NoHarmStorage;
};

const resultadoOk = (registros) => ({
  status: "ok",
  recordCount: registros,
  columnCount: 3,
  issueCount: 0,
  issueGroups: [],
  hints: [],
  warnings: [],
  extraFields: [],
});

// A resposta sobre as opcionais marca como pulada o que o cliente nao tem.
const opcionais = () => {
  const Storage = carregarStorage();
  let state = Storage.load();
  const todas = ["exame", "cultura", "alergia", "evolucao", "transferencia"];

  assert.strictEqual(Storage.hasAnswered(state, todas), false);
  state = Storage.setOptionals(state, todas, ["exame", "alergia"]);
  assert.strictEqual(Storage.hasAnswered(state, todas), true);

  assert.strictEqual(state.steps.cultura.skipped, true);
  assert.strictEqual(state.steps.exame, undefined, "O que ele tem vira etapa pendente, não pulada.");

  // Mudou de ideia: a pulada volta a ser etapa.
  state = Storage.setOptionals(state, todas, ["exame", "alergia", "cultura"]);
  assert.strictEqual(state.steps.cultura, undefined);

  console.log("Resposta das opcionais: OK");
};

// LGPD: o rodape da tela promete que "o conteudo dos arquivos nao e guardado".
// Este teste tranca a promessa. Nome, nascimento, cidade, CID e leito nao podem
// aparecer no localStorage — nem pela amostra (`preview`), nem pelos `samples`
// dos grupos de erro, que citam o valor do campo.
const nadaDeConteudoNoStorage = () => {
  const memoria = new Map();
  const escopo = {
    localStorage: {
      getItem: (key) => (memoria.has(key) ? memoria.get(key) : null),
      setItem: (key, value) => memoria.set(key, String(value)),
      removeItem: (key) => memoria.delete(key),
    },
  };
  escopo.self = escopo;
  vm.createContext(escopo);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "storage.js"), "utf8"), escopo);
  const Storage = escopo.NoHarmStorage;

  const resultado = {
    status: "error",
    recordCount: 2,
    columnCount: 19,
    issueCount: 1,
    issueGroups: [
      {
        message: "DTNASCIMENTO fora do formato de data aceito.",
        count: 1,
        samples: ['registro 1, valor "12/03/1958"'],
        distinctValues: ["12/03/1958"],
        distinctCount: 1,
      },
    ],
    hints: [],
    warnings: [],
  };
  const amostra = {
    columns: ["NOME", "DTNASCIMENTO", "CIDADE", "IDCID", "LEITO"],
    rows: [["JOAO BATISTA DOS SANTOS", "12/03/1958", "PORTO ALEGRE", "J189", "20-A"]],
    usedColumns: 5,
    totalColumns: 19,
  };

  let state = Storage.load();
  state = Storage.saveStep(state, "pessoa", resultado, { fileName: "pessoa.csv" }, ["7001"], amostra);

  const gravado = Array.from(memoria.values()).join("");
  amostra.rows[0].concat(["12/03/1958"]).forEach((valor) => {
    assert.ok(
      !gravado.includes(valor),
      `Valor vindo do arquivo foi gravado no localStorage: ${valor}. O rodape promete que nao.`
    );
  });

  // O que tem que sobreviver: a mensagem e as contagens.
  assert.ok(gravado.includes("DTNASCIMENTO fora do formato"), "A mensagem do erro precisa ser guardada.");
  assert.strictEqual(state.steps.pessoa.issueCount, 1);
  assert.strictEqual(state.steps.pessoa.issueGroups[0].distinctCount, 1);
  assert.strictEqual(state.steps.pessoa.issueGroups[0].samples, undefined);
  assert.strictEqual(state.steps.pessoa.preview, undefined);

  console.log("Nenhum conteudo de arquivo no localStorage: OK");
};

// O caso que uma revisao de seguranca pegou: export SEM CABECALHO. O PapaParse
// roda com `header: true`, entao a primeira LINHA DE DADOS vira o cabecalho, e
// os "nomes de coluna" passam a ser nome, nascimento, cidade, CID e leito do
// primeiro paciente. Esses nomes iam parar em `extraFields`, gravados no
// localStorage e copiados para o relatorio exportado.
//
// E justamente um dos arquivos quebrados que o validador existe para pegar,
// entao nao e um caso raro.
const arquivoSemCabecalhoNaoVaza = async () => {
  const validator = require(path.join(__dirname, "..", "validator.js"));
  const Storage = carregarStorageComMemoria();

  const comCabecalho = fs.readFileSync(path.join(__dirname, "..", "examples", "pessoa.csv"), "utf8");
  const semCabecalho = comCabecalho.split("\n").slice(1).join("\n");

  const parsed = await validator.parseFileText("VW_NOHARM_05.csv", semCabecalho);
  const resultado = validator.validateFile("pessoa", parsed, {});

  let state = Storage.storage.load();
  state = Storage.storage.saveStep(
    state,
    "pessoa",
    resultado,
    { fileName: "VW_NOHARM_05.csv" },
    [],
    validator.buildPreview("pessoa", parsed)
  );

  const gravado = Array.from(Storage.memoria.values()).join("");
  valoresDoPrimeiroRegistro(comCabecalho).forEach((valor) => {
    assert.ok(
      !gravado.includes(valor),
      `Arquivo sem cabecalho vazou "${valor}" para o localStorage via extraFields.`
    );
  });

  // O que sobra e util: a contagem.
  assert.strictEqual(typeof state.steps.pessoa.extraFieldCount, "number");
  assert.strictEqual(state.steps.pessoa.extraFields, undefined);

  // E o export de progresso tambem nao leva nada.
  const exportado = Storage.storage.exportJson(state);
  valoresDoPrimeiroRegistro(comCabecalho).forEach((valor) => {
    assert.ok(!exportado.includes(valor), `O export de progresso vazou "${valor}".`);
  });

  console.log("Arquivo sem cabecalho nao vaza paciente: OK");
};

opcionais();
nadaDeConteudoNoStorage();
arquivoSemCabecalhoNaoVaza().then(() => console.log("All storage checks passed."));
