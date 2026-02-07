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

## Testes
- Atualize `examples/` se mudar regras do validador.
- Rode `npm test` para garantir que CSV e JSON continuam validos.

## Estilo
- Use mensagens e labels em portugues (sem acentos, por compatibilidade).
- Evite logs barulhentos no console.

## Pagina estatica
- O site deve funcionar em GitHub Pages.
- Nao remover `.nojekyll`.
