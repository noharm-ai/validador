# noharm-validador — Visão Geral do Repositório

> Este documento é uma referência técnica completa do repositório, pensada para
> orientar tanto humanos quanto agentes/LLMs que forem alterar o código.
> Para instruções operacionais de edição, ver também [`AGENTS.md`](./AGENTS.md).

## 1. Propósito

Aplicação web **standalone** (sem build step, sem backend) que valida arquivos
CSV/JSON de integração hospitalar contra o **padrão de dados NoHarm** — o
schema de entrada usado pela plataforma NoHarm para ingestão de dados clínicos
(prescrições, medicamentos, atendimentos, etc.).

O usuário sobe até 9 arquivos (um por "tipo de dado"), a aplicação roda no
browser um motor de validação e mostra um relatório com erros/alertas por
arquivo, exportável em JSON.

Não há servidor de aplicação, banco de dados ou API: tudo roda no cliente,
carregado via CDN (React, AntD, Babel) + um HTML estático. É hospedado via
**GitHub Pages** (branch `main`, raiz do repo).

## 2. Estrutura de arquivos

```
.
├── index.html              # Shell HTML: carrega CDNs (React, AntD, Babel, PapaParse) + validator.js + app.js
├── app.js                  # UI React (JSX via Babel in-browser, sem transpilação prévia)
├── validator.js             # Motor de validação (UMD: usado tanto pelo browser quanto por Node/tests)
├── styles.css               # Tema/layout
├── examples/                 # Lotes de exemplo válidos (CSV e JSON) para os 9 tipos de arquivo
├── tests/validate_examples.js # Teste Node que roda o motor contra examples/ e espera status "ok"
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

### 3.1. Os 9 tipos de arquivo (`FILE_TYPES`)

| key            | label              | chave primária (`key`)                |
|----------------|--------------------|-----------------------------------------|
| `prescricoes`  | Prescricoes         | `FKPRESMED`                             |
| `pessoa`       | Pessoa/Atendimento  | `NRATENDIMENTO`                         |
| `medicamentos` | Medicamentos        | `FKMEDICAMENTO`                         |
| `setores`      | Setores             | `FKSETOR`                               |
| `unidades`     | Unidades            | `FKUNIDADEMEDIDA`                       |
| `frequencia`   | Frequencia          | `FKFREQUENCIA`                          |
| `exame`        | Exames              | `FKEXAME`                               |
| `alergia`      | Alergias            | `FKPESSOA` + `FKMEDICAMENTO`             |
| `cultura`      | Culturas            | `FKEXAME` + `FKITEMEXAME` + `FKMEDICAMENTO` |

### 3.2. Schema (`NOHARM_SCHEMA`)

Um único schema (não há mais suporte a múltiplos padrões — a UI já reflete
isso com o Tag "Único" em `app.js`). Para cada tipo de arquivo define:

- **`required`**: campos obrigatórios (erro se faltar).
- **`allowed`**: união de todos os campos aceitos (campo fora dessa lista =
  erro "Campos inesperados"). É a base do schema — deriva das views MV/Tasy
  da NoHarm (ver `AGENTS.md`: "O padrão NoHarm é definido pelas views MV +
  Tasy, não use CREATE TABLE").
- **`key`**: campo(s) que formam a chave primária lógica do arquivo — usados
  para detectar duplicatas e para indexar registros em validações cruzadas.
- **`typeHints`**: regras de tipo/formato por campo:
  - `number`: deve ser numérico (aceita `,` como separador decimal).
  - `date`: deve ser parseável por `new Date(...)`.
  - `boolean`: aceita `true/false/0/1/s/n/sim/nao`.
  - `notNumber`: o inverso de `number` — campo que **não pode** ser somente
    numérico (ex.: `FKUNIDADEMEDIDA`, `FKFREQUENCIA`, que devem ser
    sigla/código, não um ID puro).
  - `maxDigits` / `maxLength`: limites por campo (ex.: `NRATENDIMENTO` máx. 9
    dígitos).
- **`refs`**: campos de chave estrangeira que apontam para outro arquivo (ex.:
  `prescricoes.FKSETOR` → `setores`). Usado na validação cruzada.

Exemplo de relação entre arquivos:
```
prescricoes.FKSETOR         → setores.FKSETOR
prescricoes.FKMEDICAMENTO   → medicamentos.FKMEDICAMENTO
prescricoes.FKUNIDADEMEDIDA → unidades.FKUNIDADEMEDIDA
prescricoes.FKFREQUENCIA    → frequencia.FKFREQUENCIA
pessoa.FKSETOR              → setores.FKSETOR
exame.NRATENDIMENTO         → pessoa.NRATENDIMENTO
alergia.FKMEDICAMENTO       → medicamentos.FKMEDICAMENTO
alergia.NRATENDIMENTO       → pessoa.NRATENDIMENTO
cultura.FKEXAME             → exame.FKEXAME
cultura.FKMEDICAMENTO       → medicamentos.FKMEDICAMENTO
cultura.FKSETOR             → setores.FKSETOR
cultura.NRATENDIMENTO       → pessoa.NRATENDIMENTO
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
   - Retorna `{ fileName, format, root, fields, normalizedFields, records,
     rawRecords, parseErrors }`.

