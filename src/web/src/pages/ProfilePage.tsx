import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useGetProfileQuery, useUpdateProfileMutation } from '../features/profile/api/profileApi';
import { extractErrorMessage } from '../shared/api/baseApi';
import { LoadingState } from '../shared/ui/LoadingState';
import { PageHeader } from '../shared/ui/PageHeader';
import type { UserProfile, UserProfileUpdate } from '../types';

const TIMEZONE_VALUES = [
  '',
  'UTC',
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'Asia/Tokyo',
] as const;

const TIMEZONE_LABELS: Record<(typeof TIMEZONE_VALUES)[number], string> = {
  '': '',
  UTC: 'UTC',
  'Europe/Moscow': 'Europe/Moscow (МСК)',
  'Europe/Kaliningrad': 'Europe/Kaliningrad',
  'Europe/Samara': 'Europe/Samara',
  'Asia/Yekaterinburg': 'Asia/Yekaterinburg',
  'Asia/Omsk': 'Asia/Omsk',
  'Asia/Krasnoyarsk': 'Asia/Krasnoyarsk',
  'Asia/Irkutsk': 'Asia/Irkutsk',
  'Asia/Yakutsk': 'Asia/Yakutsk',
  'Asia/Vladivostok': 'Asia/Vladivostok',
  'Europe/London': 'Europe/London',
  'Europe/Berlin': 'Europe/Berlin',
  'America/New_York': 'America/New_York',
  'Asia/Tokyo': 'Asia/Tokyo',
};

interface ProfileForm {
  email: string;
  username: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  phone: string;
  organization: string;
  job_title: string;
  timezone: string;
}

function profileToForm(profile: UserProfile): ProfileForm {
  return {
    email: profile.email,
    username: profile.username,
    last_name: profile.last_name ?? '',
    first_name: profile.first_name ?? '',
    middle_name: profile.middle_name ?? '',
    birth_date: profile.birth_date ?? '',
    phone: profile.phone ?? '',
    organization: profile.organization ?? '',
    job_title: profile.job_title ?? '',
    timezone: profile.timezone ?? '',
  };
}

function optionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function buildPatch(form: ProfileForm): UserProfileUpdate {
  return {
    email: form.email.trim(),
    last_name: optionalString(form.last_name),
    first_name: optionalString(form.first_name),
    middle_name: optionalString(form.middle_name),
    birth_date: form.birth_date === '' ? null : form.birth_date,
    phone: optionalString(form.phone),
    organization: optionalString(form.organization),
    job_title: optionalString(form.job_title),
    timezone: form.timezone === '' ? null : form.timezone,
  };
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: profile, isLoading, isError, error, refetch } = useGetProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const timezoneOptions = useMemo(
    () =>
      TIMEZONE_VALUES.map((value) => ({
        value,
        label: value === '' ? t('profile.timezoneEmpty') : TIMEZONE_LABELS[value],
      })),
    [t],
  );

  useEffect(() => {
    if (profile) setForm(profileToForm(profile));
  }, [profile]);

  const updateField = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setFieldError(null);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.email.trim()) {
      setFieldError(t('profile.emailRequired'));
      return;
    }
    if (form.birth_date && new Date(`${form.birth_date}T00:00:00`) > new Date()) {
      setFieldError(t('profile.birthFuture'));
      return;
    }
    try {
      await updateProfile(buildPatch(form)).unwrap();
      enqueueSnackbar(t('profile.savedSuccess'), { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0]), {
        variant: 'error',
      });
    }
  };

  if (isLoading || !form) {
    return <LoadingState label={t('profile.loading')} />;
  }

  if (isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => void refetch()}>{t('common.retry')}</Button>}>
        {extractErrorMessage(error as Parameters<typeof extractErrorMessage>[0])}
      </Alert>
    );
  }

  return (
    <>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <Card>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Box
              component="img"
              src="/favicon.svg"
              alt="sg"
              sx={{ width: 56, height: 56, flexShrink: 0, display: 'block' }}
            />
            <Box>
              <Typography variant="h3">{t('profile.personal')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('profile.personalHint')}
              </Typography>
            </Box>
          </Stack>

          <Box component="form" onSubmit={(e) => void submit(e)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.lastName')} value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.firstName')} value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.middleName')} value={form.middle_name} onChange={(e) => updateField('middle_name', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.birthDate')} type="date" value={form.birth_date} onChange={(e) => updateField('birth_date', e.target.value)} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('auth.email')} type="email" required value={form.email} onChange={(e) => updateField('email', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.login')} value={form.username} disabled />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.phone')} value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.organization')} value={form.organization} onChange={(e) => updateField('organization', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('profile.jobTitle')} value={form.job_title} onChange={(e) => updateField('job_title', e.target.value)} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label={t('profile.timezone')} value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)}>
                  {timezoneOptions.map((option) => (
                    <MenuItem key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            {fieldError && (
              <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                {fieldError}
              </Typography>
            )}

            <Button type="submit" variant="contained" sx={{ mt: 3 }} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}
