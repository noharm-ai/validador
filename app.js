// Casca do validador: sequencia do passo a passo, estado e persistencia.
// As telas estao em wizard.js e o motor em validator.js.

const { useCallback, useEffect, useMemo, useRef, useState } = React;
const { Layout, Menu, message, ConfigProvider } = antd;
const { FileSearchOutlined, DatabaseOutlined, ReadOutlined, HomeOutlined } = icons;

const { Sider, Content } = Layout;

// Views OPCIONAIS por grupo. Em vez de virarem passos que o cliente pula uma a
// uma, o passo a passo pergunta de uma vez quais ele tem.
const OPTIONALS_BY_GROUP = GROUPS.reduce((acc, group) => {
  const opcionais = FILE_TYPES.filter((file) => file.group === group.key && file.criticality === "opcional");
  if (opcionais.length) acc[group.key] = opcionais.map((file) => file.key);
  return acc;
}, {});

// A sequencia e montada a partir do que o cliente respondeu: as essenciais
// sempre entram, a pergunta entra antes das opcionais do grupo, e so as
// marcadas viram passo.
const buildSequence = (progress) => {
  const sequence = [];
  GROUPS.forEach((group) => {
    FILE_TYPES.filter((file) => file.group === group.key && file.criticality === "essencial").forEach((file) =>
      sequence.push({ type: "view", key: file.key, group: group.key })
    );

    const opcionais = OPTIONALS_BY_GROUP[group.key];
    if (!opcionais) return;

    sequence.push({ type: "ask", key: `ask-${group.key}`, group: group.key, options: opcionais });
    opcionais.forEach((fileKey) => {
      if ((progress.optionals || {})[fileKey]) sequence.push({ type: "view", key: fileKey, group: group.key });
    });
  });
  return sequence;
};