2. **`validateParsed(parsedFiles)`** → delega para `buildValidationForSchema`:
   - **Índices cruzados**: para cada arquivo, monta um `Set` das chaves
     (`key` do schema) presentes — usado depois para checar `refs`.
   - Por arquivo, checa nessa ordem:
     1. Erros de parse (`parseErrors`).
     2. JSON com raiz errada (`object-data` ou `object` puro).
     3. Arquivo vazio → **warning** (não erro).
     4. Campos obrigatórios faltando (`required` vs. campos presentes).
     5. Campos inesperados (fora de `allowed`).
     6. Tipos inválidos por registro (`typeHints`: number/date/boolean/
        notNumber/maxDigits/maxLength) — limitado a `MAX_ERRORS` (200)
        primeiras ocorrências.
     7. Chave obrigatória vazia ou duplicada (baseado em `key`).
     8. Referências cruzadas quebradas (`refs`): valor de FK que não existe
        no índice do arquivo referenciado.
   - Cada arquivo recebe `status`: `"ok"` | `"warn"` | `"error"`, mais
     `issues[]`, `warnings[]`, `recordCount`, `columnCount`.
   - Status geral (`overall`) é o pior status entre todos os arquivos.

3. Saída final: `{ summary: { status, message }, files: {...por tipo...},
   parsed: {...dados brutos parseados...} }`.

### 3.4. Constantes/comportamentos importantes para quem for mexer

- `MAX_ERRORS = 200`: teto de erros de tipo reportados por arquivo (evita
  travar a UI com milhares de linhas de erro).
- `NORMALIZATION_MODE = "lower"`: declarada mas não usada como flag
  condicional em nenhum lugar do código atual — a normalização é sempre
  lowercase, hardcoded em `normalizeField`.
- Mensagens de erro/log são **em português, sem acentos** (convenção do
  `AGENTS.md`, por compatibilidade).

## 4. UI (`app.js` + `index.html` + `styles.css`)

- **Sem build step**: `app.js` é JSX puro, transpilado *no browser* via
  `@babel/standalone` (`<script type="text/babel" src="app.js">` em
  `index.html`). Isso implica: não funciona via `file://` (precisa de um
  servidor HTTP, mesmo que seja `python3 -m http.server`), e qualquer erro de
  sintaxe só aparece em runtime no console do browser.
- **Stack de UI**: React 18 (`useState`/`useMemo`/`useRef`, sem hooks
  customizados) + Ant Design 5 (`Layout`, `Upload.Dragger`, `Collapse`,
  `Alert`, etc.) + ícones `@ant-design/icons`, tudo via CDN `jsdelivr`.
- **Fluxo principal do componente `App`**:
  1. Upload por arquivo individual (`Dragger` por tipo) OU upload em lote
     (`Dragger multiple`), que tenta casar o nome do arquivo com um tipo via
     `matchFileKey` + `fileAliases` (heurística por substring, ex.: nome
     contendo "presc" → `prescricoes`). Se ambíguo ou sem match, gera
     `mappingWarnings`.
  2. Botão **"Validar arquivos"** (`validateAll`): lê o texto de cada File
     (`target.text()`), chama `Validator.parseFileText` e depois
     `Validator.validateParsed`, guarda em `results`.
  3. Renderiza: alerta de resumo geral, cards de resumo por arquivo (status +
     contagem de registros/colunas), painel `Collapse` com detalhes de
     erros/avisos por arquivo, e uma seção final listando os campos
     esperados do schema (`schemaPreview`, derivado de `NOHARM_SCHEMA.allowed`
     de cada tipo).
  4. **"Exportar relatório"**: baixa `results` como `noharm-validacao.json`.
- A UI tem elementos decorativos sem função real ainda (menu lateral com
  itens "Dados"/"Arquivos"/"Config" sem rota associada, campo de busca que só
  mostra um hint "Nada por aqui, por enquanto ;)"). Não confundir com
  funcionalidade implementada.

## 5. Testes (`tests/validate_examples.js`)

- Teste Node simples (sem framework de teste, usa `assert` nativo).
- Roda **exatamente o mesmo motor** (`require("../validator")`) contra dois
  lotes de exemplo em `examples/`: um em CSV, um em JSON — mesmos dados,
  formatos diferentes.
- Espera `status === "ok"` para o resultado geral e para cada arquivo
  individualmente. Falha com `assert` se qualquer arquivo tiver erro.
- Executado via `npm test`, e também em CI (`.github/workflows/ci.yml`) em
  todo push e pull request.
- **Implicação para quem for alterar o schema**: qualquer mudança em
  `required`/`allowed`/`typeHints`/`refs` em `validator.js` deve vir
  acompanhada de atualização dos arquivos em `examples/` (CSV e JSON, para os
  9 tipos), senão os testes quebram. Isso já está documentado em
  `AGENTS.md`.

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
- `matchFileKey` (mapeamento de upload em lote) é uma heurística por nome de
  arquivo, não por conteúdo — arquivos renomeados de forma incomum não serão
  reconhecidos automaticamente e caem em `mappingWarnings`.
- O schema (`NOHARM_SCHEMA`) é grande e tem muitos campos opcionais em
  `allowed` que não estão em `required`; ao adicionar um campo novo ao
  padrão, ele deve entrar em `allowed` (senão vira erro de "campo
  inesperado") e, se for obrigatório, também em `required`.
