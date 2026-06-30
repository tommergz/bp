import { useEffect, useMemo, useState } from 'react';
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
  const [error, setError] = useState('');

  useEffect(() => {
    const sessionData = supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setError(error.message);
  };

  const signInWithGoogle = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
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
    setMeasurements((prev) => [...prev, data]);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setNotes('');
  };

  const groupedByDate = useMemo(() => {
    return measurements.reduce((acc, item) => {
      const key = item.date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [measurements]);

  const chartPoints = useMemo(() => {
    return measurements.map((item) => ({ date: item.date, systolic: item.systolic, diastolic: item.diastolic, pulse: item.pulse }));
  }, [measurements]);

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
                          <th>Сист.</th>
                          <th>Диаст.</th>
                          <th>Пульс</th>
                          <th>Примечания</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.systolic}</td>
                            <td>{item.diastolic}</td>
                            <td>{item.pulse}</td>
                            <td>{item.notes || '-'}</td>
                          </tr>
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
            <div className="chart-table">
              <div className="chart-row chart-header">
                <span>Дата</span>
                <span>Сист.</span>
                <span>Диаст.</span>
                <span>Пульс</span>
              </div>
              {chartPoints.length === 0 ? (
                <div className="empty-state">Нет данных для графика.</div>
              ) : (
                chartPoints.map((point) => (
                  <div key={`${point.date}-${point.systolic}-${point.diastolic}-${point.pulse}`} className="chart-row">
                    <span>{point.date}</span>
                    <span>{point.systolic}</span>
                    <span>{point.diastolic}</span>
                    <span>{point.pulse}</span>
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
