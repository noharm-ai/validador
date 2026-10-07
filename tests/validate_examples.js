const assert = require("assert");
const fs = require("fs");
const path = require("path");
const validator = require("../validator");

const BASE = path.join(__dirname, "..", "examples");

// Os lotes cobrem as 15 views do Anexo I, em CSV e em JSON.
const buildBatch = (name, format) => ({
  name,
  files: validator.FILE_TYPES.reduce((acc, file) => {
    acc[file.key] = `${file.key}.${format}`;
    return acc;
  }, {}),
});

const batches = [buildBatch("CSV", "csv"), buildBatch("JSON", "json")];

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

// As views OPCIONAIS do Anexo I podem nao ser enviadas: o lote so com as
// ESSENCIAIS tem que fechar em ok, com as opcionais marcadas como skipped.
const runEssentialOnly = async () => {
  const parsed = {};
  const essenciais = validator.FILE_TYPES.filter((file) => file.criticality === "essencial");
  for (const file of essenciais) {
    const fileName = `${file.key}.csv`;
    parsed[file.key] = await validator.parseFileText(fileName, loadText(path.join(BASE, fileName)));
  }

  const result = validator.validateParsed(parsed);
  assert.strictEqual(
    result.summary.status,
    "ok",
    `[essenciais] Esperado status ok, recebido ${result.summary.status}. ` +
      Object.entries(result.files)
        .filter(([, info]) => info.status === "error")
        .map(([key, info]) => `${key}: ${info.issues.join(" | ")}`)
        .join(" || ")
  );

  const opcionais = validator.FILE_TYPES.filter((file) => file.criticality === "opcional");
  for (const file of opcionais) {
    assert.strictEqual(
      result.files[file.key].status,
      "skipped",
      `[essenciais] ${file.key} e opcional e deveria ficar como skipped.`
    );
  }
  assert.strictEqual(result.summary.skippedCount, opcionais.length);

  console.log(`Batch somente ESSENCIAIS: OK (${opcionais.length} opcionais puladas)`);
};

// Faltando uma view ESSENCIAL, a validacao tem que reprovar.
const runMissingEssential = async () => {
  const parsed = {};
  for (const file of validator.FILE_TYPES) {
    if (file.key === "setores") continue;
    const fileName = `${file.key}.csv`;
    parsed[file.key] = await validator.parseFileText(fileName, loadText(path.join(BASE, fileName)));
  }

  const result = validator.validateParsed(parsed);
  assert.strictEqual(result.files.setores.status, "error", "View essencial ausente deveria dar erro.");
  assert.strictEqual(result.summary.status, "error");

  console.log("Batch com ESSENCIAL faltando: OK");
};

(async () => {
  for (const batch of batches) {
    await runBatch(batch);
  }
  await runEssentialOnly();
  await runMissingEssential();
  console.log("All validation batches passed.");
})();
