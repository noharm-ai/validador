// Casca do validador: sequencia do passo a passo, estado e persistencia.
// As telas estao em wizard.js e o motor em validator.js.

const { useCallback, useEffect, useMemo, useRef, useState } = React;
const { Layout, Menu, message, ConfigProvider } = antd;
const { HomeOutlined, MedicineBoxOutlined, AuditOutlined } = icons;

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
  GROUPS.filter((group) => group.key !== "cadastros").forEach((group) => {
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
  const [screen, setScreen] = useState("inicio");
  const [menuKey, setMenuKey] = useState("inicio");
  const [stepIndex, setStepIndex] = useState(0);
  // Guardados por etapa: sair e voltar nao pode perder o arquivo que o cliente
  // ja enviou naquele passo.
  const [stepFiles, setStepFiles] = useState({});
  const [stepResults, setStepResults] = useState({});
  const [askChoice, setAskChoice] = useState([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  // Cartao da Base aberto (a view cujo detalhe esta na tela) e qual esta sendo
  // validada no momento.
  const [baseAberto, setBaseAberto] = useState(null);
  const [baseBusy, setBaseBusy] = useState(null);
  const [fieldsKey, setFieldsKey] = useState(null);
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
  // parsed das views que a tela de Prescricao desenha — memoria da sessao, nunca gravado
  const parsedPrevia = useRef({});
  // Estado do lote: ocupado, quantos ja foram e o resultado por arquivo.
  const [lote, setLote] = useState({ ocupado: false, progresso: { feito: 0, total: 0 }, resultados: [] });
  const [recorteOpen, setRecorteOpen] = useState(false);
  // Muda quando o progresso e apagado, para remontar a tela de Prescricao.
  const [versaoDados, setVersaoDados] = useState(0);

  const sequence = useMemo(() => (progress ? buildSequence(progress) : []), [progress]);
  const current = sequence[Math.min(stepIndex, sequence.length - 1)];
  const savedStep = progress && current && current.type === "view" ? progress.steps[current.key] : null;
  // A pergunta nao e uma view: contar telas de pergunta fazia o "N de M" nao
  // bater com o que o cliente ve.
  const totalMovimento = sequence.filter((item) => item.type === "view").length;
  const posicaoMovimento = sequence
    .slice(0, stepIndex + 1)
    .filter((item) => item.type === "view").length;
  const stepFile = current ? stepFiles[current.key] || null : null;
  const stepResult = current ? stepResults[current.key] || null : null;

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

  const baseCompleta = () => VIEWS_BASE.every((key) => progress.steps[key]);

  const handleStart = () => {
    setStepIndex(0);
    goToScreen("base", "validacao");
  };

  const handleResume = () => {
    if (!baseCompleta()) {
      goToScreen("base", "validacao");
      return;
    }
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
  // Usado pelo desvio de chave estrangeira.
  const handleJump = (fileKey) => {
    if (VIEWS_BASE.includes(fileKey)) {
      setBaseAberto(fileKey);
      goToScreen("base", "validacao");
      return;
    }
    const index = sequence.findIndex((item) => item.key === fileKey);
    if (index < 0) return;
    setStepIndex(index);
    goToScreen("steps", "validacao");
  };

  const validarArquivo = async (fileKey, file, aoTerminar) => {
    if (!Validator) {
      messageApi.error("Validador não carregado. Recarregue a página.");
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
      if (VIEWS_DA_PRESCRICAO.includes(fileKey)) {
        parsedPrevia.current[fileKey] = { nome: file.name, tamanho: file.size, parsed, registros: parsed.records || [] };
      }

      const completo = Object.assign({}, result, {
        __index: index,
        __preview: preview,
        preview,
        __fileMeta: { fileName: file.name, fileSize: file.size, format: parsed.format },
      });
      setStepResults((prev) => Object.assign({}, prev, { [fileKey]: completo }));
      if (aoTerminar) aoTerminar(completo);
    } catch (err) {
      messageApi.error(`Não foi possível ler o arquivo: ${err.message}`);
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

  // Na Base nao ha "Continuar" por view: o upload ja valida e grava, e o cartao
  // passa a mostrar o resultado.
  // A tela de Prescricao ja leu e parseou o arquivo. Aqui so validamos e
  // gravamos, para a view contar no Resultado como qualquer outra.
  //
  // `parsedPrevia` segura em memoria (nunca no localStorage) o parsed das
  // views que a tela de Prescricao desenha (`VIEWS_DA_PRESCRICAO`), venham
  // dela ou da Validacao. E o que faz a tela montar sozinha quando o cliente
  // chega nela com os arquivos ja enviados — inclusive com os nomes dos
  // medicamentos no lugar dos codigos. Morre no reload, junto com o conteudo.
  const registrarDaPrescricao = (fileKey, arquivo) => {
    if (!Validator || !Storage || !arquivo || !arquivo.parsed) return;
    try {
      const parsed = arquivo.parsed;
      const result = Validator.validateFile(fileKey, parsed, { externalIndexes: externalIndexes() });
      const index = Validator.buildKeyIndex(fileKey, parsed);
      if (index.length) sessionIndexes.current[fileKey] = index;
      const preview = Validator.buildPreview(fileKey, parsed);
      const meta = {
        fileName: arquivo.nome,
        fileSize: arquivo.tamanho || 0,
        format: parsed.format,
        origem: "previa",
      };
      parsedPrevia.current[fileKey] = arquivo;
      const completo = Object.assign({}, result, {
        __index: index,
        __preview: preview,
        preview,
        __fileMeta: meta,
      });
      setStepResults((prev) => Object.assign({}, prev, { [fileKey]: completo }));
      setProgress((atual) => Storage.saveStep(atual, fileKey, completo, meta, index, preview));
    } catch (err) {
      messageApi.error(`Não foi possível validar ${SHORT_LABEL[fileKey] || fileKey}: ${err.message}`);
    }
  };

  // ---------------------------------------------------------------------
  // Lote: o cliente solta varios arquivos de uma vez
  // ---------------------------------------------------------------------
  //
  // Cada arquivo e lido, reconhecido pelo cabecalho (`Validator.guessFileKey`)
  // e validado. O estado e **por arquivo**: o que entrou, em qual view, com
  // quantos registros ou problemas — e o que nao foi reconhecido fica na lista
  // esperando o cliente dizer de qual view e, em vez de sumir.
  const validarDoLote = async (fileKey, file, parsedPronto) => {
    const parsed = parsedPronto || (await Validator.parseFileText(file.name, await file.text()));
    const result = Validator.validateFile(fileKey, parsed, { externalIndexes: externalIndexes() });
    const index = Validator.buildKeyIndex(fileKey, parsed);
    if (index.length) sessionIndexes.current[fileKey] = index;
    if (VIEWS_DA_PRESCRICAO.includes(fileKey)) {
      parsedPrevia.current[fileKey] = {
        nome: file.name,
        tamanho: file.size,
        parsed,
        registros: parsed.records || [],
      };
    }
    const preview = Validator.buildPreview(fileKey, parsed);
    const meta = { fileName: file.name, fileSize: file.size, format: parsed.format };
    const completo = Object.assign({}, result, {
      __index: index,
      __preview: preview,
      preview,
      __fileMeta: meta,
    });
    setStepFiles((prev) => Object.assign({}, prev, { [fileKey]: file }));
    setStepResults((prev) => Object.assign({}, prev, { [fileKey]: completo }));
    setProgress((atual) => Storage.saveStep(atual, fileKey, completo, meta, index, preview));
    return completo;
  };

  // Dois arquivos da mesma view: o ultimo vale, e os anteriores precisam
  // **dizer** que foram substituidos. Sumir em silencio e a falha classica do
  // upload em lote — o cliente acha que mandou e nao mandou.
  const marcarSubstituidos = (itens) => {
    const ultimo = {};
    itens.forEach((item, indice) => {
      if (item.key) ultimo[item.key] = indice;
    });
    return itens.map((item, indice) =>
      item.key && ultimo[item.key] !== indice
        ? Object.assign({}, item, { substituidoPor: itens[ultimo[item.key]].nome })
        : item
    );
  };

  const handleLote = async (arquivos) => {
    const lista = Array.from(arquivos || []);
    if (!lista.length || !Validator || !Storage) return;

    setLote({ ocupado: true, progresso: { feito: 0, total: lista.length }, resultados: [] });
    const saida = [];

    for (let i = 0; i < lista.length; i += 1) {
      const file = lista[i];
      try {
        const parsed = await Validator.parseFileText(file.name, await file.text());
        const palpite = Validator.guessFileKey(file.name, parsed.normalizedFields);
        if (!palpite) {
          saida.push({ nome: file.name, key: null, file, parsed });
        } else {
          const completo = await validarDoLote(palpite.key, file, parsed);
          saida.push({
            nome: file.name,
            key: palpite.key,
            file,
            parsed,
            status: completo.status,
            recordCount: completo.recordCount,
            issueCount: completo.issueCount,
          });
        }
      } catch (err) {
        saida.push({ nome: file.name, key: null, erro: err.message });
      }
      setLote((atual) => Object.assign({}, atual, { progresso: { feito: i + 1, total: lista.length } }));
    }

    // Num lote a ordem e arbitraria: se Prescricoes entrou antes de Setores, a
    // chave estrangeira dela foi medida sem o indice — e pode ter passado sem
    // checagem. Uma segunda passada em TODA view que tem referencia, agora com
    // todos os indices no lugar, corrige nos dois sentidos (falso erro e falso
    // verde).
    const temRef = (key) =>
      Object.keys((Validator.NOHARM_SCHEMA.files[key] || {}).refs || {}).length > 0;
    for (const item of saida) {
      if (!item.key || !item.parsed || !temRef(item.key)) continue;
      const atualizado = await validarDoLote(item.key, item.file || { name: item.nome, size: 0 }, item.parsed);
      item.status = atualizado.status;
      item.issueCount = atualizado.issueCount;
      item.recordCount = atualizado.recordCount;
    }

    setLote({
      ocupado: false,
      progresso: { feito: lista.length, total: lista.length },
      resultados: marcarSubstituidos(saida),
    });
  };

  // O cliente disse de qual view e o arquivo que o validador nao reconheceu.
  const handleEscolherDoLote = async (indice, fileKey) => {
    const item = lote.resultados[indice];
    if (!item || !item.file || !fileKey) return;
    const completo = await validarDoLote(fileKey, item.file, item.parsed);
    setLote((atual) => {
      const resultados = atual.resultados.slice();
      resultados[indice] = Object.assign({}, item, {
        key: fileKey,
        status: completo.status,
        recordCount: completo.recordCount,
        issueCount: completo.issueCount,
      });
      return Object.assign({}, atual, { resultados: marcarSubstituidos(resultados) });
    });
  };

  // Quem referencia `fileKey`, segundo o Anexo I. O critério é o schema, não o
  // status atual: uma view pode ter PASSADO só porque o índice ainda não
  // existia (`o motor só cobra a referência de quem recebeu índice`), e essa
  // também precisa ser reconferida.
  const quemReferencia = (fileKey) =>
    FILE_TYPES.map((file) => file.key).filter(
      (key) =>
        key !== fileKey &&
        Object.values((Validator.NOHARM_SCHEMA.files[key] || {}).refs || {}).includes(fileKey)
    );

  // Chegou um arquivo novo: toda view ja enviada que aponta para ele precisa ser
  // revalidada. O resultado dela foi conferido contra o indice antigo (ou
  // contra nenhum) e nao vale mais — sem isso o cliente corrige a view de
  // Setores e o erro continua vermelho em Prescricoes, ou pior: Prescricoes
  // segue verde sem nunca ter tido a chave checada.
  const revalidarDependentes = async (fileKeyNovo, progressoAtual) => {
    const alvos = quemReferencia(fileKeyNovo).filter(
      (key) => progressoAtual.steps[key] && stepFiles[key]
    );
    for (const key of alvos) {
      await validarDoLote(key, stepFiles[key]);
    }
    return alvos;
  };

  // Tirar um arquivo ja enviado: errou a view, mandou o arquivo errado, ou
  // simplesmente nao quer mandar aquela opcional. Antes o unico jeito de
  // desfazer era apagar o progresso inteiro.
  const handleRemover = (fileKey) => {
    setProgress((atual) => Storage.resetStep(atual, fileKey));
    delete sessionIndexes.current[fileKey];
    delete parsedPrevia.current[fileKey];
    setStepFiles((prev) => {
      const copia = Object.assign({}, prev);
      delete copia[fileKey];
      return copia;
    });
    setStepResults((prev) => {
      const copia = Object.assign({}, prev);
      delete copia[fileKey];
      return copia;
    });
    if (baseAberto === fileKey) setBaseAberto(null);
    // A lista do lote precisa contar a mesma historia: o arquivo saiu.
    setLote((atual) =>
      Object.assign({}, atual, {
        resultados: atual.resultados.map((item) =>
          item.key === fileKey ? Object.assign({}, item, { removido: true }) : item
        ),
      })
    );
  };

  const handleBaseUpload = async (fileKey, file) => {
    setBaseBusy(fileKey);
    let proximo = progress;
    await validarArquivo(fileKey, file, (resultado) => {
      proximo = Storage.saveStep(
        progress,
        fileKey,
        resultado,
        resultado.__fileMeta,
        resultado.__index,
        resultado.__preview
      );
      setProgress(proximo);
      setBaseAberto(fileKey);
    });
    const revalidadas = await revalidarDependentes(fileKey, proximo);
    if (revalidadas.length) {
      messageApi.info(
        `${revalidadas.map((key) => SHORT_LABEL[key]).join(", ")} ${
          revalidadas.length === 1 ? "foi revalidada" : "foram revalidadas"
        } com o arquivo novo.`
      );
    }
    setBaseBusy(null);
    return false;
  };

  // Erro de chave estrangeira aponta para outra view. Em vez de voltar na mao
  // etapa por etapa, o cliente pula direto para ela levando junto a lista do
  // que falta incluir.
  const handleFixRef = (group) => {
    const desvioNovo = {
      voltarPara: current.key,
      corrigindo: group.refFile,
      campo: group.refField,
      valores: group.distinctValues || [],
      total: group.distinctCount || 0,
    };
    setDesvio(desvioNovo);

    // Quase sempre a view quebrada e da Base, que agora e uma tela so.
    if (VIEWS_BASE.includes(group.refFile)) {
      setBaseAberto(group.refFile);
      goToScreen("base", "validacao");
      return;
    }
    const index = sequence.findIndex((item) => item.key === group.refFile);
    if (index >= 0) setStepIndex(index);
  };

  // Sair da Base durante um desvio volta para a etapa que pediu a correcao.
  const handleBaseContinue = () => {
    if (desvio) {
      const destino = sequence.findIndex((item) => item.key === desvio.voltarPara);
      const arquivo = stepFiles[desvio.voltarPara];
      const origem = desvio.voltarPara;
      setDesvio(null);
      setBaseAberto(null);
      if (destino >= 0) {
        setStepIndex(destino);
        goToScreen("steps", "validacao");
        if (arquivo) validarArquivo(origem, arquivo);
        return;
      }
    }
    setBaseAberto(null);
  };

  const advance = (fromProgress) => {
    const nextSequence = buildSequence(fromProgress || progress);
    if (stepIndex >= nextSequence.length - 1) {
      goToScreen("base", "validacao");
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
    // O primeiro passo do Movimento volta para a Base, nao para as boas-vindas.
    if (stepIndex === 0) {
      goToScreen("base", "validacao");
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

  // Apagar tudo tem que apagar TUDO — inclusive o que mora em memoria. Faltava
  // `parsedPrevia`, e a tela de Prescricao continuava desenhando o dado de um
  // progresso que nao existia mais. `versaoDados` entra como `key` do
  // `NoHarmUI`: sem isso, a tela montada segue com o estado interno dela, que
  // ela copiou de `arquivosIniciais` na montagem.
  const handleClear = () => {
    sessionIndexes.current = {};
    parsedPrevia.current = {};
    setStepFiles({});
    setStepResults({});
    setLote({ ocupado: false, progresso: { feito: 0, total: 0 }, resultados: [] });
    setBaseAberto(null);
    setDesvio(null);
    setProgress(Storage.clear());
    setStepIndex(0);
    setVersaoDados((n) => n + 1);
    messageApi.success("Progresso apagado.");
    goToScreen("inicio", "inicio");
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
      messageApi.error(`Arquivo de progresso inválido: ${err.message}`);
    }
    return false;
  };

  const handleExportReport = () => {
    const report = {
      geradoEm: new Date().toISOString(),
      padrao: "Anexo I do Contrato NoHarm - Integração de Dados",
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
          // `saved` vem do progresso, que nao guarda valor vindo do arquivo:
          // o relatorio leva a mensagem e a contagem, nao o dado do paciente.
          gruposDeErro: saved ? saved.issueGroups : null,
          validadoEm: saved ? saved.validatedAt : null,
        };
      }),
    };
    downloadText("noharm-validacao.json", `${JSON.stringify(report, null, 2)}\n`, "application/json");
  };

  const handleMenu = ({ key }) => {
    setMenuKey(key);
    if (key === "validacao") setScreen("base");
    if (key === "previa") setScreen("previa");
    if (key === "inicio") setScreen("inicio");
  };

  if (!Validator || !Storage) {
    return <div style={{ padding: 32 }}>Validador não carregado. Recarregue a página.</div>;
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
              { key: "inicio", icon: <HomeOutlined />, label: "Início" },
              { key: "previa", icon: <MedicineBoxOutlined />, label: "Prescrição" },
              { key: "validacao", icon: <AuditOutlined />, label: "Validação" },
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

            {screen === "base" && (
              <div className="nh-wizard">
                {desvio && <DetourBanner desvio={desvio} />}
                <BaseScreen
                  progress={progress}
                  busy={baseBusy}
                  aberto={baseAberto}
                  desvio={desvio}
                  onUpload={handleBaseUpload}
                  onToggle={setBaseAberto}
                  onContinue={handleBaseContinue}
                  onShowFields={(key) => {
                    setFieldsKey(key);
                    setFieldsOpen(true);
                  }}
                  onExplainHospital={() => setHospitalOpen(true)}
                  onExplicarRecorte={() => setRecorteOpen(true)}
                  onIrPrescricao={() => goToScreen("previa", "previa")}
                  onRemover={handleRemover}
                  arquivos={stepFiles}
                  resultados={stepResults}
                  onExport={handleExportReport}
                  onClear={handleClear}
                  onExportProgress={handleExportProgress}
                  onImportProgress={handleImportProgress}
                  lote={lote}
                  onLote={handleLote}
                  onEscolherDoLote={handleEscolherDoLote}
                  onLimparLote={() =>
                    setLote({ ocupado: false, progresso: { feito: 0, total: 0 }, resultados: [] })
                  }
                />
                <FieldsModal fileKey={fieldsKey} open={fieldsOpen} onClose={() => setFieldsOpen(false)} />
                <HospitalModal open={hospitalOpen} onClose={() => setHospitalOpen(false)} />
                <RecorteModal open={recorteOpen} onClose={() => setRecorteOpen(false)} />
              </div>
            )}

            {screen === "steps" && current && (
              <div className="nh-wizard">
                <Timeline fase="movimento" position={posicaoMovimento} total={totalMovimento} />

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
                  onExplicarRecorte={() => setRecorteOpen(true)}
                      onFixRef={handleFixRef}
                      onUpload={handleStepUpload}
                      onContinue={handleContinue}
                      onSkip={handleSkip}
                      onBack={handleBack}
                      onRedo={() => handleRedo(current.key)}
                      onFinish={() => goToScreen("base", "validacao")}
                      onShowFields={() => {
                        setFieldsKey(current.key);
                        setFieldsOpen(true);
                      }}
                    />
                    <FieldsModal fileKey={fieldsKey || current.key} open={fieldsOpen} onClose={() => setFieldsOpen(false)} />
                    <HospitalModal open={hospitalOpen} onClose={() => setHospitalOpen(false)} />
                <RecorteModal open={recorteOpen} onClose={() => setRecorteOpen(false)} />
                  </>
                )}
              </div>
            )}

            {screen === "inicio" && (
              <HomeScreen
                progress={progress}
                onIr={(key) => {
                  setMenuKey(key);
                  if (key === "validacao" || key === "referencia" || key === "review") setScreen("base");
                  else setScreen(key);
                }}
              />
            )}

            {screen === "previa" && (
              <NoHarmUI
                key={versaoDados}
                arquivosIniciais={parsedPrevia.current}
                onValidado={registrarDaPrescricao}
                onIrValidacao={() => goToScreen("base", "validacao")}
              />
            )}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
