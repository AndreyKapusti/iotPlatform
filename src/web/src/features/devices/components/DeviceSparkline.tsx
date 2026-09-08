import { Box, Skeleton, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  useGetTelemetryHistoryQuery,
  useGetTelemetryLatestQuery,
} from '../../telemetry/api/telemetryApi';
import { Sparkline } from '../../../shared/ui/Sparkline';

const HISTORY_LIMIT = 60;

interface DeviceSparklineProps {
  deviceId: number;
}

export function DeviceSparkline({ deviceId }: DeviceSparklineProps) {
  const theme = useTheme();
  const { data: latest, isLoading: latestLoading } = useGetTelemetryLatestQuery(deviceId);

  const metric = useMemo(() => {
    const reading = latest?.readings.find((r) => {
      if (typeof r.value === 'number') return true;
      return !Number.isNaN(Number(r.value));
    });
    return reading?.metric;
  }, [latest]);

  const { data: history, isLoading: historyLoading } = useGetTelemetryHistoryQuery(
    { deviceId, metric: metric ?? '', limit: HISTORY_LIMIT },
    { skip: !metric },
  );

  const values = useMemo(() => {
    if (!history?.points.length) return [];
    return [...history.points]
      .reverse()
      .map((p) => Number(p.value))
      .filter((v) => !Number.isNaN(v));
  }, [history]);

  if (latestLoading || (metric && historyLoading)) {
    return <Skeleton variant="rounded" width={80} height={28} />;
  }

  if (values.length < 2) {
    return (
      <Typography variant="caption" color="text.disabled">
        —
      </Typography>
    );
  }

  return (
    <Box sx={{ color: 'primary.main', lineHeight: 0 }}>
      <Sparkline
        values={values}
        stroke={theme.palette.primary.main}
        fill={theme.palette.mode === 'dark' ? 'rgba(45, 212, 191, 0.12)' : 'rgba(15, 118, 110, 0.12)'}
      />
    </Box>
  );
}
