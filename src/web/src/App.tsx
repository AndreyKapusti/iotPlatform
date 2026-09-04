import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout, ProtectedRoute, WideLayout } from './components/Layout';
import { ThemeProvider } from './hooks/useTheme';
import { ToastProvider } from './hooks/useToast';
import { DashboardPage } from './pages/DashboardPage';
import { DashboardsListPage } from './pages/DashboardsListPage';
import { DevicePage } from './pages/DevicePage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

function LegacyDashboardRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/devices/${id}/dashboards`} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/devices" replace />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/devices/:id" element={<DevicePage />} />
              <Route path="/devices/:id/dashboards" element={<DashboardsListPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<WideLayout />}>
              <Route
                path="/devices/:id/dashboards/:dashboardId"
                element={<DashboardPage />}
              />
              <Route path="/devices/:id/dashboard" element={<LegacyDashboardRedirect />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/devices" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
