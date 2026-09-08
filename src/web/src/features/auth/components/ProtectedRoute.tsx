import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../../app/hooks';
import { selectIsAuthenticated } from '../authSlice';

export function ProtectedRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
