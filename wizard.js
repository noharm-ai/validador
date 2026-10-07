// Telas do passo a passo. A regra aqui e: o cliente olha a tela e sabe o que
// fazer sem ler. Texto so quando muda a acao dele.

const {
  Layout: WLayout,
  Menu: WMenu,
  Button,
  Card,
  Upload,
  Typography,
  Row,
  Col,
  Tag,
  Space,
  Divider,
  Alert,
  Collapse,
  List,
  Table,
  Radio,
  Result,
  Empty,
  Popconfirm,
  Tooltip,
  Modal,
  Progress,
} = antd;

const {
  CloudUploadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  LoadingOutlined,
  RightOutlined,
  ReadOutlined,
  CloseOutlined,
} = icons;

// `app.js` tambem desestrutura hooks do React, mas ele carrega DEPOIS deste
// arquivo — e `const` no escopo global nao pode ser declarado duas vezes.
// Por isso aqui os hooks saem com outro nome, igual ao `Layout: WLayout`.
const { useState: useEstado, useRef: useRefer } = React;

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const Validator = window.NoHarmValidator;
const Storage = window.NoHarmStorage;
const FILE_TYPES = Validator ? Validator.FILE_TYPES : [];
const GROUPS = Validator ? Validator.GROUPS : [];
const NOHARM_SCHEMA = Validator ? Validator.NOHARM_SCHEMA : null;
const REFERENCED_FILES = Validator ? Validator.REFERENCED_FILES : [];

const isEssencial = (file) => file.criticality === "essencial";
const filesOfGroup = (groupKey) => FILE_TYPES.filter((file) => file.group === groupKey);
const groupLabel = (groupKey) => (GROUPS.find((group) => group.key === groupKey) || {}).label || groupKey;
const fileSchemaOf = (fileKey) => (NOHARM_SCHEMA ? NOHARM_SCHEMA.files[fileKey] : null);

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDateTime = (iso) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch (err) {
    return iso;
  }
};

const downloadText = (fileName, text, mime) => {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Devolve o arquivo exatamente como o cliente mandou. So funciona na sessao em
// que ele foi enviado: o conteudo dos arquivos nunca e guardado (prescricao de
// hospital real passa de centenas de MB), entao depois do reload nao ha o que
// baixar e o botao some.
const baixarArquivo = (arquivo) => {
  if (!arquivo) return;
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = arquivo.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadTemplate = (fileKey, format) => {
  if (!Validator) return;
  const text = format === "json" ? Validator.buildTemplateJson(fileKey) : Validator.buildTemplateCsv(fileKey);
  if (!text) return;
  downloadText(
    Validator.getTemplateFileName(fileKey, format),
    text,
    format === "json" ? "application/json" : "text/csv"
  );
};

// Exemplos mostrados por tipo de problema. O motor guarda ate 5, ja
// deduplicados por valor nas regras que comparam valor.
const MAX_SAMPLES_SHOWN = 5;

// Valores mostrados no bloco de erro. Sao chips curtos, cabe mais que amostra
// em texto.
const MAX_VALORES_NO_ERRO = 12;

// Ordena numerico quando da, alfabetico quando nao da: a lista e para o cliente
// conferir e colar no filtro da view.
const ordenarValores = (valores) =>
  valores.slice().sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });

const STATUS_META = {
  ok: { className: "is-ok", label: "Validado" },
  warn: { className: "is-warn", label: "Alertas" },
  error: { className: "is-error", label: "Erros" },
  skipped: { className: "is-skipped", label: "Pulada" },
  pending: { className: "is-pending", label: "Pendente" },
};

const statusIcon = (status) => {
  if (status === "ok") return <CheckCircleFilled />;
  if (status === "warn") return <CheckCircleFilled />;
  if (status === "error") return <CloseCircleFilled />;
  return <MinusCircleOutlined />;
};

// Nome curto para o trilho e para o titulo do passo.
const SHORT_LABEL = {
  hospitais: "Hospitais",
  setores: "Setores",
  unidades: "Unidades",
  frequencia: "Frequências",
  vias: "Vias",
  medicamentos: "Medicamentos",
  prescricao_agrupada: "Prescrições agrupadas",
  pessoa: "Pacientes",
  exame: "Exames",
  cultura: "Culturas",
  alergia: "Alergias",
  evolucao: "Evoluções",
  transferencia: "Transferências",
  prescricoes: "Prescrições",
  conciliacao: "Conciliação",
};

// Uma linha, so onde evita uma duvida real. Onde o nome ja diz, fica vazio.
const STEP_HINT = {
  unidades: "O identificador é a sigla (MG, ML, AMP C/10ML), não o ID da tabela.",
  frequencia: "O identificador é a sigla (8/8, 12/12), não o ID da tabela.",
  vias: "Uma linha só: todas as vias vao no array JSON da coluna VALOR.",
  conciliacao: "Item sem cadastro associado vai com FKMEDICAMENTO = 0.",
  pessoa: "Escolha um atendimento e exporte só ele. As próximas views são desse mesmo atendimento.",
  prescricoes: "Do mesmo atendimento. Conferida contra tudo que você já enviou.",
};

// ---------------------------------------------------------------------------
// Campos da view
// ---------------------------------------------------------------------------

const FIELD_COLUMNS = [
  { title: "Campo", dataIndex: "name", key: "name", width: "24%", render: (name) => <Text code>{name}</Text> },
  { title: "Tipo", dataIndex: "type", key: "type", width: "16%" },
  {
    title: "Obrigatório",
    dataIndex: "required",
    key: "required",
    width: "14%",
    render: (required) => (required ? <Tag color="red">Sim</Tag> : <Tag>Não</Tag>),
  },
  { title: "Descrição", dataIndex: "description", key: "description" },
];

function FieldsTable({ fileKey }) {
  const schema = fileSchemaOf(fileKey);
  if (!schema) return null;
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="name"
      columns={FIELD_COLUMNS}
      dataSource={schema.fields}
      scroll={{ x: 620 }}
    />
  );
}

