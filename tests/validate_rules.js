const assert = require("assert");
const fs = require("fs");
const path = require("path");
const validator = require("../validator");

const BASE = path.join(__dirname, "..", "examples");
const load = (name) => fs.readFileSync(path.join(BASE, name), "utf8");

// Coluna que o cliente tem na view e a NoHarm nao usa nao pode virar erro:
// o validador olha so os campos do Anexo I.
const camposExtras = async () => {
  const csv =
    "FKHOSPITAL,FKSETOR,NOME,CD_SETOR_LEGADO,OBSERVACAO_TI\n" +
    "1,10,CLÍNICA MÉDICA,X-10,migrado em 2024\n" +
    "1,20,UTI ADULTO,X-20,migrado em 2024\n";
  const parsed = await validator.parseFileText("setores.csv", csv);
  const result = validator.validateFile("setores", parsed, {});

  assert.strictEqual(result.status, "ok", `Campos extras não deveriam reprovar. Erros: ${result.issues.join(" | ")}`);
  assert.deepStrictEqual(result.extraFields, ["CD_SETOR_LEGADO", "OBSERVACAO_TI"]);

  // Mas campo obrigatorio ausente continua sendo erro.
  const semNome = await validator.parseFileText("setores.csv", "FKHOSPITAL,FKSETOR,QUALQUER\n1,10,abc\n");
  const semNomeResult = validator.validateFile("setores", semNome, {});
  assert.strictEqual(semNomeResult.status, "error");
  assert.ok(
    semNomeResult.issueGroups.some((group) => group.message.includes("Campos faltando: NOME")),
    "Campo obrigatório ausente deveria reprovar."
  );

  console.log("Campos extras ignorados: OK");
};

// FKHOSPITAL é constante da plataforma, nao o codigo do hospital no sistema do
// cliente. Rede com varios hospitais se resolve no filtro da view, nunca no
// SELECT, entao o valor e sempre 1 em todas as views.
const fkhospitalFixo = async () => {
  const certo = await validator.parseFileText("setores.csv", "FKHOSPITAL,FKSETOR,NOME\n1,10,CLÍNICA MÉDICA\n");
  assert.strictEqual(validator.validateFile("setores", certo, {}).status, "ok");

  const errado = await validator.parseFileText(
    "setores.csv",
    "FKHOSPITAL,FKSETOR,NOME\n52,10,CLÍNICA MÉDICA\n52,20,UTI ADULTO\n"
  );
  const resultado = validator.validateFile("setores", errado, {});
  assert.strictEqual(resultado.status, "error", "Código real do hospital no lugar do 1 tem que reprovar.");
  assert.ok(
    resultado.issueGroups.some((group) => group.message.includes("FKHOSPITAL deve ser 1")),
    "Deveria apontar o valor fixo."
  );
  assert.ok(
    resultado.hints.some((hint) => hint.key === "fkhospital"),
    "Deveria explicar que o 1 e da plataforma, não um erro da view."
  );

  // A view de Hospitais e a excecao: e o catalogo, traz os codigos reais das
  // multi-empresas.
  const hospitais = await validator.parseFileText(
    "hospitais.csv",
    "FKHOSPITAL,NOME\n1,HOSPITAL CENTRAL\n52,HOSPITAL SUL\n57,HOSPITAL NORTE\n"
  );
  assert.strictEqual(
    validator.validateFile("hospitais", hospitais, {}).status,
    "ok",
    "A view de Hospitais não segue o valor fixo."
  );

  // Rede com varios hospitais: os setores de todos entram, todos com FKHOSPITAL 1.
  const rede = await validator.parseFileText(
    "setores.csv",
    "FKHOSPITAL,FKSETOR,NOME\n1,10,CLÍNICA - UNIDADE CENTRO\n1,20,UTI - UNIDADE SUL\n1,30,PEDIATRIA - UNIDADE NORTE\n"
  );
  assert.strictEqual(validator.validateFile("setores", rede, {}).status, "ok", "Rede consolidada em 1 tem que passar.");

  console.log("FKHOSPITAL fixo: OK");
};

