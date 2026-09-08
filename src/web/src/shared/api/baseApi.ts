import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { clearCredentials, selectAuthToken } from '../../features/auth/authSlice';
import type { RootState } from '../../app/store';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/',
  prepareHeaders: (headers, { getState }) => {
    const token = selectAuthToken(getState() as RootState);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    api.dispatch(clearCredentials());
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['Device', 'DeviceList', 'Capability', 'Dashboard', 'DashboardList', 'Profile'],
  endpoints: () => ({}),
});

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return extractFetchBaseQueryError(error as FetchBaseQueryError);
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return 'Ошибка запроса';
}

function extractFetchBaseQueryError(error: FetchBaseQueryError): string {
  if ('error' in error && typeof error.error === 'string') {
    return error.error;
  }
  if ('status' in error) {
    const data = error.data;
    if (typeof data === 'object' && data !== null) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((item) =>
            typeof item === 'object' && item !== null && 'msg' in item
              ? String((item as { msg: string }).msg)
              : JSON.stringify(item),
          )
          .join(', ');
      }
      if (typeof (data as { error?: string }).error === 'string') {
        return (data as { error: string }).error;
      }
    }
    return typeof error.status === 'number' ? `Ошибка ${error.status}` : 'Ошибка запроса';
  }
  return 'Ошибка сети';
}
