export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'signaldeck_theme';

export function getStoredTheme(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'dark' || raw === 'light') return raw;
  return 'light';
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
