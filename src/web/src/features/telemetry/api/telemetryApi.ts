import { baseApi } from '../../../shared/api/baseApi';
import type { HistoryResponse, LatestTelemetryResponse } from '../../../types';

export const telemetryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTelemetryHistory: builder.query<
      HistoryResponse,
      { deviceId: number; metric: string; limit?: number }
    >({
      query: ({ deviceId, metric, limit = 50 }) =>
        `/api/v1/telemetry/${deviceId}/history?${new URLSearchParams({
          metric,
          limit: String(limit),
        })}`,
      keepUnusedDataFor: 30,
    }),
    getTelemetryLatest: builder.query<LatestTelemetryResponse, number>({
      query: (deviceId) => `/api/v1/telemetry/${deviceId}/latest`,
      keepUnusedDataFor: 5,
    }),
  }),
});

export const {
  useGetTelemetryHistoryQuery,
  useLazyGetTelemetryHistoryQuery,
  useGetTelemetryLatestQuery,
} = telemetryApi;
