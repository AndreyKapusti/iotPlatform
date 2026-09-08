export const TOKEN_STORAGE_KEY = 'signaldeck_token';
export const THEME_STORAGE_KEY = 'signaldeck_theme';
export const LOCALE_STORAGE_KEY = 'signaldeck_locale';
export const SIDEBAR_STORAGE_KEY = 'signaldeck_sidebar_collapsed';
export const PINNED_DEVICES_KEY = 'signaldeck_pinned_devices';
export const TIMEZONE_STORAGE_KEY = 'signaldeck_timezone';
export const OFFLINE_ALERTS_KEY = 'signaldeck_offline_alerts';
export const OFFLINE_THRESHOLD_KEY = 'signaldeck_offline_threshold';

export const GRID_COLS = 12;
export const ROW_HEIGHT = 40;
export const VIEW_GRID_MIN_WIDTH = 720;

export const ONLINE_THRESHOLD_MS = 60_000;

export const CHART_HISTORY_LIMITS = [50, 200, 500] as const;
export type ChartHistoryLimit = (typeof CHART_HISTORY_LIMITS)[number];

export const OFFLINE_THRESHOLD_OPTIONS = [
  { ms: 60_000, labelKey: 'settings.threshold1m' },
  { ms: 180_000, labelKey: 'settings.threshold3m' },
  { ms: 300_000, labelKey: 'settings.threshold5m' },
] as const;

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type Locale = 'ru' | 'en';

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function detectDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return 'ru';
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
