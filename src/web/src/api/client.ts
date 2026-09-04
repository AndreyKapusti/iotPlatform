import type {
  Capability,
  Dashboard,
  DashboardSummary,
  Device,
  DeviceCreateResponse,
  HistoryResponse,
  TokenResponse,
  User,
  UserProfile,
  UserProfileUpdate,
  WidgetLayout,
} from '../types';

const TOKEN_KEY = 'signaldeck_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.error === 'string') return body.error;
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(', ');
    }
    return res.statusText || 'Request failed';
  } catch {
    return res.statusText || 'Request failed';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const message = await parseError(res);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams({ username, password });
  return request<TokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<User> {
  return request<User>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
}

export async function getProfile(): Promise<UserProfile> {
  return request<UserProfile>('/api/v1/users/me');
}

export async function updateProfile(patch: UserProfileUpdate): Promise<UserProfile> {
  return request<UserProfile>('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function listDevices(): Promise<Device[]> {
  return request<Device[]>('/api/v1/devices/');
}

export async function createDevice(name: string): Promise<DeviceCreateResponse> {
  return request<DeviceCreateResponse>('/api/v1/devices/', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getDevice(id: number): Promise<Device> {
  return request<Device>(`/api/v1/devices/${id}`);
}

export async function getCapabilities(deviceId: number): Promise<Capability[]> {
  return request<Capability[]>(`/api/v1/devices/${deviceId}/capabilities`);
}

export async function listDashboards(deviceId: number): Promise<DashboardSummary[]> {
  return request<DashboardSummary[]>(`/api/v1/dashboards/device/${deviceId}`);
}

export async function createDashboard(
  deviceId: number,
  name: string,
): Promise<Dashboard> {
  return request<Dashboard>(`/api/v1/dashboards/device/${deviceId}`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function getDashboard(dashboardId: number): Promise<Dashboard> {
  return request<Dashboard>(`/api/v1/dashboards/${dashboardId}`);
}

export async function saveDashboard(
  dashboardId: number,
  name: string,
  layout: WidgetLayout[],
): Promise<Dashboard> {
  return request<Dashboard>(`/api/v1/dashboards/${dashboardId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, layout }),
  });
}

export async function deleteDashboard(dashboardId: number): Promise<void> {
  await request<void>(`/api/v1/dashboards/${dashboardId}`, {
    method: 'DELETE',
  });
}

export async function getTelemetryHistory(
  deviceId: number,
  metric: string,
  limit = 50,
): Promise<HistoryResponse> {
  const params = new URLSearchParams({ metric, limit: String(limit) });
  return request<HistoryResponse>(`/api/v1/telemetry/${deviceId}/history?${params}`);
}

export function getWebSocketUrl(deviceId: number): string {
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl) {
    const base = envUrl.replace(/\/$/, '');
    return `${base}?device_id=${deviceId}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/v1/ws?device_id=${deviceId}`;
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDeviceOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 60_000;
}

export function formatRelativeTime(value: string | null, now = Date.now()): string {
  if (!value) return 'нет данных';
  const diffSec = Math.floor((now - new Date(value).getTime()) / 1000);
  if (diffSec < 0) return 'только что';
  if (diffSec < 5) return 'только что';
  if (diffSec < 60) return `${diffSec} сек назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ч назад`;
  return formatDate(value);
}

export function buildPalette(capabilities: Capability[]) {
  const items: Array<{
    type: WidgetLayout['type'];
    metric: string;
    label: string;
    capability: Capability;
  }> = [];

  for (const cap of capabilities) {
    if (cap.type === 'number' && cap.role === 'sensor') {
      items.push(
        { type: 'line', metric: cap.name, label: `${cap.name} — график`, capability: cap },
        { type: 'gauge', metric: cap.name, label: `${cap.name} — KPI`, capability: cap },
      );
    } else if (cap.type === 'boolean' && cap.role === 'sensor') {
      items.push({
        type: 'indicator',
        metric: cap.name,
        label: `${cap.name} — индикатор`,
        capability: cap,
      });
    } else if (cap.type === 'boolean' && cap.role === 'actuator') {
      items.push({
        type: 'toggle',
        metric: cap.name,
        label: `${cap.name} — переключатель`,
        capability: cap,
      });
    }
  }

  return items;
}

export function createWidgetId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function findNextPosition(layout: WidgetLayout[]): { x: number; y: number } {
  if (layout.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...layout.map((w) => w.y + w.h));
  return { x: 0, y: maxY };
}

export const GRID_COLS = 12;
export const ROW_HEIGHT = 40;
