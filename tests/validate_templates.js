const assert = require("assert");
const validator = require("../validator");

// Os modelos oferecidos para download precisam passar na propria validacao,
// senao o hospital baixa um exemplo que o validador reprova.
const runBatch = async (format) => {
  const parsed = {};
  for (const file of validator.FILE_TYPES) {
    const fileName = validator.getTemplateFileName(file.key, format);
    const text = format === "json" ? validator.buildTemplateJson(file.key) : validator.buildTemplateCsv(file.key);
    assert.ok(text, `Modelo ${format} de ${file.key} nao foi gerado.`);
    parsed[file.key] = await validator.parseFileText(fileName, text);
  }

  const result = validator.validateParsed(parsed);
  assert.strictEqual(
    result.summary.status,
    "ok",
    `[modelo ${format}] Esperado status ok, recebido ${result.summary.status}`
  );

  for (const [key, info] of Object.entries(result.files)) {
    assert.strictEqual(
      info.status,
      "ok",
      `[modelo ${format}] ${key} deveria estar ok. Erros: ${info.issues.join(" | ")}`
    );
  }

  console.log(`Modelos ${format}: OK`);
};

// Regressao das regras que motivaram o ajuste do validador.
const runRuleChecks = async () => {
  const csvComDecimalVirgula = "FKHOSPITAL,FKSETOR,NOME\n1,10,CLINICA MEDICA\n1,20,UTI,ADULTO 0,5\n";
  const parsedVirgula = await validator.parseFileText("setores.csv", csvComDecimalVirgula);
  assert.ok(parsedVirgula.malformedRows.size > 0, "Deveria marcar a linha com colunas a mais.");
  assert.ok(parsedVirgula.parseHints.includes("csvFieldCount"), "Deveria sugerir a dica de quantidade de colunas.");

  const csvComDataBr = "FKHOSPITAL,FKSETOR,FKPRESCRICAO,FKPESSOA,NRATENDIMENTO,DTPRESCRICAO\n1,10,1,1,1,06/08/26\n";
  const parsedData = await validator.parseFileText("prescricoes.csv", csvComDataBr);
  const resultData = validator.validateParsed({ prescricoes: parsedData });
  const grupoData = resultData.files.prescricoes.issueGroups.find((g) => g.message.includes("DTPRESCRICAO"));
  // 06/08/26 e aceito por new Date() como 8 de junho. Tem que reprovar.
  assert.ok(grupoData, "Data dd/mm/aa deveria ser reprovada mesmo com dia <= 12.");
  assert.ok(
    resultData.files.prescricoes.hints.some((h) => h.key === "dateFormat"),
    "Deveria trazer a dica de formato de data."
  );

  const semUtf8 = await validator.parseFileText("setores.csv", "FKHOSPITAL,FKSETOR,NOME\n1,10,Lact�rio\n");
  assert.ok(semUtf8.parseHints.includes("encoding"), "Deveria detectar arquivo fora de UTF-8.");

  const umaColuna = await validator.parseFileText("exame.csv", '"FKEXAME,""FKPESSOA"""\n"1,""2"""\n');
  assert.ok(umaColuna.parseHints.includes("csvSingleColumn"), "Deveria detectar linha inteira entre aspas.");

  console.log("Regras de dica: OK");
};

(async () => {
  await runBatch("csv");
  await runBatch("json");
  await runRuleChecks();
  console.log("All template batches passed.");
})();
