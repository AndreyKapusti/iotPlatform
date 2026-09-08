import { baseApi } from '../../../shared/api/baseApi';
import type { TokenResponse, User } from '../../../types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<TokenResponse, { username: string; password: string }>({
      query: ({ username, password }) => ({
        url: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      }),
    }),
    register: builder.mutation<User, { email: string; username: string; password: string }>({
      query: (body) => ({
        url: '/api/v1/auth/register',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useLoginMutation, useRegisterMutation } = authApi;
