import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ApiError,
  createDevice,
  formatDate,
  isDeviceOnline,
  listDevices,
} from '../api/client';
import type { Device } from '../types';

export function DevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDevices();
      setDevices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить устройства');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const device = await createDevice(name);
      setNewName('');
      setShowForm(false);
      navigate(`/devices/${device.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось создать устройство');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Устройства</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Управление подключёнными IoT-устройствами
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            Добавить устройство
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>Новое устройство</h3>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Имя устройства"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            />
            <button type="button" className="btn btn-primary" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? 'Создание…' : 'Создать'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Загрузка…</p>
      ) : devices.length === 0 ? (
        <div className="card empty-state">
          <h3>Пока нет устройств</h3>
          <p>Создайте первое устройство и подключите симулятор или прошивку.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 'var(--space-3)' }} onClick={() => setShowForm(true)}>
            Создать устройство
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>ID</th>
                <th>Статус</th>
                <th>Последняя активность</th>
                <th>Создано</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => {
                const online = isDeviceOnline(device.last_seen_at);
                return (
                  <tr
                    key={device.id}
                    className="clickable"
                    onClick={() => navigate(`/devices/${device.id}`)}
                  >
                    <td>{device.name}</td>
                    <td className="mono">{device.id}</td>
                    <td>
                      <span className={`badge ${online ? 'badge--online' : 'badge--offline'}`}>
                        <span className="badge-dot" />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td>{formatDate(device.last_seen_at)}</td>
                    <td>{formatDate(device.created_at)}</td>
                    <td>
                      <Link
                        to={`/devices/${device.id}/dashboards`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Дашборд
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
