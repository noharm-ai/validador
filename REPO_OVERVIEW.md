# noharm-validador — Visão Geral do Repositório

> Este documento é uma referência técnica completa do repositório, pensada para
> orientar tanto humanos quanto agentes/LLMs que forem alterar o código.
> Para instruções operacionais de edição, ver também [`AGENTS.md`](./AGENTS.md).

## 1. Propósito

Aplicação web **standalone** (sem build step, sem backend) que valida arquivos
CSV/JSON de integração hospitalar contra o **padrão de dados NoHarm** — o
schema de entrada usado pela plataforma NoHarm para ingestão de dados clínicos
(prescrições, medicamentos, atendimentos, etc.).

O cliente é guiado por um **passo a passo**: uma view por vez, na ordem em que
as dependências fecham, com validação imediata a cada upload. O progresso fica
salvo no `localStorage` da máquina dele, então dá para parar e voltar depois. No
fim sai um relatório consolidado, exportável em JSON.

Não há servidor de aplicação, banco de dados ou API: tudo roda no cliente,
carregado via CDN (React, AntD, Babel) + um HTML estático. É hospedado via
**GitHub Pages** (branch `main`, raiz do repo).

## 2. Estrutura de arquivos

```
.
├── index.html              # Shell HTML: carrega CDNs (React, AntD, Babel, PapaParse) + validator.js + app.js
├── app.js                  # Casca do app: menu, estado do passo a passo, persistência (JSX via Babel in-browser)
├── wizard.js                # Telas do passo a passo (JSX via Babel in-browser)
├── storage.js               # Persistência local do progresso (localStorage)
├── validator.js             # Motor de validação (UMD: usado tanto pelo browser quanto por Node/tests)
├── styles.css               # Tema/layout
├── examples/                 # Lotes de exemplo válidos (CSV e JSON) para as 15 views
├── tests/validate_examples.js # Teste Node que roda o motor contra examples/ e espera status "ok"
├── tests/validate_templates.js # Valida os modelos de download + regressão das dicas
├── tests/validate_rules.js   # Campos extras ignorados, hospital principal, índice entre passos
├── imgs/                     # favicon e logo
├── .github/workflows/ci.yml  # CI: npm install + npm test em todo push/PR
├── .nojekyll                  # Necessário para GitHub Pages não atropelar o index.html
├── AGENTS.md                  # Guia rápido de convenções para quem for editar o repo
└── README.md                  # Guia de uso rápido (como rodar local, testar, etc.)
```

Não existe diretório `src/`, não há bundler (Webpack/Vite/etc.), não há
`tsconfig`. É JS puro, servido diretamente. `package.json` só declara
`papaparse` como dependência (usada tanto no browser via CDN quanto via
`require` em Node para os testes) e o script `npm test`.

## 3. Arquitetura do motor de validação (`validator.js`)

Módulo UMD (`(function(root, factory) {...})`) que funciona tanto como
`window.NoHarmValidator` (browser) quanto como `module.exports` (Node, usado
nos testes e em `require("../validator")`).

### 3.1. A fonte de verdade: o Anexo I do Contrato

O padrão de dados é o **Anexo I do Contrato NoHarm — Integração de Dados**, o
mesmo documento que vai para o cliente. `VIEWS` em `validator.js` é a
transcrição literal das tabelas desse documento: campo, tipo, obrigatoriedade
(`not null`) e descrição. O validador cobra exatamente o que o documento pede —
nada além. Se os dois divergirem, o cliente segue o documento e o validador o
reprova.

Consequências práticas, registradas em `AGENTS.md`:

- Campo que existe na view real do MV/Tasy mas não está no documento **não
  entra** no schema. Ajusta-se o documento primeiro.
- Onde o Anexo I não define identificador único para a view, `key` fica `[]` e
  **não há checagem de duplicidade** — não se inventa chave.
- Só entram em `refs` as relações que o próprio documento descreve.

