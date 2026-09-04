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
import { getTelemetryHistory, getWebSocketUrl } from '../api/client';
import type { HistoryPoint, ReadingEvent } from '../types';

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
  refreshMetric: (metric: string) => Promise<void>;
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
  onReading,
  children,
}: {
  deviceId: number;
  metrics: string[];
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
        const data = await getTelemetryHistory(deviceId, metric, 50);
        const points = [...data.points].reverse();
        updateMetric(metric, () => ({
          points,
          latest: points.length > 0 ? points[points.length - 1] : null,
          loading: false,
          error: null,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load history';
        updateMetric(metric, (prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [deviceId, updateMetric],
  );

  useEffect(() => {
    const uniqueMetrics = [...new Set(metrics)];
    uniqueMetrics.forEach((metric) => {
      void refreshMetric(metric);
    });
  }, [deviceId, metricsKey, refreshMetric]);

  useEffect(() => {
    if (!live) {
      setConnected(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
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
            const nextPoints = [...prev.points, point].slice(-50);
            return {
              ...prev,
              points: nextPoints,
              latest: point,
              loading: false,
              error: null,
            };
          });
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
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
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [deviceId, live, updateMetric]);

  const getMetric = useCallback(
    (metric: string): MetricState =>
      metricMap[metric] ?? {
        points: [],
        latest: null,
        loading: true,
        error: null,
      },
    [metricMap],
  );

  const value = useMemo(
    () => ({ connected, live, setLive, getMetric, refreshMetric }),
    [connected, live, getMetric, refreshMetric],
  );

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry(metric: string): MetricState & { connected: boolean; live: boolean } {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry must be used within TelemetryProvider');
  }
  const metricState = ctx.getMetric(metric);
  return {
    ...metricState,
    connected: ctx.connected,
    live: ctx.live,
  };
}

export function useTelemetryControls() {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetryControls must be used within TelemetryProvider');
  }
  return { connected: ctx.connected, live: ctx.live, setLive: ctx.setLive };
}
