# AGENTS

Guia rapido para agentes que vao alterar este repo.

## Onde mexer
- Logica de validacao: `validator.js`
- UI: `app.js` e `styles.css`
- HTML raiz: `index.html`

## Regras de implementacao
- Mantenha o app standalone (sem build step obrigatorio).
- O motor de validacao deve ficar em `validator.js` e ser reutilizado no app e nos testes.
- Evite dependencias extras no browser. Use CDN apenas quando necessario.
- O padrao NoHarm e definido pelas views MV + Tasy (nao use CREATE TABLE).

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
  fechar entre si (chaves estrangeiras validas entre os 9 arquivos).
- Mudou schema? Atualize `TEMPLATES` junto, senao
  `tests/validate_templates.js` quebra.

## Testes
- Atualize `examples/` e `TEMPLATES` se mudar regras do validador.
- Rode `npm test` para garantir que exemplos e modelos continuam validos.

## Estilo
- Use mensagens e labels em portugues (sem acentos, por compatibilidade).
- Evite logs barulhentos no console.

## Pagina estatica
- O site deve funcionar em GitHub Pages.
- Nao remover `.nojekyll`.
