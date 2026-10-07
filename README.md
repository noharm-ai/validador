# validador

Validador web standalone para arquivos CSV/JSON no padrao NoHarm.

## O que ele faz
- Mostra a **tela da NoHarm** recebendo o dado do cliente, para ele ver como o
  arquivo dele chega la antes de a integracao existir.
- Recebe as views descritas no **Anexo I do Contrato NoHarm - Integracao de Dados**.
- Valida estrutura e semantica dos dados.
- Aceita CSV ou JSON (lista plana de registros, sem hierarquia).
- Faz validacao cruzada entre chaves (ex.: prescricoes -> medicamentos, setores, unidades, frequencia).
- **Salva o progresso na maquina do cliente**, para ele parar e voltar depois.

## As telas
O menu tem 3 itens: **Inicio**, **Prescricao** e **Validacao**. Nao ha fila — a
tela de Prescricao e opcional e quem quiser vai direto validar as views.

1. **Inicio**: o que o validador faz e em que pe esta. Um cartao com a acao do
   momento (e o andamento das views essenciais) e dois ao lado: a tela de
   Prescricao e a lista de views.
2. **Prescricao**: a replica da tela da NoHarm, usada como receptora. O cliente
   arrasta a view de Prescricoes e Itens e ve, na hora, como o arquivo dele
   chega la. A partir dai a tela escala: mostra de quais cadastros aquela
   prescricao depende (medicamento, frequencia, unidade, setor) e confere, um a
   um, se a view cobre os codigos usados. Paciente, exames e evolucoes ficam em
   branco ate serem importados. **E opcional**: nada da validacao depende dela.
3. **Validacao**: a tela onde o trabalho acontece. Tem tudo em uma pagina:
   - **Soltar os arquivos todos de uma vez**, em qualquer lugar da tela. O
     validador reconhece cada um **pelas colunas**, nao pelo nome (que no
     export costuma ser `VW_NOHARM_01.csv`), valida e mostra, arquivo a
     arquivo, em qual view ele caiu. O que ele nao reconhecer fica na lista
     perguntando de qual view e; arquivo substituido por outro da mesma view
     aparece riscado dizendo quem ficou no lugar; e cada linha tem um "x" para
     remover o que foi mandado errado e um para **baixar o arquivo como foi
     enviado** — o que passou e o que falhou —, util quando o export saiu com
     nome generico e e preciso descobrir qual arquivo era qual. Clicar no
     "N problemas" leva direto ao problema.
   - **As 14 views nos tres grupos do Anexo I** (Cadastros, Paciente,
     Prescricao), em sanfona fechada. Grupo com erro abre sozinho. Cada linha
     traz a etiqueta **essencial** ou **opcional** — so as essenciais reprovam
     a validacao —, o estado, o arquivo que entrou, um "Enviar" para mandar so
     aquela view e o "campos e modelo", que abre a lista completa de campos com
     tipo, obrigatoriedade, descricao, um exemplo e os modelos CSV/JSON.
   - **O veredito no rodape**, com o "Exportar relatorio" (so liga com tudo
     aprovado) e o bloco do progresso salvo.
   As quatro views que a tela de Prescricao tambem recebe (prescricoes, pessoa,
   exames e evolucao) entram pelos dois lados, com um estado so: o que for
   enviado la ja aparece conferido aqui, e o que for enviado aqui monta a tela
   de Prescricao sozinho, sem segundo upload.
   **Nao e para exportar a view inteira**: o recomendado e um atendimento (ou
   poucos) e, nas views de Paciente e Prescricao, so as linhas desse mesmo
   atendimento — a prescricao, os exames e as evolucoes dele.
4. **`FKHOSPITAL = 1`**: as views que tem a coluna avisam isso no detalhe da
   linha, com um "por que?" que explica que o numero e da plataforma e nao do
   sistema do cliente. E a duvida que mais faz o cliente mexer na view e
   quebrar a integracao.

Erro nao impede seguir: quem escreve a view, num hospital, costuma ser outra
pessoa, entao o cliente percorre tudo e leva uma lista so.

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
internet. O conteudo dos arquivos **nao** e guardado: nem por tamanho
(prescricao de hospital real passa de centenas de MB), nem por privacidade —
nome, data de nascimento e diagnostico sao dado sensivel de saude e o navegador
de hospital costuma ser de estacao compartilhada. O que persiste e:

- a resposta sobre quais views opcionais o cliente tem;
- o resultado de cada view ja validada: status, contagens e a **mensagem** de
  cada erro — sem os valores vindos do arquivo. Os valores (a amostra de linhas
  e os exemplos de cada erro) ficam na tela enquanto a sessao vive e vao embora
  no reload;
- o indice de chaves das views que servem de alvo de referencia cruzada, para
  os passos seguintes conferirem FK sem precisar do arquivo de novo.

O arquivo enviado continua la se o cliente sair e voltar: so sai quando ele
manda outro, clica em remover ou apaga tudo. Dentro da sessao ele tambem pode
**baixar o arquivo de volta**, como foi enviado — depois de recarregar a pagina
isso nao existe mais, porque o conteudo nunca e guardado.

O rodape da tela de **Validacao** mostra o que esta guardado, permite exportar e
reimportar o progresso (para continuar em outra maquina) e apagar tudo.
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

## Seguranca
O validador le dado de paciente, entao:


- As libs de terceiro vem do CDN com **versao pinada e `integrity` (SRI)**: se
  o byte mudar, o browser se recusa a executar.
- Um **CSP** fecha a saida (`connect-src 'self'`, `img-src 'self' data:`):
  nenhum script da pagina consegue mandar dado para fora. Testado.
- **Nada de dado de paciente no `localStorage`** — so status, contagens e
  mensagens de erro. `npm test` reprova se um valor de arquivo for gravado.
- O **relatorio exportado** leva o status e os erros de cada view, sem dado de
  paciente.
- O app **nao faz nenhuma chamada de rede**.

## Como rodar local
Precisa de um servidor HTTP (nao funciona via file:// por causa do Babel).

```bash
cd /caminho/para/validador
python3 -m http.server 8000
```

Acesse:
```
http://localhost:8000/index.html
```

Os arquivos locais entram com `?v=N` no `index.html`. O Babel busca os `.js` por
XHR e o browser segura a versao antiga: mudou arquivo e a tela nao mudou junto,
suba o `N` (ou Ctrl+Shift+R).

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
- `wizard.js`: as telas do validador (inicio, validacao, relatorio, referencia).
- `noharm-ui.js` + `noharm-ui-exemplo.js` + `noharm-ui-icons.js` + `noharm-ui.css`:
  a tela de Prescricao, replica da tela da NoHarm.
- `storage.js`: persistencia local do progresso (`localStorage`).
- `validator.js`: transcricao do Anexo I (`VIEWS`), motor de validacao, dicas
  (`HINTS`) e modelos (`TEMPLATES`), compartilhado entre app e testes.
- `examples/`: exemplos CSV/JSON validos das 15 views.
- `imgs/`: favicon e logo.

## GitHub Pages
O deploy usa o branch `main` e a raiz do repo. O arquivo `.nojekyll` evita o Jekyll sobrescrever o `index.html`.
