'use client';

import ProtectedRoute from '../../../components/Auth/ProtectedRoute';
import MainApp from '../../../components/MainApp/MainApp';

/**
 * Completed Tasks Route
 * Displays successfully completed tasks for the selected queue
 */
export default function CompletedTasksPage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