function App() {
  const [progress, setProgress] = useState(() => (Storage ? Storage.load() : null));
  const [screen, setScreen] = useState("welcome");
  const [menuKey, setMenuKey] = useState("validacao");
  const [stepIndex, setStepIndex] = useState(0);
  // Guardados por etapa: sair e voltar nao pode perder o arquivo que o cliente
  // ja enviou naquele passo.
  const [stepFiles, setStepFiles] = useState({});
  const [stepResults, setStepResults] = useState({});
  const [askChoice, setAskChoice] = useState([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  // Desvio: o cliente saiu de uma etapa para corrigir uma view anterior. Guarda
  // de onde ele veio e o que exatamente esta faltando, para a etapa de destino
  // poder dizer o que incluir.
  const [desvio, setDesvio] = useState(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messageApi, messageHolder] = message.useMessage();

  // Indices de chave desta sessao. Views grandes nao cabem no localStorage, mas
  // dentro da sessao servem a validacao cruzada.
  const sessionIndexes = useRef({});

  const sequence = useMemo(() => (progress ? buildSequence(progress) : []), [progress]);
  const current = sequence[Math.min(stepIndex, sequence.length - 1)];
  const savedStep = progress && current && current.type === "view" ? progress.steps[current.key] : null;
  const stepFile = current ? stepFiles[current.key] || null : null;
  const stepResult = current ? stepResults[current.key] || null : null;

  // Posicao dentro do grupo, para a linha do tempo.
  const groupSteps = current ? sequence.filter((item) => item.group === current.group) : [];
  const groupPosition = current ? groupSteps.findIndex((item) => item.key === current.key) + 1 : 0;

  const externalIndexes = useCallback(
    () => Object.assign({}, progress ? progress.indexes : {}, sessionIndexes.current),
    [progress]
  );

  // O cliente nao pula etapa: o primeiro passo pendente e ate onde ele pode ir.
  const firstPendingIndex = useCallback(() => {
    if (!progress) return 0;
    const index = sequence.findIndex((item) =>
      item.type === "ask" ? !Storage.hasAnswered(progress, item.options) : !progress.steps[item.key]
    );
    return index === -1 ? Math.max(sequence.length - 1, 0) : index;
  }, [progress, sequence]);

  useEffect(() => {
    setFieldsOpen(false);
    setHospitalOpen(false);
    if (current && current.type === "ask") {
      setAskChoice(current.options.filter((key) => (progress.optionals || {})[key]));
    }
  }, [stepIndex, sequence.length]);

  const goToScreen = (next, key) => {
    setScreen(next);
    if (key) setMenuKey(key);
  };

  const handleStart = () => {
    setStepIndex(0);
    goToScreen("steps", "validacao");
  };

  const handleResume = () => {
    setStepIndex(firstPendingIndex());
    goToScreen("steps", "validacao");
  };

  const handleRestart = () => {
    sessionIndexes.current = {};
    setStepFiles({});
    setStepResults({});
    setProgress(Storage.clear());
    setStepIndex(0);
    goToScreen("steps", "validacao");
  };

  // Volta para uma etapa ja concluida. Ir para frente, so pelo Continuar.
  const handleJump = (fileKey) => {
    const index = sequence.findIndex((item) => item.key === fileKey);
    if (index < 0) return;
    setStepIndex(Math.min(index, firstPendingIndex()));
    goToScreen("steps", "validacao");
  };

  const validarArquivo = async (fileKey, file) => {
    if (!Validator) {
      messageApi.error("Validador nao carregado. Recarregue a pagina.");
      return false;
    }
    setBusy(true);
    setStepFiles((prev) => Object.assign({}, prev, { [fileKey]: file }));
    setStepResults((prev) => {
      const next = Object.assign({}, prev);
      delete next[fileKey];
      return next;
    });
    try {
      const text = await file.text();
      const parsed = await Validator.parseFileText(file.name, text);
      const result = Validator.validateFile(fileKey, parsed, { externalIndexes: externalIndexes() });

      const index = Validator.buildKeyIndex(fileKey, parsed);
      if (index.length) sessionIndexes.current[fileKey] = index;
      const preview = Validator.buildPreview(fileKey, parsed);

      setStepResults((prev) =>
        Object.assign({}, prev, {
          [fileKey]: Object.assign({}, result, {
            __index: index,
            __preview: preview,
            preview,
            __fileMeta: { fileName: file.name, fileSize: file.size, format: parsed.format },
          }),
        })
      );
    } catch (err) {
      messageApi.error(`Nao foi possivel ler o arquivo: ${err.message}`);
      setStepFiles((prev) => {
        const next = Object.assign({}, prev);
        delete next[fileKey];
        return next;
      });
    } finally {
      setBusy(false);
    }

    return false;
  };

  const handleStepUpload = (file) => validarArquivo(current.key, file);

  // Erro de chave estrangeira aponta para outra view. Em vez de voltar na mao
  // etapa por etapa, o cliente pula direto para ela levando junto a lista do
  // que falta incluir.
  const handleFixRef = (group) => {
    const index = sequence.findIndex((item) => item.key === group.refFile);
    if (index < 0) return;
    setDesvio({
      voltarPara: current.key,
      corrigindo: group.refFile,
      campo: group.refField,
      valores: group.distinctValues || [],
      total: group.distinctCount || 0,
    });
    setStepIndex(index);
  };

  const advance = (fromProgress) => {
    const nextSequence = buildSequence(fromProgress || progress);
    if (stepIndex >= nextSequence.length - 1) {
      goToScreen("review", "validacao");
      return;
    }
    setStepIndex(stepIndex + 1);
  };

  const handleContinue = () => {
    let next = progress;
    if (stepResult) {
      next = Storage.saveStep(
        next,
        current.key,
        stepResult,
        stepResult.__fileMeta,
        stepResult.__index,
        stepResult.__preview
      );
      setProgress(next);
    }

    if (desvio) {
      const destino = sequence.findIndex((item) => item.key === desvio.voltarPara);
      const arquivo = stepFiles[desvio.voltarPara];
      const origem = desvio.voltarPara;
      setDesvio(null);
      if (destino >= 0) {
        setStepIndex(destino);
        // O resultado guardado la foi conferido contra o arquivo antigo: refaz
        // a validacao com o que acabou de ser corrigido.
        if (arquivo) validarArquivo(origem, arquivo);
        return;
      }
    }

    advance(next);
  };

  const handleAskContinue = () => {
    const next = Storage.setOptionals(progress, current.options, askChoice);
    setProgress(next);
    advance(next);
  };

  const handleSkip = () => {
    const next = Storage.skipStep(progress, current.key);
    setProgress(next);
    delete sessionIndexes.current[current.key];
    advance(next);
  };

  const handleBack = () => {
    setDesvio(null);
    if (stepIndex === 0) {
      goToScreen("welcome", "inicio");
      return;
    }
    setStepIndex(stepIndex - 1);
  };

  const handleRedo = (fileKey) => {
    const next = Storage.resetStep(progress, fileKey);
    setProgress(next);
    delete sessionIndexes.current[fileKey];
    setStepFiles((prev) => {
      const copy = Object.assign({}, prev);
      delete copy[fileKey];
      return copy;
    });
    setStepResults((prev) => {
      const copy = Object.assign({}, prev);
      delete copy[fileKey];
      return copy;
    });
    const index = buildSequence(next).findIndex((item) => item.key === fileKey);
    if (index >= 0) {
      setStepIndex(index);
      goToScreen("steps", "validacao");
    }
  };

  const handleClear = () => {
    sessionIndexes.current = {};
    setStepFiles({});
    setStepResults({});
    setProgress(Storage.clear());
    setStepIndex(0);
    messageApi.success("Progresso apagado.");
    goToScreen("welcome", "inicio");
  };

  const handleExportProgress = () =>
    downloadText("noharm-validador-progresso.json", Storage.exportJson(progress), "application/json");

  const handleImportProgress = async (file) => {
    try {
      const imported = Storage.importJson(await file.text());
      sessionIndexes.current = {};
      setStepFiles({});
      setStepResults({});
      setProgress(imported);
      messageApi.success("Progresso reimportado.");
    } catch (err) {
      messageApi.error(`Arquivo de progresso invalido: ${err.message}`);
    }
    return false;
  };

  const handleExportReport = () => {
    const report = {
      geradoEm: new Date().toISOString(),
      padrao: "Anexo I do Contrato NoHarm - Integracao de Dados",
      views: FILE_TYPES.map((file) => {
        const saved = progress.steps[file.key];
        return {
          view: file.view,
          grupo: file.group,
          criticidade: file.criticality,
          status: saved ? saved.status : "pendente",
          arquivo: saved ? saved.fileName : null,
          registros: saved ? saved.recordCount : null,
          colunasExtrasIgnoradas: saved ? saved.extraFields : null,
          erros: saved ? saved.issueCount : null,
          gruposDeErro: saved ? saved.issueGroups : null,
          validadoEm: saved ? saved.validatedAt : null,
        };
      }),
    };
    downloadText("noharm-validacao.json", `${JSON.stringify(report, null, 2)}\n`, "application/json");
  };

  const handleMenu = ({ key }) => {
    setMenuKey(key);
    if (key === "inicio") setScreen("welcome");
    if (key === "validacao") setScreen("steps");
    if (key === "dados") setScreen("dados");
    if (key === "referencia") setScreen("referencia");
  };

  if (!Validator || !Storage) {
    return <div style={{ padding: 32 }}>Validador nao carregado. Recarregue a pagina.</div>;
  }

  const isLast = stepIndex >= sequence.length - 1;

  return (
    <ConfigProvider
      theme={{ token: { colorPrimary: "#46a46a", colorLink: "#46a46a", borderRadius: 8, fontSize: 14 } }}
    >
      <Layout className="nh-layout">
        {messageHolder}
        <Sider width={200} className="nh-sider" breakpoint="lg" collapsedWidth={0}>
          <div className="nh-sider-brand">
            <img src="imgs/logo192.png" alt="NoHarm" />
            <span>Validador</span>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[menuKey]}
            onClick={handleMenu}
            items={[
              { key: "inicio", icon: <HomeOutlined />, label: "Inicio" },
              { key: "validacao", icon: <FileSearchOutlined />, label: "Validacao" },
              { key: "dados", icon: <DatabaseOutlined />, label: "Dados salvos" },
              { key: "referencia", icon: <ReadOutlined />, label: "Referencia" },
            ]}
          />
        </Sider>

        <Layout>
          <Content className="nh-content">
            {screen === "welcome" && (
              <WelcomeScreen
                progress={progress}
                onStart={handleStart}
                onResume={handleResume}
                onRestart={handleRestart}
              />
            )}

            {screen === "steps" && current && (
              <div className="nh-wizard">
                <Timeline groupKey={current.group} position={groupPosition} total={groupSteps.length} />

                {current.type === "ask" ? (
                  <AskStep
                    groupKey={current.group}
                    options={current.options}
                    chosen={askChoice}
                    onToggle={(key) =>
                      setAskChoice((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
                    }
                    onContinue={handleAskContinue}
                    onBack={handleBack}
                  />
                ) : (
                  <>
                    <StepPanel
                      step={FILE_TYPES.find((file) => file.key === current.key)}
                      isLast={isLast}
                      savedStep={savedStep}
                      stepFile={stepFile}
                      stepResult={stepResult}
                      busy={busy}
                      desvio={desvio && desvio.corrigindo === current.key ? desvio : null}
                      onExplainHospital={() => setHospitalOpen(true)}
                      onFixRef={handleFixRef}
                      onUpload={handleStepUpload}
                      onContinue={handleContinue}
                      onSkip={handleSkip}
                      onBack={handleBack}
                      onRedo={() => handleRedo(current.key)}
                      onFinish={() => goToScreen("review", "validacao")}
                      onShowFields={() => setFieldsOpen(true)}
                    />
                    <FieldsModal fileKey={current.key} open={fieldsOpen} onClose={() => setFieldsOpen(false)} />
                    <HospitalModal open={hospitalOpen} onClose={() => setHospitalOpen(false)} />
                  </>
                )}
              </div>
            )}

            {screen === "review" && (
              <ReviewScreen
                progress={progress}
                onBackToSteps={() => goToScreen("steps", "validacao")}
                onJump={handleJump}
                onExport={handleExportReport}
              />
            )}

            {screen === "dados" && (
              <SavedDataScreen
                progress={progress}
                onClear={handleClear}
                onExport={handleExportProgress}
                onImport={handleImportProgress}
                onResetStep={handleRedo}
              />
            )}

            {screen === "referencia" && <ReferenceScreen />}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
