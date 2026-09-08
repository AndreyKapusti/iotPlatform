import { Box, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useGetTelemetryLatestQuery } from '../../telemetry/api/telemetryApi';
import type { Capability } from '../../../types';
import { formatMetricValue, formatRelativeTime } from '../../../shared/lib/format';
import { SectionHeader } from '../../../shared/ui/SectionHeader';
import { StatCard } from '../../../shared/ui/StatCard';

interface DeviceLiveMetricsProps {
  deviceId: number;
  capabilities: Capability[];
}

export function DeviceLiveMetrics({ deviceId, capabilities }: DeviceLiveMetricsProps) {
  const { t } = useTranslation();
  const sensors = capabilities.filter((c) => c.role === 'sensor');

  const { data, isLoading, isFetching } = useGetTelemetryLatestQuery(deviceId, {
    pollingInterval: 5000,
    skip: sensors.length === 0,
  });

  if (sensors.length === 0) return null;

  const readingMap = Object.fromEntries((data?.readings ?? []).map((r) => [r.metric, r]));

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader
        title={t('device.liveMetrics')}
        action={
          isFetching && !isLoading ? (
            <Typography variant="caption" color="text.secondary">
              {t('device.updating')}
            </Typography>
          ) : undefined
        }
      />
      <Grid container spacing={2}>
        {sensors.map((cap) => {
          const reading = readingMap[cap.name];
          const label = cap.unit ? `${cap.name} (${cap.unit})` : cap.name;

          return (
            <Grid item xs={12} sm={6} md={4} key={cap.name} sx={{ display: 'flex' }}>
              <StatCard label={label}>
                {isLoading ? (
                  <Skeleton width={96} height={40} />
                ) : (
                  <Stack spacing={0.5}>
                    <Typography variant="h3" fontWeight={700} lineHeight={1.2}>
                      {reading ? formatMetricValue(reading.value, cap.unit) : t('common.noData')}
                    </Typography>
                    {reading && (
                      <Typography variant="caption" color="text.secondary">
                        {formatRelativeTime(reading.received_at)}
                      </Typography>
                    )}
                  </Stack>
                )}
              </StatCard>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
