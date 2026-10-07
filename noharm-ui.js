/*
 * Tela de Prescricao da NoHarm: a porta de entrada do validador.
 *
 * A tela e inteira receptora de dado. Nao ha nada de mentira aqui: cada area
 * fica em branco ate o cliente importar a view que a alimenta.
 *
 *   Prescricoes e Itens -> cabecalho, tabela de itens e parte do paciente
 *   Pessoa / Atendimento-> o resto do cartao do paciente
 *   Exames              -> cartao de exames
 *   Evolucao            -> cartao de evolucoes
 *
 * E a prescricao ESCALA: os codigos que ela usa (medicamento, frequencia,
 * unidade, setor) viram cartoes que pedem o cadastro correspondente. Importou,
 * a tela diz se aquela view cobre os codigos da prescricao e se ela mesma esta
 * de acordo com o Anexo I. Essa checagem usa o motor de `validator.js`.
 *
 * Fica tudo dentro de uma IIFE porque os scripts do validador compartilham o
 * escopo global (ver AGENTS.md) e os nomes daqui colidiriam com os do app.js.
 */
window.NoHarmUI = (function () {
  const { useState, useMemo } = React;
  const {
    Tag, Button, Badge, Tabs, Table, Collapse, Empty, Row, Col, Upload, Modal,
    ConfigProvider, Tooltip, Space, Alert, Spin, Switch, Input, Dropdown, FloatButton,
  } = antd;
  const {
    WarningOutlined, PieChartOutlined, UserOutlined, FileOutlined,
    MessageOutlined, TagsOutlined, FilePptOutlined,
    MoreOutlined, EditOutlined,
    ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, CaretDownOutlined,
    CaretUpOutlined, InfoCircleOutlined, FilterOutlined, AlertOutlined,
    CompressOutlined, DiffOutlined, SortAscendingOutlined, FormOutlined,
    ForkOutlined, ExperimentOutlined, HourglassOutlined, FileProtectOutlined,
    QuestionOutlined, InboxOutlined, SwapOutlined, PlusOutlined, EllipsisOutlined,
    EyeOutlined, EyeInvisibleOutlined, ReadOutlined,
    CloseCircleFilled, CheckCircleFilled,
  } = icons;

  const SVG = window.NOHARM_UI_ICONS;
  const EXEMPLO = window.NOHARM_UI_EXEMPLO;
  const VAZIO = "—";
  const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());

  /* ------------------------- o que a tela pede ----------------------- */

  // os alertas sao calculados pela NoHarm: aqui so existe a moldura
  const ALERTAS = [
    "fork", "interacao", "max", "experiment", "hourglass",
    "iv", "alergia", "sonda", "duplicidade", "protocolo",
  ];

  // cadastros que a prescricao referencia: a view precisa cobrir os codigos
  const CADASTROS = [
    { key: "medicamentos", label: "Medicamento", campo: "fkmedicamento", coluna: "FKMEDICAMENTO" },
    { key: "frequencia", label: "Frequências", campo: "fkfrequencia", coluna: "FKFREQUENCIA" },
    { key: "unidades", label: "Unidades", campo: "fkunidademedida", coluna: "FKUNIDADEMEDIDA" },
    { key: "setores", label: "Setores", campo: "fksetor", coluna: "FKSETOR" },
  ];

  // cadastros que a prescricao nao referencia, mas que a integracao pede
  const OUTROS = [
    { key: "hospitais", label: "Hospitais" },
    { key: "vias", label: "Vias" },
  ];

  /* ======================= leitura dos arquivos ======================= */

  const lerArquivo = async (file) => {
    const parsed = await Validator.parseFileText(file.name, file.text ? await file.text() : "");
    return { nome: file.name, tamanho: file.size || 0, parsed, registros: parsed.records || [] };
  };

  const indicePorNome = (arquivo, campoChave) => {
    const mapa = new Map();
    if (!arquivo) return mapa;
    arquivo.registros.forEach((r) => {
      const chave = txt(r[campoChave]);
      if (chave) mapa.set(chave, txt(r.nome) || chave);
    });
    return mapa;
  };

  const dataHora = (valor, comHora = true) => {
    const v = txt(valor);
    if (!v) return "";
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return v;
    const dia = `${m[3]}/${m[2]}/${m[1]}`;
    return comHora && m[4] ? `${dia} ${m[4]}:${m[5]}` : dia;
  };

  const anos = (nascimento) => {
    const m = txt(nascimento).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const hoje = new Date();
    const nasc = new Date(+m[1], +m[2] - 1, +m[3]);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade -= 1;
    return idade;
  };

  const ABA_POR_ORIGEM = {
    medicamentos: "drugs",
    solucoes: "drugs",
    "proced/exames": "procedures",
    dietas: "diet",
  };

  /* ---------------------- prescricao -> tela ------------------------- */
  function montarPrescricao(arquivos) {
    const arq = arquivos.prescricoes;
    if (!arq) return null;

    const comId = arq.registros.filter((r) => r && txt(r.fkprescricao));
    if (!comId.length) {
      return { erro: "Nenhuma linha com FKPRESCRICAO. Esse é o arquivo da view de Prescrições e Itens?" };
    }

    const nomes = indicePorNome(arquivos.medicamentos, "fkmedicamento");
    const freqs = indicePorNome(arquivos.frequencia, "fkfrequencia");
    const unids = indicePorNome(arquivos.unidades, "fkunidademedida");

    const idAlvo = txt(comId[0].fkprescricao);
    const daPrescricao = comId.filter((r) => txt(r.fkprescricao) === idAlvo);
    const cab = daPrescricao[0];

    const linhaDe = (rec) => {
      const codigo = txt(rec.fkmedicamento);
      const unidade = txt(rec.fkunidademedida);
      const periodo = txt(rec.periodo);
      const total = txt(rec.periodo_total);
      return {
        nome: nomes.get(codigo) || codigo || VAZIO,
        semNome: !nomes.has(codigo),
        period: periodo ? `D${periodo}${total ? `/${total}` : ""}` : "",
        // Dose e frequencia mostram a sigla da view (FKUNIDADEMEDIDA,
        // FKFREQUENCIA), como na NoHarm: "1 AMP", "12/12". O nome do cadastro
        // vai no title, para o cliente conferir que o codigo casou.
        dose: [txt(rec.dose), unidade].filter(Boolean).join(" "),
        doseTitulo: unids.get(unidade) || "",
        freq: txt(rec.fkfrequencia),
        freqTitulo: freqs.get(txt(rec.fkfrequencia)) || "",
        time: txt(rec.horario),
        via: txt(rec.via),
        msg: !!txt(rec.complemento),
        suspenso: !!txt(rec.dtsuspensao),
        // score e flag sao calculados pela NoHarm: nao vem no arquivo
        score: "",
        scoreColor: "none",
        flag: null,
        tags: [],
        aware: null,
        whitelist: false,
        aba: ABA_POR_ORIGEM[txt(rec.origem).toLowerCase()] || "drugs",
      };
    };

    const itens = [];
    const solucoes = new Map();
    daPrescricao.forEach((rec) => {
      const linha = linhaDe(rec);
      const grupo = txt(rec.slagrupamento);
      if (grupo && grupo !== "0") {
        if (!solucoes.has(grupo)) {
          const novo = { solucao: true, grupo: [], aba: linha.aba };
          solucoes.set(grupo, novo);
          itens.push(novo);
        }
        solucoes.get(grupo).grupo.push(linha);
        return;
      }
      itens.push({ linha });
    });

    // quantos codigos distintos a prescricao usa de cada cadastro
    const codigos = {};
    CADASTROS.forEach((c) => {
      codigos[c.key] = new Set(arq.registros.map((r) => txt(r[c.campo])).filter(Boolean)).size;
    });

    return {
      id: idAlvo,
      badge: null,
      inicio: dataHora(cab.dtprescricao),
      fim: dataHora(cab.dtvigencia),
      leito: txt(cab.leito) || VAZIO,
      prescritor: txt(cab.prescritor) || VAZIO,
      atendimento: txt(cab.nratendimento) || VAZIO,
      fkpessoa: txt(cab.fkpessoa),
      convenio: txt(cab.convenio),
      prontuario: txt(cab.prontuario),
      fksetor: txt(cab.fksetor),
      especialidade: txt(cab.especialidade),
      outras: new Set(comId.map((r) => txt(r.fkprescricao))).size - 1,
      codigos,
      itens,
    };
  }

  /* ------------------------ paciente -> cartao ----------------------- */
  // A prescricao ja traz parte do paciente. A view de Pessoa completa o resto.
  // mesma ordem de campos do AdmissionData.jsx
  function dadosAtendimento(presc, rec, setores) {
    const p = presc || {};
    const r = rec || {};
    const setor = setores.get(txt(r.fksetor) || p.fksetor) || txt(r.fksetor) || p.fksetor;
    return [
      { label: "Atendimento", valor: p.atendimento || txt(r.nratendimento) || VAZIO },
      { label: "Data de internação", valor: dataHora(r.dtinternacao) || VAZIO },
      { label: "Setor", valor: setor || VAZIO },
      { label: "Setor anterior", valor: VAZIO },
      { label: "Leito", valor: txt(r.leito) || p.leito || VAZIO },
      { label: "Segmento", valor: VAZIO },
      { label: "Prontuário", valor: p.prontuario || VAZIO },
      { label: "Prescritor", valor: p.prescritor || VAZIO },
      { label: "Convênio", valor: p.convenio || VAZIO },
      { label: "Médico responsável", valor: txt(r.medico_responsavel) || VAZIO },
    ];
  }

  function montarPaciente(arquivos, presc) {
    const setores = indicePorNome(arquivos.setores, "fksetor");
    const arq = arquivos.pessoa;
    const rec = arq
      ? arq.registros.find((r) => txt(r.nratendimento) === presc.atendimento) || arq.registros[0]
      : null;

    const base = {
      nome: presc && presc.fkpessoa ? `Paciente ${presc.fkpessoa}` : VAZIO,
      completo: !!rec,
      dados: [],
      tags: [],
    };

    if (!rec) {
      const vindo = (v) => (presc && v ? v : VAZIO);
      base.dados = [
        { label: "Idade", valor: VAZIO, falta: true },
        { label: "Sexo", valor: VAZIO, falta: true },
        { label: "Altura", valor: VAZIO, falta: true },
        { label: "Peso", valor: VAZIO, falta: true },
        { label: "Convênio", valor: vindo(presc && presc.convenio) },
        { label: "Prontuário", valor: vindo(presc && presc.prontuario) },
        { label: "Setor", valor: vindo(presc && (setores.get(presc.fksetor) || presc.fksetor)) },
        { label: "Especialidade", valor: vindo(presc && presc.especialidade) },
      ];
      base.atendimento = dadosAtendimento(presc, null, setores);
      return base;
    }

    const peso = parseFloat(txt(rec.peso).replace(",", "."));
    const altura = parseFloat(txt(rec.altura).replace(",", "."));
    const idade = anos(rec.dtnascimento);
    // o Anexo I nao fixa a unidade de ALTURA: vem em metro (1,75) ou em
    // centimetro (175). Abaixo de 3 so pode ser metro.
    const emMetros = altura && altura < 3;
    const metros = emMetros ? altura : altura / 100;
    const imc = peso && altura ? (peso / metros ** 2).toFixed(2) : null;
    const sexo = txt(rec.sexo).toUpperCase();

    base.atendimento = dadosAtendimento(presc, rec, setores);
    base.dados = [
      { label: "Idade", valor: idade !== null ? `${idade}a` : VAZIO, small: dataHora(rec.dtnascimento, false) },
      { label: "Sexo", valor: sexo === "M" ? "Masculino" : sexo === "F" ? "Feminino" : txt(rec.sexo) || VAZIO },
      { label: "Altura", valor: altura ? `${altura} ${emMetros ? "m" : "cm"}` : VAZIO },
      { label: "Peso", valor: peso ? `${peso} Kg` : VAZIO, small: dataHora(rec.dtpeso) },
      { label: "IMC", valor: imc ? `${imc} kg/m²` : VAZIO },
      { label: "Cor da pele", valor: txt(rec.cor) || VAZIO },
      { label: "Setor", valor: setores.get(txt(rec.fksetor)) || txt(rec.fksetor) || VAZIO },
      { label: "Leito", valor: txt(rec.leito) || (presc && presc.leito) || VAZIO },
    ];
    return base;
  }

  /* ------------------------ exames -> cartao ------------------------- */
  function montarExames(arquivos, presc) {
    const arq = arquivos.exame;
    if (!arq) return null;

    const doAtendimento = presc
      ? arq.registros.filter((r) => txt(r.nratendimento) === presc.atendimento)
      : [];
    const lista = doAtendimento.length ? doAtendimento : arq.registros;

    const ultimo = new Map();
    lista.forEach((r) => {
      const tipo = txt(r.tpexame).toUpperCase();
      if (!tipo) return;
      const atual = ultimo.get(tipo);
      if (!atual || txt(r.dtexame) > txt(atual.dtexame)) ultimo.set(tipo, r);
    });

    return {
      doAtendimento: doAtendimento.length > 0,
      lista: Array.from(ultimo.entries()).map(([tipo, r]) => ({
        sigla: tipo,
        valor: [txt(r.resultado), txt(r.unidade)].filter(Boolean).join(" "),
        data: dataHora(r.dtexame),
      })),
    };
  }

  /* ----------------------- evolucoes -> cartao ----------------------- */
  function montarEvolucoes(arquivos, presc) {
    const arq = arquivos.evolucao;
    if (!arq) return null;

    const doAtendimento = presc
      ? arq.registros.filter((r) => txt(r.nratendimento) === presc.atendimento)
      : [];
    const lista = doAtendimento.length ? doAtendimento : arq.registros;

    return {
      doAtendimento: doAtendimento.length > 0,
      total: lista.length,
      textos: lista
        .slice()
        .sort((a, b) => txt(b.dtevolucao).localeCompare(txt(a.dtevolucao)))
        .map((r) => ({
          data: dataHora(r.dtevolucao),
          autor: [txt(r.nome), txt(r.cargo)].filter(Boolean).join(" · "),
          texto: txt(r.texto),
        })),
    };
  }

  /* ===================== checagem de um cadastro ====================== */
  // Duas perguntas: a view está de acordo com o Anexo I, e ela cobre os
  // codigos que a prescricao usa? Quem responde e o motor do validador.
  function checarCadastro(chave, arquivos, cruzar) {
    const arq = arquivos[chave];
    if (!arq) return null;

    const propria = Validator.validateFile(chave, arq.parsed);
    let faltando = [];

    if (cruzar && arquivos.prescricoes) {
      const indice = { [chave]: Validator.buildKeyIndex(chave, arq.parsed) };
      const cruzada = Validator.validateFile("prescricoes", arquivos.prescricoes.parsed, {
        externalIndexes: indice,
      });
      faltando = (cruzada.issueGroups || []).filter((g) => g.refFile === chave);
    }

    const problemas = (propria.issueGroups || []).length + faltando.length;
    return { arquivo: arq, propria, faltando, ok: problemas === 0, problemas };
  }

  /* ====================== o que a NoHarm calcularia =================== */
  /*
   * Alertas, escore e os indicadores da evolucao saem da base clinica da
   * NoHarm — nenhuma view traz isso. Para o cliente ver a tela montada, a
   * simulacao abaixo preenche esses numeros a partir da propria prescricao.
   * E deterministica (mesmo arquivo, mesmos numeros) e vem sempre rotulada
   * como simulada: o cliente nao pode ler isso como analise do dado dele.
   */
  const semente = (texto) => {
    let h = 7;
    for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) % 99991;
    return h;
  };

  const todasAsLinhas = (itens) => {
    const linhas = [];
    itens.forEach((i) => (i.linha ? linhas.push(i.linha) : linhas.push(...i.grupo)));
    return linhas;
  };

  function simularAlertas(presc) {
    const linhas = todasAsLinhas(presc.itens);
    const s = semente(presc.id);
    const sorteio = (pos, max) => (max <= 0 ? 0 : Math.floor(s / 7 ** pos) % (max + 1));

    // duplicidade dá para contar de verdade: o mesmo item mais de uma vez
    const vezes = new Map();
    linhas.forEach((l) => vezes.set(l.nome, (vezes.get(l.nome) || 0) + 1));
    const duplicados = Array.from(vezes.values()).filter((v) => v > 1).length;

    const teto = Math.max(1, Math.min(5, Math.ceil(linhas.length / 3)));
    const valores = {
      fork: sorteio(1, 1),
      interacao: sorteio(2, teto),
      max: sorteio(3, teto),
      experiment: sorteio(4, 2),
      hourglass: sorteio(5, 1),
      iv: sorteio(6, 1),
      alergia: 0,
      sonda: sorteio(7, 1),
      duplicidade: duplicados,
      protocolo: 0,
    };

    return ALERTAS.map((icon) => ({ icon, valor: valores[icon], alerta: valores[icon] > 0 }));
  }

  function simularEscore(presc, alertas) {
    const linhas = todasAsLinhas(presc.itens);
    const soma = alertas.reduce((t, a) => t + a.valor, 0);
    const valor = linhas.length * 4 + soma * 7;
    // mesmas faixas do getScoreColor() da tela de verdade
    const cor =
      valor > 90 ? "#E53935" : valor > 60 ? "#FB8C00" : valor > 10 ? "#FDD835" : valor > 0 ? "#7CB342" : "#959595";
    return { valor, variacao: null, cor };
  }

  // score e flag de cada linha, no mesmo formato da tela de verdade
  function simularLinha(linha) {
    const s = semente(linha.nome);
    const score = s % 4; // 0 a 3
    return {
      ...linha,
      score: score ? String(score) : "",
      scoreColor: score >= 3 ? "red" : score ? "orange" : "none",
      flag: String(s % 3 === 0 ? 0 : s % 3),
      flagColor: s % 3 === 0 ? "green" : "red",
    };
  }

  function simularIndicadores(total) {
    const base = Math.max(1, total);
    return [
      { key: "diseases", valor: base * 4 },
      { key: "complication", valor: Math.floor(base / 2) },
      { key: "germes", valor: base % 2 },
      { key: "medications", valor: base * 6 },
      { key: "symptoms", valor: base * 2 },
    ];
  }

  /* ========================= pecas da tela ============================ */

  function Importar({ label, onArquivo, pequeno, link }) {
    const [lendo, setLendo] = useState(false);
    const [erro, setErro] = useState(null);

    const receber = async (file) => {
      setLendo(true);
      setErro(null);
      try {
        onArquivo(await lerArquivo(file));
      } catch (e) {
        setErro(e.message);
      } finally {
        setLendo(false);
      }
    };

    return (
      <Spin spinning={lendo} size="small">
        <Upload
          accept=".csv,.json,.txt"
          showUploadList={false}
          beforeUpload={(file) => {
            receber(file);
            return false;
          }}
        >
          {link ? (
            <button type="button" className="nhui-chip falta">
              <PlusOutlined /> {label}
            </button>
          ) : (
            <Button size={pequeno ? "small" : "middle"} icon={<PlusOutlined />}>
              {label}
            </Button>
          )}
        </Upload>
        {erro && <div className="nhui-slot-erro">{erro}</div>}
      </Spin>
    );
  }

  /* ------------------------- o botao do exemplo ----------------------- */
  // Fica sozinho acima do cabecalho, grande: e o atalho para o cliente ver a
  // tela montada antes de ter importado qualquer coisa.
  // as views que o detalhe sabe explicar (a barra que listava saiu da tela)
  const FONTES = [
    { key: "prescricoes", label: "Prescrição" },
    { key: "pessoa", label: "Paciente" },
    { key: "exame", label: "Exames" },
    { key: "evolucao", label: "Evolução" },
    ...CADASTROS,
    ...OUTROS,
  ];

  // A tela de verdade ja tem um FloatButton roxo no canto (#a991d6, do
  // ScreeningFloatButtonGroup). O exemplo entra ali: nao empurra nada do
  // layout e fica sempre a mao.
  function BotaoExemplo({ exemplo, onExemplo }) {
    return (
      <Tooltip
        title={exemplo ? "Voltar para os seus dados" : "Ver a tela preenchida, como fica na NoHarm"}
      >
        <Button
          size="large"
          icon={exemplo ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          className={`nhui-btn-exemplo${exemplo ? " ligado" : ""}`}
          onClick={() => onExemplo(!exemplo)}
        >
          {exemplo ? "Sair do exemplo" : "Ver exemplo"}
        </Button>
      </Tooltip>
    );
  }

  // os cartoes que o "Ver mais" abre: a NoHarm extrai esses trechos da
  // evolucao, entao fora do exemplo eles vem vazios
  function CartaoNota({ titulo, chave, nota }) {
    return (
      <div className={`nhui-card full-height nhui-ind-${chave}`}>
        <div className="header">
          <h3 className="title">{titulo}</h3>
        </div>
        <div className="content">
          <div className="text-content">{nota ? nota.texto : "--"}</div>
        </div>
        <div className="footer">
          <div className="stats light">{nota ? nota.data : ""}</div>
        </div>
      </div>
    );
  }

  function PageHeader({ presc, exemplo, onExemplo }) {
    return (
      <Row className="nhui-page-header">
        <Col xs={24} md={8}>
          <h1 className="nhui-page-title">
            Atendimento n° <span className="nhui-atendimento">{presc ? presc.atendimento : VAZIO}</span>
            <span className="legend">
              {presc
                ? `Prescrição ${presc.id}`
                : exemplo
                  ? "exemplo"
                  : "nenhum dado importado ainda"}
            </span>
          </h1>
        </Col>
        <Col xs={24} md={7}>
          <div className="nhui-page-exemplo">
            <BotaoExemplo exemplo={exemplo} onExemplo={onExemplo} />
          </div>
        </Col>
        <Col xs={24} md={9} />

      </Row>
    );
  }

  // Duas abas tem conteudo. As outras quatro existem na tela de verdade, entao
  // ficam no lugar — cinzas e sem clique, para nao prometerem o que nao tem.
  const ABAS_PACIENTE = [
    { key: "dados", icon: <UserOutlined style={{ fontSize: 18 }} /> },
    { key: "atend", icon: <FileOutlined style={{ fontSize: 18 }} /> },
    { key: "obs", icon: <MessageOutlined style={{ fontSize: 18 }} />, inerte: true },
    { key: "tags", icon: <TagsOutlined style={{ fontSize: 18 }} />, inerte: true },
    { key: "prot", icon: <FilePptOutlined style={{ fontSize: 18 }} />, inerte: true },
    { key: "rel", icon: <PieChartOutlined style={{ fontSize: 18 }} />, inerte: true },
  ];

  function PatientCard({ paciente, onArquivo }) {

    const corpo = (
      <div className="patient-data">
        {paciente.dados.map((d) => (
          <div className="patient-data-item" key={d.label}>
            <div className="patient-data-item-label">{d.label}</div>
            <div className={`patient-data-item-value${d.falta ? " falta" : ""}`}>
              {d.valor} {d.small && <span className="small">{d.small}</span>}
            </div>
          </div>
        ))}
        {!!(paciente.tags || []).length && (
          <div className="patient-data-item full">
            <div
              className="patient-data-item-value"
              style={{ display: "flex", rowGap: 5, overflow: "auto", flexWrap: "wrap" }}
            >
              {paciente.tags.map((t) => (
                <div className={`tag nhui-ind-${t.key}`} key={t.key}>{t.label}</div>
              ))}
            </div>
          </div>
        )}
        {!paciente.completo && onArquivo && (
          <div className="patient-data-item full nhui-pede">
            <Importar label="Pessoa / Atendimento" onArquivo={onArquivo} pequeno />
          </div>
        )}
      </div>
    );

    const atendimento = (
      <div className="patient-data">
        {(paciente.atendimento || []).map((d) => (
          <div className="patient-data-item" key={d.label}>
            <div className="patient-data-item-label">{d.label}</div>
            <div className={`patient-data-item-value${d.valor === VAZIO ? " falta" : ""}`}>{d.valor}</div>
          </div>
        ))}
      </div>
    );

    return (
      <div className="nhui-patient">
        <div className="patient-header">
          <div className="patient-header-name">
            <span style={{ fontSize: 14 }}>{paciente.nome}</span>
            <span className="nhui-dica-campo">exemplo: aqui fica o nome do paciente</span>
          </div>
          <div className="patient-header-action">
            <Button
              type="primary"
              ghost
              icon={<WarningOutlined style={{ fontSize: 16 }} />}
              style={{ marginRight: 3 }}
            />
            <button className="patient-menu">
              <MoreOutlined style={{ fontSize: 28 }} />
            </button>
          </div>
        </div>
        <div className="patient-body">
          <Tabs
            type="card"
            items={ABAS_PACIENTE.map((a) => ({
              key: a.key,
              label: a.icon,
              disabled: a.inerte,
              children: a.key === "atend" ? atendimento : corpo,
            }))}
          />
        </div>
      </div>
    );
  }

  function ExamsCard({ exames, onArquivo }) {
    const temExames = exames && exames.lista.length > 0;
    return (
      <div className="nhui-card full-height max-height">
        <div className="header">
          <h3 className="title">
            Exames
            <Tooltip title="Exames recentes do paciente">
              <Button shape="circle" size="small" icon={<QuestionOutlined />} />
            </Tooltip>
          </h3>
        </div>
        <div className="content">
          <div className="nhui-exam-wrap">
            {temExames ? (
              <div className="exam-list">
                {exames.lista.map((e) => (
                  <div className="exam-item" key={e.sigla}>
                    <div className={`nhui-exam${e.alerta ? " alerta" : ""}`}>
                      <div className="name">{e.sigla}</div>
                      <div className="icon"><span>{e.valor}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="Nenhum registro encontrado">
                {onArquivo && <Importar label="Importar Exames" onArquivo={onArquivo} />}
              </Empty>
            )}
          </div>
        </div>
        {temExames && (
          <div className="footer">
            <div className="stats" />
            <div className="action"><Button type="link">Ver todos</Button></div>
          </div>
        )}
      </div>
    );
  }

  const ALERT_ICON = {
    fork: () => <ForkOutlined />,
    interacao: SVG.interacao,
    max: SVG.max,
    experiment: () => <ExperimentOutlined />,
    hourglass: () => <HourglassOutlined />,
    iv: SVG.iv,
    alergia: SVG.alergia,
    sonda: SVG.sonda,
    duplicidade: SVG.duplicidade,
    protocolo: () => <FileProtectOutlined />,
  };

  // so a moldura tem nome aqui: o calculo de cada alerta e da NoHarm
  const ALERT_LABEL = {
    fork: "Incompatibilidade em Y",
    interacao: "Interações medicamentosas",
    max: "Dose máxima ultrapassada",
    experiment: "Exames alterados",
    hourglass: "Tempo de tratamento",
    iv: "Via intravenosa",
    alergia: "Alergia",
    sonda: "Administração por sonda",
    duplicidade: "Duplicidade terapêutica",
    protocolo: "Protocolos",
  };

  const NOTA_SIMULADO = (
    <Tooltip title="A NoHarm calcula isto com a base clínica dela. Aqui é uma simulação, só para você ver a tela montada.">
      <span className="nhui-simulado">simulado</span>
    </Tooltip>
  );

  function AlertsCard({ alertas, simulado }) {
    return (
      <div className="nhui-card nhui-card-alertas" style={{ height: "100%" }}>
        <div className="header">
        <h3 className="title">
          <span className="nhui-title-txt">
            Alertas
            {alertas && simulado && NOTA_SIMULADO}
          </span>
        </h3>
        </div>
        <div className="content">
          <div className="nhui-alerts">
            {(alertas || ALERTAS.map((icon) => ({ icon, valor: null }))).map((a, i) => {
              const Icone = ALERT_ICON[a.icon];
              return (
                <Tooltip key={i} title={ALERT_LABEL[a.icon]}>
                  <div className={a.alerta ? "alert" : ""}>
                    <span className="anticon"><Icone /></span>{" "}
                    <span>{a.valor === null ? VAZIO : a.valor}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function NotesCard({ evolucoes, onArquivo, onVer, simulado }) {
    return (
      <div className={`nhui-card${evolucoes ? "" : " nhui-vazio"}`} style={{ minHeight: 113, flex: 1 }}>
        <h3 className="title">
          Evolucoes
          {evolucoes && simulado && NOTA_SIMULADO}
        </h3>
        <div className="content">
          {evolucoes ? (
            <div className="stats stats-center" style={{ marginTop: 6 }}>
              {evolucoes.indicadores.map((e) => (
                <div key={e.key}>
                  <span className={`ind-tag nhui-ind-${e.key}`}>{e.valor}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="nhui-slot nhui-slot-min">
              {onArquivo && <Importar label="Evolução" onArquivo={onArquivo} pequeno />}
            </div>
          )}
        </div>
        {evolucoes && (
          <div className="footer" style={{ marginTop: 0 }}>
            <div />
            <div className="action"><Button type="link" onClick={onVer}>Visualizar</Button></div>
          </div>
        )}
      </div>
    );
  }

  function ScoreCard({ escore, simulado }) {
    return (
      <div className={`nhui-card${escore ? "" : " nhui-vazio"}`} style={{ height: "100%" }}>
        <h3 className="title">Escore Global</h3>
        <div className="content">
          <div className="stat-variation">
            <div className="stat-variation-number">
              {escore ? escore.valor : VAZIO}
              {escore && escore.variacao && <ArrowUpOutlined />}
            </div>
            <div className="stat-variation-percentage">
              {escore && escore.variacao ? <span>{escore.variacao}</span> : escore && simulado ? NOTA_SIMULADO : null}
            </div>
          </div>
        </div>
        <div className="stat-marker" style={{ background: escore ? escore.cor : "#e0e0e0" }} />
      </div>
    );
  }

  /* ----------------------- tabela de medicamentos --------------------- */
  function Score({ linha }) {
    if (!linha.score && linha.flag === null) return null;
    const cor = linha.scoreColor === "red" ? "#f44336" : "#f57f17";
    return (
      <div
        className="score-container"
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        {/* sem score a celula fica vazia: um Tag transparente vira um risco */}
        {linha.score ? (
          <Tag style={{ background: cor, borderColor: cor, color: "#fff", margin: 0, width: 30, textAlign: "center", padding: 0 }}>
            {linha.score}
          </Tag>
        ) : (
          <span style={{ width: 30 }} />
        )}
        <span className={`flag has-score ${linha.flagColor}`}>{linha.flag}</span>
        <div style={{ width: 18 }} />
      </div>
    );
  }

  const COL = [
    {
      title: "",
      dataIndex: "score",
      width: 85,
      align: "center",
      render: (_, r) => (r.divider ? null : <Score linha={r} />),
    },
    {
      title: "Medicamento",
      dataIndex: "nome",
      width: "35%",
      align: "left",
      render: (_, r) =>
        r.divider ? null : (
          <>
            <a className={`nhui-drug-link${r.semNome ? " sem-nome" : ""}`}>{r.nome}</a>
            <span style={{ marginLeft: 8 }}>
              <Space size="small">
                {(r.tags || []).map(([t, cor]) => (
                  <Tag color={cor} key={t}>{t}</Tag>
                ))}
                {r.aware && (
                  <div className={`nhui-aware nhui-aware-${r.aware}`}>
                    <span className="aware-dot" />
                    <span className="aware-label">A</span>
                  </div>
                )}
              </Space>
            </span>
          </>
        ),
    },
    { title: <Tooltip title="Período">Per.</Tooltip>, dataIndex: "period", width: 65, align: "left" },
    {
      title: "Dose",
      dataIndex: "dose",
      align: "center",
      render: (valor, linha) => (linha.doseTítulo ? <Tooltip title={linha.doseTítulo}>{valor}</Tooltip> : valor),
    },
    {
      title: "Frequência",
      dataIndex: "freq",
      align: "center",
      render: (valor, linha) => (linha.freqTítulo ? <Tooltip title={linha.freqTítulo}>{valor}</Tooltip> : valor),
    },
    { title: "Horários", dataIndex: "time", align: "center" },
    { title: "Via", dataIndex: "via", width: 85, align: "center" },
    {
      title: "Tags",
      dataIndex: "tagsCol",
      width: 90,
      align: "center",
      render: (_, r) =>
        r.divider ? null : (
          <div className="nhui-table-tags">
            <span className="tag gtm-tag-msg">
              {r.msg && (
                <Tooltip title="Possui recomendação">
                  <MessageOutlined style={{ fontSize: 18, color: "#108ee9" }} />
                </Tooltip>
              )}
            </span>
            <span className="tag gtm-tag-warn" />
          </div>
        ),
    },
    {
      title: "Ações",
      dataIndex: "acoes",
      width: 80,
      render: (_, r) =>
        r.divider ? null : (
          <div className="nhui-table-tags">
            <Button type="primary" ghost icon={<WarningOutlined style={{ fontSize: 16 }} />} />
            <Button
              type="primary"
              ghost
              icon={<FormOutlined style={{ fontSize: 16 }} />}
              style={{ background: "inherit" }}
            />
          </div>
        ),
    },
  ];

  // o filtro some com o item inteiro; a ordem move o item, nao a linha de
  // dentro dele: quebrar um grupo de solucao ao meio nao faria sentido
  function prepararItens(itens, filtro, ordem) {
    const primeira = (item) => (item.linha ? item.linha : item.grupo[0]);
    let lista = itens;

    const busca = (filtro || "").trim().toLowerCase();
    if (busca) {
      lista = lista.filter((item) =>
        (item.linha ? [item.linha] : item.grupo).some((l) =>
          String(l.nome || "").toLowerCase().includes(busca)
        )
      );
    }

    if (ordem && ordem.campo) {
      lista = lista.slice().sort((a, b) => {
        const va = String(primeira(a)[ordem.campo] || "");
        const vb = String(primeira(b)[ordem.campo] || "");
        return ordem.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return lista;
  }

  function montarLinhas(itens, aba) {
    const linhas = [];
    itens.forEach((item, idx) => {
      if (item.linha) {
        if ((item.linha.aba || "drugs") !== aba) return;
        linhas.push({
          ...item.linha,
          key: `s${idx}`,
          classe: `new-item${item.linha.suspenso ? " suspended" : ""}${item.linha.whitelist ? " whitelist" : ""}`,
        });
        return;
      }
      if ((item.aba || "drugs") !== aba) return;

      const sol = item.solucao ? " solution-group" : "";
      linhas.push({ key: `${idx}-start`, divider: true, classe: `divider-row start-row${sol}` });
      item.grupo.forEach((linha, i) => {
        linhas.push({
          ...linha,
          key: `${idx}-${i}`,
          classe:
            `new-item group-row${sol}` +
            `${item.solucao ? " solution" : ""}` +
            `${linha.whitelist ? " whitelist" : ""}` +
            `${linha.suspenso ? " suspended" : ""}`,
        });
      });
      linhas.push({ key: `${idx}-end`, divider: true, classe: `divider-row end-row${sol}` });
    });
    return linhas;
  }

  // dietColumns() no columns.jsx: sem score, sem Per., e a coluna se chama
  // "Dieta". Procedimentos usa o mesmo conjunto dos medicamentos.
  const colunasDa = (aba) => {
    if (aba !== "diet") return COL;
    return COL.filter((c) => c.dataIndex !== "score" && c.dataIndex !== "period").map((c) =>
      c.dataIndex === "nome" ? { ...c, title: "Dieta" } : c
    );
  };

  function DrugTable({ itens, aba, vazio, filtro, ordem, denso }) {
    const linhas = montarLinhas(prepararItens(itens, filtro, ordem), aba);
    if (!linhas.length) {
      return (
        <div className="nhui-tabela-vazia">
          {vazio || <Empty description={filtro ? "Nenhum item com esse nome" : "Nenhum registro encontrado"} />}
        </div>
      );
    }
    return (
      <Table
        className={`nhui-table${denso ? " denso" : ""}`}
        columns={colunasDa(aba)}
        dataSource={linhas}
        pagination={false}
        size="small"
        rowClassName={(r) => r.classe}
      />
    );
  }

  // So entra botao que faz alguma coisa. Os da tela de verdade que dependem
  // de dado que o validador nao tem (perspectiva de alertas, diff com a
  // prescricao anterior) ficam de fora em vez de virarem enfeite morto.
  const ORDENS = [
    { key: "nome", label: "Medicamento" },
    { key: "dose", label: "Dose" },
    { key: "freq", label: "Frequência" },
    { key: "via", label: "Via" },
  ];

  function Toolbox({ filtro, onFiltro, denso, onDenso, ordem, onOrdem }) {
    const atual = ORDENS.find((o) => o.key === ordem.campo) || ORDENS[0];
    return (
      <div className="nhui-toolbox">
        <div className="filters">
          <Tag className="add-filter">
            <FilterOutlined />
            <span>Filtros</span>
          </Tag>
          <Input
            className="nhui-filtro"
            allowClear
            size="small"
            placeholder="Filtrar"
            value={filtro}
            onChange={(e) => onFiltro(e.target.value)}
          />
        </div>
        <div className="viz-mode">
          <Dropdown.Button icon={<EllipsisOutlined />} menu={{ items: [] }}>
            Ativar seleção múltipla
          </Dropdown.Button>
          <Tooltip title="Perspectiva de alertas">
            <Button shape="circle" icon={<AlertOutlined />} style={{ marginLeft: 20 }} />
          </Tooltip>
          <Tooltip title={denso ? "Espaçar linhas" : "Condensar linhas"}>
            <Button
              shape="circle"
              type={denso ? "primary" : "default"}
              icon={<CompressOutlined />}
              onClick={() => onDenso(!denso)}
              style={{ marginLeft: 10 }}
            />
          </Tooltip>
          <Tooltip title="Comparar com a prescrição anterior">
            <Button shape="circle" icon={<DiffOutlined />} style={{ marginLeft: 10 }} />
          </Tooltip>
          <Dropdown
            trigger={["click"]}
            menu={{
              selectable: true,
              selectedKeys: [ordem.campo],
              items: ORDENS.map((o) => ({ key: o.key, label: o.label })),
              onClick: ({ key }) => onOrdem({ ...ordem, campo: key }),
            }}
          >
            <Tooltip title={`Ordenar por ${atual.label}`}>
              <Button shape="circle" type="primary" icon={<SortAscendingOutlined />} style={{ marginLeft: 10 }} />
            </Tooltip>
          </Dropdown>
          <Tooltip title={ordem.asc ? "Crescente" : "Decrescente"}>
            <Button
              shape="circle"
              className={`btn-order ${ordem.asc ? "order-asc" : "order-desc"}`}
              icon={<CaretUpOutlined />}
              onClick={() => onOrdem({ ...ordem, asc: !ordem.asc })}
              style={{ marginLeft: 10 }}
            />
          </Tooltip>
        </div>
      </div>
    );
  }

  function PrescricaoPanel({ p, aba, vazio, filtro, ordem, denso }) {
    const header = (
      <div className="nhui-presc-header">
        <div className="panel-header-description">
          <div className="title">
            <strong className="p-number">Prescrição &nbsp;<a>#&nbsp;{p.id}</a></strong>
          </div>
          <div className="subtitle">
            <span><strong>Início da Vigência:</strong> &nbsp;{p.inicio}</span>
            <span><strong>Fim da Vigência:</strong> &nbsp;{p.fim}</span>
            <span><strong>Leito:</strong> &nbsp;{p.leito}</span>
            <span><strong>Prescritor:</strong> &nbsp;{p.prescritor}</span>
          </div>
        </div>
      </div>
    );

    return (
      <Collapse
        className="nhui-presc-collapse"
        defaultActiveKey={[p.id]}
        items={[
          {
            key: p.id,
            label: header,
            children: (
              <DrugTable itens={p.itens} aba={aba} vazio={vazio} filtro={filtro} ordem={ordem} denso={denso} />
            ),
          },
        ]}
      />
    );
  }

  /* ------------------------- detalhe de uma view ---------------------- */
  function DetalheModal({ aberto, fonte, check, onFechar }) {
    if (!fonte || !check) return null;
    const grupos = check.propria.issueGroups || [];

    return (
      <Modal title={fonte.label} open={aberto} onCancel={onFechar} footer={null} width={720}>
        <div className="nhui-detalhe">
          <div className="arquivo">{check.arquivo.nome}</div>

          {check.ok && (
            <Alert type="success" showIcon message="A view está de acordo e cobre os códigos da prescrição." />
          )}

          {check.faltando.map((g, i) => (
            <div className="bloco erro" key={`f${i}`}>
              <div className="bloco-titulo">
                A prescricao usa {g.distinctCount || g.distinctValues.length} codigo
                {(g.distinctCount || g.distinctValues.length) === 1 ? "" : "s"} que nao estão nesta view
              </div>
              <div className="bloco-sub">Inclua {g.refField} no filtro da view de {fonte.label}:</div>
              <div className="valores">
                {g.distinctValues.map((v) => (
                  <code key={v}>{v}</code>
                ))}
              </div>
            </div>
          ))}

          {grupos.map((g, i) => (
            <div className="bloco erro" key={`p${i}`}>
              <div className="bloco-titulo">{g.message}</div>
              <div className="bloco-sub">{g.count} ocorrencia{g.count === 1 ? "" : "s"}</div>
              {!!(g.samples || []).length && (
                <div className="valores">
                  {g.samples.slice(0, 5).map((v, k) => (
                    <code key={k}>{v}</code>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  /* ===================== onde a prescricao entra ====================== */
  function DropPrescricao({ onArquivo, onExemplo, onIrValidacao }) {
    const [lendo, setLendo] = useState(false);
    const [erro, setErro] = useState(null);

    const receber = async (file) => {
      setLendo(true);
      setErro(null);
      try {
        onArquivo(await lerArquivo(file));
      } catch (e) {
        setErro(e.message);
      } finally {
        setLendo(false);
      }
    };

    return (
      <div className="nhui-import">
        <Spin spinning={lendo}>
          <Upload.Dragger
            className="nhui-drop"
            accept=".csv,.json,.txt"
            showUploadList={false}
            beforeUpload={(file) => {
              receber(file);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">
              Para ver os dados da prescrição, importe aqui a view de Prescrições e Itens
            </p>
            <p className="ant-upload-hint">
              No layout do Anexo I — CSV ou JSON, arraste ou clique. Nada sai da sua rede.
              <br />
              Não precisa ser a view inteira: o recomendado e um atendimento só, com os exames e as
              evoluções dele.
            </p>
          </Upload.Dragger>
        </Spin>
        {erro && <Alert type="error" showIcon message={erro} style={{ marginTop: 16 }} />}

        <div className="nhui-import-saidas">
          {onExemplo && (
            <Button type="link" icon={<EyeOutlined />} onClick={() => onExemplo(true)}>
              ver um exemplo preenchido
            </Button>
          )}
          {onIrValidacao && (
            <Button type="link" icon={<ReadOutlined />} onClick={onIrValidacao}>
              ver o layout desta view e as outras 13
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* =============================== tela =============================== */

  const ABAS = [
    { key: "drugs", label: "Medicamentos" },
    { key: "procedures", label: "Procedimentos/Exames" },
    { key: "diet", label: "Dietas/Recomendações" },
    { key: "intervention", label: "Intervenções" },
  ];

  const contarAba = (itens, aba) =>
    itens.reduce((total, item) => {
      if (item.linha) return total + ((item.linha.aba || "drugs") === aba ? 1 : 0);
      return total + ((item.aba || "drugs") === aba ? item.grupo.length : 0);
    }, 0);

  const PACIENTE_VAZIO = {
    nome: VAZIO,
    completo: false,
    tags: [],
    dados: [
      { label: "Idade", valor: VAZIO, falta: true },
      { label: "Sexo", valor: VAZIO, falta: true },
      { label: "Altura", valor: VAZIO, falta: true },
      { label: "Peso", valor: VAZIO, falta: true },
      { label: "Convênio", valor: VAZIO, falta: true },
      { label: "Prontuário", valor: VAZIO, falta: true },
      { label: "Setor", valor: VAZIO, falta: true },
      { label: "Especialidade", valor: VAZIO, falta: true },
    ],
  };

  function Tela({ arquivosIniciais, onValidado, onIrValidacao }) {
    // O que o cliente ja enviou na Validacao (nesta sessao) desenha a tela
    // sozinho: ele nao importa duas vezes a mesma view.
    const [arquivos, setArquivos] = useState(() => Object.assign({}, arquivosIniciais));
    const [exemplo, setExemplo] = useState(false);
    const [aba, setAba] = useState("drugs");
    const [verEvolucoes, setVerEvolucoes] = useState(false);
    const [verMais, setVerMais] = useState(false);
    const [filtro, setFiltro] = useState("");
    const [denso, setDenso] = useState(false);
    const [ordem, setOrdem] = useState({ campo: "nome", asc: true });
    const [detalhe, setDetalhe] = useState(null);

    // Grava aqui e avisa o validador: o que o cliente importa nesta tela conta
    // no progresso e no Resultado, senao a view ficaria eternamente pendente.
    const guardar = (chave, arquivo) => {
      setArquivos((prev) => ({ ...prev, [chave]: arquivo }));
      if (onValidado) onValidado(chave, arquivo);
    };

    const bruto = useMemo(() => montarPrescricao(arquivos), [arquivos]);
    const erroPresc = bruto && bruto.erro ? bruto.erro : null;
    const prescArquivo = bruto && !bruto.erro ? bruto : null;

    const checks = useMemo(() => {
      const out = {};
      CADASTROS.forEach((c) => (out[c.key] = checarCadastro(c.key, arquivos, true)));
      OUTROS.forEach((c) => (out[c.key] = checarCadastro(c.key, arquivos, false)));
      return out;
    }, [arquivos]);

    // o que a tela desenha: ou o exemplo, ou o arquivo do cliente (com os
    // numeros que a NoHarm calcularia simulados por cima)
    const tela = useMemo(() => {
      if (exemplo) {
        return {
          presc: EXEMPLO.prescricao,
          paciente: EXEMPLO.paciente,
          exames: EXEMPLO.exames,
          evolucoes: EXEMPLO.evolucoes,
          alertas: EXEMPLO.alertas,
          escore: EXEMPLO.escore,
          simulado: false,
        };
      }

      const evolucoesArq = montarEvolucoes(arquivos, prescArquivo);
      if (!prescArquivo) {
        return {
          presc: null,
          paciente: montarPaciente(arquivos, null) || PACIENTE_VAZIO,
          exames: montarExames(arquivos, null),
          evolucoes: evolucoesArq
            ? { ...evolucoesArq, indicadores: simularIndicadores(evolucoesArq.total) }
            : null,
          alertas: null,
          escore: null,
          simulado: true,
        };
      }

      const alertas = simularAlertas(prescArquivo);
      const itens = prescArquivo.itens.map((item) =>
        item.linha
          ? { ...item, linha: simularLinha(item.linha) }
          : { ...item, grupo: item.grupo.map(simularLinha) }
      );

      return {
        presc: { ...prescArquivo, itens },
        paciente: montarPaciente(arquivos, prescArquivo),
        exames: montarExames(arquivos, prescArquivo),
        evolucoes: evolucoesArq
          ? { ...evolucoesArq, indicadores: simularIndicadores(evolucoesArq.total) }
          : null,
        alertas,
        escore: simularEscore(prescArquivo, alertas),
        simulado: true,
      };
    }, [arquivos, exemplo, prescArquivo]);

    const { presc, paciente, exames, evolucoes, alertas, escore, simulado } = tela;
    const notas = exemplo ? EXEMPLO.verMais : { info: null, sinais: null };
    const soLeitura = exemplo; // no exemplo nao ha o que importar

    const abas = ABAS.map((a) => ({
      key: a.key,
      label: (
        <>
          <span style={{ marginRight: 10 }}>{a.label}</span>
          <Tag>{presc ? contarAba(presc.itens, a.key) : 0}</Tag>
        </>
      ),
      children: (
        <>
          <Toolbox
            filtro={filtro}
            onFiltro={setFiltro}
            denso={denso}
            onDenso={setDenso}
            ordem={ordem}
            onOrdem={setOrdem}
          />
          {presc ? (
            <PrescricaoPanel p={presc} aba={a.key} filtro={filtro} ordem={ordem} denso={denso} />
          ) : (
            <DropPrescricao
              onArquivo={(arq) => guardar("prescricoes", arq)}
              onExemplo={setExemplo}
              onIrValidacao={onIrValidacao}
            />
          )}
        </>
      ),
    }));

    const fonteDetalhe = detalhe ? FONTES.find((f) => f.key === detalhe) : null;

    return (
      <div className={`nhui${exemplo ? " exemplo" : ""}`}>
        <PageHeader presc={presc} exemplo={exemplo} onExemplo={setExemplo} />

        {erroPresc && !exemplo && (
          <Alert type="error" showIcon message={erroPresc} style={{ marginBottom: 12 }} />
        )}

        {presc && presc.outras > 0 && (
          <div className="nhui-aviso">
            O arquivo tem mais {presc.outras} prescriç{presc.outras > 1 ? "ões" : "ão"}. A tela mostra uma por vez.
          </div>
        )}

        <Row gutter={[8, 16]}>
          <Col xs={24} xl={8}>
            <PatientCard
              paciente={paciente}
              onArquivo={soLeitura ? null : (a) => guardar("pessoa", a)}
            />
          </Col>
          <Col xs={24} md={14} xl={10} xxl={11}>
            <ExamsCard exames={exames} onArquivo={soLeitura ? null : (a) => guardar("exame", a)} />
          </Col>
          <Col xs={24} md={10} xl={6} xxl={5}>
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ flex: 1 }}>
                <AlertsCard alertas={alertas} simulado={simulado} />
              </div>
              <div style={{ display: "flex", marginTop: 8, gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <NotesCard
                    evolucoes={evolucoes}
                    simulado={simulado}
                    onArquivo={soLeitura ? null : (a) => guardar("evolucao", a)}
                    onVer={() => setVerEvolucoes(true)}
                  />
                </div>
                <div style={{ width: "50%", maxWidth: 160 }}>
                  <ScoreCard escore={escore} simulado={simulado} />
                </div>
              </div>
            </div>
          </Col>
        </Row>

        {verMais && (
          <Row gutter={[8, 16]} style={{ marginTop: 10 }}>
            <Col xs={24} md={12} lg={8}>
              <CartaoNota titulo="Dados" chave="info" nota={notas.info} />
            </Col>
            <Col xs={24} md={12} lg={8}>
              <CartaoNota titulo="Sinais" chave="signs" nota={notas.sinais} />
            </Col>
          </Row>
        )}

        <div className="nhui-see-more">
          <Button
            type="link"
            icon={verMais ? <CaretUpOutlined /> : <CaretDownOutlined />}
            iconPosition="end"
            onClick={() => setVerMais(!verMais)}
          >
            {verMais ? "Ver menos" : "Ver mais"}
          </Button>
          <InfoCircleOutlined style={{ fontSize: "80%", verticalAlign: "top", marginLeft: 4 }} />
        </div>

        <Tabs className="nhui-tabs" type="card" activeKey={aba} onChange={setAba} items={abas} />

        <Modal
          title="Evoluções"
          open={verEvolucoes}
          onCancel={() => setVerEvolucoes(false)}
          footer={null}
          width={720}
        >
          <div className="nhui-evolucoes">
            {(evolucoes ? evolucoes.textos : []).map((e, i) => (
              <div className="nhui-evolucao" key={i}>
                <div className="topo">
                  <strong>{e.data}</strong>
                  <span>{e.autor}</span>
                </div>
                <p>{e.texto}</p>
              </div>
            ))}
          </div>
        </Modal>

        {/* A checagem dos cadastros (checarCadastro + DetalheModal) continua
            inteira no arquivo, mas sem porta de entrada: a barra que a abria
            saiu da tela. Quando decidirmos onde ela mora, e so ligar de novo. */}
        <DetalheModal
          aberto={!!detalhe}
          fonte={fonteDetalhe}
          check={detalhe ? checks[detalhe] : null}
          onFechar={() => setDetalhe(null)}
        />
      </div>
    );
  }

  return function NoHarmScreen(props) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: "#7ebe9a", colorLink: "#1890ff", borderRadius: 6 } }}>
        <Tela {...props} />
      </ConfigProvider>
    );
  };
})();
