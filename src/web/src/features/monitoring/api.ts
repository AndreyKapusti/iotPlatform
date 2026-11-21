import { baseApi } from '../../shared/api/baseApi';

export interface MonitorMeta {
  boot_id?: string;
  sample_sequence?: number;
  uptime_ms?: number;
  wifi_rssi?: number;
  mqtt_reconnects?: number;
  publish_errors?: number;
}
export interface MonitorSample { received_at: string; transport: string; metadata: MonitorMeta }
export interface MonitorEvent { received_at: string; previous_at: string | null; gap_seconds: number | string | null; metadata: MonitorMeta; previous_metadata: MonitorMeta | null }
export interface MonitoringData { server_time: string; latest: MonitorSample | null; samples: MonitorSample[]; events: MonitorEvent[]; retention_days: number }

const monitoringApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMonitoring: builder.query<MonitoringData, number>({
      query: (id) => `/api/v1/devices/${id}/monitoring`,
      keepUnusedDataFor: 0,
    }),
    getMonitoringEvents: builder.query<MonitoringData, number>({
      query: (id) => `/api/v1/devices/${id}/monitoring?include_events=true`,
      keepUnusedDataFor: 0,
    }),
  }),
});
export const { useGetMonitoringQuery, useGetMonitoringEventsQuery } = monitoringApi;
