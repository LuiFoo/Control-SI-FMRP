import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardEstoque from '@/components/DashboardEstoque';

export default function EstoquePage() {
  return (
    <ProtectedRoute>
      <DashboardEstoque />
    </ProtectedRoute>
  );
}
