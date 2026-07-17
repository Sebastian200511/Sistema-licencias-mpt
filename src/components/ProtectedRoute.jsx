import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, userRole } = useAuth();

  if (!isAuthenticated) {
    // Si no está autenticado, enviarlo al login
    return <Navigate to="/institucional" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Si está autenticado pero su rol no tiene permiso para esta ruta
    return <Navigate to="/institucional" replace />;
  }

  // Renderizar la ruta protegida (Outlet permite renderizar las subrutas)
  return <Outlet />;
}
