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
} = icons;

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
  frequencia: "Frequencias",
  vias: "Vias",
  medicamentos: "Medicamentos",
  prescricao_agrupada: "Prescricoes agrupadas",
  pessoa: "Pacientes",
  exame: "Exames",
  cultura: "Culturas",
  alergia: "Alergias",
  evolucao: "Evolucoes",
  transferencia: "Transferencias",
  prescricoes: "Prescricoes",
  conciliacao: "Conciliacao",
};

// Uma linha, so onde evita uma duvida real. Onde o nome ja diz, fica vazio.
const STEP_HINT = {
  unidades: "O identificador e a sigla (MG, ML, AMP C/10ML), nao o ID da tabela.",
  frequencia: "O identificador e a sigla (8/8, 12/12), nao o ID da tabela.",
  vias: "Uma linha so: todas as vias vao no array JSON da coluna VALOR.",
  conciliacao: "Item sem cadastro associado vai com FKMEDICAMENTO = 0.",
  pessoa: "Escolha um atendimento e exporte so ele. As proximas views sao desse mesmo atendimento.",
  prescricoes: "Do mesmo atendimento. Conferida contra tudo que voce ja enviou.",
};

// ---------------------------------------------------------------------------
// Campos da view
// ---------------------------------------------------------------------------

