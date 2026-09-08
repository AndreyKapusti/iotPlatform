import { baseApi } from '../../../shared/api/baseApi';
import type { Dashboard, DashboardSummary, WidgetLayout } from '../../../types';

export const dashboardsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listDashboards: builder.query<DashboardSummary[], number>({
      query: (deviceId) => `/api/v1/dashboards/device/${deviceId}`,
      providesTags: (result, _error, deviceId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Dashboard' as const, id })),
              { type: 'DashboardList', id: deviceId },
            ]
          : [{ type: 'DashboardList', id: deviceId }],
    }),
    getDashboard: builder.query<Dashboard, number>({
      query: (dashboardId) => `/api/v1/dashboards/${dashboardId}`,
      providesTags: (_result, _error, id) => [{ type: 'Dashboard', id }],
    }),
    createDashboard: builder.mutation<Dashboard, { deviceId: number; name: string }>({
      query: ({ deviceId, name }) => ({
        url: `/api/v1/dashboards/device/${deviceId}`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: (_result, _error, { deviceId }) => [
        { type: 'DashboardList', id: deviceId },
      ],
    }),
    saveDashboard: builder.mutation<
      Dashboard,
      { dashboardId: number; name: string; layout: WidgetLayout[] }
    >({
      query: ({ dashboardId, name, layout }) => ({
        url: `/api/v1/dashboards/${dashboardId}`,
        method: 'PUT',
        body: { name, layout },
      }),
      invalidatesTags: (_result, _error, { dashboardId }) => [
        { type: 'Dashboard', id: dashboardId },
      ],
    }),
    deleteDashboard: builder.mutation<void, { dashboardId: number; deviceId: number }>({
      query: ({ dashboardId }) => ({
        url: `/api/v1/dashboards/${dashboardId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { dashboardId, deviceId }) => [
        { type: 'Dashboard', id: dashboardId },
        { type: 'DashboardList', id: deviceId },
      ],
    }),
  }),
});

export const {
  useListDashboardsQuery,
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
  useCreateDashboardMutation,
  useSaveDashboardMutation,
  useDeleteDashboardMutation,
} = dashboardsApi;
