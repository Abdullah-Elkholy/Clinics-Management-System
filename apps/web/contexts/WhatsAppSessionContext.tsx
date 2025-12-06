'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { whatsappApiClient, GlobalPauseState } from '@/services/api/whatsappApiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useSignalR } from '@/contexts/SignalRContext';

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
  providerSessionId?: string; // Correlates frontend state with backend browser session lifetime
  // Audit trail fields
  createdByUserId?: number;
  lastActivityUserId?: number;
  lastActivityAt?: string;
}

export interface WhatsAppSessionHealth {
  currentSizeBytes: number;
  currentSizeMB: number;
  backupSizeBytes: number;
  backupSizeMB: number;
  lastCleanup?: string;
  lastBackup?: string;
  backupExists: boolean;
  isAuthenticated: boolean;
  providerSessionId?: string;
  compressionRatio: number;
  thresholdBytes: number;
  thresholdMB: number;
  exceedsThreshold: boolean;
}

interface WhatsAppSessionContextValue {
  sessionStatus: WhatsAppSessionStatus;
  sessionData: WhatsAppSessionData | null;
  sessionHealth: WhatsAppSessionHealth | null;
  globalPauseState: GlobalPauseState | null;
  isLoading: boolean;
  error: string | null;
  refreshSessionStatus: () => Promise<void>;
  refreshSessionHealth: () => Promise<void>;
  refreshGlobalPauseState: () => Promise<void>;
  checkAuthentication: () => Promise<{ isSuccess?: boolean; state?: string; resultMessage?: string }>;
  startAuthentication: () => Promise<{ isSuccess?: boolean; state?: string; resultMessage?: string }>;
}

const WhatsAppSessionContext = createContext<WhatsAppSessionContextValue | undefined>(undefined);

interface WhatsAppSessionProviderProps {
  children: ReactNode;
  moderatorId?: number;
}