### 3.2. As views, em 3 grupos

O Anexo I define 15 views; o validador cobra **14** — Prescrições Agrupadas foi
retirada por decisão de produto, embora o documento ainda a liste como
ESSENCIAL.

Os grupos seguem a ordem topológica das chaves estrangeiras: `cadastros` não
depende de ninguém, `pacientes` depende de `cadastros`, `prescricoes` depende
dos dois. Isso permite validação cruzada incremental, grupo a grupo.

| Grupo | key | View (Anexo I) | Criticidade | Chave |
|---|---|---|---|---|
| cadastros | `hospitais` | Hospitais | ESSENCIAL | `FKHOSPITAL` |
| cadastros | `setores` | Setores / Departamentos | ESSENCIAL | `FKSETOR` |
| cadastros | `unidades` | Unidades | ESSENCIAL | `FKUNIDADEMEDIDA` |
| cadastros | `frequencia` | Frequências | ESSENCIAL | `FKFREQUENCIA` |
| cadastros | `vias` | Vias | ESSENCIAL | `ID` |
| cadastros | `medicamentos` | Medicamento | ESSENCIAL | `FKMEDICAMENTO` |
| pacientes | `pessoa` | Pessoa / Atendimento | ESSENCIAL | `NRATENDIMENTO` |
| pacientes | `exame` | Exames | OPCIONAL | `FKEXAME` |
| pacientes | `cultura` | Culturas | OPCIONAL | — |
| pacientes | `alergia` | Alergias | OPCIONAL | — |
| pacientes | `evolucao` | Evolução | OPCIONAL | `FKEVOLUCAO` |
| pacientes | `transferencia` | Transferências | OPCIONAL | — |
| prescricoes | `prescricoes` | Prescrições e Itens | ESSENCIAL | `FKPRESMED` |
| prescricoes | `conciliacao` | Conciliação | OPCIONAL | `FKPRESMED` |

`criticality` vem do documento:

- **ESSENCIAL** ausente → status `error` (reprova a validação).
- **OPCIONAL** ausente → status `skipped`, fora do resultado geral. O cliente
  conclui a validação com sucesso mandando só as essenciais.

As Procedures de Devolução do Anexo I (Liberação da Prescrição, Registrar
Alerta, Registrar Evolução) **não** entram aqui: são integração de retorno
(escrita no PEP), não arquivo que o cliente extrai.

### 3.2.1. Como o schema é derivado (`NOHARM_SCHEMA`)

Cada campo é declarado por `f(nome, tipo, obrigatorio, descricao, extras)` com o
tipo do documento, e `buildFileSchema` deriva dele as regras do motor. **Não há
regra de tipo escrita à mão**: mudou o documento, muda o array de `fields`.

| Tipo no Anexo I | Regra derivada |
|---|---|
| `smallint`, `integer`, `int`, `bigint`, `float` | `typeHints.number` |
| `date`, `datetime` | `typeHints.date` (ISO, com validação de calendário) |
| `boolean` | `typeHints.boolean` |
| `varchar(N)`, `char(N)` | `typeHints.maxLength[campo] = N` |
| `text`, `varchar` sem tamanho | sem limite |

Extras por campo:

- `sigla: true` → `typeHints.notNumber`. Campo que carrega sigla/código textual
  e não pode ser só número (`FKUNIDADEMEDIDA`, `FKFREQUENCIA`).
- `maxDigits: N` → limite de dígitos citado no documento (`NRATENDIMENTO`: 9).

Por view ainda existem:

- **`required`**: derivado de `not null`. Erro se a coluna faltar.
- **`allowed`**: todos os campos do documento. Coluna fora dessa lista = erro
  "Campos inesperados".
- **`key`**: identificador único, quando o documento define.
- **`refs`**: chaves estrangeiras descritas no documento.
- **`refIgnore`**: valor padrão que o documento define e que não deve ser
  cobrado na referência cruzada (ex.: `conciliacao.FKMEDICAMENTO = 0` para item
  de texto livre sem cadastro associado).

