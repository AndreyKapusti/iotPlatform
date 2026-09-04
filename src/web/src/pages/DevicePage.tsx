import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, formatDate, getCapabilities, getDevice, isDeviceOnline } from '../api/client';
import type { Capability, Device } from '../types';

export function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const deviceId = Number(id);
  const [device, setDevice] = useState<Device | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const [dev, caps] = await Promise.all([
        getDevice(deviceId),
        getCapabilities(deviceId),
      ]);
      setDevice(dev);
      setCapabilities(caps);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить устройство');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyKey = async () => {
    if (!device) return;
    await navigator.clipboard.writeText(device.api_key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <p style={{ color: 'var(--text-muted)' }}>Загрузка…</p>;
  }

  if (error || !device) {
    return <div className="alert alert-error">{error ?? 'Устройство не найдено'}</div>;
  }

  const online = isDeviceOnline(device.last_seen_at);

  return (
    <>
      <div className="page-header">
        <div>
          <p style={{ marginBottom: 'var(--space-1)' }}>
            <Link to="/devices">← Устройства</Link>
          </p>
          <h1>{device.name}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            ID: <span className="mono">{device.id}</span>
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn-primary" to={`/devices/${device.id}/dashboards`}>
            Дашборды
          </Link>
        </div>
      </div>

      <div className="device-meta">
        <div className="meta-item">
          <div className="meta-label">Статус</div>
          <span className={`badge ${online ? 'badge--online' : 'badge--offline'}`}>
            <span className="badge-dot" />
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="meta-item">
          <div className="meta-label">Последняя активность</div>
          <div>{formatDate(device.last_seen_at)}</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">Создано</div>
          <div>{formatDate(device.created_at)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Credentials</h3>
        <div className="meta-label">API Key</div>
        <div className="api-key-row">
          <code className="mono">{device.api_key}</code>
          <button type="button" className="btn btn-secondary" onClick={() => void copyKey()}>
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-muted)', fontSize: 12 }}>
          Используйте ключ в заголовке <code className="mono">X-API-Key</code> для MQTT/HTTP ingest.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 'var(--space-3)' }}>Capabilities (schema)</h3>
        {capabilities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            Схема ещё не получена. Запустите симулятор или отправьте announce.
          </p>
        ) : (
          <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>name</th>
                  <th>type</th>
                  <th>role</th>
                  <th>unit</th>
                  <th>min</th>
                  <th>max</th>
                </tr>
              </thead>
              <tbody>
                {capabilities.map((cap) => (
                  <tr key={cap.name} style={{ cursor: 'default' }}>
                    <td className="mono">{cap.name}</td>
                    <td>{cap.type}</td>
                    <td>{cap.role}</td>
                    <td>{cap.unit ?? '—'}</td>
                    <td>{cap.min ?? '—'}</td>
                    <td>{cap.max ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
