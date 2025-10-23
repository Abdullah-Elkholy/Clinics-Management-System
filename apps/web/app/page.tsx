'use client';

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../components/Auth/LoginScreen';
import MainApp from '../components/MainApp/MainApp';

export default function Home() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainApp />;
}