Relações cruzadas ativas:
```
prescricoes.FKSETOR          → setores.FKSETOR
prescricoes.FKMEDICAMENTO    → medicamentos.FKMEDICAMENTO
prescricoes.FKUNIDADEMEDIDA  → unidades.FKUNIDADEMEDIDA
prescricoes.FKFREQUENCIA     → frequencia.FKFREQUENCIA
conciliacao.*                → idem prescricoes (FKMEDICAMENTO 0 ignorado)
prescricao_agrupada.*        → idem prescricoes
pessoa.FKSETOR               → setores.FKSETOR
exame.NRATENDIMENTO          → pessoa.NRATENDIMENTO
cultura.NRATENDIMENTO        → pessoa.NRATENDIMENTO
cultura.FKMEDICAMENTO        → medicamentos.FKMEDICAMENTO
alergia.NRATENDIMENTO        → pessoa.NRATENDIMENTO
alergia.FKMEDICAMENTO        → medicamentos.FKMEDICAMENTO
evolucao.NRATENDIMENTO       → pessoa.NRATENDIMENTO
transferencia.NRATENDIMENTO  → pessoa.NRATENDIMENTO
transferencia.FKSETOR        → setores.FKSETOR
```

### 3.3. Pipeline de validação

1. **`parseFileText(fileName, text)`**
   - Detecta formato pela extensão (`guessFormat`): `.json`, `.csv`, ou
     `auto` (tenta JSON, cai para CSV se falhar).
   - JSON esperado: **array plano de objetos** (`[{...}, {...}]`). Se vier
     `{ data: [...] }` ou objeto não-array, gera erro/aviso específico — a
     ideia é rejeitar qualquer hierarquia, o dado deve ser flat.
   - CSV: parseado via PapaParse (`header: true`, detecção de delimitador
     entre `,`, `;`, tab, `|`).
   - Todos os nomes de campo são normalizados (`normalizeField`: trim +
     lowercase) para tornar a comparação de schema case-insensitive.
   - Detecta **codificação errada**: o arquivo é lido como UTF-8, então byte
     inválido vira `U+FFFD` — a presença desse caractere denuncia Latin-1 /
     Windows-1252.
   - Detecta **linha inteira entre aspas** (o CSV vira uma coluna só) e
     **delimitador não identificado**.
   - Linhas com quantidade de colunas diferente do cabeçalho entram em
     `malformedRows` e são **excluídas** das validações de conteúdo: os valores
     estão deslocados e só produziriam erro derivado (`NRATENDIMENTO deve ser
     numero` etc.). Elas viram um aviso com a contagem.
   - Retorna `{ fileName, format, root, fields, normalizedFields, records,
     rawRecords, parseIssues, parseErrors, parseHints, malformedRows,
     replacementChars }`.

2. **`validateParsed(parsedFiles)`** → delega para `buildValidationForSchema`:
   - **Índices cruzados**: para cada arquivo, monta um `Set` das chaves
     (`key` do schema) presentes — usado depois para checar `refs`.
   - Por arquivo, checa nessa ordem:
     1. Erros de parse (`parseErrors`).
     2. JSON com raiz errada (`object-data` ou `object` puro).
     3. Arquivo vazio → **warning** (não erro).
     4. Campos obrigatórios faltando (`required` vs. campos presentes).
     5. Campos fora de `allowed` → **não são erro**: entram em `extraFields`
        e são ignorados nas demais validações (o cliente pode ter campos
        próprios na view).
     5b. `FKHOSPITAL` diferente de `1` — é constante da plataforma, não dado.
         Exceto na view de Hospitais (`fkhospitalLivre`), que é o catálogo.
     6. Tipos inválidos por registro (`typeHints`: number/date/boolean/
        notNumber/maxDigits/maxLength) — limitado a `MAX_ERRORS` (200)
        primeiras ocorrências.
     7. Chave obrigatória vazia ou duplicada (baseado em `key`).
     8. Referências cruzadas quebradas (`refs`): valor de FK que não existe
        no índice do arquivo referenciado.
   - Cada arquivo recebe `status`: `"ok"` | `"warn"` | `"error"`, mais
     `issues[]`, `issueGroups[]`, `issueCount`, `hints[]`, `warnings[]`,
     `recordCount`, `columnCount`, `malformedRowCount`.
   - Status geral (`overall`) é o pior status entre todos os arquivos.

