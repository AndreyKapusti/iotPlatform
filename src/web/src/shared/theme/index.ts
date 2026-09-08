import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import type { ResolvedTheme } from '../lib/constants';

const brand = {
  light: {
    primary: { main: '#0f766e', light: '#0d9488', dark: '#115e59', contrastText: '#fff' },
    secondary: { main: '#475569', contrastText: '#fff' },
    background: { default: '#f4f7f5', paper: '#ffffff' },
    divider: '#d8e0dc',
  },
  dark: {
    primary: { main: '#2dd4bf', light: '#5eead4', dark: '#14b8a6', contrastText: '#0f1419' },
    secondary: { main: '#94a3b8', contrastText: '#0f1419' },
    background: { default: '#0f1419', paper: '#1a222c' },
    divider: '#2c3845',
  },
};

export function createAppTheme(mode: ResolvedTheme) {
  const palette = brand[mode];
  let theme = createTheme({
    palette: {
      mode,
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      divider: palette.divider,
      success: { main: mode === 'light' ? '#15803d' : '#4ade80' },
      warning: { main: mode === 'light' ? '#b45309' : '#fbbf24' },
      error: { main: mode === 'light' ? '#b91c1c' : '#f87171' },
      text: {
        primary: mode === 'light' ? '#1a2332' : '#e8eef2',
        secondary: mode === 'light' ? '#5c6b7a' : '#9aa8b5',
      },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
      h1: { fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, fontSize: '1.75rem' },
      h2: { fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600, fontSize: '1.375rem' },
      h3: { fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 500, fontSize: '1.125rem' },
      h4: { fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 600 },
      button: { fontFamily: '"DM Sans", system-ui, sans-serif', fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { scrollbarColor: mode === 'dark' ? '#3a4654 #1a222c' : '#cbd5d1 #f4f7f5' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { minHeight: 40, borderRadius: 6 } },
      },
      MuiTextField: {
        defaultProps: { size: 'small', fullWidth: true },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: '1px solid',
            borderColor: palette.divider,
            boxShadow: mode === 'light' ? '0 1px 3px rgba(26, 35, 50, 0.08)' : '0 1px 3px rgba(0,0,0,0.35)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { borderRight: '1px solid', borderColor: palette.divider },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            py: 1.5,
            px: 2,
            borderColor: palette.divider,
          },
          head: {
            fontFamily: '"DM Sans", system-ui, sans-serif',
            fontWeight: 500,
            fontSize: '0.8125rem',
            color: mode === 'light' ? '#5c6b7a' : '#9aa8b5',
            backgroundColor: mode === 'light' ? '#fafbfa' : '#151c24',
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            '&:last-child': { pb: 2.5 },
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            flexWrap: 'wrap',
            gap: 4,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            px: 1.5,
            py: 0.5,
            borderColor: palette.divider,
            '&.Mui-selected': {
              fontWeight: 600,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
    },
  });
  theme = responsiveFontSizes(theme);
  return theme;
}
