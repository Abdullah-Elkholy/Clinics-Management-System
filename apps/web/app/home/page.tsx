'use client';

import ProtectedRoute from '../../components/Auth/ProtectedRoute';
import MainApp from '../../components/MainApp/MainApp';

/**
 * Home Page - Default authenticated route
 * Displays the welcome panel with queue overview
 */
export default function HomePage() {
  return (
    <ProtectedRoute>
      <MainApp />
    </ProtectedRoute>
  );
}
