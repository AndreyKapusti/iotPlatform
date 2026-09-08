import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Box, Skeleton, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Capability } from '../../types';
import { useTelemetry } from '../../features/telemetry/hooks/useTelemetry';
import i18n from '../../features/i18n/config';
import { useEffect, useRef, useState } from 'react';

interface WidgetCommonProps {
  metric: string;
  capability?: Capability;
  accent?: string;
}

function WidgetLoading() {
  return <Skeleton variant="rounded" width="100%" height="100%" animation="wave" />;
}

function WidgetError({ message }: { message: string }) {
  return (
    <Typography variant="caption" color="error">
      {message}
    </Typography>
  );
}

export function LineChartWidget({ metric, capability, accent }: WidgetCommonProps) {
  const { t } = useTranslation();
  const { points, loading, error } = useTelemetry(metric);

  const timeLocale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
  const chartData = points.map((p) => ({
    time: new Date(p.received_at).toLocaleTimeString(timeLocale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    value: typeof p.value === 'number' ? p.value : Number(p.value),
  }));

  if (loading && chartData.length === 0) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;
  if (chartData.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t('common.noData')}
      </Typography>
    );
  }

  const stroke = accent ?? 'currentColor';
  const min = capability?.min ?? undefined;
  const max = capability?.max ?? undefined;
  const unit = capability?.unit ?? '';

  return (
    <Box className="widget-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10 }}
            domain={min != null && max != null ? [min, max] : ['auto', 'auto']}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [`${value}${unit ? ` ${unit}` : ''}`, t('widgets.value')]}
          />
          <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function KpiGaugeWidget({ metric, capability, accent }: WidgetCommonProps) {
  const { latest, loading, error } = useTelemetry(metric);

  const value =
    latest && typeof latest.value === 'number'
      ? latest.value
      : latest
        ? Number(latest.value)
        : null;

  const min = capability?.min ?? 0;
  const max = capability?.max ?? 100;
  const pct =
    value != null && !Number.isNaN(value)
      ? Math.min(100, Math.max(0, ((value - min) / (max - min || 1)) * 100))
      : 0;

  const color =
    accent ??
    (pct >= 85 ? '#dc2626' : pct >= 60 ? '#d97706' : '#0f766e');

  if (loading && value == null) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <Box className="widget-gauge">
      <Box
        className="widget-gauge-ring"
        sx={{
          background: `conic-gradient(${color} ${pct}%, rgba(128,128,128,0.25) ${pct}%)`,
        }}
      >
        <Box className="widget-gauge-inner" sx={{ bgcolor: 'background.paper' }}>
          <Typography className="gauge-value" sx={{ color }}>
            {value != null && !Number.isNaN(value) ? value.toFixed(1) : '—'}
          </Typography>
        </Box>
      </Box>
      {capability?.unit && (
        <Typography variant="body2" color="text.secondary">
          {capability.unit}
        </Typography>
      )}
    </Box>
  );
}

export function BooleanIndicatorWidget({ metric }: Pick<WidgetCommonProps, 'metric'>) {
  const { t } = useTranslation();
  const { latest, loading, error } = useTelemetry(metric);
  const isOn = Boolean(latest?.value);

  if (loading && !latest) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <Box
      className="indicator-pill"
      sx={{
        bgcolor: isOn ? 'success.main' : 'action.hover',
        color: isOn ? 'success.contrastText' : 'text.secondary',
        opacity: isOn ? 1 : 0.9,
        '& .MuiTypography-root': { color: 'inherit' },
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: isOn ? 'currentColor' : 'text.disabled',
        }}
      />
      <Typography variant="body2" fontWeight={600}>
        {isOn ? t('widgets.on') : t('widgets.off')}
      </Typography>
    </Box>
  );
}

export function ToggleWidget({ metric, accent }: WidgetCommonProps) {
  const { latest, loading, error } = useTelemetry(metric);
  const telemetryOn = latest != null ? Boolean(latest.value) : null;
  const [localOn, setLocalOn] = useState<boolean | null>(null);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (telemetryOn == null || !latest) return;
    if (latest.received_at !== lastSyncedRef.current) {
      lastSyncedRef.current = latest.received_at;
      setLocalOn(telemetryOn);
    }
  }, [telemetryOn, latest]);

  const isOn = localOn ?? telemetryOn ?? false;

  if (loading && !latest) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <Switch
      checked={isOn}
      onChange={() => setLocalOn(!isOn)}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': { color: accent ?? 'primary.main' },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          bgcolor: accent ?? 'primary.main',
        },
      }}
    />
  );
}