3. Saída final: `{ summary: { status, message, errorCount, warningCount },
   files: {...por tipo...}, parsed: {...dados brutos parseados...} }`.
   O app **remove `parsed`** ao exportar o relatório (era ele que fazia o JSON
   exportado passar de 70 MB).

### 3.3.1. Agrupamento de erros e dicas

Ocorrências iguais são agrupadas por `createIssueCollector`:

- `issueGroups`: `[{ message, count, samples[], distinctCount?, refFile? }]`
  ordenado por `count`, com no máximo `MAX_SAMPLES` (5) exemplos por grupo.
  Regras que comparam valor passam `sampleKey` e o grupo deduplica: 58 linhas
  com o mesmo `FKSETOR` viram uma amostra, e `distinctCount` diz quantos valores
  diferentes estão quebrados. `refFile` nomeia a view a corrigir, `refField` a
  coluna, e `distinctValues` guarda o que falta (até `MAX_DISTINCT_VALUES`, 100)
  para a etapa de destino poder listar.
- `issueCount`: contagem **real**, sem truncar. Antes o relatório cortava em 200
  linhas e a contagem exibida era a da lista truncada, o que subnotificava
  gravemente (um arquivo com 46 mil erros aparecia com 201).
- `issues`: mantido para compatibilidade — uma linha por grupo, no formato
  `"1487x <mensagem> | ex.: <amostra>"`.
- `hints`: dicas deduplicadas vindas do catálogo `HINTS`, com a causa provável
  no arquivo. Cada `collector.add(grupo, amostra, chaveDaDica)` associa a dica.
  Chaves atuais: `csvFieldCount`, `csvDecimalComma`, `csvSingleColumn`,
  `csvDelimiter`, `encoding`, `dateFormat`, `boolean`, `notNumber`,
  `missingFields`, `unexpectedFields`, `refMissing`, `keyEmpty`,
  `duplicateKey`, `maxLength`, `numberFormat`, `jsonRoot`, `parse`.

### 3.3.2. Modelos de arquivo (`TEMPLATES`)

`TEMPLATES` guarda um lote de exemplo por tipo (2 registros cada) que **fecha
entre si** — as chaves estrangeiras das 15 views são válidas. É a fonte dos
downloads da UI, via `buildTemplateCsv` / `buildTemplateJson` /
`getTemplateFileName`. `tests/validate_templates.js` valida esse lote com o
próprio motor, então um modelo que o validador reprovaria quebra o teste.

### 3.4. Constantes/comportamentos importantes para quem for mexer

- `MAX_ERRORS = 200`: teto de **grupos** de erro listados em `issues` por
  arquivo. `issueCount` continua trazendo o total real.
- `MAX_SAMPLES = 5`: exemplos guardados por grupo de erro.
- `NORMALIZATION_MODE = "lower"`: declarada mas não usada como flag
  condicional em nenhum lugar do código atual — a normalização é sempre
  lowercase, hardcoded em `normalizeField`.
- Mensagens de erro/log são **em português, sem acentos** (convenção do
  `AGENTS.md`, por compatibilidade).

## 4. UI — o passo a passo

### 4.1. Como os arquivos se encaixam

Não há bundler nem sistema de módulos: o `index.html` carrega os scripts em
sequência e eles compartilham o **escopo global**.

