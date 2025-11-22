'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { whatsappApiClient } from '@/services/api/whatsappApiClient';

// Reuse API base URL logic (mirrors other api clients)
const getApiBaseUrl = (): string => {
  // Use process.env directly - Next.js replaces NEXT_PUBLIC_* at build time
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const fullBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  
  // Debug log to verify correct URL (remove after testing)
  if (typeof window !== 'undefined' && fullBase.includes('3000')) {
    console.warn('[WhatsAppSessionContext] Incorrect base URL detected:', fullBase, 'Expected: http://127.0.0.1:5000/api');
  }
  
  return fullBase;
};

export type WhatsAppSessionStatus = 'connected' | 'disconnected' | 'pending' | null;

export interface WhatsAppSessionData {
  id: number;
  moderatorUserId: number;
  sessionName?: string;
  status?: WhatsAppSessionStatus;
  lastSyncAt?: string;
  createdAt: string;
}

interface WhatsAppSessionContextValue {
  sessionStatus: WhatsAppSessionStatus;
  sessionData: WhatsAppSessionData | null;
  isLoading: boolean;
  error: string | null;
  refreshSessionStatus: () => Promise<void>;
  checkAuthentication: () => Promise<{ isSuccess?: boolean; state?: string; resultMessage?: string }>;
  startAuthentication: () => Promise<{ isSuccess?: boolean; state?: string; resultMessage?: string }>;
}

const WhatsAppSessionContext = createContext<WhatsAppSessionContextValue | undefined>(undefined);

interface WhatsAppSessionProviderProps {
  children: ReactNode;
  moderatorId?: number;
}

export function WhatsAppSessionProvider({ children, moderatorId }: WhatsAppSessionProviderProps) {
  const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>(null);
  const [sessionData, setSessionData] = useState<WhatsAppSessionData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessionStatus = useCallback(async () => {
    if (!moderatorId) {
      setSessionStatus('disconnected');
      setSessionData(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        setError('غير مصرح - يرجى تسجيل الدخول');
        setSessionStatus('disconnected');
        return;
      }

      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/moderators/${moderatorId}/whatsapp-session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No session found - create default disconnected state
          setSessionStatus('disconnected');
          setSessionData(null);
          return;
        }
        throw new Error(`Failed to fetch session: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const data: WhatsAppSessionData = result.data;
        setSessionData(data);
        
        // Normalize status to our type
        const status = data.status?.toLowerCase();
        if (status === 'connected' || status === 'pending' || status === 'disconnected') {
          setSessionStatus(status as WhatsAppSessionStatus);
        } else {
          setSessionStatus('disconnected');
        }
      } else {
        setSessionStatus('disconnected');
        setSessionData(null);
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp session status:', err);
      setError(err.message || 'فشل في جلب حالة جلسة الواتساب');
      setSessionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  }, [moderatorId]);

  const checkAuthentication = useCallback(async () => {
    try {
      console.log('[WhatsAppSessionContext] checkAuthentication called - moderatorId:', moderatorId);
      const result = await whatsappApiClient.checkAuthentication(moderatorId);
      console.log('[WhatsAppSessionContext] checkAuthentication result:', result);
      
      // Update local state based on result
      if (result.state === 'Success') {
        setSessionStatus('connected');
      } else if (result.state === 'PendingQR') {
        setSessionStatus('pending');
      } else {
        setSessionStatus('disconnected');
      }
      
      // Also refresh from database to sync
      await refreshSessionStatus();
      
      return result;
    } catch (err: any) {
      console.error('[WhatsAppSessionContext] Error checking authentication:', err);
      return {
        isSuccess: false,
        state: 'Failure',
        resultMessage: err.message || 'فشل التحقق من المصادقة',
      };
    }
  }, [moderatorId, refreshSessionStatus]);

  const startAuthentication = useCallback(async () => {
    try {
      console.log('[WhatsAppSessionContext] startAuthentication called - moderatorId:', moderatorId);
      setSessionStatus('pending');
      const result = await whatsappApiClient.authenticate(moderatorId);
      console.log('[WhatsAppSessionContext] startAuthentication result:', result);
      
      // Update local state based on result
      if (result.state === 'Success') {
        setSessionStatus('connected');
      } else if (result.state === 'PendingQR') {
        setSessionStatus('pending');
      }
      
      // Refresh from database to sync
      await refreshSessionStatus();
      
      return result;
    } catch (err: any) {
      console.error('[WhatsAppSessionContext] Error starting authentication:', err);
      setSessionStatus('disconnected');
      return {
        isSuccess: false,
        state: 'Failure',
        resultMessage: err.message || 'فشل بدء المصادقة',
      };
    }
  }, [moderatorId, refreshSessionStatus]);

  // Initial fetch
  useEffect(() => {
    refreshSessionStatus();
  }, [refreshSessionStatus]);

  // Poll every 10 seconds
  useEffect(() => {
    if (!moderatorId) return;

    const interval = setInterval(() => {
      refreshSessionStatus();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [moderatorId, refreshSessionStatus]);

  const value: WhatsAppSessionContextValue = {
    sessionStatus,
    sessionData,
    isLoading,
    error,
    refreshSessionStatus,
    checkAuthentication,
    startAuthentication,
  };

  return (
    <WhatsAppSessionContext.Provider value={value}>
      {children}
    </WhatsAppSessionContext.Provider>
  );
}

export function useWhatsAppSession() {
  const context = useContext(WhatsAppSessionContext);
  if (context === undefined) {
    throw new Error('useWhatsAppSession must be used within a WhatsAppSessionProvider');
  }
  return context;
}
