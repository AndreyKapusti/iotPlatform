import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError,
  createDashboard,
  deleteDashboard,
  formatDate,
  listDashboards,
} from '../api/client';
import type { DashboardSummary } from '../types';

export function DashboardsListPage() {
  const { id } = useParams<{ id: string }>();
  const deviceId = Number(id);
  const navigate = useNavigate();
  const [items, setItems] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listDashboards(deviceId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить дашборды');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!deviceId || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const dash = await createDashboard(deviceId, name.trim());
      navigate(`/devices/${deviceId}/dashboards/${dash.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать дашборд');
      setCreating(false);
    }
  };

  const onDelete = async (dashboardId: number, dashboardName: string) => {
    if (!window.confirm(`Удалить дашборд «${dashboardName}»?`)) return;
    try {
      await deleteDashboard(dashboardId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p style={{ marginBottom: 'var(--space-1)' }}>
            <Link to={`/devices/${deviceId}`}>← Устройство</Link>
          </p>
          <h1>Дашборды</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Несколько дашбордов на одно устройство
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="card" onSubmit={(e) => void onCreate(e)} style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 12, fontSize: 18 }}>Новый дашборд</h2>
        <div className="form-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
          <button className="btn btn-primary" type="submit" disabled={creating || !name.trim()}>
            {creating ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Пока нет дашбордов. Создайте первый выше.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Обновлён</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/devices/${deviceId}/dashboards/${item.id}`}>{item.name}</Link>
                    </td>
                    <td className="muted">{formatDate(item.updated_at ?? item.created_at ?? null)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link
                        className="btn btn-secondary"
                        style={{ marginRight: 8 }}
                        to={`/devices/${deviceId}/dashboards/${item.id}`}
                      >
                        Открыть
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void onDelete(item.id, item.name)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
