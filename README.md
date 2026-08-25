# validador

Validador web standalone para arquivos CSV/JSON no padrao NoHarm.

## O que ele faz
- Recebe 9 arquivos (prescricoes, pessoa, medicamentos, setores, unidades, frequencia, exame, alergia, cultura).
- Valida estrutura e semantica dos dados.
- Aceita CSV ou JSON (lista plana de registros, sem hierarquia).
- Faz validacao cruzada entre chaves (ex.: prescricoes -> medicamentos, setores, unidades, frequencia).

## Regras do padrao NoHarm
- Campos esperados sao baseados nas views padrão da NoHarm.
- Campos obrigatorios
- Campos permitidos
- Qualquer campo fora da uniao gera erro.

## Formato dos arquivos
- **Datas**: ISO — `YYYY-MM-DD` ou `YYYY-MM-DDTHH:MM:SS`. Formatos com barra
  nao sao aceitos: `06/08/26` e ambiguo (6 de agosto ou 8 de junho?) e o ano de
  2 digitos nao diz o seculo.
- **Numeros decimais**: separador ponto (`0.75`). Virgula sem aspas quebra a
  linha em colunas a mais (`CUSTO 0,0909` vira duas colunas).
- **Codificacao**: UTF-8. Latin-1 / Windows-1252 chega com acento corrompido.
- **CSV**: delimitador virgula, cabecalho na primeira linha, aspas so nos
  campos que precisam (nao envolver a linha inteira em aspas).
- **JSON**: array plano de objetos, sem envelope `{ data: [...] }`.

## Modelos para download
A tela tem uma secao "Modelos para download" com um lote de exemplo por tipo de
arquivo (CSV e JSON), coerente entre si — as chaves estrangeiras fecham entre os
9 arquivos. Os modelos sao gerados a partir de `TEMPLATES` no `validator.js` e
`tests/validate_templates.js` garante que eles continuam passando na validacao.

## Relatorio
Erros iguais sao agrupados com a contagem real de ocorrencias e alguns exemplos,
em vez de listar cada linha. Para os erros recorrentes o relatorio traz uma dica
apontando a causa provavel no arquivo (virgula decimal, data fora do ISO,
codificacao, linha inteira entre aspas).

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
Os testes validam os lotes de exemplos (CSV e JSON) e os modelos de download
com o mesmo motor do app.

```bash
npm install
npm test
```

## Estrutura
- `index.html`: pagina principal + CDN (React, AntD, Babel).
- `styles.css`: tema e layout.
- `app.js`: UI (upload, resumo, detalhes).
- `validator.js`: motor de validacao, dicas (`HINTS`) e modelos (`TEMPLATES`),
  compartilhado entre app e testes.
- `examples/`: exemplos CSV/JSON validos.
- `imgs/`: favicon e logo.

## GitHub Pages
O deploy usa o branch `main` e a raiz do repo. O arquivo `.nojekyll` evita o Jekyll sobrescrever o `index.html`.
