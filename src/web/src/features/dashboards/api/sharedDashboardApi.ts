import { baseApi } from '../../../shared/api/baseApi';
import type { WidgetType } from '../../../types';

export interface SharedWidget { id: string; device_id: number; metric: string; type: WidgetType; title: string }
export interface SharedDashboard { id: number; name: string; layout: SharedWidget[]; updated_at: string }
export const sharedDashboardApi = baseApi.injectEndpoints({ endpoints: (builder) => ({
  listSharedDashboards: builder.query<SharedDashboard[], void>({ query: () => '/api/v1/shared-dashboards', providesTags: ['SharedDashboard'] }),
  getSharedDashboard: builder.query<SharedDashboard, number>({ query: (id) => `/api/v1/shared-dashboards/${id}`, providesTags: ['SharedDashboard'] }),
  createSharedDashboard: builder.mutation<SharedDashboard, { name: string; layout: SharedWidget[] }>({ query: (body) => ({ url: '/api/v1/shared-dashboards', method: 'POST', body }), invalidatesTags: ['SharedDashboard'] }),
  saveSharedDashboard: builder.mutation<SharedDashboard, { id: number; name: string; layout: SharedWidget[] }>({ query: ({ id, ...body }) => ({ url: `/api/v1/shared-dashboards/${id}`, method: 'PUT', body }), invalidatesTags: ['SharedDashboard'] }),
  deleteSharedDashboard: builder.mutation<void, number>({ query: (id) => ({ url: `/api/v1/shared-dashboards/${id}`, method: 'DELETE' }), invalidatesTags: ['SharedDashboard'] }),
}) });
export const { useListSharedDashboardsQuery, useGetSharedDashboardQuery, useCreateSharedDashboardMutation,
  useSaveSharedDashboardMutation, useDeleteSharedDashboardMutation } = sharedDashboardApi;
