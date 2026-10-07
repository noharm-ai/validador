# validador

Validador web standalone para arquivos CSV/JSON no padrao NoHarm.

## O que ele faz
- Guia o cliente por um **passo a passo**, uma view por vez, na ordem em que as
  dependencias fecham.
- Recebe as views descritas no **Anexo I do Contrato NoHarm - Integracao de Dados**.
- Valida estrutura e semantica dos dados.
- Aceita CSV ou JSON (lista plana de registros, sem hierarquia).
- Faz validacao cruzada entre chaves (ex.: prescricoes -> medicamentos, setores, unidades, frequencia).
- **Salva o progresso na maquina do cliente**, para ele parar e voltar depois.

## O passo a passo
A linha do tempo mostra **os 3 grupos**, nunca a lista de views. O cliente so
avanca com o Continuar, e o Continuar so liga quando a etapa esta resolvida —
nao da para pular etapa nem chegar nas prescricoes sem os cadastros.

1. **Boas-vindas**: um botao.
2. **Cadastros**: as 6 views essenciais, uma por etapa. A etapa mostra o nome da
   view, os campos obrigatorios em etiquetas (passar o mouse mostra tipo e
   descricao), o link do modelo e a area de upload. A validacao roda na hora e,
   dando certo, mostra as **5 primeiras linhas com so as colunas que a NoHarm
   vai usar** — o cliente confere na hora que o dado caiu na coluna certa.
3. **`FKHOSPITAL = 1`**: as etapas que tem a coluna avisam isso antes do upload,
   com um "por que?" que explica que o numero e da plataforma e nao do sistema
   do cliente. E a duvida que mais faz o cliente mexer na view e quebrar a
   integracao.
4. **Pacientes**: a view de Pessoa/Atendimento e, na sequencia, **a pergunta**
   "Quais desses dados voce tem?" (Exames, Culturas, Alergias, Evolucoes,
   Transferencias). So o que ele marcar vira etapa; o resto ja entra como
   pulado.
5. **Prescricoes**: a view de prescricoes e a pergunta sobre conciliacao.
6. **Resultado**: a lista do que foi validado e o botao de exportar. E a tela do
   print que o Anexo I pede.

## As views e os 3 grupos
O Anexo I define 15 views; o validador cobra 14 (Prescricoes Agrupadas ficou de fora). O validador as organiza em 3 grupos, que seguem a
ordem de dependencia das chaves estrangeiras: Cadastros nao depende de ninguem,
Pacientes depende de Cadastros, Prescricoes depende dos dois.

| Grupo | View | Criticidade |
|---|---|---|
| Cadastros | Hospitais | ESSENCIAL |
| Cadastros | Setores / Departamentos | ESSENCIAL |
| Cadastros | Unidades | ESSENCIAL |
| Cadastros | Frequencias | ESSENCIAL |
| Cadastros | Vias | ESSENCIAL |
| Cadastros | Medicamento | ESSENCIAL |
| Pacientes | Pessoa / Atendimento | ESSENCIAL |
| Pacientes | Exames | OPCIONAL |
| Pacientes | Culturas | OPCIONAL |
| Pacientes | Alergias | OPCIONAL |
| Pacientes | Evolucao | OPCIONAL |
| Pacientes | Transferencias | OPCIONAL |
| Prescricoes | Prescricoes e Itens | ESSENCIAL |
| Prescricoes | Conciliacao | OPCIONAL |

View ESSENCIAL que nao for enviada reprova a validacao. View OPCIONAL que nao
for enviada fica com status `skipped` e nao entra no resultado — o cliente
conclui a validacao mandando so as essenciais.

## Regras do padrao NoHarm
- Campos, tipos, obrigatoriedade e descricao saem **literalmente do Anexo I**.
- Campo obrigatorio = campo marcado `not null` no documento.
- **Coluna a mais nao e erro.** Se a view do cliente tem campos proprios, o
  validador simplesmente os ignora e valida so o que precisa usar. O resultado
  informa quantas colunas foram ignoradas.
- **`FKHOSPITAL` e sempre 1**, com uma excecao: a view de Hospitais, que e o
  catalogo e traz os codigos reais das multi-empresas. Nao e o codigo do hospital no sistema do cliente:
  e um identificador fixo da plataforma NoHarm, exigido pela integridade da
  ingestao. Rede com varios hospitais tambem entra como 1 — quais hospitais
  participam se decide no filtro da view (`WHERE CD_MULTI_EMPRESA IN (...)`),
  nunca no `SELECT`. As tabelas de dominio (unidades, frequencias,
  medicamentos) sao uma so, com `DISTINCT`, porque nao ha frequencia nem
  medicamento duplicado por hospital.
- Chave primaria so e cobrada nas views em que o Anexo I define um
  identificador unico. Onde o documento nao define, o validador nao inventa
  chave e nao checa duplicidade.

## Persistencia
O progresso fica no `localStorage`, na maquina do cliente — nada trafega pela
internet. O conteudo dos arquivos **nao** e guardado (prescricao de hospital
real passa facil de centenas de MB). O que persiste e:

- a resposta sobre quais views opcionais o cliente tem;
- o resultado de cada view ja validada (status, contagens, erros agrupados);
- o indice de chaves das views que servem de alvo de referencia cruzada, para
  os passos seguintes conferirem FK sem precisar do arquivo de novo.

O arquivo enviado numa etapa continua la se o cliente voltar e avancar de novo:
so sai quando ele manda outro ou clica em refazer.

O menu **Dados salvos** mostra o que esta guardado, permite exportar e
reimportar o progresso (para continuar em outra maquina) e refazer uma view.
Indice acima de 20 mil chaves nao cabe no armazenamento local: nesse caso a
view precisa ser reenviada junto das que dependem dela.

### View de Vias
E a unica view de parametro: **uma linha so**, com `TIPO` (`map-routes`),
`VALOR` (array JSON com todas as vias), `UPDATE_AT` e `UPDATE_BY`. As chaves
`id` e `value` que o Anexo I descreve ficam **dentro** do JSON, nao sao colunas.

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
A tela tem uma secao "Modelos para download" com um lote de exemplo por view
(CSV e JSON), coerente entre si — as chaves estrangeiras fecham entre as 15
views. Os modelos sao gerados a partir de `TEMPLATES` no `validator.js` e
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
Os testes validam os lotes de exemplos (CSV e JSON), o lote so com as views
essenciais, o caso de view essencial ausente e os modelos de download — tudo
com o mesmo motor do app.

```bash
npm install
npm test
```

## Estrutura
- `index.html`: pagina principal + CDN (React, AntD, Babel).
- `styles.css`: tema e layout.
- `app.js`: casca do app, estado do passo a passo e ligacao com a persistencia.
- `wizard.js`: telas do passo a passo (boas-vindas, etapa, relatorio, dados
  salvos, referencia).
- `storage.js`: persistencia local do progresso (`localStorage`).
- `validator.js`: transcricao do Anexo I (`VIEWS`), motor de validacao, dicas
  (`HINTS`) e modelos (`TEMPLATES`), compartilhado entre app e testes.
- `examples/`: exemplos CSV/JSON validos das 15 views.
- `imgs/`: favicon e logo.

## GitHub Pages
O deploy usa o branch `main` e a raiz do repo. O arquivo `.nojekyll` evita o Jekyll sobrescrever o `index.html`.
