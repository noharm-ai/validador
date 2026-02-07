# validador

Validador web standalone para arquivos CSV/JSON no padrao NoHarm.

## O que ele faz
- Recebe 5 arquivos (prescricoes, medicamentos, setores, unidades, frequencia).
- Valida estrutura e semantica dos dados.
- Aceita CSV ou JSON (lista plana de registros, sem hierarquia).
- Faz validacao cruzada entre chaves (ex.: prescricoes -> medicamentos, setores, unidades, frequencia).

## Regras do padrao NoHarm
- Campos esperados sao baseados nas views padrão da NoHarm.
- Campos obrigatorios
- Campos permitidos
- Qualquer campo fora da uniao gera erro.

## Como rodar local
Precisa de um servidor HTTP (nao funciona via file:// por causa do Babel).

```bash
cd /home/user/Documentos/validador
python3 -m http.server 8000
```

Acesse:
```
http://localhost:8000/index.html
```

## Testes
Os testes validam os lotes de exemplos (CSV e JSON) com o mesmo motor do app.

```bash
npm install
npm test
```

## Estrutura
- `index.html`: pagina principal + CDN (React, AntD, Babel).
- `styles.css`: tema e layout.
- `app.js`: UI (upload, resumo, detalhes).
- `validator.js`: motor de validacao compartilhado (app + testes).
- `examples/`: exemplos CSV/JSON validos.
- `imgs/`: favicon e logo.

## GitHub Pages
O deploy usa o branch `main` e a raiz do repo. O arquivo `.nojekyll` evita o Jekyll sobrescrever o `index.html`.
