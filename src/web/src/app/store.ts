import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '../features/auth/authSlice';
import { uiReducer } from '../features/ui/uiSlice';
import { baseApi } from '../shared/api/baseApi';
import '../features/auth/api/authApi';
import '../features/devices/api/devicesApi';
import '../features/dashboards/api/dashboardsApi';
import '../features/profile/api/profileApi';
import '../features/telemetry/api/telemetryApi';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
