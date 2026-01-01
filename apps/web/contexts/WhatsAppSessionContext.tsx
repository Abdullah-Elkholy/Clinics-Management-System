'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { whatsappApiClient, GlobalPauseState, CombinedStatusResponse } from '@/services/api/whatsappApiClient';
import { extensionApiClient, ExtensionLeaseStatus } from '@/services/api/extensionApiClient';
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

// Extended detailed status for more descriptive UI
export type DetailedSessionStatus = 
  | 'connected_idle'           // Connected but not sending
  | 'connected_sending'        // Connected and actively sending messages
  | 'connected_paused'         // Connected but paused manually
  | 'extension_connected'      // Extension browser connected but WhatsApp status unknown
  | 'extension_disconnected'   // Extension browser went offline (had lease but no recent heartbeat)
  | 'no_extension'             // No extension paired/connected at all
  | 'pending_qr'               // Extension connected, WhatsApp needs QR scan
  | 'pending_net'              // Network issue
  | 'browser_closed'           // Browser was closed
  | 'disconnected'             // General disconnected state (legacy browser-based)
  | 'loading'                  // Loading state
  | null;

// Extension status from lease
export interface ExtensionStatus {
  hasActiveLease: boolean;
  deviceName?: string;
  whatsAppStatus?: string;  // 'connected', 'pending_qr', 'pending_net', etc.
  lastHeartbeat?: string;
  currentUrl?: string;
  isOnline: boolean;        // Calculated from lastHeartbeat
}

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
  detailedStatus: DetailedSessionStatus;
  extensionStatus: ExtensionStatus | null;
  sessionData: WhatsAppSessionData | null;
  sessionHealth: WhatsAppSessionHealth | null;
  globalPauseState: GlobalPauseState | null;
  isLoading: boolean;
  error: string | null;
  isSending: boolean;  // True when messages are being sent
  refreshSessionStatus: () => Promise<void>;
  refreshSessionHealth: () => Promise<void>;
  refreshGlobalPauseState: () => Promise<void>;
  refreshExtensionStatus: () => Promise<void>;
  refreshCombinedStatus: () => Promise<void>;
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
  const [detailedStatus, setDetailedStatus] = useState<DetailedSessionStatus>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [sessionData, setSessionData] = useState<WhatsAppSessionData | null>(null);
  const [sessionHealth, setSessionHealth] = useState<WhatsAppSessionHealth | null>(null);
  const [globalPauseState, setGlobalPauseState] = useState<GlobalPauseState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  
  // Track previous moderatorId to detect changes and force refresh
  const previousModeratorIdRef = useRef<number | undefined>(moderatorId);

  // Helper function to calculate detailed status
  const calculateDetailedStatus = useCallback((
    session: WhatsAppSessionStatus,
    extension: ExtensionStatus | null,
    pause: GlobalPauseState | null,
    sending: boolean
  ): DetailedSessionStatus => {
    // PRIORITY 1: Check extension status first (extension-based architecture)
    if (extension?.hasActiveLease) {
      // Extension has an active lease
      if (!extension.isOnline) {
        // Lease exists but no recent heartbeat - extension went offline
        return 'extension_disconnected';
      }
      
      // Extension is online, check WhatsApp status from extension
      const waStatus = extension.whatsAppStatus?.toLowerCase();
      
      // PRIORITY: If actively sending messages, show that regardless of exact WhatsApp status
      // This handles cases where status is 'loading' or briefly unknown during message sends
      if (sending && waStatus !== 'qr_pending' && waStatus !== 'pending_qr' && waStatus !== 'pending_net') {
        return 'connected_sending';
      }
      
      if (waStatus === 'connected') {
        // WhatsApp is connected via extension
        if (pause?.isPaused) return 'connected_paused';
        if (sending) return 'connected_sending';
        return 'connected_idle';
      }
      
      if (waStatus === 'qr_pending' || waStatus === 'pending_qr') {
        // Extension reports WhatsApp needs QR scan
        return 'pending_qr';
      }
      
      if (waStatus === 'pending_net' || waStatus === 'disconnected' || waStatus === 'phone_disconnected') {
        return 'pending_net';
      }
      
      // Handle 'loading' status more descriptively
      if (waStatus === 'loading') {
        return 'loading';
      }
      
      // Extension connected but WhatsApp status is unknown
      return 'extension_connected';
    }
    
    // PRIORITY 2: No active extension lease - this is the key distinction!
    // Don't show "pending_qr" here - that's misleading. Show "no_extension" instead.
    // The user needs to connect the extension first, not scan a QR code.
    
    // Check if there's a specific pause reason from old browser-based system
    if (pause?.isPaused) {
      if (pause.pauseReason?.includes('PendingQR')) {
        // This is from the old browser-based system, but if no extension is connected,
        // the real issue is the extension, not QR
        return 'no_extension';
      }
      if (pause.pauseReason?.includes('PendingNET')) return 'pending_net';
      if (pause.pauseReason?.includes('BrowserClosure')) return 'browser_closed';
    }

    // PRIORITY 3: Fallback to session status (legacy browser-based mode)
    // Only show connected states if we're actually in legacy mode and connected
    if (session === 'connected' && !extension) {
      // Legacy browser mode - still connected
      if (pause?.isPaused) return 'connected_paused';
      if (sending) return 'connected_sending';
      return 'connected_idle';
    }
    
    // Default: No extension connected
    return 'no_extension';
  }, []);

  // Refresh extension lease status
  const refreshExtensionStatus = useCallback(async () => {
    if (!moderatorId) {
      setExtensionStatus(null);
      return;
    }

    try {
      const result = await extensionApiClient.getLeaseStatus();
      if (result.success) {
        // Calculate if extension is online (heartbeat within last 60 seconds)
        const isOnline = result.lastHeartbeat 
          ? (Date.now() - new Date(result.lastHeartbeat).getTime()) < 60000
          : false;
        
        const extStatus: ExtensionStatus = {
          hasActiveLease: result.hasActiveLease || false,
          deviceName: result.deviceName,
          whatsAppStatus: result.whatsAppStatus,
          lastHeartbeat: result.lastHeartbeat,
          isOnline,
        };
        setExtensionStatus(extStatus);
        
        // Update detailed status
        setDetailedStatus(calculateDetailedStatus(
          sessionStatus,
          extStatus,
          globalPauseState,
          isSending
        ));
      }
    } catch (err) {
      console.error('[WhatsAppSessionContext] Error fetching extension status:', err);
    }
  }, [moderatorId, sessionStatus, globalPauseState, isSending, calculateDetailedStatus]);

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

  /**
   * NEW: Combined status refresh - fetches all status data in a single API call
   * This reduces 4 API calls to 1, significantly improving performance
   */
  const refreshCombinedStatus = useCallback(async () => {
    if (!moderatorId) {
      setSessionStatus('disconnected');
      setSessionData(null);
      setExtensionStatus(null);
      setGlobalPauseState(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await whatsappApiClient.getCombinedStatus(moderatorId);
      
      if (result.success) {
        // Update session data
        if (result.session) {
          setSessionData({
            id: result.session.id,
            moderatorUserId: result.session.moderatorUserId,
            sessionName: result.session.sessionName,
            status: result.session.status as WhatsAppSessionStatus,
            lastSyncAt: result.session.lastSyncAt,
            createdAt: result.session.createdAt,
            providerSessionId: result.session.providerSessionId,
            lastActivityAt: result.session.lastActivityAt,
          });
          
          // Set session status
          const status = result.session.status?.toLowerCase();
          if (status === 'connected' || status === 'pending' || status === 'disconnected') {
            setSessionStatus(status as WhatsAppSessionStatus);
          } else {
            setSessionStatus('disconnected');
          }
        } else {
          setSessionData(null);
          setSessionStatus('disconnected');
        }

        // Update pause state
        setGlobalPauseState({
          isPaused: result.pauseState.isPaused,
          pauseReason: result.pauseState.pauseReason,
          pausedAt: result.pauseState.pausedAt,
          pausedBy: result.pauseState.pausedBy,
          isResumable: result.pauseState.isResumable,
        });

        // Update extension status
        const extStatus: ExtensionStatus = {
          hasActiveLease: result.extension.hasActiveLease,
          deviceName: result.extension.deviceName,
          whatsAppStatus: result.extension.whatsAppStatus,
          lastHeartbeat: result.extension.lastHeartbeat,
          isOnline: result.extension.isOnline,
        };
        setExtensionStatus(extStatus);

        // Calculate detailed status inline (avoid circular dependency)
        const currentSessionStatus = result.session?.status?.toLowerCase() as WhatsAppSessionStatus || 'disconnected';
        setDetailedStatus(calculateDetailedStatus(
          currentSessionStatus,
          extStatus,
          result.pauseState,
          isSending
        ));
      } else {
        // API returned success: false - set error state
        console.warn('[WhatsAppSessionContext] Combined status API returned success: false');
        setError('فشل في جلب الحالة');
      }
    } catch (err: any) {
      // Log error but don't spam with fallback - just set error state
      console.error('[WhatsAppSessionContext] Error fetching combined status:', err);
      setError(err.message || 'فشل في جلب الحالة');
      // Don't fallback to individual fetches to avoid cascade of API calls
    } finally {
      setIsLoading(false);
    }
    // Note: We only depend on moderatorId and isSending to minimize re-creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId, isSending]);

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

        // Use combined status refresh for full sync
        refreshCombinedStatus();
      }
    };

    on('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate);

    return () => {
      off('WhatsAppSessionUpdated', handleWhatsAppSessionUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId, on, off]); // Only re-subscribe when moderatorId changes

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
        refreshCombinedStatus();
      }
    };

    const handleNetworkFailure = (event: Event) => {
      const customEvent = event as CustomEvent;
      const eventModeratorId = customEvent.detail?.moderatorUserId;
      
      if (!eventModeratorId || eventModeratorId === moderatorId) {
        console.log('[WhatsAppSessionContext] networkFailure event detected, refreshing status');
        setSessionStatus('disconnected');
        refreshCombinedStatus();
      }
    };

    const handleBrowserClosed = (event: Event) => {
      const customEvent = event as CustomEvent;
      const eventModeratorId = customEvent.detail?.moderatorUserId;
      
      if (!eventModeratorId || eventModeratorId === moderatorId) {
        console.log('[WhatsAppSessionContext] browserClosed event detected, refreshing status');
        setSessionStatus('disconnected');
        refreshCombinedStatus();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId]); // Only re-subscribe when moderatorId changes

  // Initial fetch - only if moderatorId is available
  // Also refresh when moderatorId changes (e.g., user logs in/out or switches accounts)
  // Note: We intentionally exclude the refresh functions from deps to prevent infinite loops
  useEffect(() => {
    // Check if moderatorId changed
    const moderatorIdChanged = previousModeratorIdRef.current !== moderatorId;
    previousModeratorIdRef.current = moderatorId;
    
    if (moderatorId) {
      // Use combined status for initial load (reduces 4 API calls to 1)
      refreshCombinedStatus();
      refreshSessionHealth(); // Health is separate since it's less frequently needed
    } else {
      // No moderatorId - set disconnected state
      setSessionStatus('disconnected');
      setSessionData(null);
      setSessionHealth(null);
      setGlobalPauseState(null);
      setExtensionStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId]); // Only re-run when moderatorId changes

  // Polling: Use combined status endpoint with longer interval (60s)
  // SignalR handles real-time updates, polling is just a fallback for missed events
  // Note: We use a ref-based approach to avoid infinite loops from callback dependencies
  useEffect(() => {
    if (!moderatorId) {
      // No moderatorId - set disconnected state and stop polling
      setSessionStatus('disconnected');
      setSessionData(null);
      setSessionHealth(null);
      return;
    }
    
    // Don't poll if tab is hidden initially
    if (document.hidden) return;

    // Initial poll already done in previous useEffect
    // Set up fallback polling with 60 second interval (SignalR handles real-time updates)
    const interval = setInterval(() => {
      // Only poll if tab is visible and moderatorId is still valid
      if (!document.hidden && moderatorId) {
        // Use combined status - 1 API call instead of 4
        refreshCombinedStatus();
        // Health is polled less frequently - only when visible
        refreshSessionHealth();
      }
    }, 60000); // 60 seconds - rely on SignalR for real-time updates

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId]); // Only moderatorId should trigger re-setup

  // Listen for MessageSending SignalR events to track sending state
  useEffect(() => {
    if (!moderatorId) return;

    const handleMessageSending = (payload: any) => {
      if (payload.moderatorId === moderatorId || payload.moderatorUserId === moderatorId) {
        setIsSending(true);
        setDetailedStatus(prev => prev === 'connected_idle' ? 'connected_sending' : prev);
      }
    };

    const handleMessageSent = (payload: any) => {
      // Update sending state based on session activity
      // Don't set to false immediately - let the periodic refresh handle it
    };

    const handleExtensionStatusUpdate = (payload: any) => {
      if (payload.moderatorUserId === moderatorId) {
        console.log('[WhatsAppSessionContext] ExtensionStatusUpdate received:', payload);
        // Use combined status for full sync
        refreshCombinedStatus();
      }
    };

    on('MessageSending', handleMessageSending);
    on('MessageSent', handleMessageSent);
    on('ExtensionStatusUpdated', handleExtensionStatusUpdate);

    return () => {
      off('MessageSending', handleMessageSending);
      off('MessageSent', handleMessageSent);
      off('ExtensionStatusUpdated', handleExtensionStatusUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moderatorId, on, off]); // Only re-subscribe when moderatorId changes

  const value: WhatsAppSessionContextValue = {
    sessionStatus,
    detailedStatus,
    extensionStatus,
    sessionData,
    sessionHealth,
    globalPauseState,
    isLoading,
    error,
    isSending,
    refreshSessionStatus,
    refreshSessionHealth,
    refreshGlobalPauseState,
    refreshExtensionStatus,
    refreshCombinedStatus,
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
