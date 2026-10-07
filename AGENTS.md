# AGENTS

Guia rapido para agentes que vao alterar este repo.

## Onde mexer
- Padrao de dados (transcricao do Anexo I): `VIEWS` em `validator.js`
- Logica de validacao: `validator.js`
- Persistencia local do progresso: `storage.js`
- Telas do passo a passo: `wizard.js`
- Casca, estado e ligacao com a persistencia: `app.js`
- Tela de Prescricao (porta de entrada): `noharm-ui.js` + `noharm-ui-exemplo.js`
- Estilo: `styles.css`
- HTML raiz: `index.html`

## Ordem de carga dos scripts
Nao ha bundler nem modulos: os arquivos sao carregados em sequencia pelo
`index.html` e compartilham o escopo global.

```
validator.js       (window.NoHarmValidator)
storage.js         (window.NoHarmStorage)
noharm-ui-icons.js (window.NOHARM_UI_ICONS: logo e SVGs dos alertas)
noharm-ui-exemplo.js (window.NOHARM_UI_EXEMPLO: a tela preenchida, do botao Ver exemplo)
noharm-ui.js       (JSX via Babel: window.NoHarmUI, a tela de Prescricao)
wizard.js          (JSX via Babel: telas + helpers compartilhados)
app.js             (JSX via Babel: App, usa tudo acima)
```

Consequencias praticas:
- **Hooks do React em `wizard.js` saem com outro nome** (`useState: useEstado`,
  `useRef: useRefer`). O `app.js` tambem os desestrutura e carrega depois: dois
  `const useState` no escopo global quebram a pagina. Mesmo motivo do
  `Layout: WLayout`.
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

## Uma tela de Validacao, com os tres grupos do Anexo I

Nenhuma das views depende de outra fora do seu grupo de origem, entao nao ha
fila: a **Validacao** e uma tela so (`BaseScreen`), dividida nos **tres grupos
do Anexo I** — Cadastros, Paciente e Prescricao (`GRUPOS_VALIDACAO`, que segue
`GROUPS` do `validator.js`).

**Nao invente agrupamento proprio.** Ja houve um par "Cadastros +
Complementares" aqui: o cliente recebeu o documento com tres grupos e e por
eles que ele procura a view, entao qualquer outro nome o obriga a traduzir. Foi
desfeito tambem porque a tela de Inicio contava os dois separados e a Validacao
os mostrava juntos — a mesma coisa em duas contas diferentes.

### Duas portas, um estado so
As quatro views de `VIEWS_NA_PRESCRICAO` (prescricoes, pessoa, exame, evolucao)
entram **pelos dois lados**: pelo dropzone da tela de Prescricao ou pelo cartao
delas na Validacao. O que nao pode e o cliente importar duas vezes a mesma view
— entao o estado e um so:

- o que entra pela tela de Prescricao e validado e gravado pelo `app.js`
  (`registrarDaPrescricao`, via `onValidado`) e ja aparece conferido na
  Validacao, com a marca `origem: "previa"` no cartao;
- o que entra pela Validacao alimenta `parsedPrevia` (um `useRef`, memoria da
  sessao, **nunca** `localStorage`) e volta para a tela de Prescricao como
  `arquivosIniciais`: o cliente chega la e a tela ja esta montada.

`parsedPrevia` morre no reload, junto com o conteudo dos arquivos — a regra de
nao persistir arquivo continua valendo. Depois de recarregar, o progresso
continua gravado, mas a tela de Prescricao volta vazia.

Some-las da Validacao esconderia um terco do padrao; tirar o upload delas de la
obrigaria o cliente que chegou com os 14 arquivos na mao a sair e voltar.

### Upload em lote: o cliente solta os 14 de uma vez
A tela tem **uma zona para o lote inteiro** (`LoteDrop`) antes dos grupos, e as
zonas por view continuam para quem tem um arquivo so ou esta refazendo um. As
diretrizes de upload multiplo (PatternFly, SaaSUI) dao as tres regras que
valem aqui, e cada uma virou codigo:

