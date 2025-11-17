'use client';

import { useAuth } from '../../../../contexts/AuthContext';
import LoginScreen from '../../../../components/Auth/LoginScreen';
import MainApp from '../../../../components/MainApp/MainApp';

export default function OngoingTasksPage() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp />;
}

