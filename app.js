const { useMemo, useRef, useState } = React;
const {
  Layout,
  Menu,
  Input,
  Button,
  Card,
  Upload,
  Typography,
  Row,
  Col,
  Tag,
  Badge,
  Space,
  Divider,
  Alert,
  Collapse,
  List,
} = antd;

const {
  UserOutlined,
  FileSearchOutlined,
  DatabaseOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  SettingOutlined,
} = icons;

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Dragger } = Upload;

const Validator = window.NoHarmValidator;
const FILE_TYPES = Validator
  ? Validator.FILE_TYPES
  : [
      { key: "prescricoes", label: "Prescricoes" },
      { key: "medicamentos", label: "Medicamentos" },
      { key: "setores", label: "Setores" },
      { key: "unidades", label: "Unidades" },
      { key: "frequencia", label: "Frequencia" },
    ];
const NOHARM_SCHEMA = Validator ? Validator.NOHARM_SCHEMA : null;

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${sizes[i]}`;
};

function App() {
  const [files, setFiles] = useState({
    prescricoes: null,
    medicamentos: null,
    setores: null,
    unidades: null,
    frequencia: null,
  });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mappingWarnings, setMappingWarnings] = useState([]);
  const [searchHintVisible, setSearchHintVisible] = useState(false);
  const searchHintTimerRef = useRef(null);

  const schemaPreview = useMemo(() => {
    return FILE_TYPES.map((file) => ({
      key: file.key,
      label: file.label,
      fields: NOHARM_SCHEMA ? Array.from(new Set(NOHARM_SCHEMA.files[file.key].allowed)).sort() : [],
    }));
  }, []);

  const handleFile = (key) => (file) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
    setMappingWarnings([]);
    return false;
  };

  const fileAliases = {
    prescricoes: ["prescricao", "prescricoes", "presc"],
    medicamentos: ["medicamento", "medicamentos", "med"],
    setores: ["setor", "setores"],
    unidades: ["unidade", "unidades", "unidademedida", "uni"],
    frequencia: ["frequencia", "frequencias", "freq"],
  };

  const getFileBaseName = (name) => name.toLowerCase().replace(/\.(csv|json)$/i, "");

  const matchFileKey = (fileName) => {
    const base = getFileBaseName(fileName);
    const scores = FILE_TYPES.map((file) => {
      const aliases = fileAliases[file.key] || [];
      const match = aliases.reduce((best, alias) => (base.includes(alias) ? Math.max(best, alias.length) : best), 0);
      return { key: file.key, score: match };
    }).filter((entry) => entry.score > 0);

    if (scores.length === 0) return null;
    scores.sort((a, b) => b.score - a.score);
    if (scores.length > 1 && scores[0].score === scores[1].score) {
      return { key: scores[0].key, ambiguous: true };
    }
    return { key: scores[0].key, ambiguous: false };
  };

  const handleBatchUpload = (info) => {
    const warnings = [];
    const incoming = {};
    const list = info.fileList || [];
    list.forEach((entry) => {
      const file = entry.originFileObj || entry;
      if (!file) return;
      const match = matchFileKey(file.name);
      if (!match) {
        warnings.push(`Arquivo ${file.name} ignorado: nome nao corresponde a nenhum tipo.`); 
        return;
      }
      if (match.ambiguous) {
        warnings.push(`Arquivo ${file.name} pode corresponder a mais de um tipo. Usando ${match.key}.`); 
      }
      if (incoming[match.key] || files[match.key]) {
        warnings.push(`Arquivo ${file.name} substituiu ${match.key}.`);
      }
      incoming[match.key] = file;
    });

    if (Object.keys(incoming).length) {
      setFiles((prev) => ({ ...prev, ...incoming }));
    }
    setMappingWarnings(warnings);
    setResults(null);
  };

  const clearFiles = () => {
    setFiles({
      prescricoes: null,
      medicamentos: null,
      setores: null,
      unidades: null,
      frequencia: null,
    });
    setResults(null);
    setMappingWarnings([]);
  };

  const validateAll = async () => {
    setBusy(true);
    setResults(null);

    if (!Validator) {
      setResults({
        summary: { status: "error", message: "Validador nao carregado. Recarregue a pagina." },
        files: {},
      });
      setBusy(false);
      return;
    }

    const missing = FILE_TYPES.filter((file) => !files[file.key]).map((file) => file.label);
    if (missing.length) {
      setResults({
        summary: { status: "error", message: `Arquivos faltando: ${missing.join(", ")}` },
        files: {},
      });
      setBusy(false);
      return;
    }

    const parsedFiles = {};

    await Promise.all(
      FILE_TYPES.map(async (file) => {
        const target = files[file.key];
        const text = await target.text();
        parsedFiles[file.key] = await Validator.parseFileText(target.name, text);
      })
    );

    const result = Validator.validateParsed(parsedFiles);
    setResults(result);
    setBusy(false);
  };

  const downloadReport = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "noharm-validacao.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const summaryContent = results?.summary ? (
    <Alert
      message={results.summary.message}
      type={results.summary.status === "ok" ? "success" : results.summary.status === "warn" ? "warning" : "error"}
      showIcon
    />
  ) : (
    <Alert message="Selecione os arquivos e rode a validacao." type="info" showIcon />
  );

  return (
    <Layout className="nh-layout">
      <Sider width={72} className="nh-sider">
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="imgs/logo192.png" alt="NoHarm" style={{ width: 28, height: 28 }} />
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={["validador"]}
          items={[
            { key: "validador", icon: <FileSearchOutlined />, label: "Validador" },
            { key: "dados", icon: <DatabaseOutlined />, label: "Dados" },
            { key: "arquivos", icon: <FileTextOutlined />, label: "Arquivos" },
            { key: "config", icon: <SettingOutlined />, label: "Config" },
          ]}
        />
      </Sider>

      <Layout>
        <Header className="nh-header">
          <div className="nh-search">
            <Input.Search
              placeholder="Buscar por numero do atendimento ou prescricao"
              onSearch={() => {
                if (searchHintTimerRef.current) {
                  clearTimeout(searchHintTimerRef.current);
                }
                setSearchHintVisible(true);
                searchHintTimerRef.current = setTimeout(() => {
                  setSearchHintVisible(false);
                }, 2200);
              }}
            />
            {searchHintVisible && (
              <div className="nh-search-hint">Nada por aqui, por enquanto ;)</div>
            )}
          </div>
          <div className="nh-user">
            <Tag color="gold">HOMOLOGACAO</Tag>
            <Badge dot>
              <UserOutlined style={{ fontSize: 18 }} />
            </Badge>
            <Text strong>Validador</Text>
          </div>
        </Header>

        <Content className="nh-content">
          <Title level={3} className="nh-title">
            Validador de Integracao
          </Title>
          <Text className="nh-subtitle">Valide arquivos CSV ou JSON contra os padroes NoHarm.</Text>

          <div className="nh-toolbar">
            <Space size="middle" wrap>
              <Text strong>Padrao NoHarm</Text>
              <Tag color="green">Unico</Tag>
            </Space>

            <div className="nh-actions">
              <Button onClick={clearFiles}>Limpar</Button>
              <Button type="primary" loading={busy} onClick={validateAll} style={{ background: "#58b47b" }}>
                Validar arquivos
              </Button>
              <Button disabled={!results} onClick={downloadReport}>
                Exportar relatorio
              </Button>
            </div>
          </div>

          {summaryContent}
          {mappingWarnings.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message="Avisos de mapeamento"
              description={
                <List
                  size="small"
                  dataSource={mappingWarnings}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              }
            />
          )}

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24}>
              <Card className="nh-card" bodyStyle={{ padding: 16 }}>
                <div className="nh-upload-label">Upload em lote</div>
                <div className="nh-upload-meta">
                  Selecione varios arquivos e o sistema identifica o tipo pelo nome (ex.: prescricoes, medicamentos).
                </div>
                <div className="nh-upload-zone">
                  <Dragger
                    multiple
                    accept=".csv,.json"
                    showUploadList={false}
                    beforeUpload={() => false}
                    onChange={handleBatchUpload}
                  >
                    <p className="ant-upload-drag-icon">
                      <CloudUploadOutlined />
                    </p>
                    <p className="ant-upload-text">Clique ou arraste varios arquivos</p>
                    <p className="ant-upload-hint">CSV ou JSON</p>
                  </Dragger>
                </div>
              </Card>
            </Col>
            {FILE_TYPES.map((file) => {
              const target = files[file.key];
              return (
                <Col xs={24} md={12} lg={8} key={file.key}>
                  <Card className="nh-card nh-upload-card" bodyStyle={{ padding: 16 }}>
                    <div className="nh-upload-label">{file.label}</div>
                    <div className="nh-upload-meta">Arquivo CSV ou JSON em formato flat.</div>
                    <div className="nh-upload-zone">
                      <Dragger
                        multiple={false}
                        accept=".csv,.json"
                        showUploadList={false}
                        beforeUpload={handleFile(file.key)}
                      >
                        <p className="ant-upload-drag-icon">
                          <CloudUploadOutlined />
                        </p>
                        <p className="ant-upload-text">Clique ou arraste o arquivo</p>
                        <p className="ant-upload-hint">{target ? `${target.name} (${formatBytes(target.size)})` : "Nenhum arquivo"}</p>
                      </Dragger>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>

          <Divider />

          <Title level={4}>Resumo por arquivo</Title>
          <div className="nh-summary">
            {FILE_TYPES.map((file) => {
              const fileResult = results?.files?.[file.key];
              const status = fileResult?.status || "warn";
              const statusClass =
                status === "ok" ? "nh-status-ok" : status === "warn" ? "nh-status-warn" : "nh-status-error";
              const icon =
                status === "ok" ? <CheckCircleOutlined /> : status === "warn" ? <WarningOutlined /> : <ExclamationCircleOutlined />;

              return (
                <div className="nh-summary-card" key={`summary-${file.key}`}>
                  <div className="nh-summary-title">{file.label}</div>
                  <div className={`nh-status-pill ${statusClass}`}>
                    {icon}
                    {status === "ok" ? "Sem erros" : status === "warn" ? "Com alertas" : "Com erros"}
                  </div>
                  <div className="nh-muted" style={{ marginTop: 8 }}>
                    Registros: {fileResult?.recordCount ?? "-"}
                  </div>
                  <div className="nh-muted">Colunas: {fileResult?.columnCount ?? "-"}</div>
                </div>
              );
            })}
          </div>

          <Divider />

          <Title level={4}>Detalhes da validacao</Title>
          <Collapse
            accordion
            items={FILE_TYPES.map((file) => {
              const fileResult = results?.files?.[file.key];
              const issues = fileResult?.issues || [];
              const warnings = fileResult?.warnings || [];
              return {
                key: file.key,
                label: `${file.label}`,
                children: (
                  <div>
                    {issues.length === 0 && warnings.length === 0 ? (
                      <Alert message="Nenhum erro encontrado." type="success" showIcon />
                    ) : (
                      <>
                        {issues.length > 0 && (
                          <>
                            <Text strong>Erros</Text>
                            <List size="small" dataSource={issues} renderItem={(item) => <List.Item>{item}</List.Item>} />
                          </>
                        )}
                        {warnings.length > 0 && (
                          <>
                            <Text strong style={{ display: "block", marginTop: 12 }}>
                              Alertas
                            </Text>
                            <List size="small" dataSource={warnings} renderItem={(item) => <List.Item>{item}</List.Item>} />
                          </>
                        )}
                      </>
                    )}
                  </div>
                ),
              };
            })}
          />

          <Divider />

          <Title level={4}>Campos esperados (padrao NoHarm)</Title>
          <Text className="nh-muted" style={{ display: "block", marginBottom: 8 }}>
            Lista unificada de campos aceitos nos formatos MV, Tasy e Create.
          </Text>
          <Row gutter={[16, 16]}>
            {schemaPreview.map((info) => (
              <Col xs={24} md={12} key={`schema-${info.key}`}>
                <Card className="nh-card" bodyStyle={{ padding: 16 }}>
                  <Text strong>{info.label}</Text>
                  <div className="nh-muted" style={{ marginTop: 8, marginBottom: 8 }}>
                    Campos esperados ({info.fields.length})
                  </div>
                  {info.groups ? (
                    Object.entries(info.groups).map(([group, fields]) => (
                      <div key={`${info.key}-${group}`} style={{ marginBottom: 12 }}>
                        <Text className="nh-muted" strong style={{ display: "block", marginBottom: 6 }}>
                          {group}
                        </Text>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {fields.map((field) => (
                            <Tag key={`${group}-${field}`}>{field}</Tag>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {info.fields.map((field) => (
                        <Tag key={field}>{field}</Tag>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>

          <div className="nh-footer-note">
            Validacao semantica inclui chaves duplicadas e referencias cruzadas entre prescricoes, medicamentos, setores,
            unidades e frequencia.
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
