import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { store } from '../../../app/store';
import { telemetryApi } from '../api/telemetryApi';
import { getWebSocketUrl } from '../../../shared/lib/format';
import i18n from '../../i18n/config';
import type { HistoryPoint, ReadingEvent } from '../../../types';

interface MetricState {
  points: HistoryPoint[];
  latest: HistoryPoint | null;
  loading: boolean;
  error: string | null;
}

interface TelemetryContextValue {
  deviceId: number;
  connected: boolean;
  live: boolean;
  setLive: (live: boolean) => void;
  getMetric: (metric: string) => MetricState;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

// Metadata only: timestamps and metric names allow matching browser events to ingest logs.
function telemetryLog(event: string, details: Record<string, unknown>) {
  console.info('[telemetry]', new Date().toISOString(), event, details);
}

function normalizePoint(event: ReadingEvent): HistoryPoint {
  return {
    metric: event.metric,
    value: event.value,
    type: event.type,
    received_at: event.received_at,
  };
}

function filterPointsByRange(points: HistoryPoint[], rangeMs: number): HistoryPoint[] {
  const cutoff = Date.now() - rangeMs;
  return points.filter((p) => new Date(p.received_at).getTime() >= cutoff);
}

export function TelemetryProvider({
  deviceId,
  metrics,
  historyRangeMs = 5 * 60 * 1000,
  historyFetchLimit = 200,
  onReading,
  children,
}: {
  deviceId: number;
  metrics: string[];
  historyRangeMs?: number;
  historyFetchLimit?: number;
  onReading?: (event: ReadingEvent) => void;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [live, setLive] = useState(true);
  const [metricMap, setMetricMap] = useState<Record<string, MetricState>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const metricsKey = metrics.join(',');

  useEffect(() => {
    for (const [metric, state] of Object.entries(metricMap)) {
      if (state.latest) {
        telemetryLog('chart state committed', {
          deviceId, metric, receivedAt: state.latest.received_at, points: state.points.length,
        });
      }
    }
  }, [deviceId, metricMap]);

  const updateMetric = useCallback((metric: string, updater: (prev: MetricState) => MetricState) => {
    setMetricMap((prev) => {
      const current = prev[metric] ?? {
        points: [],
        latest: null,
        loading: true,
        error: null,
      };
      return { ...prev, [metric]: updater(current) };
    });
  }, []);

  const refreshMetric = useCallback(
    async (metric: string) => {
      const started = performance.now();
      updateMetric(metric, (prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await store.dispatch(
          telemetryApi.endpoints.getTelemetryHistory.initiate(
            { deviceId, metric, limit: historyFetchLimit },
            { forceRefetch: true },
          ),
        );
        if ('error' in result && result.error) {
          throw new Error('Failed to load history');
        }
        const data = result.data!;
        const points = filterPointsByRange([...data.points].reverse(), historyRangeMs);
        telemetryLog('history loaded', { deviceId, metric, points: points.length,
          durationMs: Math.round(performance.now() - started), latest: points[points.length - 1]?.received_at });
        updateMetric(metric, () => ({
          points,
          latest: points.length > 0 ? points[points.length - 1] : null,
          loading: false,
          error: null,
        }));
      } catch (error) {
        console.warn('[telemetry] history failed', { deviceId, metric, error });
        updateMetric(metric, (prev) => ({
          ...prev,
          loading: false,
          error: i18n.t('widgets.historyError'),
        }));
      }
    },
    [deviceId, updateMetric, historyRangeMs, historyFetchLimit],
  );

  useEffect(() => {
    const uniqueMetrics = [...new Set(metrics)];
    uniqueMetrics.forEach((metric) => {
      void refreshMetric(metric);
    });
  }, [deviceId, metricsKey, refreshMetric, historyRangeMs, historyFetchLimit]);

  useEffect(() => {
    if (!live) {
      setConnected(false);
      wsRef.current?.close();
      wsRef.current = null;
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      return;
    }

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      telemetryLog('websocket connecting', { deviceId });
      const ws = new WebSocket(getWebSocketUrl(deviceId));
      wsRef.current = ws;

      ws.onopen = () => {
        telemetryLog('websocket connected', { deviceId });
        if (!cancelled) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as ReadingEvent;
          telemetryLog('websocket event received', { deviceId, metric: data.metric, receivedAt: data.received_at });
          const point = normalizePoint(data);
          onReadingRef.current?.(data);
          updateMetric(data.metric, (prev) => {
            const nextPoints = filterPointsByRange([...prev.points, point], historyRangeMs);
            return {
              points: nextPoints,
              latest: point,
              loading: false,
              error: null,
            };
          });
        } catch (error) {
          console.warn('[telemetry] event processing failed', { deviceId, error });
        }
      };

      ws.onclose = (event) => {
        telemetryLog('websocket closed', { deviceId, code: event.code, clean: event.wasClean, reconnecting: !cancelled });
        setConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        console.warn('[telemetry] websocket error', { deviceId });
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [deviceId, live, updateMetric, historyRangeMs]);

  const getMetric = useCallback(
    (metric: string): MetricState =>
      metricMap[metric] ?? { points: [], latest: null, loading: true, error: null },
    [metricMap],
  );

  const value = useMemo(
    () => ({ deviceId, connected, live, setLive, getMetric }),
    [deviceId, connected, live, getMetric],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(metric: string): MetricState {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider');
  return ctx.getMetric(metric);
}

export function useTelemetryControls() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetryControls must be used within TelemetryProvider');
  return { connected: ctx.connected, live: ctx.live, setLive: ctx.setLive };
}

export function useTelemetryDeviceId() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) throw new Error('useTelemetryDeviceId must be used within TelemetryProvider');
  return ctx.deviceId;
}