const FIELD_COLUMNS = [
  { title: "Campo", dataIndex: "name", key: "name", width: "24%", render: (name) => <Text code>{name}</Text> },
  { title: "Tipo", dataIndex: "type", key: "type", width: "16%" },
  {
    title: "Obrigatorio",
    dataIndex: "required",
    key: "required",
    width: "14%",
    render: (required) => (required ? <Tag color="red">Sim</Tag> : <Tag>Nao</Tag>),
  },
  { title: "Descricao", dataIndex: "description", key: "description" },
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
            <strong>{result.recordCount} registros validados</strong>
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

  // O cabecalho conta TIPOS de problema, que e o que a lista abaixo mostra.
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
      <p className="nh-welcome-sub">Vamos conferir seus dados antes da integracao.</p>

      {hasProgress ? (
        <Space direction="vertical" size={12} className="nh-welcome-actions">
          <Button type="primary" size="large" onClick={onResume} icon={<ArrowRightOutlined />}>
            Continuar
          </Button>
          <Popconfirm
            title="Apagar o progresso e recomecar?"
            okText="Apagar"
            cancelText="Cancelar"
            onConfirm={onRestart}
          >
            <Button type="text">Comecar do zero</Button>
          </Popconfirm>
        </Space>
      ) : (
        <div className="nh-welcome-actions">
          <Button type="primary" size="large" onClick={onStart} icon={<ArrowRightOutlined />}>
            Comecar
          </Button>
        </div>
      )}

      <div className="nh-welcome-meta">CSV ou JSON · nada sai da sua rede</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha do tempo: os 3 grupos, nada mais
// ---------------------------------------------------------------------------

function Timeline({ groupKey, position, total }) {
  const atual = GROUPS.findIndex((group) => group.key === groupKey);

  return (
    <ol className="nh-timeline">
      {GROUPS.map((group, index) => (
        <li
          key={group.key}
          className={index < atual ? "is-done" : index === atual ? "is-current" : ""}
        >
          <i>{index < atual ? <CheckCircleFilled /> : index + 1}</i>
          <span>{group.label}</span>
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
// Pergunta: quais dados opcionais o cliente tem
// ---------------------------------------------------------------------------

function AskStep({ groupKey, options, chosen, onToggle, onContinue, onBack }) {
  const pergunta =
    groupKey === "prescricoes" ? "Voce tem conciliacao medicamentosa?" : "Quais desses dados voce tem?";

  return (
    <div className="nh-ask">
      <h2>{pergunta}</h2>
      <p className="nh-ask-sub">Marque o que o hospital consegue extrair. Da para mudar depois.</p>

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
        <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={onContinue}>
          {chosen.length === 0 ? "Nao tenho nenhum" : "Continuar"}
        </Button>
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
        <div className="nh-detour-body">Envie o arquivo certo e voce volta para la.</div>
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
  const canContinue = !!shown && !hasError;
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
              <strong>{savedStep.recordCount} registros validados</strong>
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
          Corrija o arquivo na origem e envie de novo{!essencial ? ', ou marque que nao tem esse dado' : ''}.
        </div>
      )}

      <footer className="nh-step-foot">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Voltar
        </Button>
        <Space size={8}>
          {!essencial && !canContinue && (
            <Button type="text" onClick={onSkip}>
              Nao tenho
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

function ReviewScreen({ progress, onBackToSteps, onJump, onExport }) {
  const rows = FILE_TYPES.map((file) => {
    const saved = progress.steps[file.key];
    return { file, status: saved ? saved.status : "pending", saved };
  });

  const pendentes = rows.filter((row) => isEssencial(row.file) && row.status !== "ok" && row.status !== "warn");
  const aprovado = pendentes.length === 0;
  const erros = rows.reduce((sum, row) => sum + ((row.saved && row.saved.issueCount) || 0), 0);

  return (
    <div className="nh-review">
      <div className={`nh-review-head ${aprovado ? "is-ok" : "is-error"}`}>
        {aprovado ? <CheckCircleFilled /> : <CloseCircleFilled />}
        <h2>{aprovado ? "Dados aprovados" : "Ainda tem pendencia"}</h2>
        <p>
          {aprovado
            ? "Tire um print desta tela e envie para a NoHarm."
            : `${pendentes.length} view(s) essencial(is) pendente(s), ${erros} erro(s).`}
        </p>
        <Space size={8}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBackToSteps}>
            Voltar
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={onExport}>
            Exportar relatorio
          </Button>
        </Space>
      </div>

      <ul className="nh-review-list">
        {rows.map((row) => {
          const meta = STATUS_META[row.status] || STATUS_META.pending;
          return (
            <li
              key={row.file.key}
              className={meta.className}
              onClick={() => onJump(row.file.key)}
            >
              <i>{statusIcon(row.status)}</i>
              <span className="nh-review-name">{SHORT_LABEL[row.file.key]}</span>
              <span className="nh-review-meta">
                {row.saved && row.saved.recordCount != null
                  ? `${row.saved.recordCount} registros`
                  : row.status === "skipped"
                  ? "pulada"
                  : "pendente"}
              </span>
              {row.saved && row.saved.issueCount ? (
                <span className="nh-review-errors">{row.saved.issueCount} erros</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dados salvos
// ---------------------------------------------------------------------------

function SavedDataScreen({ progress, onClear, onExport, onImport, onResetStep }) {
  const salvos = FILE_TYPES.filter((file) => progress.steps[file.key]);

  return (
    <div className="nh-plain">
      <h2>Dados salvos</h2>
      <p className="nh-plain-sub">
        Fica so no seu navegador. O conteudo dos arquivos nao e guardado.
      </p>

      {!Storage.available && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Este navegador esta bloqueando o armazenamento local — o progresso nao sera salvo."
        />
      )}

      <Space wrap style={{ marginBottom: 20 }}>
        <Button icon={<DownloadOutlined />} onClick={onExport}>
          Exportar
        </Button>
        <Upload accept=".json" showUploadList={false} beforeUpload={onImport}>
          <Button icon={<CloudUploadOutlined />}>Reimportar</Button>
        </Upload>
        <Popconfirm title="Apagar tudo?" okText="Apagar" cancelText="Cancelar" onConfirm={onClear}>
          <Button danger type="text" icon={<ReloadOutlined />}>
            Apagar
          </Button>
        </Popconfirm>
      </Space>

      {salvos.length === 0 ? (
        <Empty description="Nada salvo ainda." />
      ) : (
        <ul className="nh-review-list">
          {salvos.map((file) => {
            const saved = progress.steps[file.key];
            const meta = STATUS_META[saved.status] || STATUS_META.pending;
            return (
              <li key={file.key} className={meta.className}>
                <i>{statusIcon(saved.status)}</i>
                <span className="nh-review-name">{SHORT_LABEL[file.key]}</span>
                <span className="nh-review-meta">{saved.fileName || "pulada"}</span>
                <a onClick={() => onResetStep(file.key)}>refazer</a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Referencia
// ---------------------------------------------------------------------------

function ReferenceScreen() {
  return (
    <div className="nh-plain">
      <h2>Campos por view</h2>
      <p className="nh-plain-sub">Conforme o Anexo I do contrato. Coluna fora desta lista e ignorada.</p>

      {GROUPS.map((group) => (
        <div key={group.key} className="nh-ref-group">
          <span className="nh-label">{group.label}</span>
          <Collapse
            ghost
            items={filesOfGroup(group.key).map((file) => ({
              key: file.key,
              label: (
                <span className="nh-ref-item">
                  {SHORT_LABEL[file.key]}
                  <span className="nh-ref-count">{fileSchemaOf(file.key).fields.length} campos</span>
                  {!isEssencial(file) && <span className="nh-badge">opcional</span>}
                </span>
              ),
              children: (
                <div>
                  <Space size={8} style={{ marginBottom: 12 }}>
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate(file.key, "csv")}>
                      CSV
                    </Button>
                    <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate(file.key, "json")}>
                      JSON
                    </Button>
                  </Space>
                  <FieldsTable fileKey={file.key} />
                </div>
              ),
            }))}
          />
        </div>
      ))}
    </div>
  );
}

// Por que FKHOSPITAL e 1. E a duvida que o cliente traz quando ve o numero fixo
// numa view que ele sabe ser do hospital 52 — e a razao pela qual ele mexe nisso
// e quebra a integracao.
function HospitalModal({ open, onClose }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={560} title="Por que FKHOSPITAL e sempre 1?">
      <div className="nh-explain">
        <p>
          <strong>Nao e o codigo do hospital no seu sistema.</strong> E um identificador fixo da plataforma NoHarm.
          Manter o <code>1</code> e o que garante a integridade dos dados na ingestao.
        </p>
        <p>
          <strong>Rede com varios hospitais?</strong> Continua 1. Quais hospitais entram na integracao se decide no{" "}
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
          As tabelas de dominio — unidades, frequencias, medicamentos — sao uma so, com <code>DISTINCT</code>. Nao ha
          frequencia nem medicamento duplicado por hospital, entao o hospital nao faz diferenca ali.
        </p>
        <p>
          <strong>Unica excecao:</strong> a view de <em>Hospitais</em>. Ela e o catalogo, entao traz os codigos reais
          das multi-empresas.
        </p>
        <p className="nh-explain-warn">
          Trocar o <code>1</code> pelo codigo real do hospital quebra a integracao.
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
      <FieldsTable fileKey={fileKey} />
    </Modal>
  );
}
