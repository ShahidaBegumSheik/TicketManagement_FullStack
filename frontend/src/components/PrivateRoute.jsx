import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PageLoader from './PageLoader';

export default function PrivateRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    const fallback = user.role === 'admin' ? '/admin' : '/user';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
