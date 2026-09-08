import { Alert, Box, Breadcrumbs, Button, Link as MuiLink, Typography } from '@mui/material';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useGetDashboardQuery,
} from '../features/dashboards/api/dashboardsApi';
import { useGetCapabilitiesQuery, useGetDeviceQuery } from '../features/devices/api/devicesApi';
import { DashboardEditor } from '../features/dashboards/components/DashboardEditor';
import { extractErrorMessage } from '../shared/api/baseApi';
import { LoadingState } from '../shared/ui/LoadingState';

export function DashboardPage() {
  const { t } = useTranslation();
  const { id, dashboardId: dashboardIdParam } = useParams<{
    id: string;
    dashboardId: string;
  }>();
  const deviceId = Number(id);
  const dashboardId = Number(dashboardIdParam);

  const {
    data: device,
    isLoading: deviceLoading,
    isError: deviceError,
    error: deviceErr,
    refetch: refetchDevice,
  } = useGetDeviceQuery(deviceId, { skip: !deviceId });

  const {
    data: capabilities = [],
    isLoading: capsLoading,
  } = useGetCapabilitiesQuery(deviceId, { skip: !deviceId });

  const {
    data: dashboard,
    isLoading: dashLoading,
    isError: dashError,
    error: dashErr,
    refetch: refetchDash,
  } = useGetDashboardQuery(dashboardId, { skip: !dashboardId });

  if (!deviceId || !dashboardId) {
    return <Navigate to="/devices" replace />;
  }

  const loading = deviceLoading || capsLoading || dashLoading;

  if (loading) {
    return <LoadingState label={t('dashboards.loading')} />;
  }

  if (deviceError || dashError || !device || !dashboard) {
    const err = deviceErr ?? dashErr;
    return (
      <>
        <Alert
          severity="error"
          action={
            <Button onClick={() => { void refetchDevice(); void refetchDash(); }}>
              {t('common.retry')}
            </Button>
          }
        >
          {extractErrorMessage(err as Parameters<typeof extractErrorMessage>[0])}
        </Alert>
      </>
    );
  }

  if (dashboard.device_id !== deviceId) {
    return <Alert severity="error">{t('dashboards.notOwned')}</Alert>;
  }

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs sx={{ fontSize: 13 }}>
          <MuiLink component={Link} to="/devices" underline="hover" color="inherit">
            {t('devices.title')}
          </MuiLink>
          <MuiLink component={Link} to={`/devices/${device.id}`} underline="hover" color="inherit">
            {device.name}
          </MuiLink>
          <MuiLink component={Link} to={`/devices/${device.id}/dashboards`} underline="hover" color="inherit">
            {t('dashboards.title')}
          </MuiLink>
          <Typography color="text.secondary" fontSize={13}>
            {dashboard.name}
          </Typography>
        </Breadcrumbs>
      </Box>
      <DashboardEditor
        key={`${dashboardId}-${dashboard.updated_at ?? dashboard.name}`}
        device={device}
        capabilities={capabilities}
        dashboardId={dashboardId}
        dashboardName={dashboard.name}
        initialLayout={dashboard.layout}
      />
    </>
  );
}
