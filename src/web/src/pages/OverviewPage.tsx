import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  DevicesOther as DevicesIcon,
  OfflineBolt as OfflineIcon,
  SignalCellularAlt as OnlineIcon,
} from '@mui/icons-material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { useListDevicesQuery } from '../features/devices/api/devicesApi';
import { extractErrorMessage } from '../shared/api/baseApi';
import { selectOfflineThresholdMs } from '../features/ui/uiSlice';
import { useFleetMeta } from '../shared/hooks/useFleetMeta';
import { usePinnedDevices } from '../shared/hooks/usePinnedDevices';
import { computeFleetHealth, healthScoreColor } from '../shared/lib/fleetHealth';
import { formatDate, formatDurationMs, formatRelativeTime, isDeviceOnline } from '../shared/lib/format';
import { DeviceStatusChip } from '../shared/ui/DeviceStatusChip';
import { LoadingState } from '../shared/ui/LoadingState';
import { PageHeader } from '../shared/ui/PageHeader';
import { QuickCard } from '../shared/ui/QuickCard';
import { SectionHeader } from '../shared/ui/SectionHeader';
import { StatCard } from '../shared/ui/StatCard';
import type { Device } from '../types';

function HealthScoreCard({
  score,
  onlinePct,
  avgLagMs,
}: {
  score: number;
  onlinePct: number;
  avgLagMs: number | null;
}) {
  const { t } = useTranslation();
  const color = healthScoreColor(score);

  return (
    <StatCard label={t('overview.healthScore')}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <CircularProgress variant="determinate" value={score} size={52} thickness={5} color={color} />
          <Box
            sx={{
              inset: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" fontWeight={700}>
              {score}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {t('overview.onlinePct', { pct: onlinePct })}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {avgLagMs != null
              ? t('overview.avgLag', { lag: formatDurationMs(avgLagMs) })
              : t('overview.noActivityYet')}
          </Typography>
        </Box>
      </Stack>
    </StatCard>
  );
}

export function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { pinned } = usePinnedDevices();
  const { data: devices = [], isLoading, isError, error, refetch } = useListDevicesQuery(undefined, {
    pollingInterval: 15_000,
  });
  const { dashboards: fleetDashboards } = useFleetMeta(devices);

  const stats = useMemo(() => {
    let online = 0;
    for (const d of devices) {
      if (isDeviceOnline(d.last_seen_at, thresholdMs)) online += 1;
    }
    return { total: devices.length, online, offline: devices.length - online };
  }, [devices, thresholdMs]);

  const health = useMemo(
    () => computeFleetHealth(devices, thresholdMs),
    [devices, thresholdMs],
  );

  const offlineDevices = useMemo(
    () =>
      devices
        .filter((d) => !isDeviceOnline(d.last_seen_at, thresholdMs))
        .sort((a, b) => {
          const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          return ta - tb;
        }),
    [devices, thresholdMs],
  );

  const pinnedDevices = useMemo(
    () => pinned.map((id) => devices.find((d) => d.id === id)).filter(Boolean) as Device[],
    [devices, pinned],
  );

  const recentDashboards = fleetDashboards.slice(0, 6);

  if (isLoading) {
    return <LoadingState label={t('overview.loading')} />;
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
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3} sx={{ display: 'flex' }}>
          <HealthScoreCard score={health.score} onlinePct={health.onlinePct} avgLagMs={health.avgLagMs} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3} sx={{ display: 'flex' }}>
          <StatCard label={t('overview.totalDevices')} icon={<DevicesIcon />}>
            <Typography variant="h3" fontWeight={700}>
              {stats.total}
            </Typography>
          </StatCard>
        </Grid>
        <Grid item xs={12} sm={6} lg={3} sx={{ display: 'flex' }}>
          <StatCard label={t('overview.online')} icon={<OnlineIcon />} iconColor="success.main">
            <Typography variant="h3" fontWeight={700} color="success.main">
              {stats.online}
            </Typography>
          </StatCard>
        </Grid>
        <Grid item xs={12} sm={6} lg={3} sx={{ display: 'flex' }}>
          <StatCard
            label={t('overview.offline')}
            icon={<OfflineIcon />}
            iconColor={stats.offline > 0 ? 'warning.main' : 'text.secondary'}
          >
            <Typography
              variant="h3"
              fontWeight={700}
              color={stats.offline > 0 ? 'warning.main' : 'text.secondary'}
            >
              {stats.offline}
            </Typography>
          </StatCard>
        </Grid>
      </Grid>

      {stats.offline > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('overview.offlineAlert', { count: stats.offline })}
        </Alert>
      )}

      {recentDashboards.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <SectionHeader
            title={t('overview.recentDashboards')}
            action={
              <Button size="small" onClick={() => navigate('/devices')}>
                {t('overview.allDevices')}
              </Button>
            }
          />
          <Grid container spacing={2}>
            {recentDashboards.map((dash) => (
              <Grid item xs={12} sm={6} lg={4} key={dash.id}>
                <QuickCard
                  title={dash.name}
                  subtitle={dash.deviceName}
                  meta={formatDate(dash.updated_at ?? dash.created_at ?? null)}
                  icon={<DashboardIcon />}
                  to={`/devices/${dash.device_id}/dashboards/${dash.id}`}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {pinnedDevices.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <SectionHeader title={t('overview.pinned')} />
          <Grid container spacing={2}>
            {pinnedDevices.map((device) => (
              <Grid item xs={12} sm={6} lg={4} key={device.id}>
                <QuickCard
                  title={device.name}
                  subtitle={`ID ${device.id}`}
                  meta={formatRelativeTime(device.last_seen_at)}
                  trailing={<DeviceStatusChip lastSeenAt={device.last_seen_at} />}
                  onClick={() => navigate(`/devices/${device.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {offlineDevices.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <SectionHeader title={t('overview.needsAttention')} />
          <Grid container spacing={2}>
            {offlineDevices.slice(0, 6).map((device) => (
              <Grid item xs={12} sm={6} lg={4} key={device.id}>
                <QuickCard
                  title={device.name}
                  subtitle={`ID ${device.id}`}
                  meta={formatRelativeTime(device.last_seen_at)}
                  trailing={<DeviceStatusChip lastSeenAt={device.last_seen_at} />}
                  onClick={() => navigate(`/devices/${device.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </>
  );
}
