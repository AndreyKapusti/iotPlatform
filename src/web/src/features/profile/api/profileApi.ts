import { baseApi } from '../../../shared/api/baseApi';
import type { UserProfile, UserProfileUpdate } from '../../../types';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<UserProfile, void>({
      query: () => '/api/v1/users/me',
      providesTags: [{ type: 'Profile', id: 'ME' }],
    }),
    updateProfile: builder.mutation<UserProfile, UserProfileUpdate>({
      query: (body) => ({
        url: '/api/v1/users/me',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [{ type: 'Profile', id: 'ME' }],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