```
validator.js  → window.NoHarmValidator   (motor + schema)
storage.js    → window.NoHarmStorage     (persistência, JS puro)
wizard.js     → JSX: telas + helpers compartilhados
app.js        → JSX: componente App, consome tudo acima
```

Armadilha: declarar o mesmo `const` em `wizard.js` e `app.js` quebra a página
com *"Identifier has already been declared"*. Por isso `wizard.js` faz
`const { Layout: WLayout, Menu: WMenu, ... } = antd`, deixando os nomes `Layout`
e `Menu` para o `app.js`. `wizard.js` é o dono dos helpers compartilhados
(`FILE_TYPES`, `GROUPS`, `downloadText`, `downloadTemplate`, `STATUS_META`,
`statusIcon`, `groupLabel`, `fileSchemaOf`, `formatBytes`, `formatDateTime`).

Como antes, JSX é transpilado **no browser** via `@babel/standalone`: não
funciona por `file://`, precisa de um servidor HTTP, e erro de sintaxe só aparece
em runtime no console.

### 4.2. Telas (`wizard.js`)

| Componente | Papel |
|---|---|
| `WelcomeScreen` | Logo, título, uma linha, um botão. Se há progresso salvo, vira "Continuar (N/15)". |
| `Timeline` | Os **3 grupos** e a posição dentro do grupo atual. Nunca lista as views. |
| `AskStep` | "Quais desses dados você tem?" — as opcionais do grupo como cartões clicáveis. Só as marcadas viram etapa. |
| `StepPanel` | O passo: nome da view, campos obrigatórios em chips, dropzone, resultado e navegação. |
| `RequiredChips` | Os campos obrigatórios como etiquetas; o `Tooltip` traz tipo e descrição, e `+N opcionais` abre o `FieldsModal`. |
| `StepResult` | Sucesso vira uma linha mais a amostra. Erro conta **tipos** de problema (o que a lista mostra), com as ocorrências no `Nx` de cada linha, até 3 exemplos por tipo, e as dicas (`HINTS`) em `<details>` fechados. |
| `PreviewTable` | "Assim a NoHarm vai ler": as 5 primeiras linhas, só com as colunas do padrão presentes no arquivo (`Validator.buildPreview`). Omitida na etapa de Hospitais, onde o `HospitalPicker` já mostra os mesmos dados. |
| `HospitalModal` | "Por que FKHOSPITAL é sempre 1?" — aberto pelo "por que?" do passo. Explica que o número é da plataforma, mostra onde fica o recorte de rede (`WHERE`, não `SELECT`) e avisa que trocar quebra a integração. |
| `ReviewScreen` | Ícone, veredito, uma linha e a lista das 15 views. É a tela do print que o Anexo I pede. |
| `SavedDataScreen` | O que está guardado nesta máquina; exportar/reimportar progresso, refazer uma view, apagar tudo. |
| `ReferenceScreen` | Os campos de todas as views, fora do fluxo do passo a passo. |
| `FieldsTable` / `FieldsModal` | Tabela Campo / Tipo / Obrigatório / Descrição, direto de `NOHARM_SCHEMA.files[key].fields`. |

Três mapas governam o texto da UI, e a regra ao editá-los é **cortar**:
`SHORT_LABEL` (nome curto da view), `STEP_HINT` (uma linha, só onde evita uma
dúvida real — a maioria das views não tem) e `STATUS_META`. Não há parágrafo
explicativo por passo: se a tela precisa de um, o problema é a tela.

O tema da AntD é definido num único `ConfigProvider` no `app.js`
(`colorPrimary: "#46a46a"`), não em override de CSS.

### 4.3. Estado (`app.js`)

- `progress` — o estado persistido, carregado de `Storage.load()` na montagem.
- `stepIndex` — posição na sequência de `buildSequence(progress)`, que mistura
  etapas de view com etapas de pergunta e depende das respostas do cliente.
