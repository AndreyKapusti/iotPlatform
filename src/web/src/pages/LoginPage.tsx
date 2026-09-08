import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useLoginMutation, useRegisterMutation } from '../features/auth/api/authApi';
import { setCredentials, selectIsAuthenticated } from '../features/auth/authSlice';
import { extractErrorMessage } from '../shared/api/baseApi';
import { ThemeToggle } from '../shared/ui/ThemeToggle';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [login, { isLoading: loggingIn }] = useLoginMutation();
  const [register, { isLoading: registering }] = useRegisterMutation();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'register') {
        await register({ email, username, password }).unwrap();
        enqueueSnackbar(t('auth.accountCreated'), { variant: 'success' });
        setMode('login');
        return;
      }
      const token = await login({ username, password }).unwrap();
      dispatch(setCredentials(token.access_token));
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]));
    }
  };

  const loading = loggingIn || registering;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        bgcolor: 'background.default',
        position: 'relative',
      }}
    >
      <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1 }}>
        <ThemeToggle />
      </Box>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h1" gutterBottom>
            {t('app.name')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('app.tagline')}
          </Typography>

          <Tabs
            value={mode}
            onChange={(_, value: AuthMode) => {
              setMode(value);
              setError(null);
            }}
            sx={{ mb: 3 }}
          >
            <Tab label={t('auth.login')} value="login" />
            <Tab label={t('auth.register')} value="register" />
          </Tabs>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={(e) => void submit(e)}>
            <Stack spacing={2}>
              {mode === 'register' && (
                <TextField
                  label={t('auth.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              )}
              <TextField
                label={t('auth.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                inputProps={{ minLength: 3 }}
                autoComplete="username"
              />
              <TextField
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                inputProps={{ minLength: 6 }}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading
                  ? t('auth.wait')
                  : mode === 'login'
                    ? t('auth.login')
                    : t('auth.register')}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
