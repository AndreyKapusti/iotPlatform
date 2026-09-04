import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, login, register, setToken } from '../api/client';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const hasToken = Boolean(localStorage.getItem('signaldeck_token'));
  if (hasToken) {
    return <Navigate to="/devices" replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email, username, password);
        setRegistered(true);
        setMode('login');
      } else {
        const token = await login(username, password);
        setToken(token.access_token);
        navigate('/devices');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось выполнить запрос');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 style={{ marginBottom: 'var(--space-2)' }}>SignalDeck</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          Мониторинг IoT-устройств и живые дашборды
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'auth-tab--active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
          >
            Регистрация
          </button>
        </div>

        {registered && (
          <div className="alert alert-success">Аккаунт создан. Войдите с вашим логином.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          {mode === 'register' && (
            <label className="field">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Имя пользователя</span>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              autoComplete="username"
            />
          </label>

          <label className="field">
            <span className="field-label">Пароль</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <p style={{ marginTop: 'var(--space-3)', fontSize: 12, color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              Нет аккаунта?{' '}
              <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 'auto' }} onClick={() => setMode('register')}>
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>
              Уже есть аккаунт?{' '}
              <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 'auto' }} onClick={() => setMode('login')}>
                Войти
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