1. **Uma zona, nao 14 alvos.** Quem tem os exports numa pasta nao quer acertar
   o cartao certo com cada arquivo. E a zona e uma **barra**, nao uma caixa
   grande: a acao acontece uma vez e nao merece 180px de tela. O que compensa
   o tamanho e que **a tela inteira recebe o arrasto** — `.nh-base` escuta
   `dragenter/over/leave/drop`, acende uma borda e um aviso ("Solte os arquivos
   para validar"), e o cliente nao precisa mirar em nada. O contador
   `profundidade` existe porque `dragenter`/`dragleave` disparam tambem nos
   filhos: sem ele o aviso pisca ao passar por cada linha.
2. **Estado por arquivo, nunca um veredito do lote.** A lista abaixo da zona
   mostra, linha a linha, qual arquivo virou qual view e com quantos registros
   ou problemas. "Concluido" num lote, escondendo quem entrou, e a falha mais
   citada.
3. **Nada some em silencio.** Arquivo nao reconhecido fica na lista com um
   seletor ("de qual view e?"), e arquivo que outro da mesma view substituiu
   aparece riscado dizendo quem ficou no lugar (`marcarSubstituidos`).

**Quem reconhece o arquivo e o cabecalho, nao o nome.** `Validator.guessFileKey`
compara as colunas do arquivo com as da view por intersecao/uniao — contar so
"quanto da view existe no arquivo" nao serve, porque Hospitais tem duas colunas
(FKHOSPITAL, NOME) que quase toda view tem e ela casaria com tudo. Obrigatorio
faltando elimina a view. O nome do arquivo so desempata, porque o export sai
como `VW_NOHARM_01.csv`. Sem destaque claro sobre a segunda colocada, devolve
`null` e a tela **pergunta** em vez de gravar no lugar errado.
`tests/validate_rules.js` cobre isso: todas as 14 views tem que ser
reconhecidas a partir de um arquivo chamado `anonimo.csv`.

### O recorte recomendado
A tela avisa, no link "Quanto dado exportar?" do dropzone (`RecorteModal`), que
**nao e para exportar a view inteira**: o recomendado e um atendimento (ou poucos) e, nas views de
Paciente e Prescricao, so as linhas desse mesmo atendimento. E o recorte que
fecha entre si — da para cruzar tudo e a tela da NoHarm aparece montada com um
caso real. O mesmo aviso esta no dropzone da tela de Prescricao.

- O upload e em qualquer ordem, sem "Continuar" por view: ja valida e grava.
- **Etiqueta `essencial` / `opcional` em cada linha.** O cliente nao precisa
  mandar as 14: a etiqueta diz quais reprovam a validacao se faltarem. Fora do
  verde/vermelho de proposito — ali eles significam "validou" e "deu erro", e
  isto e classificacao, nao estado. Os contadores do grupo seguem a mesma
  divisao ("1 de 1 essenciais · 5 de 5 opcionais").
- **Da para remover um arquivo enviado** (`onRemover`), na linha da view e na
  lista do lote. Sem isso, desfazer um upload errado so apagando o progresso
  inteiro. O remover limpa `progress`, `stepFiles`, `stepResults`,
  `sessionIndexes`, `parsedPrevia` **e** marca a entrada do lote como removida —
  senao a lista continuaria dizendo que o arquivo entrou.
- **Da para baixar o arquivo como foi enviado** (`baixarArquivo`), tanto o que
  passou quanto o que deu erro, na linha da view e na lista do lote. Serve para
  o cliente abrir o arquivo exato que o validador leu — util quando o export
  saiu com nome generico (`VW_NOHARM_07.csv`) e ele precisa descobrir qual era.
  **So funciona na sessao em que o arquivo foi enviado**: o conteudo nunca e
  guardado (prescricao de hospital real passa de centenas de MB), entao depois
  do reload o botao some. Ele sai de `stepFiles`, que e memoria, nao
  `localStorage`.
- **Clicar no "N problemas" da lista do lote leva ao problema**: abre o grupo,
  abre o detalhe da view e rola ate ela (`irParaView`). Quem ve "1 problema"
  quer o problema, nao a informacao de que ele existe.
- **Os tres grupos sao uma sanfona feita a mao**, nao o `Collapse` do AntD.
  **Grupo com erro abre sozinho e nao fecha** — `abertos` e a *uniao* de
  `gruposComErro` com o que o cliente abriu na mao, nao um "ou": assim um erro
  novo aparece mesmo depois de ele ter mexido na sanfona. O cabecalho do grupo
  com erro leva "N com problema" em vermelho, para o estado nao depender de
  abrir.
- **Uma linha por view (`BaseRow`), nao um cartao com dropzone.** Com o
  reconhecimento pelo cabecalho, a zona de lote ja manda **qualquer** arquivo
  para a view certa, inclusive um arquivo so — entao 14 dropzones viraram 14
  alvos redundantes ocupando a tela inteira. A linha carrega o que importa (o
  que e, em que pe esta, qual arquivo entrou) e as acoes como texto. O "campos
  e modelo" so aparece no hover: ele se repete 14 vezes e competia com o
  estado, que e o que o cliente vem ver.
- **O detalhe abre na propria linha**, nao no rodape da tela. Quando era um
  painel unico la embaixo, clicar na segunda view fazia a resposta aparecer
  800px abaixo do clique.
- **Texto que se le uma vez vira modal.** A orientacao de quanto dado exportar
  morava em cinco linhas no corpo da tela, em todo acesso; agora e o link
  "Quanto dado exportar?" no proprio dropzone (`RecorteModal`). Mesma logica do
  `HospitalModal`. Os modelos CSV/JSON sairam dos 14 cartoes e moram no
  `FieldsModal`, junto da lista de campos — que e onde o cliente vai quando
  precisa montar o arquivo.
- O rodape da propria tela e o veredito (`nh-veredito`): sem todas as
  essenciais enviadas e sem erro, ele nao diz "aprovado" e o "Exportar
  relatorio" fica desabilitado.
- A fase **Movimento** e a tela `steps` nao fazem mais parte do caminho normal:
  o que sobrou delas serve ao desvio de chave estrangeira, que abre a etapa
  isolada da view a corrigir. `buildSequence()` continua existindo para isso.

### O que a tela de Prescricao importa conta no progresso
`NoHarmUI` recebe `onValidado(chave, arquivo)` e o `app.js` responde com
`registrarDaPrescricao`: valida o `parsed` que aquela tela ja montou (sem reler
o arquivo) e grava com `Storage.saveStep`. Sem isso as quatro views ficariam
eternamente pendentes no veredito, e o atalho da linha seria mentira.

Ela tambem recebe `onIrValidacao`, usado no rodape do dropzone ("ver o layout
desta view e as outras 13").

### A referencia mora na linha da view
Cada `BaseRow` leva **"campos e modelo"**, que abre o `FieldsModal` com a lista
completa de campos, um exemplo e os modelos CSV/JSON. E com isso que o cliente
monta o arquivo: esconder atras do resultado inverte a ordem de uso.

## Regras do passo a passo
- **O portao fica no fim, nao em cada etapa.** Erro nao impede seguir: o cliente
  percorre tudo, descobre todos os problemas numa passada e leva uma lista so
  para quem mexe na view — num hospital quem escreve a view costuma ser outra
  pessoa. Quem bloqueia e o veredito no rodape da Validacao: sem tudo verde,
  nao diz "aprovado" e o botao de exportar fica desabilitado.
- **Modelo e lista de campos vivem na linha da view, antes do upload.** E com
  eles que o cliente monta o arquivo; esconder atras do resultado inverte a
  ordem de uso.
- **A pergunta das opcionais nao e uma view.** Nao conta no "N de M" (o contador
  usa `sequence.filter(type === "view")`) e o botao principal e sempre
  "Continuar" — deixar "Nao tenho nenhum" como CTA verde punha o caminho
  negativo em destaque.
- **Uma informacao, um lugar.** O menu tem **3 itens**: Inicio, Prescricao,
  Validacao. Antes de criar tela nova, veja se ela nao e outra vista de algo
  que ja existe — foi o que aconteceu com duas telas que sairam:
  - **Resultado** listava as 14 views com status e contagem, exatamente o que a
    Validacao ja mostra. O que ela tinha de proprio desceu para o rodape da
    Validacao: o veredito (`nh-veredito`), o "Exportar relatorio" e o bloco do
    progresso salvo.
  - **Referencia** listava os campos de cada view, o que o `FieldsModal` ja faz
    por view, a um clique da linha ("campos e modelo"). O `ExampleTable` (as 3
    primeiras linhas do modelo) foi junto para dentro do modal.
  Em ambos os casos a tela separada obrigava o cliente a sair do lugar onde ele
  estava trabalhando para ver a mesma coisa.
- **Nao ha linha do tempo.** `FASES` e o `Timeline` sobraram so para a tela
  `steps` do desvio de chave estrangeira. Na Validacao a linha do tempo foi
  retirada: com duas fases (e depois uma) ela era uma faixa de cromo sem
  informacao. Se voce se pegar querendo listar as 14 views numa tela, e sinal
  de que a tela esta errada.
- **A tela de Inicio mostra estado, nao instrucao.** A NN/g e direta: instrucao
  que o usuario precisa digerir *antes* de usar o produto reduz a usabilidade
  ("Onboarding: skip it when possible"). Entao a Inicio nao e um tutorial de
  tres cartoes explicando o que ele vai fazer — ela diz **em que pe ele esta** e
  da **uma** proxima acao.
  **E nao ha fila.** Ja teve um `Steps` aqui e era mentira: a tela de Prescricao
  e opcional — serve para o cliente ver o dado dele montado na NoHarm, e nada na
  validacao depende dela. Quem quer so validar as views vai direto. Entao os
  dois caminhos ficam lado a lado, com o peso de cada um: **validar** e a acao
  principal (coluna larga), **ver na NoHarm** e **referencia** sao o convite
  (coluna estreita).
  Montagem, toda com componentes do AntD, como o resto do app e a propria
  NoHarm: `Card`, `Progress`, `Alert`.
  - O cartao principal e um painel de estado: o texto muda conforme o progresso
    e, abaixo, a lista dos **tres grupos do Anexo I** com o que ja entrou em
    cada um — a mesma divisao da tela de Validacao. Foi o que resolveu o vazio
    do cartao sem inventar instrucao: conteudo que o cliente quer ("onde
    estou"), nao texto explicando o produto.
  - **O andamento conta as ESSENCIAIS**, nao as 14. Opcional ausente entra como
    `skipped` e fica fora do resultado; medir sobre 14 daria "8 de 14" com tudo
    aprovado e mandaria o cliente procurar seis views que nao precisa enviar.
    As opcionais aparecem a parte ("0 de 6 opcionais").
  - **Sem contagem antes de comecar**: com zero views enviadas o cartao
    principal nao mostra barra de progresso, so o resumo do que o Anexo I pede.
  Ja foi tentada como painel de duas colunas de texto, como faixa de cartoes no
  topo e como coluna estreita centralizada com tres cartoes descritivos: as
  tres viraram leitura obrigatoria antes de trabalhar.
- **As telas de trabalho nao sao uma coluna centralizada.** `.nh-wizard` e
  `.nh-review` ocupam a largura (ate 1120px) alinhados a esquerda. Centralizar
  deixava os cartoes espremidos numa faixa de 620px com meia tela vazia ao
  lado.
  A Inicio tambem (`.nh-home`, ate 1120px, `margin: 0 auto`): quem ocupa a
  largura la e a `Row` de cartoes, nao uma coluna de texto.
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
- **Toda view que referencia a que acabou de chegar e revalidada.**
  `quemReferencia(fileKey)` sai do `refs` do schema, **nao** do status atual: a
  view pode ter PASSADO so porque o indice ainda nao existia (o motor so cobra
  a referencia de quem recebeu indice). Num lote de 14 a ordem e arbitraria,
  entao ha uma segunda passada em toda view com `refs` depois que todos os
  indices entraram. Sem isso o bug era nos **dois** sentidos: erro que fica
  vermelho depois de corrigido, e — pior — **falso verde**, view aprovada sem a
  chave estrangeira nunca ter sido checada. Medido: 4 das 14 passavam assim.
- **Erro de chave estrangeira aponta para outra etapa.** O grupo de erro carrega
  `refFile` (a view a corrigir), `refField` (a coluna) e `distinctValues` (o que
  falta, ate `MAX_DISTINCT_VALUES`). A UI mostra um "corrigir <View>" que pula
  para la levando a lista: a etapa de destino nao diz so "corrija", ela lista os
  valores a incluir, ordenados para o cliente colar no filtro da view. `voltarPara` no `app.js` guarda de onde o cliente saiu: ao concluir a
  etapa do desvio, ele volta e a etapa de origem e **revalidada** com o arquivo
  que ficou em `stepFiles` — o resultado guardado la foi conferido contra o
  indice antigo e nao vale mais.
  Na interface nova isso virou: o `StepResult` dentro da linha recebe
  `onFixRef`, que guarda o desvio em `correcao` e chama `irParaView(refFile)`.
  A linha de destino mostra `nh-view-correcao` com os valores a incluir, e a
  revalidacao da origem acontece sozinha no upload (`revalidarDependentes`),
  sem o cliente precisar voltar.
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

## A tela de Prescricao (`noharm-ui*`) e a porta de entrada

A tela inicial do validador e uma replica da tela de Prescricao da aplicacao
NoHarm (`/prescricao/:id`, `src/components/Screening` no frontend), usada como
**receptora de dado**: nao existe nada de mentira nela. Cada area fica em
branco ate o cliente importar a view que a alimenta.

**O layout aparece de cara, vazio — nao ha portao de entrada.** O cliente ve a
tela da NoHarm montada antes de importar qualquer coisa, e os pontos de import
ficam dentro dela: o dropzone da prescricao mora no corpo da aba, no lugar da
tabela. Uma tela de upload antes do layout esconde justamente o que o cliente
veio ver.

| area | view que alimenta |
|---|---|
| cabecalho, tabela de itens e parte do paciente | Prescricoes e Itens (a porta de entrada) |
| idade, sexo, peso, altura, cor | Pessoa / Atendimento |
| cartao de exames | Exames |
| cartao de evolucoes | Evolucao |

### A prescricao escala
Importada a prescricao, os codigos que ela usa viram cartoes: Medicamento,
Frequencias, Unidades e Setores (mais Hospitais e Vias, que ela nao
referencia). Cada cartao diz quantos codigos distintos a prescricao usa e pede
o cadastro. Quando o cadastro entra, o cartao fica **verde** ou **vermelho** e
abre o detalhe.

A checagem e feita com o motor de `validator.js`, duas perguntas por cadastro:

1. `validateFile(chave, parsed)` — a view esta de acordo com o Anexo I?
2. `validateFile("prescricoes", presc, { externalIndexes: { [chave]: indice } })`
   — ela cobre os codigos que a prescricao usa?

O motor **so cobra a referencia de quem recebeu indice**, entao passar um
cadastro por vez isola a pergunta. Os grupos de erro vem filtrados por
`refFile === chave`, e e deles que sai a lista de codigos a incluir no filtro
da view.

### De onde vem cada coluna da tabela

| na tela | campo da view de prescricoes |
|---|---|
| Atendimento n° | `NRATENDIMENTO` |
| Prescricao # | `FKPRESCRICAO` |
| Inicio / Fim da Vigencia | `DTPRESCRICAO` / `DTVIGENCIA` |
| Leito, Prescritor | `LEITO`, `PRESCRITOR` |
| Medicamento | `FKMEDICAMENTO` (vira nome quando o cadastro entra) |
| Per. | `PERIODO` / `PERIODO_TOTAL` |
| Dose | `DOSE` + `FKUNIDADEMEDIDA` |
| Frequencia, Horarios, Via | `FKFREQUENCIA`, `HORARIO`, `VIA` |
| aba do item | `ORIGEM` (Solucoes cai junto de Medicamentos) |
| faixa roxa (grupo de solucao) | `SLAGRUPAMENTO` |
| item riscado | `DTSUSPENSAO` |
| icone de mensagem | `COMPLEMENTO` |

**Uma prescricao por vez.** Nao ha agrupamento por vigencia: a tela pega a
primeira `FKPRESCRICAO` do arquivo e avisa quantas outras ficaram de fora.

### As abas e as colunas de cada uma
Do `components/Screening/index.jsx` e do `columns.jsx`:

- **Medicamentos** e **Procedimentos/Exames** usam o mesmo conjunto: score,
  Medicamento, Per., Dose, Frequencia, Horarios, Via, Tags, Acoes.
- **Dietas/Recomendacoes** usa `dietColumns()`: **sem score e sem Per.**, e a
  primeira coluna se chama **Dieta**.
- Larguras do fonte: score 85, medicamento 35%, Per. 65, Via 85, Tags 90,
  Acoes 80. Dose nao tem largura fixa.
- O original ainda tem a aba **Solucoes** (escondida pela feature
  `hasDisableSolutionTab`, desligada no schema do print) e so mostra
  Procedimentos e Dietas quando tem item. Aqui as duas aparecem sempre.

O exemplo (`noharm-ui-exemplo.js`) tem item nas tres abas: se voce mexer nele,
mantenha procedimento e dieta — uma aba vazia esconde a coluna que mudou.

### O que a NoHarm calcula e nenhuma view traz
**Score, flag, alertas, escore global e os indicadores da evolucao** sao
resultado do processamento da NoHarm: nao vem em view nenhuma. Sem eles a tela
fica sem sentido, entao o validador **simula** esses numeros
(`simularAlertas`, `simularEscore`, `simularLinha`, `simularIndicadores`).

A simulacao e deterministica — sai de uma semente derivada da propria
prescricao, entao o mesmo arquivo da sempre os mesmos numeros — e **vem sempre
com a etiqueta `simulado`** ao lado do titulo do cartao. A etiqueta nao e
decoracao: sem ela o cliente le o numero como analise do dado dele.

Onde da para contar de verdade, conta: a duplicidade e o numero de itens que
aparecem mais de uma vez na prescricao.

### O botao "Ver exemplo"
Na barra de dados, liga `noharm-ui-exemplo.js`: a tela inteira preenchida como
fica na NoHarm quando tudo chegou certo. E a unica coisa de mentira no arquivo,
e por isso mora separada — a tela em si e receptora. Com o exemplo ligado os
chips de import ficam inertes e a tela ganha uma borda roxa.

### A tela fica igual a da NoHarm, botao por botao
**Nao remova controle nenhum por estar inerte.** O ponto da tela e o cliente
reconhecer o produto, e uma barra de acoes pela metade descaracteriza. "Ver
mais", "Ver todos" dos exames, o menu do paciente, as seis abas do cartao e os
botoes de selecao multipla, perspectiva de alertas e diff estao la porque estao
la na plataforma.

Isso ja foi tentado ao contrario uma vez (tirar o que nao funcionava) e foi
desfeito: a tela ficou irreconhecivel.

Os que **funcionam de verdade** sao os que davam para ligar sem inventar dado:
filtrar por nome, ordenar (campo e direcao) e condensar as linhas.

Tres sairam por decisao do David, por prometerem acao que nao existe aqui:
- **Checar**, **Evolucao** e **Fechar** no cabecalho (`PageHeader`). O
  cabecalho ficou so com o atendimento e o botao do exemplo: aqui nao ha para
  onde fechar, a tela e a propria porta de entrada.
- **Ver todos** do cartao de Alertas, que nao tem para onde ir. No lugar, cada
  icone ganhou a dica do alerta (`ALERT_LABEL`) no hover — era isso que o
  cliente procurava ali. O "Ver todos" dos **Exames** continua.
- O **recarregar** ao lado do nome do paciente. O nome agora carrega a legenda
  `nhui-dica-campo` ("exemplo: aqui fica o nome do paciente"), porque a tela e
  receptora e o cliente precisa saber que dado cai em cada lugar.

### Regras de implementacao
- **Tudo roda dentro de uma IIFE** que exporta `window.NoHarmUI`. Os scripts
  compartilham escopo global, e os nomes da tela (`Table`, `Tabs`...)
  colidiriam com os do `app.js`. Mesmo motivo do `Layout: WLayout` no
  `wizard.js`.
- **O CSS e escopado em `.nhui`**, nao em `.nh-`: o validador ja usa o prefixo
  `.nh-` e ate uma classe `.nh-preview` (a amostra de registros do passo a
  passo). Sem o escopo, as regras de tabela e de card vazariam para o wizard.
- `ALTURA` nao tem unidade fixa no Anexo I: vem em metro (1,75) ou centimetro
  (175). A tela trata valor abaixo de 3 como metro, para o IMC nao sair absurdo.
- **A linha de cima tem que fechar com a tela vazia tambem.** Os tres cartoes
  (paciente, exames, alertas+evolucoes+escore) sao colunas de um `Row` que ja
  estica: quem desalinhava era o `.max-height: 315px` do fonte, que capava o
  **cartao** de exames enquanto a linha ficava mais alta que isso. O limite
  agora e `height: 100%`, e quem rola e a lista (`.exam-list`, que tem o seu
  proprio limite). Cartao sem dado leva `nhui-vazio` e centraliza o conteudo,
  em vez de deixa-lo encostado no topo com um vazio embaixo.
- O unico dado de mentira do projeto mora em `noharm-ui-exemplo.js`, atras do
  botao "Ver exemplo". Fora dali a tela so mostra o que o cliente importou (ou
  o que a simulacao preenche, sempre rotulada).

## Persistencia (`storage.js`)
- Guarda em `localStorage`: hospital principal, resultado por view e o indice de
  chaves das views que sao alvo de referencia cruzada (`REFERENCED_FILES`).
- **Nunca guarde o conteudo dos arquivos.** Duas razoes, e a segunda e a que
  manda:
  1. Prescricao de hospital real passa de centenas de MB e estoura a cota.
  2. **LGPD.** Nome, data de nascimento, CID e leito sao dado sensivel de saude
     (art. 11), e o navegador de hospital costuma ser de estacao compartilhada.
     O rodape da tela promete ao cliente que o conteudo nao e guardado: isso
     tem que ser verdade.

  `saveStep` ja guardou o `preview` (as 5 primeiras linhas do arquivo) e os
  `samples` dos grupos de erro (que citam o valor: `registro 1, valor
  "12/03/1958"`). Uma revisao de seguranca pegou: 1177 bytes no `localStorage`
  com nome, nascimento, cidade, CID, atendimento e leito.
  Uma segunda revisao pegou a **mesma coisa por outro caminho**, e esse e menos
  obvio: **os NOMES das colunas extras** (`extraFields`). O PapaParse roda com
  `header: true`, entao arquivo sem cabecalho — SQL*Plus sem `SET HEADING ON`,
  banner antes do header, arquivo cortado na mao: exatamente os quebrados que o
  validador existe para pegar — faz a primeira LINHA DE DADOS virar cabecalho,
  e os "nomes de coluna" viram os dados do primeiro paciente. Hoje so a
  **contagem** (`extraFieldCount`) e guardada e exportada; os nomes nunca
  apareceram na tela. Pela mesma razao, `descreverErroDeLeitura()` troca a
  mensagem do V8 para JSON invalido, que cita os primeiros caracteres da
  entrada.
  **Licao**: toda string que vem do arquivo e dado de paciente em potencial,
  inclusive a que parece metadado. Ao adicionar campo ao registro do passo,
  pergunte de onde a string veio.
  Agora `semValores()` corta `preview`, `samples` e `distinctValues` na
  gravacao, e
  `tests/validate_storage.js` **tranca isso** com um teste que reprova se
  qualquer valor de arquivo aparecer no storage.
  O que fica gravado: status, contagens e a **mensagem** do erro. Os valores
  continuam na tela enquanto a sessao vive, porque `BaseScreen` usa
  `detalhe(key) = stepResults[key] || progress.steps[key]` — memoria primeiro.
  Depois do reload o cliente ve o status e a mensagem, nao o dado.
- **O indice de chaves continua gravado, e isso e uma decisao consciente.**
  Quatro dos cinco (`setores`, `medicamentos`, `unidades`, `frequencia`) sao
  codigo de dominio, nao dado pessoal. O de `pessoa` e `NRATENDIMENTO` — numero
  de atendimento, identificador indireto, sem nome nem nascimento ao lado. Ele
  e load-bearing: sem ele a referencia das prescricoes nao e checada depois do
  reload. O texto do rodape **diz isso em voz alta** em vez de prometer o
  contrario. Ao mexer, mexa no texto junto.
- Indice acima de `MAX_INDEX_KEYS` (20 mil) nao e guardado. Se a cota estourar
  mesmo assim, `write()` vai soltando os indices do maior para o menor ate
  caber: o progresso e mais importante que o indice.
- Indices grandes demais para persistir ficam em `sessionIndexes` (um `useRef`
  no `app.js`), validos so dentro da sessao.
- **Nao deixe estado dependente sobreviver ao que o originou.** Foi o que
  aconteceu com o antigo "hospital principal": ele vinha do arquivo de Hospitais
  mas era guardado por conta propria, entao refazer o passo deixava a escolha
  orfa e travava o fluxo.
  Aconteceu de novo com o "apagar tudo": ele limpava o `localStorage` e
  `sessionIndexes`, mas nao `parsedPrevia` — e a tela de Prescricao continuava
  desenhando o dado de um progresso que nao existia mais. **Ao mexer no
  `handleClear`, confira a lista inteira**: `progress`, `sessionIndexes`,
  `parsedPrevia`, `stepFiles`, `stepResults`, `lote`, `baseAberto`, `desvio`.
  E o `NoHarmUI` leva `key={versaoDados}`: sem remontar, a tela segue com o
  estado interno que ela copiou de `arquivosIniciais` na montagem.
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
- **Nada de nome realista nos dados de exemplo.** Sao "PACIENTE EXEMPLO UM",
  "DRA EXEMPLO UM", "FARMACEUTICA EXEMPLO". Ja houve "JOAO BATISTA DOS SANTOS"
  e "DRA FERNANDA ALVES" ali, e isso fez um relatorio de bug parecer vazamento
  de dado real de paciente.
- **O lote e um caso clinico so, de proposito.** Paciente 5001 / atendimento
  7001: pneumonia em UTI, com a prescricao (12 itens nas quatro origens:
  Medicamentos, Solucoes agrupadas, Proced/Exames e Dietas), o painel de 12
  exames da mesma coleta, 3 evolucoes de autores diferentes, a hemocultura com
  antibiograma, a alergia e o caminho pelos setores. Um segundo atendimento
  (5002 / 7002) menor evita a view de paciente unico. E o mesmo recorte que o
  validador recomenda ao cliente, entao o modelo e o exemplo da orientacao.
- Dado generico (`FULANO DE TAL`, dois exames soltos) nao serve: a tela de
  Prescricao fica com abas vazias e o cliente nao reconhece o proprio dado.
  Ao mexer, mantenha item em **todas** as abas, o grupo de solucao
  (`SLAGRUPAMENTO`), um item suspenso (`DTSUSPENSAO`) e um `COMPLEMENTO`.
- `itemPrescricao(cabecalho, item)` monta a linha de prescricao: os 11 campos
  de cabecalho ficam no objeto da prescricao e so o que muda aparece no item.
- O `FieldsModal` mostra as 3 primeiras linhas de cada modelo (`ExampleTable`),
  entao as primeiras linhas sao as que melhor representam a view.
- A tela de Prescricao mostra a **sigla** da view em Dose e Frequencia
  (`1 AMP`, `12/12`), como a NoHarm, com o nome do cadastro no `title`. Entao
  o `NOME` de unidades e frequencias pode ser descritivo sem espremer a
  tabela.
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
- **Mensagens e labels em portugues COM acento.** A regra antiga era sem acento
  "por compatibilidade", mas tudo aqui e UTF-8 (o `index.html` declara o
  charset e os arquivos sao UTF-8), e a tela de Prescricao ja usava acento por
  ser replica da NoHarm — metade do app contrariava a outra metade, e o cliente
  lia aquilo como erro de portugues.
- **O acento entra em texto, nunca em codigo.** Chave de objeto, nome de
  arquivo, classe CSS e identificador ficam sem acento: `"frequencia"`,
  `"prescricoes"`, `nh-base-card`, `const codigo`. Isso ja quebrou a pagina
  duas vezes — uma com `goToScreen("referência")` e outra com
  `` `${obrigatórios} campos` `` dentro de template literal, onde o `${...}` e
  codigo. Ao acentuar em massa, proteja: string de uma palavra so minuscula,
  propriedade, acesso a membro, classe CSS, nome de arquivo e **o interior de
  `${...}`**.
- Os testes comparam o texto das mensagens (`message.includes(...)`), entao
  mudou mensagem, muda o teste junto.
- Evite logs barulhentos no console.

## Seguranca (o app le dado de paciente)
Revisao feita em 07/10/2026 (OWASP/STRIDE + eixo clinico). O que esta no lugar
e nao deve ser desfeito:

- **Libs de terceiro com versao pinada e `integrity` (SRI)** no `index.html`.
  Sao 7 scripts com acesso total a uma pagina que tem prescricao e paciente em
  memoria: sem SRI, uma versao nova comprometida no CDN roda sem ninguem notar.
  Trocar de versao exige recalcular o hash:
  ```bash
  curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A
  ```
  `antd.min.css` foi removido do HTML: ele retorna 404 desde sempre (o AntD 5
  injeta estilo em runtime), era requisicao morta.
- **CSP que fecha a saida**, nao a entrada. `connect-src 'self'` e
  `img-src 'self' data:` impedem um script da pagina de mandar dado para fora —
  testado: `fetch` e `new Image().src` para dominio externo sao bloqueados.
  `script-src` precisa de `unsafe-eval` **e** `unsafe-inline` porque o Babel
  compila o JSX no browser e injeta o resultado como script inline; ou seja, o
  CSP nao protege contra injecao, protege contra exfiltracao. Hoje nao ha vetor
  de injecao (nenhum `innerHTML`/`eval` sobre dado do cliente). Quem quiser
  fechar o `unsafe-eval` precisa antes tirar o Babel do browser — o que quebra
  a regra de "sem build step".
- **O relatorio exportado nao leva dado de paciente.** Ele e montado a partir
  do `progress`, que ja nao tem valor vindo do arquivo. O mesmo vale para o
  export de progresso.
- **Nenhuma chamada de rede no codigo do app.** Nao adicione: o dado nao sai da
  maquina, e e isso que a tela promete.
- **Sem `innerHTML`/`dangerouslySetInnerHTML`/`eval` sobre dado do cliente.**
  O React escapa tudo; arquivo malicioso nao injeta script. Nao abra excecao.
- Nome de coluna `__proto__` nao polui prototipo (testado no CSV e no JSON).

## Pagina estatica
- O site deve funcionar em GitHub Pages.
- Nao remover `.nojekyll`.
