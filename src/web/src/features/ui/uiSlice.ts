import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  detectDefaultLocale,
  LOCALE_STORAGE_KEY,
  OFFLINE_ALERTS_KEY,
  OFFLINE_THRESHOLD_KEY,
  ONLINE_THRESHOLD_MS,
  resolveTheme,
  SIDEBAR_STORAGE_KEY,
  THEME_STORAGE_KEY,
  type Locale,
  type ResolvedTheme,
  type ThemePreference,
} from '../../shared/lib/constants';

interface UiState {
  themePreference: ThemePreference;
  locale: Locale;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  offlineAlertsEnabled: boolean;
  offlineThresholdMs: number;
}

function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
    return 'system';
  } catch {
    return 'system';
  }
}

function readLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'ru' || raw === 'en') return raw;
    return detectDefaultLocale();
  } catch {
    return detectDefaultLocale();
  }
}

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function readOfflineAlertsEnabled(): boolean {
  try {
    return localStorage.getItem(OFFLINE_ALERTS_KEY) === '1';
  } catch {
    return false;
  }
}

function readOfflineThresholdMs(): number {
  try {
    const raw = localStorage.getItem(OFFLINE_THRESHOLD_KEY);
    if (raw) {
      const n = Number(raw);
      if (n >= 30_000) return n;
    }
    return ONLINE_THRESHOLD_MS;
  } catch {
    return ONLINE_THRESHOLD_MS;
  }
}

function applyDocumentTheme(resolved: ResolvedTheme) {
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.dataset.theme = resolved;
}

const initialPreference = readThemePreference();
applyDocumentTheme(resolveTheme(initialPreference));

const initialState: UiState = {
  themePreference: initialPreference,
  locale: readLocale(),
  sidebarCollapsed: readSidebarCollapsed(),
  mobileNavOpen: false,
  offlineAlertsEnabled: readOfflineAlertsEnabled(),
  offlineThresholdMs: readOfflineThresholdMs(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setThemePreference(state, action: PayloadAction<ThemePreference>) {
      state.themePreference = action.payload;
      localStorage.setItem(THEME_STORAGE_KEY, action.payload);
      applyDocumentTheme(resolveTheme(action.payload));
    },
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      localStorage.setItem(LOCALE_STORAGE_KEY, action.payload);
      document.documentElement.lang = action.payload;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, action.payload ? '1' : '0');
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, state.sidebarCollapsed ? '1' : '0');
    },
    setMobileNavOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavOpen = action.payload;
    },
    syncSystemTheme(state) {
      applyDocumentTheme(resolveTheme(state.themePreference));
    },
    setOfflineAlertsEnabled(state, action: PayloadAction<boolean>) {
      state.offlineAlertsEnabled = action.payload;
      localStorage.setItem(OFFLINE_ALERTS_KEY, action.payload ? '1' : '0');
    },
    setOfflineThresholdMs(state, action: PayloadAction<number>) {
      state.offlineThresholdMs = action.payload;
      localStorage.setItem(OFFLINE_THRESHOLD_KEY, String(action.payload));
    },
  },
});

export const {
  setThemePreference,
  setLocale,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  setMobileNavOpen,
  syncSystemTheme,
  setOfflineAlertsEnabled,
  setOfflineThresholdMs,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;

export const selectThemePreference = (state: { ui: UiState }) => state.ui.themePreference;
export const selectLocale = (state: { ui: UiState }) => state.ui.locale;
export const selectSidebarCollapsed = (state: { ui: UiState }) => state.ui.sidebarCollapsed;
export const selectMobileNavOpen = (state: { ui: UiState }) => state.ui.mobileNavOpen;
export const selectOfflineAlertsEnabled = (state: { ui: UiState }) => state.ui.offlineAlertsEnabled;
export const selectOfflineThresholdMs = (state: { ui: UiState }) => state.ui.offlineThresholdMs;
