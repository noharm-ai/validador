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
  assert.strictEqual(state.steps.exame, undefined, "O que ele tem vira etapa pendente, nao pulada.");

  // Mudou de ideia: a pulada volta a ser etapa.
  state = Storage.setOptionals(state, todas, ["exame", "alergia", "cultura"]);
  assert.strictEqual(state.steps.cultura, undefined);

  console.log("Resposta das opcionais: OK");
};

opcionais();
console.log("All storage checks passed.");
