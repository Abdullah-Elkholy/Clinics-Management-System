'use client';

import ProtectedRoute from '../../../../components/Auth/ProtectedRoute';
import MainApp from '../../../../components/MainApp/MainApp';

export default function CompletedTasksPage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}

