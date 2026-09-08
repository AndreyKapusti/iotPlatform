import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import { AppLayout, WideLayout } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DashboardsListPage } from './pages/DashboardsListPage';
import { DevicePage } from './pages/DevicePage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { EventsPage } from './pages/EventsPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';

function LegacyDashboardRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/devices/${id}/dashboards`} replace />;
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="devices/:id" element={<DevicePage />} />
              <Route path="devices/:id/dashboards" element={<DashboardsListPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route element={<WideLayout />}>
              <Route path="devices/:id/dashboards/:dashboardId" element={<DashboardPage />} />
              <Route path="devices/:id/dashboard" element={<LegacyDashboardRedirect />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
