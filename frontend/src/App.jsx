import { Fragment, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const todayString = () => new Date().toISOString().slice(0, 10);

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [date, setDate] = useState(todayString());
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [notes, setNotes] = useState('');
  const [rangeFrom, setRangeFrom] = useState(todayString());
  const [rangeTo, setRangeTo] = useState(todayString());
  const [measurements, setMeasurements] = useState([]);
  const [expandedRows, setExpandedRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionData = supabase.auth.session();
    setSession(sessionData);

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchMeasurements();
  }, [session, rangeFrom, rangeTo]);

  const token = session?.access_token;

  const fetchMeasurements = async () => {
    if (!token) return;
    const params = new URLSearchParams({ from: rangeFrom, to: rangeTo });
    const res = await fetch(`${backendUrl}/api/measurements?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to load measurements');
      return;
    }
    setMeasurements(data);
  };

  const signUp = async () => {
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return setError(error.message);
    setError('Проверьте почту для подтверждения или продолжайте, если аккаунт уже активен.');
  };

  const signIn = async () => {
    setError('');
    const { error } = await supabase.auth.signIn({ email, password });
    if (error) return setError(error.message);
  };

  const signInWithGoogle = async () => {
    setError('');
    const { error } = await supabase.auth.signIn({ provider: 'google' });
    if (error) return setError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const addMeasurement = async () => {
    if (!token) return;
    setError('');
    const payload = { date, systolic: Number(systolic), diastolic: Number(diastolic), pulse: Number(pulse), notes };
    const res = await fetch(`${backendUrl}/api/measurements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Failed to save measurement');
      return;
    }
    await fetchMeasurements();
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setNotes('');
  };

  const formatTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const measurementsWithTime = useMemo(
    () =>
      measurements.map((item) => ({
        ...item,
        time: formatTime(item.created_at),
      })),
    [measurements]
  );

  const toggleNotes = (id) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const groupedByDate = useMemo(() => {
    const groups = measurementsWithTime.reduce((acc, item) => {
      const key = item.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    Object.values(groups).forEach((items) => {
      items.sort((a, b) => {
        const timeA = new Date(a.created_at || a.date).getTime();
        const timeB = new Date(b.created_at || b.date).getTime();
        return timeA - timeB;
      });
    });

    return groups;
  }, [measurementsWithTime]);

  const chartPoints = useMemo(() => {
    return measurements
      .map((item) => ({
        date: item.date,
        time: formatTime(item.created_at),
        timestamp: item.created_at ? new Date(item.created_at).getTime() : new Date(item.date).getTime(),
        systolic: item.systolic,
        diastolic: item.diastolic,
        pulse: item.pulse,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [measurements]);

  const chartBounds = useMemo(() => {
    if (chartPoints.length === 0) {
      return { min: 0, max: 100, range: 100 };
    }
    const values = chartPoints.flatMap((point) => [point.systolic, point.diastolic, point.pulse]);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const paddedMax = Math.ceil(maxValue / 10) * 10 + 10;
    const paddedMin = Math.max(0, Math.floor(minValue / 10) * 10 - 10);
    return { min: paddedMin, max: paddedMax, range: paddedMax - paddedMin };
  }, [chartPoints]);

  const chartDimensions = useMemo(() => {
    const width = Math.max(320, Math.max(1, chartPoints.length) * 90);
    const height = 240;
    return { width, height, marginLeft: 40, marginRight: 20, marginTop: 20, marginBottom: 50 };
  }, [chartPoints.length]);

  const buildLinePath = (key) => {
    if (chartPoints.length === 0) return '';
    const { width, height, marginLeft, marginRight, marginTop, marginBottom } = chartDimensions;
    const innerWidth = width - marginLeft - marginRight;
    const innerHeight = height - marginTop - marginBottom;
    return chartPoints
      .map((point, index) => {
        const x = marginLeft + (innerWidth * index) / Math.max(chartPoints.length - 1, 1);
        const y = marginTop + innerHeight - ((point[key] - chartBounds.min) / chartBounds.range) * innerHeight;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  if (!supabaseUrl || !supabaseAnonKey) {
    return <div>Missing Supabase configuration.</div>;
  }

  return (
    <div className="app-shell">
      <header>
        <h1>BP Tracker</h1>
        {session && <button onClick={signOut}>Sign Out</button>}
      </header>

      {!session ? (
        <div className="auth-card">
          <h2>Авторизация</h2>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>
          <label>
            Пароль
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </label>
          <div className="auth-actions">
            <button onClick={signIn}>Войти</button>
            <button onClick={signUp}>Регистрация</button>
          </div>
          <button className="google-button" onClick={signInWithGoogle}>Войти через Google</button>
          {error && <div className="error-box">{error}</div>}
        </div>
      ) : (
        <main>
          <section className="controls">
            <div className="filter-card">
              <h2>Выбор диапазона</h2>
              <label>
                С
                <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
              </label>
              <label>
                По
                <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </label>
              <button onClick={fetchMeasurements}>Обновить</button>
            </div>
            <div className="entry-card">
              <h2>Добавить замер</h2>
              <label>
                Дата
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                Систолическое
                <input type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
              </label>
              <label>
                Диастолическое
                <input type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
              </label>
              <label>
                Пульс
                <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} />
              </label>
              <label>
                Заметки
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <button onClick={addMeasurement}>Сохранить</button>
            </div>
          </section>

          <section className="data-section">
            <h2>Замеры по дням</h2>
            <div className="calendar-grid">
              {Object.keys(groupedByDate).length === 0 ? (
                <div className="empty-state">Нет замеров за выбранный период.</div>
              ) : (
                Object.entries(groupedByDate).map(([day, items]) => (
                  <div key={day} className="day-card">
                    <h3>{day}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Сист.</th>
                          <th>Диаст.</th>
                          <th>Пульс</th>
                          <th>Заметки</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <Fragment key={item.id}>
                            <tr className="measurement-row">
                              <td data-label="Время">{item.time}</td>
                              <td data-label="Сист.">{item.systolic}</td>
                              <td data-label="Диаст.">{item.diastolic}</td>
                              <td data-label="Пульс">{item.pulse}</td>
                              <td data-label="Заметки" className="notes-column">
                                <span className="notes-text">{item.notes || '-'}</span>
                                {item.notes && (
                                  <button className="toggle-notes notes-toggle-button" onClick={() => toggleNotes(item.id)}>
                                    {expandedRows.includes(item.id) ? 'Скрыть' : 'Показать'}
                                  </button>
                                )}
                              </td>
                            </tr>
                            {expandedRows.includes(item.id) && item.notes && (
                              <tr className="notes-row">
                                <td colSpan={5}>{item.notes}</td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="chart-card">
            <h2>График</h2>
            {chartPoints.length === 0 ? (
              <div className="empty-state">Нет данных для графика.</div>
            ) : (
              <div className="line-chart">
                <svg
                  width={chartDimensions.width}
                  height={chartDimensions.height}
                  viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                >
                  <defs>
                    <linearGradient id="lineGradientSystolic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#93c5fd" />
                    </linearGradient>
                    <linearGradient id="lineGradientDiastolic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#047857" />
                      <stop offset="100%" stopColor="#6ee7b7" />
                    </linearGradient>
                    <linearGradient id="lineGradientPulse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#be123c" />
                      <stop offset="100%" stopColor="#fca5a5" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3, 4].map((step) => {
                    const y =
                      chartDimensions.marginTop +
                      ((chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) * step) / 4;
                    const value = Math.round(chartBounds.max - (chartBounds.range * step) / 4);
                    return (
                      <g key={step}>
                        <line
                          x1={chartDimensions.marginLeft}
                          y1={y}
                          x2={chartDimensions.width - chartDimensions.marginRight}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 4"
                        />
                        <text x={chartDimensions.marginLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#374151">
                          {value}
                        </text>
                      </g>
                    );
                  })}
                  <path
                    d={buildLinePath('systolic')}
                    fill="none"
                    stroke="url(#lineGradientSystolic)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d={buildLinePath('diastolic')}
                    fill="none"
                    stroke="url(#lineGradientDiastolic)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d={buildLinePath('pulse')}
                    fill="none"
                    stroke="url(#lineGradientPulse)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  {chartPoints.map((point, index) => {
                    const x =
                      chartDimensions.marginLeft +
                      ((chartDimensions.width - chartDimensions.marginLeft - chartDimensions.marginRight) * index) /
                        Math.max(chartPoints.length - 1, 1);
                    const ySystolic =
                      chartDimensions.marginTop +
                      (chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) *
                        (1 - (point.systolic - chartBounds.min) / chartBounds.range);
                    const yDiastolic =
                      chartDimensions.marginTop +
                      (chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) *
                        (1 - (point.diastolic - chartBounds.min) / chartBounds.range);
                    const yPulse =
                      chartDimensions.marginTop +
                      (chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) *
                        (1 - (point.pulse - chartBounds.min) / chartBounds.range);
                    return (
                      <g key={`${point.timestamp}-${point.systolic}-${point.diastolic}-${point.pulse}`}>
                        <circle cx={x} cy={ySystolic} r="4" fill="#2563eb" />
                        <circle cx={x} cy={yDiastolic} r="4" fill="#047857" />
                        <circle cx={x} cy={yPulse} r="4" fill="#be123c" />
                        <text x={x} y={chartDimensions.height - 20} textAnchor="middle" fontSize="10" fill="#475569">
                          {point.date}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="line-chart-legend">
                  <span><strong className="legend-dot legend-systolic" /> Систолическое</span>
                  <span><strong className="legend-dot legend-diastolic" /> Диастолическое</span>
                  <span><strong className="legend-dot legend-pulse" /> Пульс</span>
                </div>
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default App;
