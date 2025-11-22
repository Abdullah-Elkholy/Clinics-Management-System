'use client';

import ProtectedRoute from '../../../components/Auth/ProtectedRoute';
import MainApp from '../../../components/MainApp/MainApp';

/**
 * Queues Dashboard Route
 * Displays the main queue overview panel
 */
export default function QueuesDashboardPage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