// Passo seguinte valida FK contra o indice guardado do passo anterior, sem
// precisar do arquivo de origem de novo.
const indicePersistido = async () => {
  const prescricoes = await validator.parseFileText("prescricoes.csv", load("prescricoes.csv"));

  // Os indices saem das proprias views do lote — assim o teste nao quebra toda
  // vez que os modelos ganham uma linha nova.
  const indiceDe = async (fileKey) =>
    validator.buildKeyIndex(fileKey, await validator.parseFileText(`${fileKey}.csv`, load(`${fileKey}.csv`)));

  const indices = {
    setores: await indiceDe("setores"),
    medicamentos: await indiceDe("medicamentos"),
    unidades: await indiceDe("unidades"),
    frequencia: await indiceDe("frequencia"),
  };

  const comIndice = validator.validateFile("prescricoes", prescricoes, { externalIndexes: indices });
  assert.strictEqual(comIndice.status, "ok", `Deveria fechar com os índices. Erros: ${comIndice.issues.join(" | ")}`);

  const indiceFurado = validator.validateFile("prescricoes", prescricoes, {
    externalIndexes: Object.assign({}, indices, { setores: ["99"] }),
  });
  assert.strictEqual(indiceFurado.status, "error", "FK que não existe no índice deveria reprovar.");
  assert.ok(indiceFurado.issueGroups.some((group) => group.message.includes("FKSETOR não existe em setores")));

  // O indice serve para o passo seguinte: e gerado a partir da view validada.
  const setores = await validator.parseFileText("setores.csv", load("setores.csv"));
  assert.deepStrictEqual(validator.buildKeyIndex("setores", setores), ["10", "20", "30", "40"]);
  // View sem chave definida no Anexo I nao gera indice.
  const cultura = await validator.parseFileText("cultura.csv", load("cultura.csv"));
  assert.deepStrictEqual(validator.buildKeyIndex("cultura", cultura), []);

  console.log("Índice persistido entre passos: OK");
};

// A amostra mostra so as colunas do padrao que existem no arquivo, na ordem do
// Anexo I, para o cliente conferir que o dado caiu na coluna certa.
const amostra = async () => {
  const csv =
    "FKHOSPITAL,FKSETOR,NOME,CD_LEGADO,OBS\n" +
    "1,10,CLÍNICA MÉDICA,X-10,abc\n" +
    "1,20,UTI ADULTO,X-20,def\n" +
    "1,30,PEDIATRIA,,ghi\n";
  const parsed = await validator.parseFileText("setores.csv", csv);
  const preview = validator.buildPreview("setores", parsed);

  assert.deepStrictEqual(preview.columns, ["FKHOSPITAL", "FKSETOR", "NOME"], "Só as colunas do padrão.");
  assert.strictEqual(preview.usedColumns, 3);
  assert.strictEqual(preview.totalColumns, 5);
  assert.strictEqual(preview.rows.length, 3);
  assert.deepStrictEqual(preview.rows[0], ["1", "10", "CLÍNICA MÉDICA"]);

  // No maximo 5 linhas, mesmo com arquivo grande.
  const muitas = ["FKHOSPITAL,FKSETOR,NOME"];
  for (let i = 1; i <= 40; i += 1) muitas.push(`1,${i},SETOR ${i}`);
  const grande = await validator.parseFileText("setores.csv", `${muitas.join("\n")}\n`);
  assert.strictEqual(validator.buildPreview("setores", grande).rows.length, 5);

  // Coluna do padrao que nao veio no arquivo nao aparece na amostra.
  const semNome = await validator.parseFileText("setores.csv", "FKHOSPITAL,FKSETOR\n1,10\n");
  assert.deepStrictEqual(validator.buildPreview("setores", semNome).columns, ["FKHOSPITAL", "FKSETOR"]);

  // Coluna OPCIONAL do padrao aparece, desde que esteja no arquivo.
  const comOpcionais = await validator.parseFileText(
    "pessoa.csv",
    "FKHOSPITAL,FKPESSOA,NRATENDIMENTO,DTINTERNACAO,NOME,PESO,ALTURA\n" +
      "1,5001,7001,2026-02-07T09:30:00,FULANO,78.5,1.75\n"
  );
  assert.deepStrictEqual(
    validator.buildPreview("pessoa", comOpcionais).columns,
    ["FKHOSPITAL", "FKPESSOA", "NOME", "NRATENDIMENTO", "DTINTERNACAO", "PESO", "ALTURA"],
    "Opcional entra na amostra, na ordem do Anexo I."
  );

  // Mas so se estiver no arquivo: opcional ausente nao vira coluna vazia.
  const semOpcionais = await validator.parseFileText(
    "pessoa.csv",
    "FKHOSPITAL,FKPESSOA,NRATENDIMENTO,DTINTERNACAO\n1,5001,7001,2026-02-07T09:30:00\n"
  );
  assert.deepStrictEqual(validator.buildPreview("pessoa", semOpcionais).columns, [
    "FKHOSPITAL",
    "FKPESSOA",
    "NRATENDIMENTO",
    "DTINTERNACAO",
  ]);

  console.log("Amostra dos registros: OK");
};

