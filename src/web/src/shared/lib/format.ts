import i18n from '../../features/i18n/config';
import { TIMEZONE_STORAGE_KEY } from './constants';

function getDateLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'ru-RU';
}

function getTimezone(): string | undefined {
  try {
    const tz = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    return tz && tz.trim() ? tz : undefined;
  } catch {
    return undefined;
  }
}

export function setCachedTimezone(timezone: string | null | undefined) {
  try {
    if (timezone?.trim()) {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone.trim());
    } else {
      localStorage.removeItem(TIMEZONE_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getTimezone(),
  };
  return new Date(value).toLocaleString(getDateLocale(), options);
}

export function formatRelativeTime(value: string | null, now = Date.now()): string {
  if (!value) return i18n.t('common.noData');
  const diffSec = Math.floor((now - new Date(value).getTime()) / 1000);
  if (diffSec < 5) return i18n.t('common.justNow');
  if (diffSec < 60) return i18n.t('common.secondsAgo', { count: diffSec });
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return i18n.t('common.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return i18n.t('common.hoursAgo', { count: diffHour });
  return formatDate(value);
}

export function formatDurationMs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return i18n.t('common.secondsAgo', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return i18n.t('common.minutesAgo', { count: min });
  const hour = Math.floor(min / 60);
  if (hour < 48) return i18n.t('common.hoursAgo', { count: hour });
  const day = Math.floor(hour / 24);
  return i18n.t('common.daysAgo', { count: day });
}

export function isStaleLastSeen(lastSeen: string | null, maxAgeMs: number): boolean {
  if (!lastSeen) return true;
  return Date.now() - new Date(lastSeen).getTime() > maxAgeMs;
}

export function isDeviceOnline(lastSeen: string | null, thresholdMs = 60_000): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < thresholdMs;
}

export function formatMetricValue(value: number | boolean | string, unit?: string | null): string {
  if (typeof value === 'boolean') return value ? i18n.t('widgets.on') : i18n.t('widgets.off');
  if (typeof value === 'number') {
    const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return String(value);
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
