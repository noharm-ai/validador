const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// storage.js roda no browser. Aqui damos a ele um localStorage de mentira para
// poder testar as regras de progresso em Node.
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
  ["JOAO BATISTA DOS SANTOS", "12/03/1958", "PORTO ALEGRE", "J189", "20-A"].forEach((valor) => {
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

opcionais();
nadaDeConteudoNoStorage();
console.log("All storage checks passed.");
