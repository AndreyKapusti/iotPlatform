import { baseApi } from '../../../shared/api/baseApi';

export interface DeviceCommand {
  id: number;
  device_id: number;
  metric: string;
  value: boolean;
  status: 'pending' | 'acknowledged' | 'expired' | 'superseded';
  acknowledged_at?: string;
}

export const commandApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    sendCommand: builder.mutation<DeviceCommand, { deviceId: number; metric: string; value: boolean }>({
      query: ({ deviceId, metric, value }) => ({ url: `/api/v1/commands/${deviceId}`, method: 'POST', body: { metric, value } }),
    }),
    getCommand: builder.query<DeviceCommand, { deviceId: number; commandId: number }>({
      query: ({ deviceId, commandId }) => `/api/v1/commands/${deviceId}/${commandId}`,
    }),
  }),
});

export const { useSendCommandMutation, useGetCommandQuery } = commandApi;
