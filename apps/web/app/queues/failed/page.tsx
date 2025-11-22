'use client';

import ProtectedRoute from '../../../components/Auth/ProtectedRoute';
import MainApp from '../../../components/MainApp/MainApp';

/**
 * Failed Tasks Route
 * Displays failed tasks for the selected queue
 */
export default function FailedTasksPage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
