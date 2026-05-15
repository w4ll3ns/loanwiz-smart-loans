import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardSkeleton } from '@/components/LoadingSkeletons';
import Layout from '@/components/Layout';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  withLayout?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, withLayout = true }: ProtectedRouteProps) {
  const { isAdmin, isLoading, role } = useUserRole();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return withLayout ? <Layout>{children}</Layout> : <>{children}</>;
}
