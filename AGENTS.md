# AGENTS

Guia rapido para agentes que vao alterar este repo.

## Onde mexer
- Padrao de dados (transcricao do Anexo I): `VIEWS` em `validator.js`
- Logica de validacao: `validator.js`
- Persistencia local do progresso: `storage.js`
- Telas do passo a passo: `wizard.js`
- Casca, estado e ligacao com a persistencia: `app.js`
- Estilo: `styles.css`
- HTML raiz: `index.html`

## Ordem de carga dos scripts
Nao ha bundler nem modulos: os arquivos sao carregados em sequencia pelo
`index.html` e compartilham o escopo global.

```
validator.js  (window.NoHarmValidator)
storage.js    (window.NoHarmStorage)
wizard.js     (JSX via Babel: telas + helpers compartilhados)
app.js        (JSX via Babel: App, usa tudo acima)
```

Consequencias praticas:
- `wizard.js` declara os helpers compartilhados (`FILE_TYPES`, `GROUPS`,
  `downloadText`, `STATUS_META`, `statusIcon`, `groupLabel`...). `app.js` so
  consome.
- **Nao declare o mesmo `const` nos dois arquivos** — dois `const Layout` em
  arquivos diferentes quebram a pagina com "Identifier has already been
  declared". Por isso `wizard.js` usa `Layout: WLayout` no destructuring.
- Erro de sintaxe so aparece em runtime, no console do browser.

## A fonte de verdade e o Anexo I do Contrato
O padrao de dados e o **Anexo I do Contrato NoHarm - Integracao de Dados**, que
e o documento enviado ao cliente. O validador tem que cobrar exatamente o que o
documento pede — nem mais, nem menos. Se validador e documento divergirem, o
cliente segue o documento e o validador o reprova.

Regras que saem disso:
- Nao adicione campo que nao esta no documento, mesmo que exista na view real
  do MV/Tasy. Ajuste o documento primeiro.
- Nao invente chave primaria. Onde o Anexo I nao define um identificador unico
  para a view, `key` fica `[]` e nao ha checagem de duplicidade.
- Excecao registrada: a **View de Vias**. O Anexo I descreve `id` e `value` como
  se fossem colunas, mas sao as chaves de dentro do JSON. A view real
  (MV e Tasy) e uma linha so com `TIPO`, `VALOR`, `UPDATE_AT`, `UPDATE_BY`, e o
  `VALOR` traz todas as vias num array JSON. O validador segue a view; o
  documento precisa ser corrigido.
- Nao invente referencia cruzada. So entram em `refs` as relacoes que o proprio
  documento descreve.
- Campo obrigatorio (`required`) = campo marcado `not null` no documento.

## Como o schema e montado
`VIEWS` em `validator.js` e a transcricao literal das tabelas do Anexo I. Cada
view declara `label`, `view`, `group`, `criticality`, `frequency`, `key`,
`fields` e, quando o documento descreve, `refs`.

Cada campo vem de `f(nome, tipo, obrigatorio, descricao, extras)`. O tipo e o do
documento (`smallint`, `bigint`, `float`, `datetime`, `varchar(250)`, `boolean`,
`text`...) e `buildFileSchema` deriva dele as regras do motor: numerico, data,
booleano e tamanho maximo. **Nao escreva regra de tipo a mao** — mudou o
documento, muda o array de `fields`.

Extras disponiveis:
- `sigla: true` — campo que carrega sigla/codigo textual e nao pode ser so
  numero (ex.: `FKUNIDADEMEDIDA`, `FKFREQUENCIA`).
- `maxDigits: N` — limite de digitos citado no documento (ex.: `NRATENDIMENTO`).
- `jsonList: ["id", "value"]` — a coluna carrega um array JSON cujos itens
  precisam ter essas chaves (ex.: `vias.VALOR`). Aceita o texto ou o array ja
  parseado, porque depende de como o cliente exportou, e fica fora da checagem
  generica de "o dado precisa ser flat".

E por view, quando o documento define valor padrao que nao deve ser cobrado na
referencia cruzada, use `refIgnore` (ex.: `conciliacao.FKMEDICAMENTO = 0` para
item de texto livre sem cadastro).

