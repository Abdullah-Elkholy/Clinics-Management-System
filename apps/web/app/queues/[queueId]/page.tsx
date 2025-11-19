'use client';

import ProtectedRoute from '../../../components/Auth/ProtectedRoute';
import MainApp from '../../../components/MainApp/MainApp';

export default function QueuePage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}

