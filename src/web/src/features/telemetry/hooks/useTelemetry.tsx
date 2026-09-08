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

export function TelemetryProvider({
  deviceId,
  metrics,
  historyLimit = 50,
  onReading,
  children,
}: {
  deviceId: number;
  metrics: string[];
  historyLimit?: number;
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
            { deviceId, metric, limit: historyLimit },
            { forceRefetch: true },
          ),
        );
        if ('error' in result && result.error) {
          throw new Error('Failed to load history');
        }
        const data = result.data!;
        const points = [...data.points].reverse();
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
    [deviceId, updateMetric, historyLimit],
  );

  useEffect(() => {
    const uniqueMetrics = [...new Set(metrics)];
    uniqueMetrics.forEach((metric) => {
      void refreshMetric(metric);
    });
  }, [deviceId, metricsKey, refreshMetric, historyLimit]);

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
          updateMetric(data.metric, (prev) => ({
            points: [...prev.points, point].slice(-historyLimit),
            latest: point,
            loading: false,
            error: null,
          }));
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
  }, [deviceId, live, updateMetric, historyLimit]);

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
