import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Capability } from '../../types';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast';

interface WidgetShellProps {
  title: string;
  selected?: boolean;
  dragging?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLSpanElement>;
  onRemove?: () => void;
  children: ReactNode;
}

export function WidgetShell({
  title,
  selected,
  dragging,
  dragHandleProps,
  onRemove,
  children,
}: WidgetShellProps) {
  return (
    <div
      className={[
        'widget-shell',
        selected ? 'widget-shell--selected' : '',
        dragging ? 'widget-shell--dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="widget-header">
        <span className="widget-drag-handle" {...dragHandleProps} title="Перетащить">
          ⠿
        </span>
        <span className="widget-title">{title}</span>
        {onRemove && (
          <button type="button" className="btn btn-ghost" onClick={onRemove} title="Удалить">
            ×
          </button>
        )}
      </div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

export function WidgetLoading() {
  return <div className="widget-skeleton" />;
}

export function WidgetError({ message }: { message: string }) {
  return <span style={{ color: 'var(--error)', fontSize: 12 }}>{message}</span>;
}

interface LineChartWidgetProps {
  metric: string;
  capability?: Capability;
}

export function LineChartWidget({ metric, capability }: LineChartWidgetProps) {
  const { points, loading, error } = useTelemetry(metric);

  const chartData = points.map((p) => ({
    time: new Date(p.received_at).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    value: typeof p.value === 'number' ? p.value : Number(p.value),
    ts: p.received_at,
  }));

  if (loading && chartData.length === 0) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;
  if (chartData.length === 0) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Нет данных</span>;
  }

  return (
    <LineChartInner
      data={chartData}
      unit={capability?.unit ?? undefined}
      min={capability?.min ?? undefined}
      max={capability?.max ?? undefined}
    />
  );
}

function LineChartInner({
  data,
  unit,
  min,
  max,
}: {
  data: Array<{ time: string; value: number; ts: string }>;
  unit?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="widget-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            domain={min != null && max != null ? [min, max] : ['auto', 'auto']}
            width={40}
          />
          <Tooltip
            formatter={(value: number) => [`${value}${unit ? ` ${unit}` : ''}`, 'Значение']}
            labelFormatter={(label) => String(label)}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--widget-accent, var(--accent))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface KpiGaugeWidgetProps {
  metric: string;
  capability?: Capability;
}

export function KpiGaugeWidget({ metric, capability }: KpiGaugeWidgetProps) {
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

  if (loading && value == null) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <div className="widget-gauge">
      <div
        className="widget-gauge-ring"
        style={{
          background: `conic-gradient(var(--widget-accent, var(--accent)) ${pct}%, var(--border) ${pct}%)`,
        }}
      >
        <div className="widget-gauge-inner">
          <span
            className="gauge-value"
            style={{ fontSize: 22, color: 'var(--widget-accent, var(--accent))' }}
          >
            {value != null && !Number.isNaN(value) ? value.toFixed(1) : '—'}
          </span>
        </div>
      </div>
      {capability?.unit && <div className="gauge-unit">{capability.unit}</div>}
    </div>
  );
}

interface BooleanIndicatorWidgetProps {
  metric: string;
}

export function BooleanIndicatorWidget({ metric }: BooleanIndicatorWidgetProps) {
  const { latest, loading, error } = useTelemetry(metric);
  const isOn = Boolean(latest?.value);

  if (loading && !latest) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <span className={`indicator-pill ${isOn ? 'indicator-pill--on' : 'indicator-pill--off'}`}>
      <span className="badge-dot" />
      {isOn ? 'ON' : 'OFF'}
    </span>
  );
}

interface ToggleWidgetProps {
  metric: string;
  capability?: Capability;
}

export function ToggleWidget({ metric, capability }: ToggleWidgetProps) {
  const { latest, loading, error } = useTelemetry(metric);
  const toast = useToast();
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

  const handleToggle = () => {
    const next = !isOn;
    setLocalOn(next);
    toast.demo('Команда отправлена (демо)');
    console.info(`Toggle command for ${metric}: ${next}`, capability?.name);
  };

  if (loading && !latest) return <WidgetLoading />;
  if (error) return <WidgetError message={error} />;

  return (
    <div className="toggle-widget">
      <label className="toggle-switch" title="Команда актуатора (демо)">
        <input type="checkbox" checked={isOn} onChange={handleToggle} />
        <span className="toggle-slider" />
      </label>
      <span className="toggle-demo-caption">демо</span>
    </div>
  );
}
