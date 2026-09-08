import { baseApi } from '../../../shared/api/baseApi';
import type { Capability, Device, DeviceCreateResponse } from '../../../types';

export const devicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDevices: builder.query<Device[], void>({
      query: () => '/api/v1/devices/',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Device' as const, id })),
              { type: 'DeviceList', id: 'LIST' },
            ]
          : [{ type: 'DeviceList', id: 'LIST' }],
    }),
    getDevice: builder.query<Device, number>({
      query: (id) => `/api/v1/devices/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Device', id }],
    }),
    createDevice: builder.mutation<DeviceCreateResponse, { name: string }>({
      query: (body) => ({
        url: '/api/v1/devices/',
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'DeviceList', id: 'LIST' }],
    }),
    deleteDevice: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/v1/devices/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Device', id },
        { type: 'DeviceList', id: 'LIST' },
        { type: 'Capability', id },
        { type: 'DashboardList', id },
      ],
    }),
    getCapabilities: builder.query<Capability[], number>({
      query: (deviceId) => `/api/v1/devices/${deviceId}/capabilities`,
      providesTags: (_result, _error, deviceId) => [{ type: 'Capability', id: deviceId }],
    }),
    regenerateApiKey: builder.mutation<Device, number>({
      query: (id) => ({
        url: `/api/v1/devices/${id}/regenerate-key`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Device', id }],
    }),
  }),
});

export const {
  useListDevicesQuery,
  useGetDeviceQuery,
  useCreateDeviceMutation,
  useDeleteDeviceMutation,
  useGetCapabilitiesQuery,
  useRegenerateApiKeyMutation,
} = devicesApi;