## Grupos e criticidade
As 15 views estao em 3 grupos (`GROUPS`), na ordem topologica das chaves
estrangeiras: `cadastros` -> `pacientes` -> `prescricoes`. O grupo seguinte so
depende dos anteriores, entao a validacao cruzada pode ser feita de forma
incremental.

`criticality` vem do Anexo I (ESSENCIAL / OPCIONAL):
- ESSENCIAL ausente -> status `error`.
- OPCIONAL ausente -> status `skipped`, fora do resultado geral.

## Regras do passo a passo
- A sequencia e montada em `buildSequence()` no `app.js`, a partir de
  `FILE_TYPES` **mais** o que o cliente respondeu sobre as opcionais. As
  essenciais sempre entram; uma etapa de pergunta precede as opcionais de cada
  grupo; so as marcadas viram etapa.
- **Nao da para pular etapa.** O unico caminho para frente e o Continuar, que so
  liga quando a etapa esta resolvida. `handleJump` limita qualquer navegacao ao
  `firstPendingIndex()`, entao o cliente volta a uma etapa concluida mas nunca
  avanca por atalho.
- A UI mostra a linha do tempo dos **3 grupos**, nunca a lista de views. Se voce
  se pegar querendo listar as 14 views numa tela, e sinal de que a tela esta
  errada.
- Prescricoes Agrupadas foi retirada do validador por decisao de produto, embora
  o Anexo I ainda a liste como ESSENCIAL.
- Coluna fora do Anexo I **nao e erro**. O cliente pode ter campos proprios na
  view; o validador usa so o que precisa e devolve a lista em `extraFields`.
  Campo obrigatorio ausente continua sendo erro.
- **`FKHOSPITAL` e constante, nao dado.** `FKHOSPITAL_FIXO = "1"` no
  `validator.js`, cobrado em toda view que tem a coluna — menos a de Hospitais,
  marcada com `fkhospitalLivre: true` em `VIEWS` por ser o catalogo e trazer os
  codigos reais das multi-empresas. Nao e o codigo do hospital no sistema do cliente: e o identificador
  da plataforma, exigido pela integridade da ingestao. Rede com varios hospitais
  se resolve no filtro da view (`WHERE`), nunca no `SELECT`; as tabelas de
  dominio sao uma so, com `DISTINCT`.
- Essa e a duvida que mais faz o cliente mexer na view e quebrar a integracao,
  entao o aviso e **preventivo**: aparece no passo antes do upload, com o
  `HospitalModal` explicando o porque. Ao mudar a regra, mude o modal junto — o
  cliente que nao entende o motivo troca o 1 pelo codigo real dele.
- **Erro de chave estrangeira aponta para outra etapa.** O grupo de erro carrega
  `refFile` (a view a corrigir), `refField` (a coluna) e `distinctValues` (o que
  falta, ate `MAX_DISTINCT_VALUES`). A UI mostra um "corrigir <View>" que pula
  para la levando a lista: a etapa de destino nao diz so "corrija", ela lista os
  valores a incluir, ordenados para o cliente colar no filtro da view. `voltarPara` no `app.js` guarda de onde o cliente saiu: ao concluir a
  etapa do desvio, ele volta e a etapa de origem e **revalidada** com o arquivo
  que ficou em `stepFiles` — o resultado guardado la foi conferido contra o
  indice antigo e nao vale mais.
- **Passo com erro bloqueia.** Nao existe escape: o cliente corrige e reenvia.
  Seguir com um cadastro quebrado faz as etapas seguintes validarem contra um
  indice furado e produz erro em cascata, que confunde mais do que ajuda. Em
  view opcional a saida e o "Nao tenho", nao seguir com erro.
- **Amostra e por valor distinto, nao por linha.** 58 linhas apontando para o
  mesmo setor sao um problema so; o cliente precisa saber *quais* setores
  faltam. As regras que comparam valor passam `sampleKey` no 5o argumento de
  `collector.add(...)` e o grupo ganha `distinctCount`. Criou regra de valor?
  Passe o `sampleKey`, senao a lista volta a repetir o mesmo valor.
