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
  connected: boolean;
  live: boolean;
  setLive: (live: boolean) => void;
  getMetric: (metric: string) => MetricState;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

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
        updateMetric(metric, () => ({
          points,
          latest: points.length > 0 ? points[points.length - 1] : null,
          loading: false,
          error: null,
        }));
      } catch {
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
      const ws = new WebSocket(getWebSocketUrl(deviceId));
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as ReadingEvent;
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
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
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
    () => ({ connected, live, setLive, getMetric }),
    [connected, live, getMetric],
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