- `stepFiles` / `stepResults` — mapas **por etapa** do arquivo e do resultado;
  vivem só enquanto a tela está aberta, mas sobrevivem à navegação: voltar e
  avançar de novo não perde o que já foi enviado. Só `handleRedo` limpa a
  entrada daquela etapa.
- `sessionIndexes` (`useRef`) — índices de chave desta sessão. Views grandes
  demais para o `localStorage` ficam aqui e servem à validação cruzada enquanto
  a aba não for fechada.

Fluxo de um passo: upload → `parseFileText` → `validateFile(key, parsed, {
mainHospital, externalIndexes })` → resultado na tela → "Continuar" grava via
`Storage.saveStep` e avança. `externalIndexes` é a união dos índices
persistidos com os da sessão, então cada passo valida FK contra o que já passou.

Passo com erro **bloqueia**: o botão principal fica desabilitado e o cliente
corrige e reenvia. Não há "continuar assim" — seguir com um cadastro quebrado
faz as etapas seguintes validarem contra um índice furado e produz erro em
cascata. Em view opcional a saída é o "Não tenho".

Erro de FK vira atalho: o grupo carrega `refFile`/`refField`/`distinctValues`, o
cliente pula para a view a corrigir e a faixa no topo lista exatamente o que
incluir; ao concluir ele volta para a origem, que é revalidada contra o arquivo
novo.

**Não há como pular etapa.** O único caminho para frente é o Continuar; qualquer
navegação (`handleJump`, retomada) é limitada ao `firstPendingIndex()`, que é a
primeira etapa não resolvida. Quem chega nas prescrições necessariamente passou
pelos cadastros.

### 4.4. Persistência (`storage.js`)

Tudo em `localStorage`, chave `noharm-validador-progresso`. Formato:

```js
{ version, startedAt, updatedAt, mainHospital, hospitalOptions,
  optionals: { [fileKey]: true | false },   // resposta sobre ter ou não a view
  steps:   { [fileKey]: { status, skipped, fileName, recordCount, issueCount,
                          issueGroups, hints, warnings, extraFields, preview,
                          indexStored, validatedAt } },
  indexes: { [fileKey]: [...chaves] } }
```

O conteúdo dos arquivos **nunca** é guardado — prescrição de hospital real passa
de centenas de MB. Índice com mais de `MAX_INDEX_KEYS` (20 mil) não é
persistido; e se a cota estourar mesmo assim, `write()` vai soltando os índices
do maior para o menor até caber, porque o progresso importa mais que o índice.
Em janela anônima `Storage.available` fica `false` e a tela avisa.

## 5. Testes (`tests/`)

- Testes Node simples (sem framework de teste, usam `assert` nativo).
  `npm test` roda `validate_examples.js` e depois `validate_templates.js`.
- `validate_examples.js` roda **exatamente o mesmo motor**
  (`require("../validator")`) em quatro cenários:
  1. Lote completo em **CSV** (15 views) → espera `ok`.
  2. Lote completo em **JSON** (mesmos dados) → espera `ok`.
  3. Lote só com as views **ESSENCIAIS** → espera `ok`, com todas as OPCIONAIS
     em status `skipped` e `summary.skippedCount` batendo.
  4. Lote com uma view **ESSENCIAL ausente** (`setores`) → espera `error`.
- `validate_rules.js` cobre as regras do passo a passo: coluna extra não
  reprova (mas obrigatório ausente sim), o hospital principal amarra o
  `FKHOSPITAL` das demais views, e um passo valida FK contra o índice guardado
  do passo anterior sem precisar do arquivo de origem.
- `validate_storage.js` cobre as regras de progresso (`storage.js`) com um
  `localStorage` de mentira: a resposta das opcionais marca como pulada a view
  que o cliente não tem, e volta a ser etapa se ele mudar de ideia.
