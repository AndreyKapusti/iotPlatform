import {
  Box,
  Chip,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useMemo, Suspense, lazy, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../app/hooks';
import { useGetCapabilitiesQuery } from '../../devices/api/devicesApi';
import { useGetTelemetryLatestQuery } from '../../telemetry/api/telemetryApi';
import { selectOfflineThresholdMs } from '../../ui/uiSlice';
import { formatRelativeTime, isDeviceOnline } from '../../../shared/lib/format';
import { usePinnedDevices } from '../../../shared/hooks/usePinnedDevices';
import type { Device } from '../../../types';
import { HouseGardenSceneSkeleton } from './HouseGardenSceneSkeleton';
import { mapTwinState, emptyTwinState } from '../lib/mapTwinState';
import { selectTwinDevice } from '../lib/selectTwinDevice';

const HouseGardenScene = lazy(() =>
  import('./HouseGardenScene').then((m) => ({ default: m.HouseGardenScene })),
);

interface DigitalTwinPanelProps {
  devices: Device[];
}

function TwinLegendChips({ state }: { state: ReturnType<typeof mapTwinState> }) {
  const { t } = useTranslation();
  const chips: {
    key: string;
    label: string;
    color: 'default' | 'success' | 'warning' | 'error' | 'info';
    filled?: boolean;
  }[] = [];

  if (state.temperature != null) {
    chips.push({
      key: 'temp',
      label: t('overview.twin.chipTemp', {
        value: state.temperature.toFixed(1),
        unit: state.temperatureUnit ?? '°C',
      }),
      color: state.heatLevel === 'fire' || state.heatLevel === 'hot' ? 'error' : 'warning',
      filled: true,
    });
  }
  if (state.humidity != null) {
    chips.push({
      key: 'humid',
      label: t('overview.twin.chipHumidity', {
        value: state.humidity.toFixed(0),
        unit: state.humidityUnit ?? '%',
      }),
      color: state.misty ? 'info' : 'default',
      filled: true,
    });
  }
  if (state.lightsOn) {
    chips.push({ key: 'light', label: t('overview.twin.chipLightsOn'), color: 'warning' });
  }
  if (state.droplets) {
    chips.push({ key: 'droplets', label: t('overview.twin.chipDroplets'), color: 'info' });
  }
  if (state.presence) {
    chips.push({ key: 'presence', label: t('overview.twin.chipPresence'), color: 'success' });
  }
  if (state.nearNorm >= 0.55 && !state.motionActive) {
    chips.push({ key: 'near', label: t('overview.twin.chipProximity'), color: 'info' });
  }
  if (state.doorOpen) {
    chips.push({ key: 'door', label: t('overview.twin.chipDoorOpen'), color: 'success' });
  }
  if (state.valveOpen) {
    chips.push({ key: 'valve', label: t('overview.twin.chipValveOpen'), color: 'info' });
  }
  if (state.mailboxFlag) {
    chips.push({ key: 'mailbox', label: t('overview.twin.chipMailbox'), color: 'default' });
  }
  if (state.heatLevel === 'fire') {
    chips.push({ key: 'fire', label: t('overview.twin.chipFire'), color: 'error' });
  }

  if (chips.length === 0) return null;

  // Climate first; keep up to 6 so temp/humidity are never crowded out.
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap className="twin-legend">
      {chips.slice(0, 6).map((c) => (
        <Chip
          key={c.key}
          size="small"
          label={c.label}
          color={c.color}
          variant={c.filled ? 'filled' : 'outlined'}
          sx={c.filled ? { fontWeight: 600 } : undefined}
        />
      ))}
    </Stack>
  );
}

/**
 * Overview hero: live Homely House twin driven by one primary device's latest telemetry.
 */
export function DigitalTwinPanel({ devices }: DigitalTwinPanelProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const thresholdMs = useAppSelector(selectOfflineThresholdMs);
  const { pinned } = usePinnedDevices();

  const device = useMemo(
    () => selectTwinDevice(devices, pinned, thresholdMs),
    [devices, pinned, thresholdMs],
  );

  const online = device ? isDeviceOnline(device.last_seen_at, thresholdMs) : false;

  /** Bridge MUI palette into CSS vars used by digital-twin.css (no CssVarsProvider required). */
  const twinThemeVars = {
    '--twin-border': theme.palette.divider,
    '--twin-bg': theme.palette.background.paper,
  } as CSSProperties;

  const { data: capabilities = [], isLoading: capsLoading } = useGetCapabilitiesQuery(device?.id ?? 0, {
    skip: !device,
  });

  const { data: latest, isLoading: latestLoading, isFetching } = useGetTelemetryLatestQuery(
    device?.id ?? 0,
    {
      skip: !device,
      pollingInterval: 5_000,
    },
  );

  const state = useMemo(() => {
    if (!device) return emptyTwinState(false);
    // Don't wait for network — render house immediately with empty/partial state.
    return mapTwinState(capabilities, latest?.readings ?? [], online);
  }, [device, capabilities, latest, online]);

  if (!device) {
    return (
      <Box
        className="twin-panel twin-panel--empty"
        sx={{ mb: 3, p: 3, textAlign: 'center', ...twinThemeVars }}
      >
        <Typography variant="h3" gutterBottom>
          {t('overview.twin.title')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('overview.twin.empty')}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/devices')}>
          {t('overview.allDevices')}
        </Button>
      </Box>
    );
  }

  const bootstrapping = (capsLoading || latestLoading) && !latest && capabilities.length === 0;

  return (
    <Box className="twin-panel" sx={{ mb: 3, overflow: 'hidden', ...twinThemeVars }}>
      <Box className="twin-panel__chrome">
        <Box className="twin-panel__titles">
          <Typography variant="h3" component="h2" className="twin-panel__title">
            {t('overview.twin.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap className="twin-panel__subtitle">
            {t('overview.twin.subtitle', { name: device.name })}
            {isFetching && !latestLoading ? ` · ${t('overview.twin.updating')}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
          <Chip
            size="small"
            label={online ? t('overview.online') : t('overview.offline')}
            color={online ? 'success' : 'default'}
            variant={online ? 'filled' : 'outlined'}
          />
          <Button size="small" onClick={() => navigate(`/devices/${device.id}`)}>
            {t('overview.twin.openDevice')}
          </Button>
        </Stack>
      </Box>

      <Box className="twin-panel__stage">
        {bootstrapping ? (
          <HouseGardenSceneSkeleton />
        ) : (
          <Suspense fallback={<HouseGardenSceneSkeleton />}>
            <HouseGardenScene state={state} />
          </Suspense>
        )}
      </Box>

      <Box className="twin-panel__footer">
        <TwinLegendChips state={state} />
        {!bootstrapping && !state.hasReadings && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
            {t('overview.twin.noTelemetry')}
          </Typography>
        )}
        {!bootstrapping && state.hasReadings && latest?.readings[0] && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
            {t('overview.twin.lastUpdate', {
              time: formatRelativeTime(latest.readings[0]?.received_at ?? device.last_seen_at),
            })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
