import { useMemo, useEffect, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { I18nextProvider } from 'react-i18next';
import { store } from '../store';
import { useAppSelector } from '../hooks';
import { createAppTheme } from '../../shared/theme';
import { useEffectiveTheme } from '../../shared/hooks/useEffectiveTheme';
import i18n from '../../features/i18n/config';

const META_THEME: Record<'light' | 'dark', string> = {
  light: '#f4f7f5',
  dark: '#0f1419',
};

function ThemedApp({ children }: { children: ReactNode }) {
  const mode = useEffectiveTheme();
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const locale = useAppSelector((s) => s.ui.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', META_THEME[mode]);
  }, [mode]);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          autoHideDuration={4000}
        >
          {children}
        </SnackbarProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemedApp>{children}</ThemedApp>
    </Provider>
  );
}