// Os campos obrigatorios como etiquetas. Passar o mouse mostra tipo e descricao,
// o que evita um paragrafo explicando cada um.
function RequiredChips({ fileKey, onShowAll }) {
  const schema = fileSchemaOf(fileKey);
  const required = schema.fields.filter((field) => field.required);
  const opcionais = schema.fields.length - required.length;

  return (
    <div className="nh-chips">
      {required.map((field) => (
        <Tooltip key={field.name} title={`${field.type} — ${field.description}`}>
          <span className="nh-chip">{field.name}</span>
        </Tooltip>
      ))}
      {opcionais > 0 && (
        <button type="button" className="nh-chip-more" onClick={onShowAll}>
          +{opcionais} opcionais <RightOutlined />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amostra: as primeiras linhas, so com as colunas que a NoHarm usa
// ---------------------------------------------------------------------------

function PreviewTable({ preview, recordCount }) {
  if (!preview || !preview.rows.length) return null;

  return (
    <div className="nh-preview">
      <div className="nh-preview-head">
        <span className="nh-label">Assim a NoHarm vai ler</span>
        <span className="nh-preview-meta">
          {preview.usedColumns} colunas usadas
          {preview.totalColumns - preview.usedColumns > 0
            ? ` · ${preview.totalColumns - preview.usedColumns} ignoradas`
            : ""}
        </span>
      </div>
      <div className="nh-preview-scroll">
        <table>
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} title={cell}>
                    {cell === "" ? <span className="nh-preview-empty">vazio</span> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {recordCount > preview.rows.length && (
        <div className="nh-preview-foot">
          primeiras {preview.rows.length} de {recordCount} linhas
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultado do passo
// ---------------------------------------------------------------------------

function StepResult({ result, onFixRef }) {
  if (!result) return null;
  const { status, issueGroups = [], hints = [], warnings = [], extraFields = [] } = result;

  if (status === "ok" || status === "warn") {
    return (
      <>
        <div className="nh-result is-ok">
          <CheckCircleFilled />
          <div>
            <strong>
              {result.recordCount} {result.recordCount === 1 ? "registro validado" : "registros validados"}
            </strong>
            {warnings.map((warning) => (
              <div className="nh-result-note" key={warning}>
                {warning}
              </div>
            ))}
          </div>
        </div>
        <PreviewTable preview={result.preview} recordCount={result.recordCount} />
      </>
    );
  }

  // O cabecalho conta TIPOS de problema, que é o que a lista abaixo mostra.
  // Contar ocorrencias aqui fazia parecer que faltavam linhas na lista: "2
  // problemas" com um item so na tela.
  const tipos = issueGroups.length;
  const ocorrencias = result.issueCount || tipos;

  return (
    <div className="nh-result is-error">
      <div className="nh-result-head">
        <CloseCircleFilled />
        <strong>
          {tipos} {tipos === 1 ? "problema" : "problemas"}
        </strong>
        {ocorrencias > tipos && <span className="nh-result-count">em {ocorrencias} ocorrencias</span>}
      </div>

      <ul className="nh-issues">
        {issueGroups.map((group) => {
          // Quando a regra deduplica por valor, o util e ver QUAIS valores estao
          // quebrados — o numero da linha nao e o que o cliente conserta. Sem
          // deduplicacao (erro de arquivo inteiro, tamanho de campo) ficam as
          // amostras em texto, que ai apontam a linha mesmo.
          const valores = group.distinctValues || [];
          const mostrados = valores.slice(0, MAX_VALORES_NO_ERRO);
          const sobrando = (group.distinctCount || valores.length) - mostrados.length;
          const exemplos = valores.length ? [] : (group.samples || []).slice(0, MAX_SAMPLES_SHOWN);
          const sobrandoTexto = exemplos.length ? group.count - exemplos.length : 0;

          return (
            <li key={group.message}>
              <div className="nh-issue-top">
                <span className="nh-issue-msg">{group.message}</span>
                {group.count > 1 && <span className="nh-issue-count">{group.count}x</span>}
              </div>

              {mostrados.length > 0 && (
                <>
                  <div className="nh-issue-sub">
                    {group.distinctCount}{" "}
                    {group.refFile
                      ? `${group.distinctCount === 1 ? "valor" : "valores"} sem correspondencia`
                      : group.distinctCount === 1
                      ? "valor diferente"
                      : "valores diferentes"}
                    :
                  </div>
                  <div className="nh-issue-values">
                    {ordenarValores(mostrados).map((valor) => (
                      <span className="nh-chip" key={valor}>
                        {valor}
                      </span>
                    ))}
                    {sobrando > 0 && <span className="nh-chip is-more">+{sobrando}</span>}
                  </div>
                </>
              )}

              {exemplos.map((sample, index) => (
                <div className="nh-issue-sample" key={index}>
                  {sample}
                </div>
              ))}
              {sobrandoTexto > 0 && (
                <div className="nh-issue-sample nh-issue-more">
                  e mais {sobrandoTexto} {sobrandoTexto === 1 ? "ocorrencia" : "ocorrencias"}
                </div>
              )}

              {/* O arquivo a corrigir e outro, la atras. O atalho leva direto na
                  etapa dele, com a lista do que falta, e volta para ca depois. */}
              {group.refFile && onFixRef && (
                <Button
                  className="nh-fix"
                  size="small"
                  danger
                  icon={<ArrowRightOutlined />}
                  iconPosition="end"
                  onClick={() => onFixRef(group)}
                >
                  Corrigir {SHORT_LABEL[group.refFile] || group.refFile}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {hints.length > 0 && (
        <div className="nh-why">
          {hints.map((hint) => (
            <details key={hint.key}>
              <summary>{hint.title}</summary>
              <p>{hint.detail}</p>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boas-vindas
// ---------------------------------------------------------------------------

function WelcomeScreen({ progress, onStart, onResume, onRestart }) {
  const hasProgress = Storage && Storage.hasProgress(progress);

  return (
    <div className="nh-welcome">
      <img src="imgs/logo192.png" alt="NoHarm" className="nh-welcome-logo" />
      <h1>Validador NoHarm</h1>
      <p className="nh-welcome-sub">Vamos conferir seus dados antes da integração.</p>

      {hasProgress ? (
        <Space direction="vertical" size={12} className="nh-welcome-actions">
          <Button type="primary" size="large" onClick={onResume} icon={<ArrowRightOutlined />}>
            Continuar
          </Button>
          <Popconfirm
            title="Apagar o progresso e recomeçar?"
            okText="Apagar"
            cancelText="Cancelar"
            onConfirm={onRestart}
          >
            <Button type="text">Começar do zero</Button>
          </Popconfirm>
        </Space>
      ) : (
        <div className="nh-welcome-actions">
          <Button type="primary" size="large" onClick={onStart} icon={<ArrowRightOutlined />}>
            Começar
          </Button>
        </div>
      )}

      <div className="nh-welcome-meta">CSV ou JSON · nada sai da sua rede</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// As views da Base nao dependem de nada, nem entre si.
const VIEWS_BASE = FILE_TYPES.filter((file) => file.group === "cadastros").map((file) => file.key);

// As quatro views que a tela de Prescricao recebe. Elas continuam aparecendo
// na Validacao, dentro do grupo delas — o cliente precisa ver os tres grupos
// inteiros —, mas como atalho para aquela tela, nao como um segundo upload.
const VIEWS_NA_PRESCRICAO = ["prescricoes", "pessoa", "exame", "evolucao"];

// Tudo que a tela de Prescricao consome: as quatro acima mais os cadastros,
// de que ela precisa para trocar codigo por nome (FKMEDICAMENTO -> "DIPIRONA
// ...") e para dizer se a view cobre os codigos usados.
const VIEWS_DA_PRESCRICAO = VIEWS_NA_PRESCRICAO.concat([
  "medicamentos",
  "frequencia",
  "unidades",
  "setores",
  "hospitais",
  "vias",
]);

// Os grupos sao os do Anexo I (`GROUPS`), com o texto que o cliente le. Nao
// invente agrupamento proprio: o cliente recebeu o documento com estes tres.
const GRUPOS_VALIDACAO = [
  {
    key: "cadastros",
    titulo: "Cadastros",
    sub: "As tabelas de domínio que o resto da integração referência. Envie na ordem que quiser.",
  },
  {
    key: "pacientes",
    titulo: "Paciente",
    sub: "Quem está internado e o que foi registrado no atendimento.",
  },
  {
    key: "prescricoes",
    titulo: "Prescrição",
    sub: "O que foi prescrito para o paciente.",
  },
];

const viewsDoGrupo = (groupKey) =>
  FILE_TYPES.filter((file) => file.group === groupKey).map((file) => file.key);
const VIEWS_MOVIMENTO = FILE_TYPES.filter(
  (file) => file.group !== "cadastros" && !VIEWS_NA_PRESCRICAO.includes(file.key)
).map((file) => file.key);

// Sobrou so para a tela `steps` do desvio de chave estrangeira.
const FASES = [
  { key: "base", label: "Validação" },
  { key: "movimento", label: "Correção" },
];

function Timeline({ fase, position, total }) {
  const atual = FASES.findIndex((item) => item.key === fase);

  return (
    <ol className="nh-timeline">
      {FASES.map((item, index) => (
        <li key={item.key} className={index < atual ? "is-done" : index === atual ? "is-current" : ""}>
          <i>{index < atual ? <CheckCircleFilled /> : index + 1}</i>
          <span>{item.label}</span>
          {index === atual && total > 0 && (
            <em>
              {position} de {total}
            </em>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Fase 1: a Base numa tela so
// ---------------------------------------------------------------------------
//
// Seis views independentes. O cliente envia na ordem que quiser, ve o escopo
// inteiro de cara e clica num cartao para abrir o detalhe.

// Uma linha por view, nao um cartao. Com o reconhecimento pelo cabecalho, a
// zona de lote la em cima ja manda cada arquivo para a view certa — inclusive
// um arquivo so. Entao 14 dropzones viraram 14 alvos redundantes ocupando a
// tela inteira. A linha guarda o que importa (o que e, em que pe esta) e leva
// as acoes como texto, nao como bloco.
function BaseRow({
  file,
  saved,
  busy,
  aberto,
  naPrescricao,
  onUpload,
  onToggle,
  onShowFields,
  onExplainHospital,
  onRemover,
  arquivo,
  onFixRef,
  correcao,
}) {
  const schema = fileSchemaOf(file.key);
  const status = saved ? saved.status : "pending";
  const obrigatorios = schema.fields.filter((campo) => campo.required).length;
  const essencial = isEssencial(file);

  const info = saved
    ? status === "error"
      ? `${saved.issueCount} ${saved.issueCount === 1 ? "problema" : "problemas"}`
      : `${saved.recordCount} ${saved.recordCount === 1 ? "registro" : "registros"}`
    : `${obrigatorios} campos obrigatórios`;

  return (
    <li id={`view-${file.key}`} className={`nh-view ${saved ? status : "vazio"} ${aberto ? "is-open" : ""}`}>
      <button
        type="button"
        className="nh-view-corpo"
        onClick={saved ? onToggle : () => onShowFields(file.key)}
      >
        <span className="nh-view-estado">
          {busy ? <LoadingOutlined /> : saved ? statusIcon(status) : <span className="nh-view-ponto" />}
        </span>
        <span className="nh-view-nome">{SHORT_LABEL[file.key]}</span>
        {/* O cliente nao precisa mandar as 14: a etiqueta diz quais reprovam a
            validacao se faltarem e quais ele manda so se tiver. */}
        <span className={`nh-tag ${essencial ? "essencial" : "opcional"}`}>
          {essencial ? "essencial" : "opcional"}
        </span>
        <span className="nh-view-info">{info}</span>
        {saved && <span className="nh-view-arquivo">{saved.fileName}</span>}
        {!saved && naPrescricao && <span className="nh-view-nota">entra também pela tela de Prescrição</span>}
      </button>

      <span className="nh-view-acoes">
        <button type="button" className="nh-linkish" onClick={() => onShowFields(file.key)}>
          campos e modelo
        </button>
        <Upload
          accept=".csv,.json"
          showUploadList={false}
          beforeUpload={(arquivo) => onUpload(file.key, arquivo)}
          disabled={busy}
        >
          <Button size="small">{saved ? "Reenviar" : "Enviar"}</Button>
        </Upload>
        {arquivo && (
          <button
            type="button"
            className="nh-view-baixar"
            title={`Baixar ${arquivo.name} como foi enviado`}
            onClick={() => baixarArquivo(arquivo)}
          >
            <DownloadOutlined />
          </button>
        )}
        {/* Mandou o arquivo errado? Tira. Sem isso o jeito de desfazer era
            apagar o progresso inteiro. */}
        {saved && (
          <Popconfirm
            title={`Remover o arquivo de ${SHORT_LABEL[file.key]}?`}
            okText="Remover"
            cancelText="Cancelar"
            onConfirm={onRemover}
          >
            <button type="button" className="nh-view-remover" title="Remover este arquivo">
              <CloseOutlined />
            </button>
          </Popconfirm>
        )}
      </span>

      {/* O detalhe abre na propria linha. Antes ele ia para o rodape da tela e
          o cliente clicava numa view e a resposta aparecia 800px abaixo. */}
      {/* Chegou aqui pelo "Corrigir <View>" de outra view: a etapa de destino
          nao diz so "corrija", ela lista os valores que faltam, ordenados para
          o cliente colar no filtro da view. */}
      {correcao && (
        <div className="nh-view-correcao">
          <strong>
            Inclua {correcao.valores.length}{" "}
            {correcao.valores.length === 1 ? "valor" : "valores"} em {correcao.refField}
          </strong>
          <span>
            {SHORT_LABEL[correcao.origem]} usa {correcao.valores.length === 1 ? "este codigo" : "estes codigos"}{" "}
            e esta view nao traz:
          </span>
          <div className="nh-issue-values">
            {ordenarValores(correcao.valores).map((valor) => (
              <span className="nh-chip" key={valor}>
                {valor}
              </span>
            ))}
          </div>
          <span className="nh-view-correcao-dica">
            Normalmente e o filtro da view que esta estreito demais (`WHERE`). Reenvie depois de ajustar —
            {" "}{SHORT_LABEL[correcao.origem]} e revalidada sozinha.
          </span>
        </div>
      )}

      {aberto && saved && (
        <div className="nh-view-detalhe">
          {schema.allowed.includes("FKHOSPITAL") && !schema.fkhospitalLivre && (
            <div className="nh-step-fields-note">
              <strong>FKHOSPITAL = {Validator.FKHOSPITAL_FIXO}</strong>, sempre.{" "}
              <button type="button" className="nh-linkish" onClick={onExplainHospital}>
                por que?
              </button>
            </div>
          )}
          <StepResult result={saved} onFixRef={onFixRef} />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Zona de lote: o cliente solta os arquivos todos de uma vez
// ---------------------------------------------------------------------------
//
// Pesquisa de upload (PatternFly, SaaSUI) converge em tres coisas que valem
// aqui:
//
// 1. **Uma zona para o lote**, nao uma por arquivo. Quem tem os 14 exports
//    numa pasta nao quer acertar 14 alvos — solta tudo e o sistema resolve.
//    As zonas por view continuam, para quem tem um arquivo so ou esta
//    refazendo um.
// 2. **Estado por arquivo, nunca um veredito do lote.** "Falhou" numa barra so,
//    escondendo quais entraram e quais nao, e o modo classico de falhar.
// 3. **Nada sumir em silencio.** Arquivo que o validador nao reconhece aparece
//    na lista pedindo para o cliente dizer de qual view e.
function LoteDrop({
  ocupado,
  vazio,
  progresso,
  resultados,
  onLote,
  onEscolher,
  onLimpar,
  onExplicarRecorte,
  onIrParaView,
  onRemover,
}) {
  const reconhecidos = resultados.filter((item) => item.key);

  const seletor = (
    <Upload
      multiple
      accept=".csv,.json"
      showUploadList={false}
      disabled={ocupado}
      beforeUpload={(arquivo, lista) => {
        if (arquivo === lista[0]) onLote(lista);
        return false;
      }}
    >
      <Button type={vazio ? "primary" : "default"} size={vazio ? "large" : "middle"} disabled={ocupado}>
        Selecionar os arquivos
      </Button>
    </Upload>
  );

  return (
    <section className="nh-lote">
      {/* Sem nada enviado, o caminho de mandar tudo junto e o principal e fala
          alto. Depois da primeira leva ele encolhe para uma barra: a acao ja
          aconteceu e quem manda na tela passa a ser o estado das views. */}
      {vazio && !ocupado ? (
        <div className="nh-lote-convite">
          <span className="nh-lote-icone">
            <CloudUploadOutlined />
          </span>
          <h3>Já tem as views prontas no banco? Mande todas de uma vez.</h3>
          <p>
            Exporte as {FILE_TYPES.length} views e solte os arquivos aqui — ou em qualquer lugar desta tela.
            Não precisa mandar uma a uma nem dizer qual é qual: o validador reconhece cada arquivo pelas
            colunas e valida na hora. CSV ou JSON.
          </p>
          {seletor}
          <button type="button" className="nh-linkish" onClick={onExplicarRecorte}>
            Quanto dado exportar de cada view?
          </button>
        </div>
      ) : (
        <div className={`nh-lote-barra${ocupado ? " ocupado" : ""}`}>
          <span className="nh-lote-icone">{ocupado ? <LoadingOutlined /> : <CloudUploadOutlined />}</span>
          <span className="nh-lote-texto">
            {ocupado ? (
              <strong>
                Validando {progresso.feito} de {progresso.total}...
              </strong>
            ) : (
              <>
                <strong>Mande mais arquivos: solte em qualquer lugar desta tela.</strong>
                <i>
                  Pode ser tudo de uma vez — o validador reconhece cada um pelas colunas.{" "}
                  <button type="button" className="nh-linkish" onClick={onExplicarRecorte}>
                    Quanto dado exportar?
                  </button>
                </i>
              </>
            )}
          </span>
          {seletor}
        </div>
      )}

      {ocupado && (
        <Progress percent={Math.round((progresso.feito / progresso.total) * 100)} showInfo={false} />
      )}

      {!ocupado && resultados.length > 0 && (
        <div className="nh-lote-saida">
          <div className="nh-lote-saida-topo">
            <strong>
              {reconhecidos.length} de {resultados.length}{" "}
              {resultados.length === 1 ? "arquivo reconhecido" : "arquivos reconhecidos"}
            </strong>
            <button type="button" className="nh-linkish" onClick={onLimpar}>
              fechar
            </button>
          </div>
          <ul>
            {resultados.map((item, index) => (
              <li
                key={index}
                className={`${item.key ? item.status : "sem-dono"}${
                  item.substituidoPor || item.removido ? " substituido" : ""
                }`}
              >
                <span className="nh-lote-arquivo">{item.nome}</span>
                {item.removido ? (
                  <span className="nh-lote-destino sem-acao">
                    <i>removido</i>
                  </span>
                ) : item.substituidoPor ? (
                  <span className="nh-lote-destino">
                    <i>
                      {SHORT_LABEL[item.key]} ficou com <b>{item.substituidoPor}</b>
                    </i>
                  </span>
                ) : item.key ? (
                  <span className="nh-lote-acoes">
                    {/* Clicar aqui abre o grupo, abre o detalhe da view e
                        rola ate ela: o cliente ve "1 problema" e quer o
                        problema, nao a informacao de que ele existe. */}
                    <button
                      type="button"
                      className="nh-lote-destino"
                      onClick={() => onIrParaView(item.key)}
                      title={item.status === "error" ? "Ver o problema" : "Ver a view"}
                    >
                      {statusIcon(item.status)} {SHORT_LABEL[item.key]}
                      <i>
                        {item.status === "error"
                          ? `${item.issueCount} ${item.issueCount === 1 ? "problema" : "problemas"}`
                          : `${item.recordCount} ${item.recordCount === 1 ? "registro" : "registros"}`}
                      </i>
                    </button>
                    {item.file && (
                      <button
                        type="button"
                        className="nh-lote-remover"
                        title={`Baixar ${item.nome} como foi enviado`}
                        onClick={() => baixarArquivo(item.file)}
                      >
                        <DownloadOutlined />
                      </button>
                    )}
                    <Popconfirm
                      title={`Remover o arquivo de ${SHORT_LABEL[item.key]}?`}
                      okText="Remover"
                      cancelText="Cancelar"
                      onConfirm={() => onRemover(item.key)}
                    >
                      <button type="button" className="nh-lote-remover" title="Remover este arquivo">
                        <CloseOutlined />
                      </button>
                    </Popconfirm>
                  </span>
                ) : (
                  <span className="nh-lote-escolha">
                    <em>não reconheci — de qual view e?</em>
                    <select defaultValue="" onChange={(evento) => onEscolher(index, evento.target.value)}>
                      <option value="" disabled>
                        escolher a view
                      </option>
                      {FILE_TYPES.map((file) => (
                        <option key={file.key} value={file.key}>
                          {SHORT_LABEL[file.key]}
                        </option>
                      ))}
                    </select>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BaseScreen({
  progress,
  busy,
  aberto,
  desvio,
  lote,
  onLote,
  onEscolherDoLote,
  onLimparLote,
  onUpload,
  onToggle,
  onContinue,
  onShowFields,
  onExplainHospital,
  onExplicarRecorte,
  onIrPrescricao,
  onRemover,
  arquivos,
  resultados,
  onExport,
  onClear,
  onExportProgress,
  onImportProgress,
}) {
  // A barra de upload e pequena de proposito (a acao acontece uma vez), entao
  // quem recebe o arrasto e a **tela inteira**: o cliente nao precisa mirar.
  // O contador existe porque dragenter/dragleave disparam tambem nos filhos.
  const [arrastando, setArrastando] = useEstado(false);
  const profundidade = useRefer(0);

  const temArquivos = (evento) =>
    Array.from((evento.dataTransfer && evento.dataTransfer.types) || []).includes("Files");

  const aoEntrar = (evento) => {
    if (!temArquivos(evento)) return;
    profundidade.current += 1;
    setArrastando(true);
  };

  const aoSair = () => {
    profundidade.current = Math.max(0, profundidade.current - 1);
    if (profundidade.current === 0) setArrastando(false);
  };

  const aoSoltar = (evento) => {
    if (!temArquivos(evento)) return;
    evento.preventDefault();
    profundidade.current = 0;
    setArrastando(false);
    onLote(evento.dataTransfer.files);
  };

  const enviadasTotal = FILE_TYPES.filter((file) => progress.steps[file.key]).length;

  // Grupo com erro fica sempre aberto; os outros o cliente abre se quiser.
  // Uniao em vez de "ou": assim um erro novo aparece mesmo depois de ele ter
  // mexido na sanfona.
  const [abertosManual, setAbertosManual] = useEstado([]);
  const gruposComErro = GRUPOS_VALIDACAO.filter((grupo) =>
    viewsDoGrupo(grupo.key).some((key) => progress.steps[key] && progress.steps[key].status === "error")
  ).map((grupo) => grupo.key);

  const abertos = Array.from(new Set(gruposComErro.concat(abertosManual)));

  // O que a tela mostra = o resultado em memoria (completo, com amostra e
  // valores) quando existe, senao o gravado (sem valor nenhum, por LGPD).
  // Depois de recarregar o cliente ve status e mensagens, nao o dado.
  const detalhe = (fileKey) => resultados[fileKey] || progress.steps[fileKey];

  // O "Corrigir <View>" de um erro de chave estrangeira: guarda o que falta e
  // leva para a view que tem de incluir aqueles valores.
  const [correcao, setCorrecao] = useEstado(null);
  const aoCorrigirRef = (grupo, origem) => {
    if (!grupo || !grupo.refFile) return;
    setCorrecao({
      fileKey: grupo.refFile,
      refField: grupo.refField || "a chave",
      valores: grupo.distinctValues || [],
      origem,
    });
    irParaView(grupo.refFile);
  };

  // Abre o grupo da view, abre o detalhe dela e rola ate la.
  const irParaView = (fileKey) => {
    const grupo = GRUPOS_VALIDACAO.find((item) => viewsDoGrupo(item.key).includes(fileKey));
    if (grupo) {
      setAbertosManual((atual) => (atual.includes(grupo.key) ? atual : atual.concat(grupo.key)));
    }
    onToggle(fileKey);
    window.setTimeout(() => {
      const alvo = document.getElementById(`view-${fileKey}`);
      if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };
  // O veredito e o do Anexo I: essencial ausente reprova, opcional ausente nao.
  const essenciais = FILE_TYPES.filter(isEssencial).map((file) => file.key);
  const faltamEssenciais = essenciais.filter((key) => !progress.steps[key]).length;
  const comErro = FILE_TYPES.filter(
    (file) => progress.steps[file.key] && progress.steps[file.key].status === "error"
  );
  const aprovado = faltamEssenciais === 0 && comErro.length === 0;

  return (
    <div
      className={`nh-base${arrastando ? " arrastando" : ""}`}
      onDragEnter={aoEntrar}
      onDragOver={(evento) => temArquivos(evento) && evento.preventDefault()}
      onDragLeave={aoSair}
      onDrop={aoSoltar}
    >
      {arrastando && (
        <div className="nh-base-alvo">
          <CloudUploadOutlined /> Solte os arquivos para validar
        </div>
      )}

      <header className="nh-base-head">
        <div>
          <h2>Validação</h2>
          <p>As {FILE_TYPES.length} views do Anexo I, nos tres grupos do documento.</p>
        </div>
      </header>

      <LoteDrop
        ocupado={lote.ocupado}
        vazio={enviadasTotal === 0}
        progresso={lote.progresso}
        resultados={lote.resultados}
        onLote={onLote}
        onEscolher={onEscolherDoLote}
        onLimpar={onLimparLote}
        onExplicarRecorte={onExplicarRecorte}
        onIrParaView={irParaView}
        onRemover={onRemover}
      />

      {/* Sanfona na mao, sem o `Collapse` do AntD. O controlado trava: o
          rc-motion reinicia a animacao a cada render do `BaseScreen` (que
          re-renderiza no arrasto) e o painel fica aberto com 1px de altura.
          Aqui nao ha animacao e nao ha o que travar.

          Os grupos vem fechados: o que o cliente tem para fazer e mandar os
          arquivos, e 14 linhas abertas competiam com isso. Grupo com erro abre
          sozinho e nao fecha — e justamente o que ele precisa ver. */}
      <div className="nh-grupos">
        {GRUPOS_VALIDACAO.map((grupo) => {
          const views = viewsDoGrupo(grupo.key).map((key) => FILE_TYPES.find((file) => file.key === key));
          const essenciaisDoGrupo = views.filter(isEssencial);
          const enviadas = essenciaisDoGrupo.filter((file) => progress.steps[file.key]).length;
          const opcionaisDoGrupo = views.filter((file) => !isEssencial(file));
          const opcionaisFeitas = opcionaisDoGrupo.filter((file) => progress.steps[file.key]).length;
          const erros = views.filter(
            (file) => progress.steps[file.key] && progress.steps[file.key].status === "error"
          ).length;
          const aberto_ = abertos.includes(grupo.key);

          return (
            <section key={grupo.key} className={`nh-grupo${aberto_ ? " aberto" : ""}`}>
              <button
                type="button"
                className="nh-grupo-head"
                aria-expanded={aberto_}
                onClick={() =>
                  setAbertosManual((atual) =>
                    atual.includes(grupo.key)
                      ? atual.filter((chave) => chave !== grupo.key)
                      : atual.concat(grupo.key)
                  )
                }
              >
                <RightOutlined className="nh-grupo-seta" />
                <span className="nh-grupo-nome">{grupo.titulo}</span>
                <span className="nh-grupo-conta">
                  {erros > 0 && <em>{erros} com problema</em>}
                  <span className="nh-base-contador">
                    {enviadas} de {essenciaisDoGrupo.length} essenciais
                    {opcionaisDoGrupo.length > 0 && (
                      <i>
                        {" · "}
                        {opcionaisFeitas} de {opcionaisDoGrupo.length} opcionais
                      </i>
                    )}
                  </span>
                </span>
              </button>

              {aberto_ && (
                <ul className="nh-view-lista">
                  {views.map((file) => (
                    <BaseRow
                      key={file.key}
                      file={file}
                      saved={detalhe(file.key)}
                      busy={busy === file.key}
                      aberto={aberto === file.key}
                      naPrescricao={VIEWS_NA_PRESCRICAO.includes(file.key)}
                      onUpload={onUpload}
                      onToggle={() => onToggle(aberto === file.key ? null : file.key)}
                      onShowFields={onShowFields}
                      onExplainHospital={onExplainHospital}
                      onRemover={() => onRemover(file.key)}
                      arquivo={arquivos[file.key]}
                      onFixRef={(grupo) => aoCorrigirRef(grupo, file.key)}
                      correcao={correcao && correcao.fileKey === file.key ? correcao : null}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* O veredito mora aqui, no fim da lista que ele resume. Antes era uma
          tela de Resultado que repetia as 14 views com o mesmo status — a
          mesma informacao em dois lugares. */}
      <footer className={`nh-veredito ${aprovado ? "ok" : "pendente"}`}>
        <span className="nh-veredito-icone">{aprovado ? <CheckCircleFilled /> : <CloseCircleFilled />}</span>
        <span className="nh-veredito-texto">
          <strong>{aprovado ? "Dados aprovados" : "Ainda falta coisa"}</strong>
          <i>
            {aprovado
              ? "Exporte o relatório e envie para a NoHarm. Ele leva o status e os erros de cada view, sem nenhum dado de paciente."
              : faltamEssenciais > 0
                ? `${faltamEssenciais} ${faltamEssenciais === 1 ? "view essencial" : "views essenciais"} sem enviar` +
                  (comErro.length ? ` · ${comErro.length} com problema` : "")
                : `${comErro.length} ${comErro.length === 1 ? "view precisa" : "views precisam"} de correção`}
          </i>
        </span>
        <Space size={8}>
          {desvio && (
            <Button icon={<ArrowLeftOutlined />} onClick={onContinue}>
              Voltar para {SHORT_LABEL[desvio.voltarPara]}
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            disabled={!aprovado}
            onClick={onExport}
          >
            Exportar relatório
          </Button>
        </Space>
      </footer>

      {/* O progresso guardado: mesma informacao que ficava no rodape do
          Resultado. */}
      <div className="nh-review-rodape">
        <span>
          Salvo neste navegador: o resultado de cada view e as chaves usadas para cruzar as referências
          (ex.: números de atendimento). <strong>O conteúdo dos arquivos não é guardado</strong> — nem nome,
          nem data de nascimento, nem diagnóstico.
        </span>
        <Space size={4} wrap>
          <Button type="text" size="small" onClick={onExportProgress}>
            exportar progresso
          </Button>
          <Upload accept=".json" showUploadList={false} beforeUpload={onImportProgress}>
            <Button type="text" size="small">
              reimportar
            </Button>
          </Upload>
          <Popconfirm title="Apagar tudo e recomeçar?" okText="Apagar" cancelText="Cancelar" onConfirm={onClear}>
            <Button type="text" size="small" danger>
              apagar tudo
            </Button>
          </Popconfirm>
        </Space>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pergunta: quais dados opcionais o cliente tem
// ---------------------------------------------------------------------------

function AskStep({ groupKey, options, chosen, onToggle, onContinue, onBack }) {
  const pergunta =
    groupKey === "prescricoes" ? "Você tem conciliação medicamentosa?" : "Quais desses dados você tem?";

  return (
    <div className="nh-ask">
      <h2>{pergunta}</h2>
      <p className="nh-ask-sub">Marque o que o hospital consegue extrair. Dá para mudar depois.</p>

      <div className="nh-ask-options">
        {options.map((fileKey) => {
          const marcado = chosen.includes(fileKey);
          return (
            <button
              type="button"
              key={fileKey}
              className={`nh-ask-option ${marcado ? "is-on" : ""}`}
              onClick={() => onToggle(fileKey)}
            >
              <i>{marcado ? <CheckCircleFilled /> : <span className="nh-ask-box" />}</i>
              {SHORT_LABEL[fileKey]}
            </button>
          );
        })}
      </div>

      <footer className="nh-step-foot">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Voltar
        </Button>
        <Space size={8}>
          {chosen.length === 0 && (
            <span className="nh-ask-nota">Não marcou nenhum? Segue sem eles.</span>
          )}
          <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={onContinue}>
            Continuar
          </Button>
        </Space>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Faixa do desvio: o cliente veio corrigir esta view por causa de outra etapa.
// Em vez de so dizer "corrija", lista exatamente o que falta incluir.
// ---------------------------------------------------------------------------

const MAX_VALORES_MOSTRADOS = 20;

function DetourBanner({ desvio }) {
  const valores = ordenarValores(desvio.valores || []);
  const mostrados = valores.slice(0, MAX_VALORES_MOSTRADOS);
  const restantes = (desvio.total || valores.length) - mostrados.length;

  return (
    <div className="nh-detour">
      <div className="nh-detour-head">
        Corrigindo para <strong>{SHORT_LABEL[desvio.voltarPara]}</strong>
      </div>
      {mostrados.length > 0 ? (
        <div className="nh-detour-body">
          Inclua na view {desvio.campo ? <Text code>{desvio.campo}</Text> : "os valores"} que faltam:
          <div className="nh-detour-valores">
            {mostrados.map((valor) => (
              <span className="nh-chip" key={valor}>
                {valor}
              </span>
            ))}
            {restantes > 0 && <span className="nh-detour-mais">e mais {restantes}</span>}
          </div>
        </div>
      ) : (
        <div className="nh-detour-body">Envie o arquivo certo e você volta para lá.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Passo
// ---------------------------------------------------------------------------

function StepPanel({
  step,
  isLast,
  savedStep,
  stepFile,
  stepResult,
  busy,
  desvio,
  onExplainHospital,
  onFixRef,
  onUpload,
  onContinue,
  onSkip,
  onBack,
  onRedo,
  onFinish,
  onShowFields,
}) {
  const essencial = isEssencial(step);
  const shown = stepResult || (savedStep && !savedStep.skipped ? savedStep : null);
  const hasError = shown && shown.status === "error";
  // Erro nao trava: o portao fica no fim. O cliente percorre tudo, descobre
  // todos os problemas numa passada e leva uma lista so para quem mexe na view.
  const canContinue = !!shown;
  const jaValidado = !stepResult && savedStep && !savedStep.skipped;
  const schema = fileSchemaOf(step.key);
  // A view de Hospitais traz os codigos reais, entao o aviso do 1 nao vale la.
  const temHospital = schema.allowed.includes("FKHOSPITAL") && !schema.fkhospitalLivre;

  return (
    <div className="nh-step">
      {desvio && <DetourBanner desvio={desvio} />}

      <header className="nh-step-head">
        <h2>{SHORT_LABEL[step.key]}</h2>
        {!essencial && <span className="nh-badge">opcional</span>}
      </header>

      {STEP_HINT[step.key] && <p className="nh-step-hint">{STEP_HINT[step.key]}</p>}

      <div className="nh-step-fields">
        <div className="nh-step-fields-top">
          <span className="nh-label">Precisa ter</span>
          <span className="nh-models">
            modelo
            <button type="button" onClick={() => downloadTemplate(step.key, "csv")}>
              CSV
            </button>
            <button type="button" onClick={() => downloadTemplate(step.key, "json")}>
              JSON
            </button>
          </span>
        </div>
        <RequiredChips fileKey={step.key} onShowAll={onShowFields} />
        {temHospital && (
          <div className="nh-step-fields-note">
            <strong>FKHOSPITAL = {Validator.FKHOSPITAL_FIXO}</strong>, sempre.{" "}
            <button type="button" className="nh-linkish" onClick={onExplainHospital}>
              por que?
            </button>
          </div>
        )}
      </div>

      <Dragger
        multiple={false}
        accept=".csv,.json"
        showUploadList={false}
        beforeUpload={onUpload}
        disabled={busy}
        className={`nh-drop ${shown ? "has-result" : ""}`}
      >
        <div className="nh-drop-icon">{busy ? <LoadingOutlined /> : <CloudUploadOutlined />}</div>
        <div className="nh-drop-text">
          {busy ? "Validando..." : stepFile ? stepFile.name : "Arraste o arquivo ou clique"}
        </div>
        <div className="nh-drop-sub">
          {stepFile
            ? formatBytes(stepFile.size)
            : jaValidado
            ? `Enviado: ${savedStep.fileName}`
            : "CSV ou JSON"}
        </div>
      </Dragger>

      {jaValidado && (
        <>
          <div className="nh-result is-ok">
            <CheckCircleFilled />
            <div>
              <strong>
                {savedStep.recordCount} {savedStep.recordCount === 1 ? "registro validado" : "registros validados"}
              </strong>
              <div className="nh-result-note">
                {formatDateTime(savedStep.validatedAt)} · <a onClick={onRedo}>refazer</a>
              </div>
            </div>
          </div>
          <PreviewTable preview={savedStep.preview} recordCount={savedStep.recordCount} />
        </>
      )}

      {!stepResult && savedStep && savedStep.skipped && (
        <div className="nh-result is-skipped">
          <MinusCircleOutlined />
          <div>
            <strong>Pulada</strong>
            <div className="nh-result-note">
              <a onClick={onRedo}>enviar agora</a>
            </div>
          </div>
        </div>
      )}

      {stepResult && <StepResult result={stepResult} onFixRef={onFixRef} />}

      {hasError && (
        <div className="nh-step-blocker">
          Dá para seguir e corrigir depois — mas com erro a validação não fecha.
        </div>
      )}

      <footer className="nh-step-foot">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Voltar
        </Button>
        <Space size={8}>
          {!essencial && !canContinue && (
            <Button type="text" onClick={onSkip}>
              Não tenho
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            disabled={!canContinue}
            icon={isLast && !desvio ? null : <ArrowRightOutlined />}
            onClick={isLast && !desvio ? onFinish : onContinue}
          >
            {desvio
              ? `Voltar para ${SHORT_LABEL[desvio.voltarPara]}`
              : isLast
              ? "Ver resultado"
              : "Continuar"}
          </Button>
        </Space>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Referencia
// ---------------------------------------------------------------------------

// As primeiras linhas do modelo, na propria tela: o cliente ve o formato
// esperado sem precisar baixar o arquivo para descobrir como e um valor.
function ExampleTable({ fileKey }) {
  const template = (Validator && Validator.TEMPLATES && Validator.TEMPLATES[fileKey]) || null;
  if (!template || !template.rows.length) return null;

  const linhas = template.rows.slice(0, 3);

  return (
    <div className="nh-preview nh-exemplo">
      <div className="nh-preview-head">
        <span className="nh-label">Exemplo</span>
        <span className="nh-preview-meta">
          {linhas.length} de {template.rows.length} {template.rows.length === 1 ? "linha" : "linhas"} do modelo
        </span>
      </div>
      <div className="nh-preview-scroll">
        <table>
          <thead>
            <tr>
              {template.fields.map((campo) => (
                <th key={campo}>{campo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, index) => (
              <tr key={index}>
                {linha.map((celula, celulaIndex) => (
                  <td key={celulaIndex}>
                    {celula === "" ? <span className="nh-preview-empty">vazio</span> : celula}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// Quanto dado exportar. Saiu do corpo da tela e virou modal: e leitura de uma
// vez so, e ocupava cinco linhas em todo acesso.
function RecorteModal({ open, onClose }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={560} title="Quanto dado exportar?">
      <div className="nh-explain">
        <p>
          <strong>Não precisa ser a view inteira.</strong> O recomendado e um recorte pequeno que feche entre
          si: um atendimento (ou poucos) e, nas views de Paciente e Prescricao, so as linhas{" "}
          <em>desse mesmo atendimento</em> — a prescrição, os exames e as evoluções dele.
        </p>
        <p>
          Assim o validador consegue cruzar as chaves entre as views e você ve a tela da NoHarm montada com
          um caso real, em vez de linhas soltas que não conversam.
        </p>
        <p>
          As views de cadastro (hospitais, setores, unidades, frequências, vias, medicamentos) vao inteiras:
          são tabelas de domínio, costumam ser pequenas e o resto aponta para elas.
        </p>
      </div>
    </Modal>
  );
}

// Por que FKHOSPITAL é 1. E a duvida que o cliente traz quando ve o numero fixo
// numa view que ele sabe ser do hospital 52 — e a razao pela qual ele mexe nisso
// e quebra a integracao.
function HospitalModal({ open, onClose }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={560} title="Por que FKHOSPITAL é sempre 1?">
      <div className="nh-explain">
        <p>
          <strong>Não é o código do hospital no seu sistema.</strong> É um identificador fixo da plataforma NoHarm.
          Manter o <code>1</code> e o que garante a integridade dos dados na ingestão.
        </p>
        <p>
          <strong>Rede com vários hospitais?</strong> Continua 1. Quais hospitais entram na integracao se decide no{" "}
          <em>filtro</em> da view, nunca no SELECT:
        </p>
        <pre>
{`SELECT 1 AS FKHOSPITAL,          -- sempre 1
       S.CD_SETOR AS FKSETOR,
       S.NM_SETOR AS NOME
FROM   DBAMV.SETOR S
WHERE  S.CD_MULTI_EMPRESA IN (1, 52, 57)   -- aqui sim`}
        </pre>
        <p>
          As tabelas de domínio — unidades, frequências, medicamentos — são uma só, com <code>DISTINCT</code>. Não há
          frequência nem medicamento duplicado por hospital, entao o hospital não faz diferença ali.
        </p>
        <p>
          <strong>Única exceção:</strong> a view de <em>Hospitais</em>. Ela e o catálogo, entao traz os códigos reais
          das multi-empresas.
        </p>
        <p className="nh-explain-warn">
          Trocar o <code>1</code> pelo código real do hospital quebra a integração.
        </p>
      </div>
    </Modal>
  );
}

// Tabela completa de campos, aberta pelo "+N opcionais" do passo.
function FieldsModal({ fileKey, open, onClose }) {
  if (!fileKey) return null;
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={860} title={SHORT_LABEL[fileKey]}>
      {/* Os modelos moravam no cartao de cada view, 14 vezes na tela. Aqui eles
          ficam junto da lista de campos, que e onde o cliente vai quando
          precisa montar o arquivo. */}
      <Space size={8} style={{ marginBottom: 14 }}>
        <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate(fileKey, "csv")}>
          modelo CSV
        </Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate(fileKey, "json")}>
          modelo JSON
        </Button>
      </Space>
      {/* O exemplo vinha da tela de Referência, que saiu: era a mesma lista de
          campos que este modal ja mostra, so que numa tela a parte. */}
      <ExampleTable fileKey={fileKey} />
      <FieldsTable fileKey={fileKey} />
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tela de Inicio: o hub. Diz o que o validador e, o que ja foi conferido
// (agregado por grupo, nao view a view) e qual e a referencia de dados que a
// integracao pede.
// ---------------------------------------------------------------------------
// Tela de Inicio
// ---------------------------------------------------------------------------
//
// ---------------------------------------------------------------------------
// Tela de Inicio
// ---------------------------------------------------------------------------
//
// A NN/g e direta sobre isto: instrucao que o usuario precisa digerir ANTES de
// usar o produto reduz a usabilidade ("Onboarding: skip it when possible").
// Entao esta tela nao e um tutorial explicando o que ele vai fazer — ela mostra
// **em que pe ele esta** e da a proxima acao.
//
// E **nao ha fila**. Ja teve um `Steps` aqui e era mentira: a tela de
// Prescricao e opcional, serve para o cliente ver o dado dele montado na
// NoHarm, e nada na validacao depende dela. Quem quer so validar as views vai
// direto. Por isso os dois caminhos aparecem lado a lado, com o peso de cada
// um: validar e a acao principal, ver na NoHarm e o convite.
//
// Componentes do AntD, como no resto do app e na propria NoHarm: `Card`,
// `Progress`, `Alert`.

function HomeScreen({ progress, onIr }) {
  const feitos = (progress && progress.steps) || {};
  const chaves = FILE_TYPES.map((file) => file.key);
  const essenciais = FILE_TYPES.filter(isEssencial).map((file) => file.key);

  const enviadas = chaves.filter((key) => feitos[key]);
  const comErro = enviadas.filter((key) => feitos[key].status === "error");

  // Quem decide a aprovacao sao as ESSENCIAIS: opcional ausente entra como
  // `skipped` e fica fora do resultado. Entao o andamento conta essenciais, e
  // as opcionais aparecem a parte — senao o circulo diria "8 de 14" com tudo
  // aprovado e o cliente procuraria seis views que nao precisa mandar.
  const essenciaisFeitas = essenciais.filter((key) => feitos[key]).length;
  const completou = essenciaisFeitas === essenciais.length;
  const faltam = essenciais.length - essenciaisFeitas;
  const opcionais = chaves.length - essenciais.length;
  const opcionaisFeitas = enviadas.length - essenciaisFeitas;
  const comecou = enviadas.length > 0;
  const percentual = Math.round((essenciaisFeitas / essenciais.length) * 100);

  // Os tres grupos do Anexo I, com o que ja entrou em cada um. E a mesma
  // divisao da tela de Validacao: o cliente olha aqui e sabe onde esta sem
  // precisar abrir.
  const porGrupo = GRUPOS_VALIDACAO.map((grupo) => {
    const views = viewsDoGrupo(grupo.key);
    const prontas = views.filter((key) => feitos[key]);
    return {
      key: grupo.key,
      titulo: grupo.titulo,
      total: views.length,
      feitas: prontas.length,
      erros: prontas.filter((key) => feitos[key].status === "error").length,
    };
  });

  const resumo = !comecou
    ? `As ${FILE_TYPES.length} views do Anexo I: ${essenciais.length} essenciais e ${opcionais} opcionais. ` +
      "Envie na ordem que quiser — o validador confere na hora e aponta o que corrigir."
    : completou
      ? comErro.length
        ? `As ${essenciais.length} essenciais chegaram, mas ${comErro.length} ${
            comErro.length === 1 ? "precisa" : "precisam"
          } de correção. O relatório lista o que ajustar em cada uma.`
        : `As ${essenciais.length} essenciais passaram. Dá para exportar o relatório e mandar para a NoHarm.`
      : `Faltam ${faltam} ${faltam === 1 ? "view essencial" : "views essenciais"}.` +
        (comErro.length
          ? ` ${comErro.length} ${comErro.length === 1 ? "ja enviada precisa" : "ja enviadas precisam"} de correção.`
          : "");

  return (
    <div className="nh-home">
      <header className="nh-home-topo">
        <img src="imgs/logo192.png" alt="NoHarm" className="nh-home-logo" />
        <div>
          <Title level={2} className="nh-home-titulo">
            Validador NoHarm
          </Title>
          <Text type="secondary">
            Confira as views do seu hospital antes da integração e veja como os dados chegam na NoHarm.
          </Text>
        </div>
      </header>

      <Row gutter={[16, 16]} className="nh-home-linha">
        <Col xs={24} lg={14}>
          <Card className="nh-home-acao">
            <h3>Validar as views</h3>
            <p>{resumo}</p>

            {comecou && (
              <div className="nh-home-andamento">
                <Progress
                  percent={percentual}
                  showInfo={false}
                  status={comErro.length ? "exception" : completou ? "success" : "normal"}
                  strokeColor={comErro.length ? undefined : "#7ebe9a"}
                />
                <span>
                  <b>
                    <strong>
                      {essenciaisFeitas} de {essenciais.length}
                    </strong>{" "}
                    essenciais
                  </b>
                  <i>
                    {opcionaisFeitas} de {opcionais} opcionais
                  </i>
                </span>
              </div>
            )}

            <ul className="nh-home-grupos">
              {porGrupo.map((grupo) => (
                <li key={grupo.key} className={grupo.erros ? "erro" : grupo.feitas === grupo.total ? "ok" : ""}>
                  <span className="nh-home-grupo-nome">{grupo.titulo}</span>
                  <span className="nh-home-grupo-conta">
                    {grupo.feitas} de {grupo.total}
                    {grupo.erros ? ` · ${grupo.erros} com problema` : ""}
                  </span>
                </li>
              ))}
            </ul>

            <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => onIr("validacao")}>
              {comecou ? "Continuar a validação" : "Abrir a validação"}
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <div className="nh-home-lado">
            <Card className="nh-home-lateral">
              <h3>Ver o seu dado na NoHarm</h3>
              <p>
                Importe a view de Prescrições e Itens e a tela da NoHarm monta com o dado do seu hospital.
                E opcional: nada da validação depende dela, e o que você enviar lá já conta aqui.
              </p>
              <Button onClick={() => onIr("previa")}>Abrir a tela de Prescrição</Button>
            </Card>

            <Card className="nh-home-lateral">
              <h3>Quais dados precisamos</h3>
              <p>
                As {FILE_TYPES.length} views do <strong>Anexo I do Contrato de Integração</strong>. Na tela de
                Validação, cada uma abre a lista completa de campos — com tipo, obrigatoriedade e um modelo
                para baixar.
              </p>
              <Button onClick={() => onIr("validacao")}>Ver as views</Button>
            </Card>
          </div>
        </Col>
      </Row>

      <Alert
        className="nh-home-rodape"
        type="info"
        showIcon
        message="Tudo roda no seu navegador: nenhum arquivo sai da sua rede. Aceita CSV ou JSON, e o progresso fica salvo nesta máquina — dá para parar e voltar depois."
      />
    </div>
  );
}
