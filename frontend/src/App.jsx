import React, { useEffect, useState } from 'react';
import { request } from './api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const FEATURES = [
  'operating_hours',
  'temperature_c',
  'vibration_mm_s',
  'noise_db'
];

const MIN_READINGS = 5;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('admin@automhub.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState('Dashboard');
  const [data, setData] = useState(null);
  const [machines, setMachines] = useState([]);
  const [readings, setReadings] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState('1');

  const [predictionReadings, setPredictionReadings] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [modelStatus, setModelStatus] = useState(null);
  const [selectedPredictionMachine, setSelectedPredictionMachine] = useState('1');
  const [generating, setGenerating] = useState(false);

  const [etlStatus, setEtlStatus] = useState(null);
  const [modelMetrics, setModelMetrics] = useState(null);
  const [modelHistory, setModelHistory] = useState([]);
  const [trainingReadings, setTrainingReadings] = useState([]);
  const [etlLoading, setEtlLoading] = useState(false);
  const [training, setTraining] = useState(false);

  const [maintenancePlanning, setMaintenancePlanning] = useState(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    equipment_type: '',
    location: '',
    operating_hours: 0
  });

  async function load() {
    try {
      const [dash, list] = await Promise.all([
        request('/dashboard', token),
        request('/maquinas', token)
      ]);

      setData(dash);
      setMachines(list);

      if (list.length && !list.some(m => String(m.id) === selectedPredictionMachine)) {
        setSelectedPredictionMachine(String(list[0].id));
      }

      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadReadings() {
    try {
      const params = selectedMachine
        ? `?maquina_id=${selectedMachine}`
        : '';

      const result = await request(`/leituras_etl${params}`, token);

      setReadings(
        [...result].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        )
      );

      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadPredictionData() {
    if (!selectedPredictionMachine) return;

    try {
      const machineId = selectedPredictionMachine;

      const [readingList, predictionList, status] = await Promise.all([
        request(`/leituras_etl?maquina_id=${machineId}`, token),
        request(`/previsoes?maquina_id=${machineId}`, token),
        request('/modelo/status', token)
      ]);

      setPredictionReadings(readingList);
      setPredictions(predictionList);
      setModelStatus(status);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadEtlData() {
    try {
      const [etl, status, metrics, allReadings, history] = await Promise.all([
        request('/etl/status', token),
        request('/modelo/status', token),
        request('/modelo/metricas', token),
        request('/leituras_etl', token),
        request('/modelo/historico', token)
      ]);

      setEtlStatus(etl);
      setModelStatus(status);
      setModelMetrics(metrics);
      setTrainingReadings(allReadings);
      setModelHistory(history);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadMaintenancePlanning() {
    setMaintenanceLoading(true);
    try {
      const result = await request('/manutencao/planejamento', token);
      setMaintenancePlanning(result);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setMaintenanceLoading(false);
    }
  }

  async function executeEtl() {
    setEtlLoading(true);
    setError('');
    try {
      const result = await request('/etl/executar', token, { method: 'POST' });
      setEtlStatus(result);
      await loadEtlData();
    } catch (e) {
      setError(e.message);
    } finally {
      setEtlLoading(false);
    }
  }

  async function trainModel() {
    if (!canTrainModel) return;
    setTraining(true);
    setError('');
    try {
      await request('/modelo/treinar', token, { method: 'POST' });
      await loadEtlData();
    } catch (e) {
      setError(e.message);
    } finally {
      setTraining(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  useEffect(() => {
    function handleAuthExpired() {
      localStorage.removeItem('token');
      setToken('');
      setData(null);
      setMachines([]);
      setReadings([]);
      setPredictionReadings([]);
      setPredictions([]);
      setPassword('');
      setError('Sua sessão expirou. Faça login novamente.');
    }

    window.addEventListener('auth-expired', handleAuthExpired);

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    if (token && page === 'Leituras') {
      loadReadings();
    }
  }, [token, page, selectedMachine]);

  useEffect(() => {
    if (token && page === 'Previsões' && selectedPredictionMachine) {
      loadPredictionData();
    }
  }, [token, page, selectedPredictionMachine]);

  useEffect(() => {
    if (token && page === 'ETL e Modelos') {
      loadEtlData();
    }
  }, [token, page]);

  useEffect(() => {
    if (token && page === 'Planejamento de Manutenção') {
      loadMaintenancePlanning();
    }
  }, [token, page]);

  async function login(e) {
    e.preventDefault();
    setError('');

    try {
      const result = await request('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('token', result.access_token);
      setToken(result.access_token);
      setPassword('');
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    setToken('');
    setData(null);
    setMachines([]);
    setReadings([]);
    setPredictionReadings([]);
    setPredictions([]);
    setPassword('');
    setError('');
  }

  async function createMachine(e) {
    e.preventDefault();
    setError('');

    try {
      await request('/maquinas', token, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          operating_hours: Number(form.operating_hours)
        })
      });

      setForm({
        name: '',
        equipment_type: '',
        location: '',
        operating_hours: 0
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const latestReading = readings.length
    ? readings[readings.length - 1]
    : null;

  const chartData = readings.map(reading => ({
    time: new Date(reading.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    temperature: reading.temperature_c,
    vibration: reading.vibration_mm_s,
    noise: reading.noise_db
  }));

  // Validação visual das leituras para a previsão.
  const completeReadings = predictionReadings.filter(reading =>
    FEATURES.every(feature => reading[feature] !== null && reading[feature] !== undefined)
  );

  const latestPredictionReading = predictionReadings.length
    ? [...predictionReadings].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      )[0]
    : null;

  const latestReadingComplete = latestPredictionReading
    ? FEATURES.every(feature =>
        latestPredictionReading[feature] !== null &&
        latestPredictionReading[feature] !== undefined
      )
    : false;

  const enoughReadings = completeReadings.length >= MIN_READINGS;
  const modelAvailable = modelStatus?.available === true;

  const completeLabeledReadings = trainingReadings.filter(reading =>
    FEATURES.every(feature => reading[feature] !== null && reading[feature] !== undefined) &&
    (reading.failure_within_horizon === 0 || reading.failure_within_horizon === 1)
  );
  const trainingClasses = new Set(completeLabeledReadings.map(reading => reading.failure_within_horizon));
  const canTrainModel = completeLabeledReadings.length >= 20 && trainingClasses.size >= 2 && !training;

  const canPredict =
    enoughReadings &&
    latestReadingComplete &&
    modelAvailable &&
    !generating;

  async function generatePrediction() {
    if (!canPredict) return;

    setGenerating(true);
    setError('');

    try {
      await request(
        `/maquinas/${selectedPredictionMachine}/previsoes`,
        token,
        { method: 'POST' }
      );

      await loadPredictionData();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!token) {
    return (
      <main className="login">
        <form className="login-card" onSubmit={login}>
          <div className="logo">AUTOM <b>HUB</b></div>
          <p>Plataforma de monitoramento industrial</p>

          <label>E-mail</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <button>Entrar</button>
          {error && <small className="error">{error}</small>}
        </form>
      </main>
    );
  }

  return (
    <div className="layout">
      <aside>
        <div className="logo">AUTOM <b>HUB</b></div>
        <span className="muted">MONITORAMENTO</span>

        {[
          'Dashboard',
          'Máquinas',
          'Leituras',
          'Previsões',
          'Planejamento de Manutenção',
          'ETL e Modelos'
        ].map(x => (
          <button
            key={x}
            className={page === x ? 'active' : ''}
            onClick={() => setPage(x)}
          >
            {x}
          </button>
        ))}

        <button className="logout" onClick={logout}>
          Sair
        </button>
      </aside>

      <main className="content">
        <header>
          <div>
            <small>PAINEL ADMINISTRATIVO</small>
            <h1>{page}</h1>
          </div>
          <span className="status">â— API conectada</span>
        </header>

        {error && <p className="error">{error}</p>}

        {page === 'Dashboard' && (
          <>
            <section className="cards">
              {[
                ['Máquinas', data?.machines ?? '—'],
                ['Leituras', data?.readings ?? '—'],
                ['Risco elevado', data?.high_risk ?? '—'],
                ['Previsões', data?.predictions ?? '—']
              ].map(([k, v]) => (
                <article key={k}>
                  <small>{k}</small>
                  <strong>{v}</strong>
                </article>
              ))}
            </section>

<article className="operational-summary">
  <h2>Visão operacional</h2>

  {!data ? (
    <p className="muted">
      Carregando indicadores operacionais da API...
    </p>
  ) : (
    <>
      <p>
        O Autom Hub monitora atualmente{" "}
        <strong>{data.machines ?? 0} máquinas</strong>, com{" "}
        <strong>{data.readings ?? 0} leituras registradas</strong> e{" "}
        <strong>{data.predictions ?? 0} previsões realizadas</strong>.
      </p>

      <p>
        O indicador de risco elevado retornou{" "}
        <strong>{data.high_risk ?? 0}</strong>.
        {Number(data.high_risk ?? 0) > 0
          ? " Recomenda-se verificar os equipamentos associados a essas classificações e acompanhar suas condições operacionais."
          : " Não há registros classificados como risco elevado nos indicadores retornados pela API."}
      </p>

      <small className="muted">
        Resumo gerado automaticamente com os indicadores recebidos da API.
        A classificação de risco representa uma estimativa do modelo, não a confirmação de uma falha.
      </small>
    </>
  )}
</article>

          </>
        )}

        {page === 'Máquinas' && (
          <>
            <article>
              <h2>Cadastrar equipamento</h2>

              <form className="machine-form" onSubmit={createMachine}>
                {[
                  ['name', 'Nome'],
                  ['equipment_type', 'Tipo'],
                  ['location', 'Localização'],
                  ['operating_hours', 'Horas de operação']
                ].map(([k, l]) => (
                  <label key={k}>
                    {l}
                    <input
                      required
                      value={form[k]}
                      onChange={e =>
                        setForm({ ...form, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}

                <button>Cadastrar</button>
              </form>
            </article>

            <article>
              <h2>Equipamentos cadastrados</h2>

              {machines.length === 0 ? (
                <p className="muted">Nenhuma máquina cadastrada.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Local</th>
                      <th>Horas</th>
                    </tr>
                  </thead>

                  <tbody>
                    {machines.map(m => (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td>{m.name}</td>
                        <td>{m.equipment_type}</td>
                        <td>{m.location}</td>
                        <td>{m.operating_hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
          </>
        )}

        {page === 'Leituras' && (
          <>
            <article>
              <div className="section-heading">
                <div>
                  <h2>Monitoramento de sensores</h2>
                  <p className="muted">
                    Acompanhamento das condições operacionais dos equipamentos.
                  </p>
                </div>

                <select
                  value={selectedMachine}
                  onChange={e => setSelectedMachine(e.target.value)}
                >
                  <option value="">Todas as máquinas</option>
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      Máquina {machine.id} — {machine.name}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={loadReadings}>Atualizar leituras</button>
            </article>

            <section className="sensor-cards">
              <article>
                <small>Temperatura atual</small>
                <strong>
                  {latestReading?.temperature_c != null
                    ? `${latestReading.temperature_c} °C`
                    : '—'}
                </strong>
              </article>

              <article>
                <small>Vibração atual</small>
                <strong>
                  {latestReading?.vibration_mm_s != null
                    ? `${latestReading.vibration_mm_s} mm/s`
                    : '—'}
                </strong>
              </article>

              <article>
                <small>Ruído atual</small>
                <strong>
                  {latestReading?.noise_db != null
                    ? `${latestReading.noise_db} dB`
                    : '—'}
                </strong>
              </article>

              <article>
                <small>Horas de operação</small>
                <strong>{latestReading?.operating_hours ?? '—'}</strong>
              </article>
            </section>

            {readings.length === 0 ? (
              <article>
                <p className="muted">
                  Nenhuma leitura encontrada para a máquina selecionada.
                </p>
              </article>
            ) : (
              <>
                {[
                  ['Histórico de temperatura', 'temperature', '#a78bfa'],
                  ['Histórico de vibração', 'vibration', '#38bdf8'],
                  ['Histórico de ruído', 'noise', '#f59e0b']
                ].map(([title, key, color]) => (
                  <article key={key}>
                    <h2>{title}</h2>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#30394a" />
                          <XAxis dataKey="time" stroke="#929caf" />
                          <YAxis stroke="#929caf" />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey={key}
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>
                ))}

                <article>
                  <h2>Histórico de leituras</h2>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Data e horário</th>
                          <th>Máquina</th>
                          <th>Temperatura</th>
                          <th>Vibração</th>
                          <th>Ruído</th>
                          <th>Horas</th>
                          <th>Classificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...readings].reverse().map(reading => (
                          <tr key={reading.id}>
                            <td>{new Date(reading.timestamp).toLocaleString('pt-BR')}</td>
                            <td>{reading.machine_id}</td>
                            <td>{reading.temperature_c ?? '—'} °C</td>
                            <td>{reading.vibration_mm_s ?? '—'} mm/s</td>
                            <td>{reading.noise_db ?? '—'} dB</td>
                            <td>{reading.operating_hours}</td>
                            <td>
                              {reading.failure_within_horizon === 1
                                ? 'Com falha'
                                : reading.failure_within_horizon === 0
                                  ? 'Sem falha'
                                  : 'Não classificada'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </>
            )}
          </>
        )}

        {page === 'Previsões' && (
          <>
            <article>
              <div className="section-heading">
                <div>
                  <h2>Gerenciamento de previsões</h2>
                  <p className="muted">
                    Análise de risco de falha utilizando o modelo Random Forest.
                  </p>
                </div>

                <select
                  value={selectedPredictionMachine}
                  onChange={e => setSelectedPredictionMachine(e.target.value)}
                >
                  {machines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                      Máquina {machine.id} — {machine.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="prediction-status">
                <div>
                  <small>Leituras completas</small>
                  <strong>
                    {completeReadings.length} / {MIN_READINGS}
                  </strong>
                </div>

                <div>
                  <small>Modelo</small>
                  <strong>
                    {modelAvailable ? 'Disponível' : 'Indisponível'}
                  </strong>
                </div>

                <div>
                  <small>Última leitura</small>
                  <strong>
                    {latestReadingComplete ? 'Completa' : 'Incompleta'}
                  </strong>
                </div>
              </div>

              <div className="requirement-message">
                {!enoughReadings && (
                  <p className="warning">
                    São necessárias pelo menos 5 leituras completas.
                    Faltam {MIN_READINGS - completeReadings.length} leitura(s).
                  </p>
                )}

                {enoughReadings && !latestReadingComplete && (
                  <p className="warning">
                    A leitura mais recente está incompleta. Registre todos os
                    dados dos sensores antes de gerar uma previsão.
                  </p>
                )}

                {!modelAvailable && (
                  <p className="warning">
                    Não há modelo treinado disponível para realizar a análise.
                  </p>
                )}

                {canPredict && (
                  <p className="success">
                    Requisitos atendidos. A máquina está apta para uma nova previsão.
                  </p>
                )}
              </div>

              <div className="prediction-actions">
                <button
                  onClick={generatePrediction}
                  disabled={!canPredict}
                >
                  {generating ? 'Gerando previsão...' : 'Gerar previsão'}
                </button>

                <button
                  className="secondary-button"
                  onClick={loadPredictionData}
                  disabled={generating}
                >
                  Atualizar dados
                </button>
              </div>
            </article>

            <section className="sensor-cards">
              <article>
                <small>Leituras disponíveis</small>
                <strong>{predictionReadings.length}</strong>
              </article>

              <article>
                <small>Leituras completas</small>
                <strong>{completeReadings.length}</strong>
              </article>

              <article>
                <small>Previsões realizadas</small>
                <strong>{predictions.length}</strong>
              </article>

              <article>
                <small>Versão do modelo</small>
                <strong className="version-value">
                  {modelStatus?.version || '—'}
                </strong>
              </article>
            </section>

            <article>
              <h2>Histórico de previsões</h2>

              {predictions.length === 0 ? (
                <p className="muted">
                  Nenhuma previsão registrada para esta máquina.
                </p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Data</th>
                        <th>Máquina</th>
                        <th>Probabilidade</th>
                        <th>Risco</th>
                        <th>Modelo</th>
                      </tr>
                    </thead>

                    <tbody>
                      {[...predictions]
                        .sort((a, b) => b.id - a.id)
                        .map(prediction => (
                          <tr key={prediction.id}>
                            <td>{prediction.id}</td>
                            <td>
                              {prediction.created_at
                                ? new Date(prediction.created_at).toLocaleString('pt-BR')
                                : '—'}
                            </td>
                            <td>{prediction.machine_id}</td>
                            <td>
                              {(prediction.probability * 100).toFixed(1)}%
                            </td>
                            <td>
                              <span className={`risk risk-${prediction.risk}`}>
                                {prediction.risk}
                              </span>
                            </td>
                            <td>{prediction.model_version}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article>
              <h2>Interpretação do resultado</h2>
              <p className="muted">
                A probabilidade representa a estimativa produzida pelo modelo
                para a classe de falha. O resultado indica risco estimado,
                não confirmação de falha ou diagnóstico definitivo.
              </p>
            </article>
          </>
        )}

        {page === 'Planejamento de Manutenção' && (
          <>
            <article>
              <div className="section-heading">
                <div>
                  <h2>Planejamento preventivo da frota</h2>
                  <p className="muted">
                    Acompanhamento do intervalo padrão de manutenção e do risco estimado pelo Random Forest.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={loadMaintenancePlanning}
                  disabled={maintenanceLoading}
                >
                  {maintenanceLoading ? 'Atualizando...' : 'Atualizar planejamento'}
                </button>
              </div>

              <div className="sensor-cards">
                <div>
                  <small>Intervalo preventivo</small>
                  <strong>{maintenancePlanning?.interval_hours ?? 500} h</strong>
                </div>
                <div>
                  <small>Antecedência do alerta</small>
                  <strong>{maintenancePlanning?.warning_hours ?? 50} h</strong>
                </div>
                <div>
                  <small>Máquinas analisadas</small>
                  <strong>{maintenancePlanning?.machines_count ?? '—'}</strong>
                </div>
                <div>
                  <small>Máquinas com risco elevado</small>
                  <strong>
                    {Array.isArray(maintenancePlanning?.planning)
                      ? maintenancePlanning.planning.filter(item => item.ai_risk === 'elevado').length
                      : '—'}
                  </strong>
                </div>
              </div>
            </article>

            {maintenanceLoading && !maintenancePlanning && (
              <article>
                <p className="muted">Carregando planejamento de manutenção...</p>
              </article>
            )}

            {!maintenanceLoading && maintenancePlanning?.planning?.length === 0 && (
              <article>
                <p className="muted">Nenhuma máquina cadastrada para planejamento.</p>
              </article>
            )}

            {Array.isArray(maintenancePlanning?.planning) &&
              maintenancePlanning.planning.map(item => {
                const status = item.status || 'indisponivel';
                const statusLabel = item.status_label || (
                  status === 'em_dia' ? 'Em dia' :
                  status === 'atencao' ? 'Atenção' :
                  status === 'vencida' ? 'Manutenção vencida' :
                  'Dados insuficientes'
                );
                const risk = item.ai_risk || 'indisponivel';
                const riskLabel = risk === 'elevado' ? 'Elevado' :
                  risk === 'moderado' ? 'Moderado' :
                  risk === 'baixo' ? 'Baixo' : 'Indisponível';
                const progress = Number.isFinite(Number(item.progress_percent))
                  ? Math.max(0, Math.min(100, Number(item.progress_percent)))
                  : null;
                const probability = Number.isFinite(Number(item.ai_probability_percent))
                  && item.ai_probability_percent !== null
                  ? Number(item.ai_probability_percent)
                  : null;

                return (
                  <article className="maintenance-card" key={item.machine_id}>
                    <div className="maintenance-card-heading">
                      <div>
                        <small className="muted">MÁQUINA {item.machine_id}</small>
                        <h2>{item.machine_name || `Máquina ${item.machine_id}`}</h2>
                      </div>
                      <span className={`maintenance-status maintenance-status-${status}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="maintenance-metrics">
                      <div>
                        <small>Horímetro atual</small>
                        <strong>{item.current_operating_hours ?? '—'} h</strong>
                      </div>
                      <div>
                        <small>Próxima manutenção</small>
                        <strong>{item.next_maintenance_at_hours ?? '—'} h</strong>
                      </div>
                      <div>
                        <small>Horas restantes</small>
                        <strong>{item.hours_remaining ?? '—'} h</strong>
                      </div>
                      <div>
                        <small>Risco estimado pela IA</small>
                        <strong className={`maintenance-risk-text risk-${risk}`}>
                          {probability === null ? riskLabel : `${probability.toFixed(1)}%`}
                        </strong>
                        <small>{riskLabel}</small>
                      </div>
                    </div>

                    <div className="maintenance-progress-section">
                      <div className="maintenance-progress-label">
                        <strong>Progresso do intervalo preventivo</strong>
                        <span>{progress === null ? '—' : `${progress.toFixed(1)}%`}</span>
                      </div>
                      <div className="maintenance-progress-track">
                        <div
                          className={`maintenance-progress-fill maintenance-progress-${status}`}
                          style={{ width: `${progress ?? 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="maintenance-timeline">
                      <div className="maintenance-timeline-step">
                        <span className="maintenance-timeline-dot" />
                        <small>Última manutenção</small>
                        <strong>
                          {item.last_maintenance_operating_hours != null
                            ? `${item.last_maintenance_operating_hours} h`
                            : 'Não registrada'}
                        </strong>
                        <small>
                          {item.last_maintenance_at
                            ? new Date(item.last_maintenance_at).toLocaleDateString('pt-BR')
                            : 'Sem data registrada'}
                        </small>
                      </div>
                      <div className="maintenance-timeline-step">
                        <span className="maintenance-timeline-dot warning" />
                        <small>Alerta preventivo</small>
                        <strong>
                          {item.next_maintenance_at_hours != null &&
                          item.warning_hours != null
                            ? `${Math.max(0, item.next_maintenance_at_hours - item.warning_hours)} h`
                            : '—'}
                        </strong>
                        <small>Início da faixa de alerta</small>
                      </div>
                      <div className="maintenance-timeline-step">
                        <span className="maintenance-timeline-dot target" />
                        <small>Próxima manutenção</small>
                        <strong>
                          {item.next_maintenance_at_hours != null
                            ? `${item.next_maintenance_at_hours} h`
                            : 'A definir'}
                        </strong>
                        <small>Limite do intervalo</small>
                      </div>
                    </div>

                    <div className="maintenance-recommendation">
                      <strong>Recomendação</strong>
                      <p>{item.recommendation || item.ai_message || item.message || 'Mantenha o acompanhamento da máquina.'}</p>
                      {item.ai_message && (
                        <small className="muted">{item.ai_message}</small>
                      )}
                    </div>
                  </article>
                );
              })}

            <article>
              <h2>Como interpretar o planejamento</h2>
              <p className="muted">
                O intervalo de 500 horas é um parâmetro demonstrativo global. O alerta preventivo é configurado para as 50 horas anteriores ao limite. Esses valores devem ser ajustados conforme as recomendações do fabricante e as condições reais de operação.
              </p>
              <p className="muted">
                A classificação da IA representa uma estimativa produzida pelo modelo, não a confirmação de que uma falha ocorrerá. Quando não houver leituras completas ou modelo treinado, a análise de IA poderá ficar indisponível sem interromper o cálculo preventivo.
              </p>
            </article>

            <style>{`
              .maintenance-card { display: flex; flex-direction: column; gap: 22px; }
              .maintenance-card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
              .maintenance-card-heading h2 { margin: 5px 0 0; }
              .maintenance-status { border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; background: #263244; color: #dbeafe; }
              .maintenance-status-em_dia { background: #123b2b; color: #86efac; }
              .maintenance-status-atencao { background: #493516; color: #fcd34d; }
              .maintenance-status-vencida { background: #4b2025; color: #fca5a5; }
              .maintenance-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
              .maintenance-metrics > div { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 10px; background: rgba(127, 139, 160, .08); min-width: 0; }
              .maintenance-metrics small, .maintenance-timeline small { color: #929caf; font-size: 12px; }
              .maintenance-metrics strong { font-size: 20px; overflow-wrap: anywhere; }
              .maintenance-risk-text.risk-elevado { color: #f87171; }
              .maintenance-risk-text.risk-moderado { color: #fbbf24; }
              .maintenance-risk-text.risk-baixo { color: #4ade80; }
              .maintenance-progress-section { display: flex; flex-direction: column; gap: 9px; }
              .maintenance-progress-label { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
              .maintenance-progress-track { height: 11px; border-radius: 999px; overflow: hidden; background: #293344; }
              .maintenance-progress-fill { height: 100%; border-radius: inherit; background: #38bdf8; transition: width .25s ease; }
              .maintenance-progress-atencao { background: #fbbf24; }
              .maintenance-progress-vencida { background: #f87171; }
              .maintenance-timeline { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-top: 8px; }
              .maintenance-timeline-step { position: relative; display: flex; flex-direction: column; gap: 7px; padding: 14px 12px 14px 18px; border-left: 2px solid #3a4659; }
              .maintenance-timeline-dot { position: absolute; left: -6px; top: 17px; width: 10px; height: 10px; border-radius: 50%; background: #38bdf8; }
              .maintenance-timeline-dot.warning { background: #fbbf24; }
              .maintenance-timeline-dot.target { background: #4ade80; }
              .maintenance-timeline-step strong { font-size: 16px; }
              .maintenance-recommendation { padding: 15px; border-radius: 10px; background: rgba(127, 139, 160, .08); }
              .maintenance-recommendation p { margin: 7px 0; }
              @media (max-width: 760px) {
                .maintenance-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .maintenance-timeline { grid-template-columns: 1fr; }
                .maintenance-card-heading { align-items: flex-start; flex-direction: column; }
              }
            `}</style>
          </>
        )}

        {page === 'ETL e Modelos' && (
          <>
            <article>
              <div className="section-heading">
                <div>
                  <h2>Processamento de dados (ETL)</h2>
                  <p className="muted">
                    Extração das leituras, remoção de duplicidades, organização dos registros e exportação para CSV.
                  </p>
                </div>
                <button onClick={loadEtlData} disabled={etlLoading || training} className="secondary-button">
                  Atualizar status
                </button>
              </div>

              <div className="prediction-actions">
                <button onClick={executeEtl} disabled={etlLoading || training}>
                  {etlLoading ? 'Executando ETL...' : 'Executar ETL'}
                </button>
              </div>

              <div className="sensor-cards">
                <div><small>Registros recebidos</small><strong>{etlStatus?.received ?? '—'}</strong></div>
                <div><small>Registros processados</small><strong>{etlStatus?.processed ?? '—'}</strong></div>
                <div><small>Duplicidades descartadas</small><strong>{etlStatus?.discarded ?? '—'}</strong></div>
                <div><small>Registros corrigidos</small><strong>{etlStatus?.corrected ?? '—'}</strong></div>
              </div>

              <p className="muted">
                {etlStatus?.executed_at
                  ? `Última execução: ${new Date(etlStatus.executed_at).toLocaleString('pt-BR')}`
                  : 'O processamento ainda não foi executado nesta sessão.'}
              </p>
              {etlStatus?.output && <p className="muted">Arquivo gerado: <code>{etlStatus.output}</code></p>}
              {Array.isArray(etlStatus?.errors) && etlStatus.errors.length > 0 && (
                <div className="error"><strong>Erros do ETL</strong><ul>{etlStatus.errors.map((item, index) => <li key={index}>{String(item)}</li>)}</ul></div>
              )}
              {etlStatus?.status && <p className="muted">Status: {etlStatus.status}</p>}
            </article>

            <article>
              <h2>Treinamento do modelo Random Forest</h2>
              <p className="muted">
                O treinamento utiliza leituras completas e rotuladas. São exigidos pelo menos 20 registros e as duas classes: com falha (1) e sem falha (0).
              </p>
              <div className="sensor-cards">
                <div><small>Registros completos e rotulados</small><strong>{completeLabeledReadings.length} / 20</strong></div>
                <div><small>Classes disponíveis</small><strong>{trainingClasses.size} / 2</strong></div>
                <div><small>Modelo</small><strong>{modelStatus?.available ? 'Disponível' : 'Indisponível'}</strong></div>
                <div><small>Versão</small><strong className="version-value">{modelStatus?.version || '—'}</strong></div>
                <div><small>Último treinamento</small><strong>{modelStatus?.trained_at ? new Date(modelStatus.trained_at).toLocaleString('pt-BR') : 'Ainda não treinado'}</strong></div>
              </div>
              {!canTrainModel && !training && (
                <p className="warning">
                  Para treinar, insira pelo menos 20 leituras completas com rótulos e garanta que existam registros das duas classes.
                </p>
              )}
              {canTrainModel && <p className="success">Requisitos atendidos. O modelo está apto para treinamento.</p>}
              <button onClick={trainModel} disabled={!canTrainModel}>
                {training ? 'Treinando modelo...' : 'Treinar modelo'}
              </button>
            </article>

            <article>
              <h2>Métricas de avaliação</h2>
              {!modelMetrics?.available || !modelMetrics?.metrics ? (
                <p className="muted">Ainda não existem métricas de treinamento disponíveis.</p>
              ) : (
                <>
                  <div className="sensor-cards">
                    <div><small>Precisão (Precision)</small><strong>{(modelMetrics.metrics.precision * 100).toFixed(1)}%</strong></div>
                    <div><small>Revocação (Recall)</small><strong>{(modelMetrics.metrics.recall * 100).toFixed(1)}%</strong></div>
                    <div><small>F1-score</small><strong>{(modelMetrics.metrics.f1 * 100).toFixed(1)}%</strong></div>
                    <div><small>Amostras de teste</small><strong>{modelMetrics.metrics.test_samples ?? '—'}</strong></div>
                  </div>
                  <p className="muted">Amostras utilizadas no treinamento: {modelMetrics.metrics.training_samples ?? '—'}</p>
                  <h3>Matriz de confusão</h3>
                  {Array.isArray(modelMetrics.metrics.confusion_matrix) &&
                   modelMetrics.metrics.confusion_matrix.length >= 2 ? (
                    <div className="table-container">
                      <table className="confusion-matrix">
                        <thead>
                          <tr>
                            <th>Classe real / prevista</th>
                            <th>Sem falha (0)</th>
                            <th>Com falha (1)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th>Sem falha (0)</th>
                            <td style={{ background: '#14532d', color: '#dcfce7', fontWeight: 700 }}>
                              {modelMetrics.metrics.confusion_matrix[0][0]}
                            </td>
                            <td style={{ background: '#7f1d1d', color: '#fee2e2', fontWeight: 700 }}>
                              {modelMetrics.metrics.confusion_matrix[0][1]}
                            </td>
                          </tr>
                          <tr>
                            <th>Com falha (1)</th>
                            <td style={{ background: '#7f1d1d', color: '#fee2e2', fontWeight: 700 }}>
                              {modelMetrics.metrics.confusion_matrix[1][0]}
                            </td>
                            <td style={{ background: '#14532d', color: '#dcfce7', fontWeight: 700 }}>
                              {modelMetrics.metrics.confusion_matrix[1][1]}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">Matriz de confusão indisponível.</p>
                  )}
                </>
              )}
              <p className="warning">
                Atenção: métricas obtidas com dados simulados servem para testar o funcionamento técnico do pipeline. Elas não comprovam a precisão do modelo em equipamentos reais.
              </p>
            </article>

            <article>
              <h2>Histórico de treinamentos</h2>
              {modelHistory.length === 0 ? (
                <p className="muted">Nenhum treinamento registrado.</p>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Data e horário</th>
                        <th>Versão</th>
                        <th>Precisão</th>
                        <th>Recall</th>
                        <th>F1-score</th>
                        <th>Amostras de teste</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelHistory.map(item => (
                        <tr key={item.id}>
                          <td>{item.trained_at ? new Date(item.trained_at).toLocaleString('pt-BR') : '—'}</td>
                          <td>{item.version}</td>
                          <td>{item.metrics?.precision != null ? `${(item.metrics.precision * 100).toFixed(1)}%` : '—'}</td>
                          <td>{item.metrics?.recall != null ? `${(item.metrics.recall * 100).toFixed(1)}%` : '—'}</td>
                          <td>{item.metrics?.f1 != null ? `${(item.metrics.f1 * 100).toFixed(1)}%` : '—'}</td>
                          <td>{item.metrics?.test_samples ?? '—'}</td>
                          <td>{item.available ? 'Disponível' : 'Indisponível'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </>
        )}
      </main>
    </div>
  );
}
