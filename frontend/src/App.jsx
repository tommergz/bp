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
  const [chartType, setChartType] = useState('all'); // 'all', 'bloodPressure', 'pulse'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const sessionData = supabase.auth.session();
    setSession(sessionData);

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchMeasurements();
  }, [session, rangeFrom, rangeTo]);

  useEffect(() => {
    if (!session) return;
    
    const token = session?.access_token;
    if (!token) return;
    
    const initializeRange = async () => {
      const res = await fetch(`${backendUrl}/api/measurements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data || data.length === 0) return;
      
      const dates = data.map(m => m.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      
      setRangeFrom(minDate);
      setRangeTo(maxDate);
    };
    
    initializeRange();
  }, [session]);

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
        return timeB - timeA;
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

  const chartDateBands = useMemo(() => {
    if (chartPoints.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    chartPoints.forEach((point, index) => {
      if (!currentGroup || currentGroup.date !== point.date) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { date: point.date, startIndex: index, endIndex: index, points: [index] };
      } else {
        currentGroup.endIndex = index;
        currentGroup.points.push(index);
      }
    });

    if (currentGroup) groups.push(currentGroup);

    return groups.map((group, index) => ({
      ...group,
      fill: index % 2 === 0 ? '#f8fafc' : '#eef2ff',
    }));
  }, [chartPoints]);

  const chartDimensionsDesktop = useMemo(() => {
    const width = Math.max(400, Math.max(1, chartPoints.length) * 80);
    const height = 360;
    return { width, height, marginLeft: 45, marginRight: 45, marginTop: 10, marginBottom: 50, lineStroke: 1.5 };
  }, [chartPoints.length]);

  const chartDimensionsMobile = useMemo(() => {
    const width = Math.max(280, Math.max(1, chartPoints.length) * 62);
    const height = 540;
    return { width, height, marginLeft: 34, marginRight: 24, marginTop: 10, marginBottom: 48, lineStroke: 2.2 };
  }, [chartPoints.length]);

  const chartDimensions = isMobile ? chartDimensionsMobile : chartDimensionsDesktop;

  const chartBoundsDesktop = useMemo(() => {
    if (chartType === 'pulse') {
      return { min: 40, max: 180, range: 140 };
    }
    return { min: 60, max: 220, range: 160 };
  }, [chartType]);

  const chartBoundsMobile = useMemo(() => {
    if (chartType === 'pulse') {
      return { min: 40, max: 180, range: 140 };
    }
    return { min: 60, max: 220, range: 160 };
  }, [chartType]);

  const chartBounds = isMobile ? chartBoundsMobile : chartBoundsDesktop;

  const pointRadius = isMobile ? 3 : 2.8;
  const fontSizeChart = isMobile ? 11 : 10;

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

          <section className="chart-card">
            <h2>График</h2>
            <div className="chart-tabs">
              <button 
                className={`chart-tab ${chartType === 'all' ? 'active' : ''}`}
                onClick={() => setChartType('all')}
              >
                Все показатели
              </button>
              <button 
                className={`chart-tab ${chartType === 'bloodPressure' ? 'active' : ''}`}
                onClick={() => setChartType('bloodPressure')}
              >
                Артериальное давление
              </button>
              <button 
                className={`chart-tab ${chartType === 'pulse' ? 'active' : ''}`}
                onClick={() => setChartType('pulse')}
              >
                Пульс
              </button>
            </div>

            {chartPoints.length === 0 ? (
              <div className="empty-state">Нет данных для графика.</div>
            ) : (
              <div className={`line-chart ${chartPoints.length > 20 ? 'line-chart-scrollable' : ''}`}>
                <svg
                  width={chartDimensions.width}
                  height={chartDimensions.height}
                  viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {(() => {
                    const innerWidth = chartDimensions.width - chartDimensions.marginLeft - chartDimensions.marginRight;
                    const innerHeight = chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom;
                    const stepCount = Math.max(chartPoints.length - 1, 1);
                    return chartDateBands.map((band) => {
                      const pointXs = band.points.map((index) => chartDimensions.marginLeft + (innerWidth * index) / stepCount);
                      const bandStart = pointXs[0] - (pointXs[1] - pointXs[0]) / 2;
                      const bandEnd = pointXs[pointXs.length - 1] + (pointXs[pointXs.length - 1] - pointXs[pointXs.length - 2]) / 2;
                      return (
                        <rect
                          key={`band-${band.date}`}
                          x={bandStart}
                          y={chartDimensions.marginTop}
                          width={Math.max(1, bandEnd - bandStart)}
                          height={innerHeight}
                          fill={band.fill}
                        />
                      );
                    });
                  })()}
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

                  {(() => {
                    const steps = [];
                    for (let i = chartBounds.min; i <= chartBounds.max; i += 10) {
                      steps.push(i);
                    }
                    return steps.map((value) => {
                      const step = value - chartBounds.min;
                      const y =
                        chartDimensions.marginTop +
                        ((chartDimensions.height - chartDimensions.marginTop - chartDimensions.marginBottom) *
                          (chartBounds.range - step)) /
                          chartBounds.range;
                      const isHighlighted = (value === 80 || value === 120) && chartType !== 'pulse';
                      return (
                        <g key={value}>
                          <line
                            x1={chartDimensions.marginLeft}
                            y1={y}
                            x2={chartDimensions.width - chartDimensions.marginRight}
                            y2={y}
                            stroke={isHighlighted ? '#ff6b6b' : '#e2e8f0'}
                            strokeDasharray={isHighlighted ? '5 5' : '3 4'}
                            strokeWidth={isHighlighted ? '2' : '1'}
                          />
                          <text x={chartDimensions.marginLeft - 8} y={y + 4} textAnchor="end" fontSize={fontSizeChart} fill="#374151">
                            {value}
                          </text>
                          <text
                            x={chartDimensions.width - chartDimensions.marginRight + 12}
                            y={y + 4}
                            textAnchor="start"
                            fontSize={fontSizeChart}
                            fill="#374151"
                          >
                            {value}
                          </text>
                        </g>
                      );
                    });
                  })()}

                  {(chartType === 'all' || chartType === 'bloodPressure') && (
                    <>
                      <path
                        d={buildLinePath('systolic')}
                        fill="none"
                        stroke="url(#lineGradientSystolic)"
                        strokeWidth={chartDimensions.lineStroke}
                        strokeLinecap="round"
                      />
                      <path
                        d={buildLinePath('diastolic')}
                        fill="none"
                        stroke="url(#lineGradientDiastolic)"
                        strokeWidth={chartDimensions.lineStroke}
                        strokeLinecap="round"
                      />
                    </>
                  )}

                  {(chartType === 'all' || chartType === 'pulse') && (
                    <path
                      d={buildLinePath('pulse')}
                      fill="none"
                      stroke="url(#lineGradientPulse)"
                      strokeWidth={chartDimensions.lineStroke}
                      strokeLinecap="round"
                    />
                  )}

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
                        {(chartType === 'all' || chartType === 'bloodPressure') && (
                          <>
                            <circle cx={x} cy={ySystolic} r={pointRadius} fill="#2563eb">
                              <title>Систолическое: {point.systolic}</title>
                            </circle>
                            <circle cx={x} cy={yDiastolic} r={pointRadius} fill="#047857">
                              <title>Диастолическое: {point.diastolic}</title>
                            </circle>
                          </>
                        )}
                        {(chartType === 'all' || chartType === 'pulse') && (
                          <circle cx={x} cy={yPulse} r={pointRadius} fill="#be123c">
                            <title>Пульс: {point.pulse}</title>
                          </circle>
                        )}
                        <text x={x} y={chartDimensions.height - 28} textAnchor="middle" fontSize={fontSizeChart} fill="#475569">
                          {point.date}
                        </text>
                        <text x={x} y={chartDimensions.height - 10} textAnchor="middle" fontSize={fontSizeChart - 1} fill="#64748b">
                          {point.time}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="line-chart-legend">
                  {(chartType === 'all' || chartType === 'bloodPressure') && (
                    <>
                      <span><strong className="legend-dot legend-systolic" /> Систолическое</span>
                      <span><strong className="legend-dot legend-diastolic" /> Диастолическое</span>
                    </>
                  )}
                  {(chartType === 'all' || chartType === 'pulse') && (
                    <span><strong className="legend-dot legend-pulse" /> Пульс</span>
                  )}
                </div>
              </div>
            )}
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
        </main>
      )}
    </div>
  );
}

export default App;
