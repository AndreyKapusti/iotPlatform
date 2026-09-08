import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Download as DownloadIcon, Save as SaveIcon, Undo as UndoIcon } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { store } from '../../../app/store';
import { telemetryApi } from '../../telemetry/api/telemetryApi';
import { DeviceStatusChip } from '../../../shared/ui/DeviceStatusChip';
import { formatRelativeTime } from '../../../shared/lib/format';
import { downloadCsv, mergeHistoryCsv } from '../../../shared/lib/exportCsv';
import type { ChartHistoryLimit } from '../../../shared/lib/constants';
import { CHART_HISTORY_LIMITS } from '../../../shared/lib/constants';
import { useTelemetryControls } from '../../telemetry/hooks/useTelemetry';
import type { Device } from '../../../types';

export type DashboardMode = 'view' | 'edit';

interface DashboardToolbarProps {
  device: Device;
  title: string;
  name: string;
  mode: DashboardMode;
  saving: boolean;
  error: string | null;
  metrics: string[];
  historyLimit: ChartHistoryLimit;
  onHistoryLimitChange: (limit: ChartHistoryLimit) => void;
  onSave: () => void;
  onReset: () => void;
  onModeChange: (mode: DashboardMode) => void;
  onNameChange: (name: string) => void;
}

export function DashboardToolbar({
  device,
  title,
  name,
  mode,
  saving,
  error,
  metrics,
  historyLimit,
  onHistoryLimitChange,
  onSave,
  onReset,
  onModeChange,
  onNameChange,
}: DashboardToolbarProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { connected, live, setLive } = useTelemetryControls();
  const editing = mode === 'edit';
  const [, setTick] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const exportCsv = async () => {
    if (metrics.length === 0) return;
    setExporting(true);
    try {
      const historyByMetric: Record<string, import('../../../types').HistoryPoint[]> = {};
      for (const metric of metrics) {
        const result = await store.dispatch(
          telemetryApi.endpoints.getTelemetryHistory.initiate({
            deviceId: device.id,
            metric,
            limit: historyLimit,
          }),
        );
        if ('data' in result && result.data) {
          historyByMetric[metric] = [...result.data.points].reverse();
        }
      }
      downloadCsv(
        `signaldeck-${device.name}-${new Date().toISOString().slice(0, 10)}.csv`,
        mergeHistoryCsv(historyByMetric),
      );
      enqueueSnackbar(t('dashboards.exportSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('dashboards.exportFailed'), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'flex-start' }}
        spacing={2}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <TextField
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              variant="standard"
              fullWidth
              inputProps={{ 'aria-label': t('dashboards.nameAriaLabel') }}
              sx={{ '& input': { fontSize: '1.375rem', fontWeight: 600 } }}
            />
          ) : (
            <Typography variant="h2">{title}</Typography>
          )}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5 }}>
            <DeviceStatusChip lastSeenAt={device.last_seen_at} />
            <Typography variant="caption" color="text.secondary">
              {t('dashboards.updatedAgo', { time: formatRelativeTime(device.last_seen_at) })}
            </Typography>
            <Typography
              variant="caption"
              color={connected ? 'success.main' : 'text.secondary'}
            >
              {connected ? `● ${t('dashboards.streamConnected')}` : `○ ${t('dashboards.streamDisconnected')}`}
            </Typography>
            <FormControlLabel
              control={<Switch size="small" checked={live} onChange={(e) => setLive(e.target.checked)} />}
              label={<Typography variant="body2">{t('common.live')}</Typography>}
            />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={historyLimit}
            onChange={(_, value: ChartHistoryLimit | null) => value && onHistoryLimitChange(value)}
          >
            {CHART_HISTORY_LIMITS.map((limit) => (
              <ToggleButton key={limit} value={limit}>
                {t('dashboards.historyPoints', { count: limit })}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            disabled={exporting || metrics.length === 0}
            onClick={() => void exportCsv()}
          >
            {exporting ? t('dashboards.exporting') : t('dashboards.exportCsv')}
          </Button>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            onChange={(_, value: DashboardMode | null) => value && onModeChange(value)}
          >
            <ToggleButton value="view">{t('dashboards.view')}</ToggleButton>
            <ToggleButton value="edit">{t('dashboards.edit')}</ToggleButton>
          </ToggleButtonGroup>
          {editing && (
            <>
              <Button size="small" startIcon={<UndoIcon />} onClick={onReset}>
                {t('dashboards.reset')}
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saving}
                onClick={onSave}
              >
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