// A view de Vias e uma linha so, com todas as vias num array JSON na coluna
// VALOR. O Anexo I descrevia o conteudo do JSON como se fossem colunas.
const viasJson = async () => {
  const linha = (valor) =>
    `TIPO,VALOR,UPDATE_AT,UPDATE_BY\nmap-routes,"${valor.replace(/"/g, '""')}",2026-02-07T03:00:00,0\n`;

  const ok = await validator.parseFileText(
    "vias.csv",
    linha(JSON.stringify([{ id: "VO", value: "Via Oral" }, { id: "IV", value: "Intravenosa" }]))
  );
  assert.strictEqual(validator.validateFile("vias", ok, {}).status, "ok");

  // A variante com LISTAGG quebra o JSON quando o nome da via tem aspas.
  const quebrado = await validator.parseFileText("vias.csv", linha('[{"id": "VO", "value": "ORAL" '));
  const resultadoQuebrado = validator.validateFile("vias", quebrado, {});
  assert.strictEqual(resultadoQuebrado.status, "error");
  assert.ok(resultadoQuebrado.issueGroups.some((group) => group.message.includes("não é um JSON válido")));
  assert.ok(resultadoQuebrado.hints.some((hint) => hint.key === "jsonList"));

  const semValue = await validator.parseFileText("vias.csv", linha(JSON.stringify([{ id: "VO" }])));
  const resultadoSemValue = validator.validateFile("vias", semValue, {});
  assert.strictEqual(resultadoSemValue.status, "error");
  assert.ok(resultadoSemValue.issueGroups.some((group) => group.message.includes("item sem value")));

  const vazio = await validator.parseFileText("vias.csv", linha("[]"));
  assert.strictEqual(validator.validateFile("vias", vazio, {}).status, "error", "Array vazio não serve.");

  // So TIPO e VALOR sao obrigatorios: UPDATE_AT e UPDATE_BY entram se vierem.
  const soEssencial = await validator.parseFileText(
    "vias.csv",
    'TIPO,VALOR\nmap-routes,"[{""id"":""VO"",""value"":""Via Oral""}]"\n'
  );
  assert.strictEqual(
    validator.validateFile("vias", soEssencial, {}).status,
    "ok",
    "Sem UPDATE_AT e UPDATE_BY tem que passar."
  );

  // Exportando em JSON, VALOR pode vir ja como array de verdade.
  const jaParseado = await validator.parseFileText(
    "vias.json",
    JSON.stringify([
      {
        TIPO: "map-routes",
        VALOR: [{ id: "VO", value: "Via Oral" }],
        UPDATE_AT: "2026-02-07T03:00:00",
        UPDATE_BY: 0,
      },
    ])
  );
  assert.strictEqual(
    validator.validateFile("vias", jaParseado, {}).status,
    "ok",
    "Array já parseado não pode cair na checagem de dado flat."
  );

  console.log("Vias com array JSON: OK");
};