- `validate_templates.js` valida os modelos gerados (CSV e JSON) e faz a
  regressão das regras que motivaram o ajuste: data `dd/mm/aa` com dia ≤ 12 tem
  que reprovar, linha com coluna a mais tem que virar `malformedRows` +
  dica `csvFieldCount`, arquivo fora de UTF-8 tem que acusar `encoding`, e CSV
  com a linha inteira entre aspas tem que acusar `csvSingleColumn`.
- Executado via `npm test`, e também em CI (`.github/workflows/ci.yml`) em
  todo push e pull request.
- **Implicação para quem for alterar o schema**: qualquer mudança em `VIEWS`
  (`validator.js`) deve vir acompanhada de atualização de `TEMPLATES` **e** dos
  arquivos em `examples/`, senão os testes quebram. `examples/` é gerado a
  partir de `TEMPLATES` (comando em `AGENTS.md`).

## 6. CI/CD

- `.github/workflows/ci.yml`: dispara em push para qualquer branch e em pull
  requests. Passos: checkout → setup Node 18 → `npm install` → `npm test`.
- Actions são pinadas por **SHA completo** (não por tag), com o número da
  versão em comentário (ex.: `actions/checkout@34e11487... # v4`) — exigência
  de segurança da organização (ver commit `fc8be69 "Fixa actions do CI por
  SHA (exigencia da org)"`). Ao atualizar actions, manter esse padrão.
- Deploy é via **GitHub Pages**, servindo a raiz do branch `main` — não há
  step de deploy no CI atual (o Pages provavelmente está configurado
  diretamente nas settings do repo, servindo os arquivos estáticos direto).
  `.nojekyll` é obrigatório para o GitHub Pages não tentar processar os
  arquivos com Jekyll (o que quebraria `index.html`/assets).

## 7. Convenções ao editar este repo (resumo do `AGENTS.md`)

- Lógica de validação sempre em `validator.js` (nunca duplicar regras na UI).
- Manter o app standalone: sem adicionar bundler/build step.
- CDNs só quando necessário; evitar novas dependências client-side.
- O padrão de campos é definido pelas **views MV + Tasy** da NoHarm — a fonte
  de verdade é a view, não um `CREATE TABLE` de banco.
- Toda mudança de regra de validação deve atualizar os `examples/`
  correspondentes e passar em `npm test`.
- Mensagens/labels em português sem acentos.
- Evitar `console.log` ruidoso.
- Não remover `.nojekyll`.

## 8. Pontos de atenção / possíveis armadilhas para um agente

- Editar `app.js` sem servir via HTTP não permite testar (Babel in-browser
  exige `http://`, não `file://`).
- `validator.js` é o único lugar testado automaticamente — mudanças na UI
  (`app.js`) não têm cobertura de teste, só verificação manual no browser.
- O JSON de entrada **precisa ser um array plano na raiz**; um objeto
  `{ data: [...] }` é tratado como erro de formato, não como variação
  aceitável — isso é proposital (ver `parseFileText`/`root` checks).
- `wizard.js` e `app.js` compartilham escopo global: declarar o mesmo `const`
  nos dois quebra a página inteira. Ao adicionar um componente ou helper,
  confira se o nome já existe no outro arquivo.
- O conteúdo dos arquivos nunca é persistido. Se precisar de mais dado entre
  passos, persista índice/resumo — nunca os registros.
- `NOHARM_SCHEMA` é **derivado**, não escrito à mão: quem se edita é `VIEWS`.
  Adicionar um campo é acrescentar uma linha `f(...)` no array `fields` da view
  — `allowed`, `required` e os `typeHints` saem dali sozinhos. Editar
  `NOHARM_SCHEMA` diretamente é sinal de que algo está sendo feito errado.
- Views sem `key` (`cultura`, `alergia`, `transferencia`,
  `prescricao_agrupada`) não têm checagem de duplicidade — é proposital, o
  Anexo I não define identificador único para elas. Não invente chave: ajuste o
  documento e depois o código.
