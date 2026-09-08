import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Dashboard as DashboardIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConnectionPanel } from '../features/devices/components/ConnectionPanel';
import { DeviceLiveMetrics } from '../features/devices/components/DeviceLiveMetrics';
import { useDeviceEvents } from '../shared/hooks/useFleetEvents';
import {
  useGetCapabilitiesQuery,
  useGetDeviceQuery,
} from '../features/devices/api/devicesApi';
import { extractErrorMessage } from '../shared/api/baseApi';
import { formatDate, formatRelativeTime } from '../shared/lib/format';
import { DeviceStatusChip } from '../shared/ui/DeviceStatusChip';
import { EmptyState } from '../shared/ui/EmptyState';
import { LoadingState } from '../shared/ui/LoadingState';
import { PageHeader } from '../shared/ui/PageHeader';
import { EventFeed } from '../shared/ui/EventFeed';
import { StatCard } from '../shared/ui/StatCard';

export function DevicePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const deviceId = Number(id);
  const [tab, setTab] = useState(0);

  const {
    data: device,
    isLoading: deviceLoading,
    isError: deviceError,
    error: deviceErr,
    refetch: refetchDevice,
  } = useGetDeviceQuery(deviceId, { skip: !deviceId, pollingInterval: 8000 });

  const {
    data: capabilities = [],
    isLoading: capsLoading,
    refetch: refetchCaps,
  } = useGetCapabilitiesQuery(deviceId, { skip: !deviceId });

  if (!deviceId) {
    return <Alert severity="error">{t('device.invalidId')}</Alert>;
  }

  if (deviceLoading) {
    return <LoadingState label={t('device.loading')} />;
  }

  if (deviceError || !device) {
    return (
      <Alert
        severity="error"
        action={<Button onClick={() => void refetchDevice()}>{t('common.retry')}</Button>}
      >
        {extractErrorMessage(deviceErr as Parameters<typeof extractErrorMessage>[0])}
      </Alert>
    );
  }

  return (
    <>
      <PageHeader
        title={device.name}
        subtitle={`ID ${device.id}`}
        breadcrumbs={[
          { label: t('devices.title'), to: '/devices' },
          { label: device.name },
        ]}
        actions={
          <Button
            variant="contained"
            component={RouterLink}
            to={`/devices/${device.id}/dashboards`}
            startIcon={<DashboardIcon />}
          >
            {t('devices.dashboards')}
          </Button>
        }
      />

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <StatCard label={t('common.status')}>
                <DeviceStatusChip lastSeenAt={device.last_seen_at} size="medium" />
              </StatCard>
            </Grid>
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <StatCard label={t('device.lastSeen')}>
                <Typography fontWeight={600}>{formatRelativeTime(device.last_seen_at)}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {formatDate(device.last_seen_at)}
                </Typography>
              </StatCard>
            </Grid>
            <Grid item xs={12} sm={4} sx={{ display: 'flex' }}>
              <StatCard label={t('common.created')}>
                <Typography fontWeight={500}>{formatDate(device.created_at)}</Typography>
              </StatCard>
            </Grid>
          </Grid>

          <DeviceLiveMetrics deviceId={deviceId} capabilities={capabilities} />

          <Card>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Tab label={t('device.connection')} />
              <Tab label={t('device.schema', { count: capabilities.length })} />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {tab === 0 && <ConnectionPanel device={device} />}

              {tab === 1 && (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('device.schemaHint')}
                    </Typography>
                    <Button size="small" startIcon={<RefreshIcon />} onClick={() => void refetchCaps()}>
                      {t('common.refresh')}
                    </Button>
                  </Stack>

                  {capsLoading ? (
                    <LoadingState minHeight={160} label={t('device.loadingSchema')} />
                  ) : capabilities.length === 0 ? (
                    <EmptyState
                      title={t('device.schemaEmptyTitle')}
                      description={t('device.schemaEmptyDesc')}
                    />
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>{t('device.metric')}</TableCell>
                            <TableCell>{t('device.type')}</TableCell>
                            <TableCell>{t('device.role')}</TableCell>
                            <TableCell>{t('device.unit')}</TableCell>
                            <TableCell>{t('device.min')}</TableCell>
                            <TableCell>{t('device.max')}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {capabilities.map((cap) => (
                            <TableRow key={cap.name}>
                              <TableCell>
                                <Chip label={cap.name} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>{cap.type}</TableCell>
                              <TableCell>{cap.role}</TableCell>
                              <TableCell>{cap.unit ?? '—'}</TableCell>
                              <TableCell>{cap.min ?? '—'}</TableCell>
                              <TableCell>{cap.max ?? '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              )}
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
            <DeviceEventFeed deviceId={deviceId} />
          </Box>
        </Grid>
      </Grid>
    </>
  );
}

function DeviceEventFeed({ deviceId }: { deviceId: number }) {
  const { t } = useTranslation();
  const events = useDeviceEvents(deviceId, 20);
  return <EventFeed events={events} title={t('events.deviceTitle')} limit={20} compact />;
}
