import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { TOKEN_STORAGE_KEY } from '../../shared/lib/constants';

interface AuthState {
  token: string | null;
  isHydrated: boolean;
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: readStoredToken(),
  isHydrated: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<string>) {
      state.token = action.payload;
      localStorage.setItem(TOKEN_STORAGE_KEY, action.payload);
    },
    clearCredentials(state) {
      state.token = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export const authReducer = authSlice.reducer;

export const selectIsAuthenticated = (state: { auth: AuthState }) => Boolean(state.auth.token);
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;