// Linhas diferentes com o mesmo valor quebrado sao um problema so. O que o
// cliente precisa ver e quais valores distintos estao errados, nao as primeiras
// linhas em que apareceram.
const amostrasDistintas = async () => {
  const setores = [809, 809, 812, 809, 977, 812, 809, 1004, 809, 809];
  let csv = "FKHOSPITAL,FKPESSOA,NRATENDIMENTO,DTINTERNACAO,FKSETOR\n";
  setores.forEach((setor, idx) => {
    csv += `1,${5000 + idx},${7000 + idx},2026-02-07T09:30:00,${setor}\n`;
  });

  const parsed = await validator.parseFileText("pessoa.csv", csv);
  const grupo = validator
    .validateFile("pessoa", parsed, { externalIndexes: { setores: ["10"] } })
    .issueGroups.find((item) => item.message.includes("FKSETOR"));

  assert.strictEqual(grupo.count, 10, "A contagem de ocorrências continua real.");
  assert.strictEqual(grupo.distinctCount, 4, "São 4 setores diferentes faltando.");
  assert.strictEqual(grupo.samples.length, 4, "Uma amostra por valor distinto, não por linha.");
  assert.ok(grupo.samples.every((sample) => sample.includes("valor")));
  ["809", "812", "977", "1004"].forEach((setor) => {
    assert.ok(
      grupo.samples.some((sample) => sample.includes(`"${setor}"`)),
      `O setor ${setor} deveria aparecer nas amostras.`
    );
  });
  assert.strictEqual(grupo.refFile, "setores", "O grupo diz qual view corrigir.");

  // Erro de arquivo inteiro nao deduplica por valor: nao tem distinctCount.
  const semNome = await validator.parseFileText("setores.csv", "FKHOSPITAL,FKSETOR\n1,10\n");
  const grupoCampo = validator
    .validateFile("setores", semNome, {})
    .issueGroups.find((item) => item.message.includes("Campos faltando"));
  assert.strictEqual(grupoCampo.distinctCount, undefined);

  console.log("Amostras por valor distinto: OK");
};

// O cliente solta os 14 arquivos de uma vez e o validador descobre quem e
// quem pelo CABECALHO — o nome do arquivo e so desempate, porque o export sai
// como "VW_NOHARM_01.csv".
const reconhecimento = async () => {
  for (const file of validator.FILE_TYPES) {
    for (const ext of ["csv", "json"]) {
      const parsed = await validator.parseFileText(`anonimo.${ext}`, load(`${file.key}.${ext}`));
      const palpite = validator.guessFileKey(`anonimo.${ext}`, parsed.normalizedFields);
      assert.ok(palpite, `Não reconheceu ${file.key}.${ext} pelo cabeçalho.`);
      assert.strictEqual(palpite.key, file.key, `${file.key}.${ext} foi confundida com ${palpite && palpite.key}.`);
    }
  }

  // Coluna propria do cliente nao atrapalha o reconhecimento.
  const comExtras = load("setores.csv")
    .split("\n")
    .map((linha, i) => (linha ? (i === 0 ? `${linha},CD_LEGADO,OBS` : `${linha},X,y`) : linha))
    .join("\n");
  const parsedExtras = await validator.parseFileText("VW_NOHARM_01.csv", comExtras);
  assert.strictEqual(validator.guessFileKey("VW_NOHARM_01.csv", parsedExtras.normalizedFields).key, "setores");

  // Arquivo que nao e de view nenhuma volta sem palpite: a tela pergunta, em
  // vez de gravar no lugar errado.
  const estranho = await validator.parseFileText("lixo.csv", "A,B,C\n1,2,3\n");
  assert.strictEqual(validator.guessFileKey("lixo.csv", estranho.normalizedFields), null);

  console.log("Reconhecimento do arquivo pelo cabeçalho: OK");
};

(async () => {
  await camposExtras();
  await amostrasDistintas();
  await viasJson();
  await amostra();
  await fkhospitalFixo();
  await indicePersistido();
  await reconhecimento();
  console.log("All rule checks passed.");
})();