- O cabecalho do erro conta **tipos** de problema, que e o que a lista mostra.
  Contar ocorrencias ali fazia parecer que faltavam linhas na lista ("2
  problemas" com um item so na tela). As ocorrencias aparecem no `Nx` de cada
  linha e no "em N ocorrencias" ao lado do titulo.
- Etapa que passa mostra `buildPreview()`: as 5 primeiras linhas com so as
  colunas do padrao que existem no arquivo. Excecao: na etapa de Hospitais a
  lista de escolha ja mostra os mesmos dados, entao a amostra e omitida
  (`hidePreview`). E a conferencia visual de que o dado
  certo caiu na coluna certa. A amostra e pequena, entao vai junto no
  `Storage.saveStep` e sobrevive ao reload.
- `stepFiles` / `stepResults` no `app.js` sao mapas por etapa, nao valores
  unicos: voltar e avancar de novo nao pode perder o arquivo que o cliente ja
  enviou. So `handleRedo` limpa a entrada daquela etapa.

## Persistencia (`storage.js`)
- Guarda em `localStorage`: hospital principal, resultado por view e o indice de
  chaves das views que sao alvo de referencia cruzada (`REFERENCED_FILES`).
- **Nunca guarde o conteudo dos arquivos.** Prescricao de hospital real passa de
  centenas de MB e estoura a cota na hora.
- Indice acima de `MAX_INDEX_KEYS` (20 mil) nao e guardado. Se a cota estourar
  mesmo assim, `write()` vai soltando os indices do maior para o menor ate
  caber: o progresso e mais importante que o indice.
- Indices grandes demais para persistir ficam em `sessionIndexes` (um `useRef`
  no `app.js`), validos so dentro da sessao.
- **Nao deixe estado dependente sobreviver ao que o originou.** Foi o que
  aconteceu com o antigo "hospital principal": ele vinha do arquivo de Hospitais
  mas era guardado por conta propria, entao refazer o passo deixava a escolha
  orfa e travava o fluxo.
- `tests/validate_storage.js` cobre as regras de progresso com um `localStorage`
  de mentira. Objeto criado dentro do `vm` tem outro prototipo, entao compare
  por string, nao com `deepStrictEqual`.

## Regras de implementacao
- Mantenha o app standalone (sem build step).
- O motor de validacao deve ficar em `validator.js` e ser reutilizado no app e nos testes.
- Evite dependencias extras no browser. Use CDN apenas quando necessario.

## Regras de formato (nao afrouxar sem combinar)
- Data e ISO (`YYYY-MM-DD` / `YYYY-MM-DDTHH:MM:SS`). Nao volte a usar
  `new Date()` para validar: ele le `06/08/26` como mm/dd e aceita a data com
  dia e mes trocados, reprovando so quando o dia passa de 12.
- Linha com quantidade de colunas diferente do cabecalho e marcada em
  `malformedRows` e fica fora das validacoes de conteudo (os valores estao
  deslocados e so gerariam erro derivado).

## Erros e dicas
- Erros iguais sao agrupados em `issueGroups` com contagem real (`issueCount`) e
  ate 5 exemplos. `issues` continua existindo como uma linha por grupo.
- Erro recorrente deve ter dica em `HINTS` no `validator.js`, dizendo a causa
  provavel no arquivo. Ao criar uma regra nova, passe a chave da dica no
  terceiro argumento de `collector.add(...)`.

## Modelos
- Os modelos de download saem de `TEMPLATES` no `validator.js`. O lote precisa
  fechar entre si (chaves estrangeiras validas entre as 15 views).
- Mudou o schema? Atualize `TEMPLATES` junto, senao
  `tests/validate_templates.js` quebra.
- Os arquivos em `examples/` sao gerados a partir de `TEMPLATES`:
  ```bash
  node -e "const v=require('./validator.js');const fs=require('fs');for(const f of v.FILE_TYPES){fs.writeFileSync('examples/'+f.key+'.csv',v.buildTemplateCsv(f.key));fs.writeFileSync('examples/'+f.key+'.json',v.buildTemplateJson(f.key));}"
  ```

## Testes
- Atualize `examples/` e `TEMPLATES` se mudar regras do validador.
- Rode `npm test` para garantir que exemplos e modelos continuam validos.

## Estilo
- Use mensagens e labels em portugues (sem acentos, por compatibilidade).
- Evite logs barulhentos no console.

## Pagina estatica
- O site deve funcionar em GitHub Pages.
- Nao remover `.nojekyll`.
