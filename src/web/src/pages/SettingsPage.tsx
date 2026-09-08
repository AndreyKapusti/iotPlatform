import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useLocaleSync } from '../features/i18n/hooks/useLocaleSync';
import {
  selectOfflineAlertsEnabled,
  selectOfflineThresholdMs,
  setOfflineAlertsEnabled,
  setOfflineThresholdMs,
} from '../features/ui/uiSlice';
import type { Locale } from '../shared/lib/constants';
import { OFFLINE_THRESHOLD_OPTIONS } from '../shared/lib/constants';
import { PageHeader } from '../shared/ui/PageHeader';

export function SettingsPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const offlineAlertsEnabled = useAppSelector(selectOfflineAlertsEnabled);
  const offlineThresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { locale, setLocale } = useLocaleSync();

  const localeOptions: { value: Locale; label: string }[] = [
    { value: 'ru', label: t('locale.ru') },
    { value: 'en', label: t('locale.en') },
  ];

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    await Notification.requestPermission();
  };

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Stack spacing={3} sx={{ maxWidth: 720 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h3" gutterBottom>
              {t('settings.notifications')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.notificationsHint')}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={offlineAlertsEnabled}
                  onChange={(e) => dispatch(setOfflineAlertsEnabled(e.target.checked))}
                />
              }
              label={t('settings.offlineAlerts')}
            />
            {offlineAlertsEnabled && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600} gutterBottom>
                  {t('settings.offlineThreshold')}
                </Typography>
                <FormControl>
                  <RadioGroup
                    value={offlineThresholdMs}
                    onChange={(_, value) => dispatch(setOfflineThresholdMs(Number(value)))}
                  >
                    <Grid container spacing={1}>
                      {OFFLINE_THRESHOLD_OPTIONS.map((option) => (
                        <Grid item xs={12} sm={4} key={option.ms}>
                          <FormControlLabel
                            value={option.ms}
                            control={<Radio />}
                            label={t(option.labelKey)}
                            sx={{
                              m: 0,
                              width: '100%',
                              px: 2,
                              py: 1.5,
                              border: 1,
                              borderColor: offlineThresholdMs === option.ms ? 'primary.main' : 'divider',
                              borderRadius: 2,
                              bgcolor: offlineThresholdMs === option.ms ? 'action.selected' : 'transparent',
                            }}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </RadioGroup>
                </FormControl>
                {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    {t('settings.notificationPermission')}
                    <Button size="small" sx={{ ml: 1 }} onClick={() => void requestNotificationPermission()}>
                      {t('settings.enableNotifications')}
                    </Button>
                  </Alert>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h3" gutterBottom>
              {t('locale.language')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('locale.languageHint')}
            </Typography>
            <FormControl>
              <RadioGroup
                value={locale}
                onChange={(_, value) => setLocale(value as Locale)}
              >
                <Grid container spacing={1}>
                  {localeOptions.map((option) => (
                    <Grid item xs={12} sm={6} key={option.value}>
                      <FormControlLabel
                        value={option.value}
                        control={<Radio />}
                        label={option.label}
                        sx={{
                          m: 0,
                          width: '100%',
                          px: 2,
                          py: 1.5,
                          border: 1,
                          borderColor: locale === option.value ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          bgcolor: locale === option.value ? 'action.selected' : 'transparent',
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </RadioGroup>
            </FormControl>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
