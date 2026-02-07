const assert = require("assert");
const fs = require("fs");
const path = require("path");
const validator = require("../validator");

const BASE = path.join(__dirname, "..", "examples");

const batches = [
  {
    name: "CSV",
    files: {
      prescricoes: "prescricoes.csv",
      medicamentos: "medicamentos.csv",
      setores: "setores.csv",
      unidades: "unidades.csv",
      frequencia: "frequencia.csv",
    },
  },
  {
    name: "JSON",
    files: {
      prescricoes: "prescricoes.json",
      medicamentos: "medicamentos.json",
      setores: "setores.json",
      unidades: "unidades.json",
      frequencia: "frequencia.json",
    },
  },
];

const loadText = (filePath) => fs.readFileSync(filePath, "utf8");

const runBatch = async (batch) => {
  const parsed = {};
  for (const [key, fileName] of Object.entries(batch.files)) {
    const fullPath = path.join(BASE, fileName);
    const text = loadText(fullPath);
    parsed[key] = await validator.parseFileText(fileName, text);
  }

  const result = validator.validateParsed(parsed);
  assert.strictEqual(
    result.summary.status,
    "ok",
    `[${batch.name}] Esperado status ok, recebido ${result.summary.status}`
  );

  for (const [key, info] of Object.entries(result.files)) {
    assert.strictEqual(
      info.status,
      "ok",
      `[${batch.name}] ${key} deveria estar ok. Erros: ${info.issues.join(" | ")}`
    );
  }

  console.log(`Batch ${batch.name}: OK`);
};

(async () => {
  for (const batch of batches) {
    await runBatch(batch);
  }
  console.log("All validation batches passed.");
})();