export function WhatsAppSessionProvider({ children, moderatorId }: WhatsAppSessionProviderProps) {
  const { user } = useAuth();
  const { on, off } = useSignalR();
  const [sessionStatus, setSessionStatus] = useState<WhatsAppSessionStatus>(null);
  const [sessionData, setSessionData] = useState<WhatsAppSessionData | null>(null);
  const [sessionHealth, setSessionHealth] = useState<WhatsAppSessionHealth | null>(null);
  const [globalPauseState, setGlobalPauseState] = useState<GlobalPauseState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track previous moderatorId to detect changes and force refresh
  const previousModeratorIdRef = useRef<number | undefined>(moderatorId);

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
        
        // Normalize status to our type (will be overridden by global pause state if needed)
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
      
      // After fetching session data, check global pause state to override status if needed
      // This is done separately to avoid circular dependency
      if (moderatorId) {
        try {
          const pauseState = await whatsappApiClient.getGlobalPauseState(moderatorId);
          setGlobalPauseState(pauseState);
          
          // Override status based on global pause state
          if (pauseState.isPaused) {
            if (pauseState.pauseReason?.includes('PendingQR')) {
              setSessionStatus('pending');
            } else if (pauseState.pauseReason?.includes('PendingNET') || pauseState.pauseReason?.includes('BrowserClosure')) {
              setSessionStatus('disconnected');
            }
          }
        } catch (err) {
          // Silently fail - don't break session status if pause state check fails
          console.error('[WhatsAppSessionContext] Error fetching global pause state in refreshSessionStatus:', err);
        }
      }
    } catch (err: any) {
      console.error('Error fetching WhatsApp session status:', err);
      setError(err.message || 'فشل في جلب حالة جلسة الواتساب');
      setSessionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  }, [moderatorId]);
  
  const refreshGlobalPauseState = useCallback(async () => {
    if (!moderatorId) {
      setGlobalPauseState(null);
      return;
    }

    try {
      const state = await whatsappApiClient.getGlobalPauseState(moderatorId);
      setGlobalPauseState(state);
      
      // Update session status based on global pause state
      if (state.isPaused) {
        if (state.pauseReason?.includes('PendingQR')) {
          setSessionStatus('pending');
        } else if (state.pauseReason?.includes('PendingNET') || state.pauseReason?.includes('BrowserClosure')) {
          setSessionStatus('disconnected');
        }
      } else {
        // Refresh session status from database when not paused
        await refreshSessionStatus();
      }
    } catch (err: any) {
      console.error('[WhatsAppSessionContext] Error fetching global pause state:', err);
      // Don't set error state - just log it
    }
  }, [moderatorId, refreshSessionStatus]);

  const checkAuthentication = useCallback(async () => {
    try {
      const userId = user?.id ? parseInt(user.id, 10) : undefined;
      console.log('[WhatsAppSessionContext] checkAuthentication called - moderatorId:', moderatorId, 'userId:', userId);
      const result = await whatsappApiClient.checkAuthentication(moderatorId, userId);
      console.log('[WhatsAppSessionContext] checkAuthentication result:', result);
      
      // Update local state based on result
      if (result.state === 'Success') {
        setSessionStatus('connected');
      } else if (result.state === 'PendingQR') {
        setSessionStatus('pending');
      } else {
        setSessionStatus('disconnected');
      }
      
      // Refresh both session status and global pause state from database to sync
      await Promise.all([
        refreshSessionStatus(),
        refreshGlobalPauseState()
      ]);
      
      return result;
    } catch (err: any) {
      console.error('[WhatsAppSessionContext] Error checking authentication:', err);
      return {
        isSuccess: false,
        state: 'Failure',
        resultMessage: err.message || 'فشل التحقق من المصادقة',
      };
    }
  }, [moderatorId, refreshSessionStatus, refreshGlobalPauseState, user]);

  const refreshSessionHealth = useCallback(async () => {
    if (!moderatorId) {
      setSessionHealth(null);
      return;
    }

    try {
      const health = await whatsappApiClient.getSessionHealth(moderatorId);
      setSessionHealth(health);
    } catch (err: any) {
      console.error('[WhatsAppSessionContext] Error fetching session health:', err);
      setSessionHealth(null);
    }
  }, [moderatorId]);

  const startAuthentication = useCallback(async () => {
    try {
      const userId = user?.id ? parseInt(user.id, 10) : undefined;
      console.log('[WhatsAppSessionContext] startAuthentication called - moderatorId:', moderatorId, 'userId:', userId);
      setSessionStatus('pending');
      const result = await whatsappApiClient.authenticate(moderatorId, userId);
      console.log('[WhatsAppSessionContext] startAuthentication result:', result);
      
      // Update local state based on result
      if (result.state === 'Success') {
        setSessionStatus('connected');
      } else if (result.state === 'PendingQR') {
        setSessionStatus('pending');
      }
      
      // Refresh both session status and global pause state from database to sync
      await Promise.all([
        refreshSessionStatus(),
        refreshGlobalPauseState()
      ]);
      
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
  }, [moderatorId, refreshSessionStatus, refreshGlobalPauseState]);

  // Listen for WhatsAppSessionUpdated SignalR events
  useEffect(() => {
    if (!moderatorId) return;

    const handleWhatsAppSessionUpdate = (payload: any) => {
      // Only process events for this moderator
      if (payload.moderatorUserId === moderatorId) {
        console.log('[WhatsAppSessionContext] WhatsAppSessionUpdated event received', payload);
        
        // Update session data
        if (payload.status) {
          setSessionStatus(payload.status as WhatsAppSessionStatus);
        }
        
        // Update session data state
        setSessionData({
          id: payload.id,
          moderatorUserId: payload.moderatorUserId,
          sessionName: payload.sessionName,
          status: payload.status,
          lastSyncAt: payload.lastSyncAt,
          createdAt: payload.createdAt || new Date().toISOString(),
          providerSessionId: payload.providerSessionId,
        });

        // Update global pause state (includes backend-computed isResumable)
        setGlobalPauseState({
          isPaused: payload.isPaused || false,
          pauseReason: payload.pauseReason,
          pausedAt: payload.pausedAt,
          pausedBy: payload.pausedBy,
          isResumable: payload.isResumable || false,
        });

        // Optionally refresh from database for full sync
        refreshSessionStatus();
        refreshGlobalPauseState();
      }
    };

    on('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate);

    return () => {
      off('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate);
    };
  }, [moderatorId, on, off, refreshSessionStatus, refreshGlobalPauseState]);

  // Listen for pendingQR events from API calls
  useEffect(() => {
    if (!moderatorId) return;

    const handlePendingQR = (event: Event) => {
      const customEvent = event as CustomEvent;
      const eventModeratorId = customEvent.detail?.moderatorUserId;
      
      // Only respond to events for this moderator
      if (!eventModeratorId || eventModeratorId === moderatorId) {
        console.log('[WhatsAppSessionContext] pendingQR event detected, refreshing status');
        setSessionStatus('pending');
        refreshSessionStatus();
      }
    };

    const handleNetworkFailure = (event: Event) => {
      const customEvent = event as CustomEvent;
      const eventModeratorId = customEvent.detail?.moderatorUserId;
      
      if (!eventModeratorId || eventModeratorId === moderatorId) {
        console.log('[WhatsAppSessionContext] networkFailure event detected, refreshing status');
        setSessionStatus('disconnected');
        refreshGlobalPauseState();
      }
    };

    const handleBrowserClosed = (event: Event) => {
      const customEvent = event as CustomEvent;
      const eventModeratorId = customEvent.detail?.moderatorUserId;
      
      if (!eventModeratorId || eventModeratorId === moderatorId) {
        console.log('[WhatsAppSessionContext] browserClosed event detected, refreshing status');
        setSessionStatus('disconnected');
        refreshGlobalPauseState();
      }
    };

    window.addEventListener('whatsapp:pendingQR', handlePendingQR);
    window.addEventListener('whatsapp:networkFailure', handleNetworkFailure);
    window.addEventListener('whatsapp:browserClosed', handleBrowserClosed);
    
    return () => {
      window.removeEventListener('whatsapp:pendingQR', handlePendingQR);
      window.removeEventListener('whatsapp:networkFailure', handleNetworkFailure);
      window.removeEventListener('whatsapp:browserClosed', handleBrowserClosed);
    };
  }, [moderatorId, refreshSessionStatus, refreshGlobalPauseState]);

  // Initial fetch - only if moderatorId is available
  // Also refresh when moderatorId changes (e.g., user logs in/out or switches accounts)
  useEffect(() => {
    // Check if moderatorId changed
    const moderatorIdChanged = previousModeratorIdRef.current !== moderatorId;
    previousModeratorIdRef.current = moderatorId;
    
    if (moderatorId) {
      // Refresh session status and global pause state when moderatorId is available or changed
      // This ensures status updates when user logs in or switches accounts
      refreshSessionStatus();
      refreshSessionHealth();
      refreshGlobalPauseState();
    } else {
      // No moderatorId - set disconnected state
      setSessionStatus('disconnected');
      setSessionData(null);
      setSessionHealth(null);
      setGlobalPauseState(null);
    }
  }, [moderatorId, refreshSessionStatus, refreshSessionHealth, refreshGlobalPauseState]);

  // Poll every 15 seconds (reduced frequency to save resources)
  // Only poll when tab is visible and moderatorId is available
  useEffect(() => {
    if (!moderatorId) {
      // No moderatorId - set disconnected state and stop polling
      setSessionStatus('disconnected');
      setSessionData(null);
      setSessionHealth(null);
      return;
    }
    
    // Don't poll if tab is hidden
    if (document.hidden) return;

    // Initial poll when moderatorId changes
    refreshSessionStatus();
    refreshSessionHealth();
    refreshGlobalPauseState();

    const interval = setInterval(() => {
      // Only poll if tab is visible and moderatorId is still valid
      if (!document.hidden && moderatorId) {
        refreshSessionStatus();
        refreshSessionHealth();
        refreshGlobalPauseState();
      }
    }, 15000); // Increased from 10 seconds to 15 seconds

    // Pause polling when tab becomes hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [moderatorId, refreshSessionStatus, refreshSessionHealth, refreshGlobalPauseState]);

  const value: WhatsAppSessionContextValue = {
    sessionStatus,
    sessionData,
    sessionHealth,
    globalPauseState,
    isLoading,
    error,
    refreshSessionStatus,
    refreshSessionHealth,
    refreshGlobalPauseState,
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
