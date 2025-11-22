'use client';

import ProtectedRoute from '../../../components/Auth/ProtectedRoute';
import MainApp from '../../../components/MainApp/MainApp';

/**
 * Ongoing Tasks Route
 * Displays ongoing/pending tasks for the selected queue
 */
export default function OngoingTasksPage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
