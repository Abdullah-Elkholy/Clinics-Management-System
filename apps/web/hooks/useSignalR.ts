import { useEffect, useState, useCallback, useRef } from 'react';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

/**
 * Custom React hook for managing SignalR connections
 * Implements per-moderator group model as per PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 10.3
 * 
 * @param hubUrl - The SignalR hub endpoint URL (e.g., '/dataUpdateHub')
 * @param options - Configuration options for the connection
 * @returns Object containing connection, connection state, and utility methods
 */
export interface UseSignalROptions {
  /**
   * Whether to automatically connect when the hook is mounted
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Whether to automatically reconnect on connection failure
   * @default true
   */
  autoReconnect?: boolean;

  /**
   * Callback function called when connection is established
   */
  onConnected?: () => void;

  /**
   * Callback function called when connection is closed
   */
  onDisconnected?: (error?: Error) => void;

  /**
   * Callback function called when reconnecting
   */
  onReconnecting?: (error?: Error) => void;

  /**
   * Callback function called when reconnected
   */
  onReconnected?: (connectionId?: string) => void;
}

export interface UseSignalRReturn {
  /**
   * The SignalR hub connection instance
   */
  connection: HubConnection | null;

  /**
   * Current connection state
   */
  connectionState: HubConnectionState;

  /**
   * Whether the connection is currently connected
   */
  isConnected: boolean;

  /**
   * Manually start the connection
   */
  connect: () => Promise<void>;

  /**
   * Manually stop the connection
   */
  disconnect: () => Promise<void>;

  /**
   * Subscribe to a specific moderator's updates
   */
  subscribeToModerator: (moderatorId: number) => Promise<void>;

  /**
   * Unsubscribe from a specific moderator's updates
   */
  unsubscribeFromModerator: (moderatorId: number) => Promise<void>;

  /**
   * Subscribe as admin to receive all updates
   */
  subscribeAsAdmin: () => Promise<void>;
}

/**
 * Hook to manage SignalR connection for real-time updates
 */
export function useSignalR(
  hubUrl: string,
  options: UseSignalROptions = {}
): UseSignalRReturn {
  const {
    autoConnect = true,
    autoReconnect = true,
    onConnected,
    onDisconnected,
    onReconnecting,
    onReconnected
  } = options;

  const { user } = useAuth();
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<HubConnectionState>(HubConnectionState.Disconnected);
  const isConnectedRef = useRef(false);
  const connectionRef = useRef<HubConnection | null>(null);

  // Build the SignalR connection
  useEffect(() => {
    if (!user) {
      logger.debug('SignalR: User not authenticated, skipping connection');
      return;
    }

    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      logger.debug('SignalR: No token available, skipping connection');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    // Remove /api prefix if present since backend maps hub directly to root
    const normalizedHubUrl = hubUrl.startsWith('/api/') ? hubUrl.replace('/api/', '/') : hubUrl;
    const fullHubUrl = `${apiUrl}${normalizedHubUrl}`;

    logger.info(`SignalR: Building connection to ${fullHubUrl}`);

    const newConnection = new HubConnectionBuilder()
      .withUrl(fullHubUrl, {
        accessTokenFactory: () => token,
        withCredentials: true,
      })
      .withAutomaticReconnect(autoReconnect ? {
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 10s, 30s, 60s, then 60s max
          const delays = [0, 2000, 10000, 30000, 60000];
          if (retryContext.previousRetryCount < delays.length) {
            return delays[retryContext.previousRetryCount];
          }
          return 60000; // Max 60 seconds between retries
        }
      } : undefined)
      .configureLogging(LogLevel.Warning) // Reduce log noise, only show warnings and errors
      .build();

    // Connection event handlers
    newConnection.onclose((error) => {
      logger.warn('SignalR: Connection closed', error);
      setConnectionState(HubConnectionState.Disconnected);
      isConnectedRef.current = false;
      onDisconnected?.(error);
    });

    newConnection.onreconnecting((error) => {
      logger.info('SignalR: Reconnecting...', error);
      setConnectionState(HubConnectionState.Reconnecting);
      isConnectedRef.current = false;
      onReconnecting?.(error);
    });

    newConnection.onreconnected((connectionId) => {
      logger.info('SignalR: Reconnected', { connectionId });
      setConnectionState(HubConnectionState.Connected);
      isConnectedRef.current = true;
      onReconnected?.(connectionId);
    });

    connectionRef.current = newConnection;
    setConnection(newConnection);

    return () => {
      // Cleanup: stop connection when component unmounts
      if (newConnection.state !== HubConnectionState.Disconnected) {
        logger.info('SignalR: Stopping connection (cleanup)');
        newConnection.stop().catch((err) => {
          logger.error('SignalR: Error stopping connection during cleanup', err);
        });
      }
    };
  }, [user, hubUrl, autoReconnect, onConnected, onDisconnected, onReconnecting, onReconnected]);

  // Auto-connect if enabled with retry logic
  useEffect(() => {
    if (!connection || !autoConnect) return;

    if (connection.state === HubConnectionState.Disconnected) {
      let retryCount = 0;
      const maxRetries = 5;
      const retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

      const attemptConnection = async () => {
        try {
          logger.info('SignalR: Auto-connecting...', { attempt: retryCount + 1 });
          await connection.start();
          logger.info('SignalR: Connected successfully', { connectionId: connection.connectionId });
          setConnectionState(HubConnectionState.Connected);
          isConnectedRef.current = true;
          onConnected?.();
          retryCount = 0; // Reset on success
        } catch (err: any) {
          retryCount++;
          const errorMessage = err?.message || String(err);
          
          // Check if it's a 404 (hub not found) or negotiation error
          if (errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('negotiate')) {
            logger.warn('SignalR: Hub endpoint not found (404). This may be temporary.', {
              hubUrl: connection.baseUrl,
              attempt: retryCount,
              maxRetries
            });
          } else {
            logger.error('SignalR: Connection failed', {
              error: errorMessage,
              attempt: retryCount,
              maxRetries
            });
          }

          setConnectionState(HubConnectionState.Disconnected);
          isConnectedRef.current = false;

          // Retry with exponential backoff if we haven't exceeded max retries
          if (retryCount < maxRetries) {
            const delay = retryDelays[Math.min(retryCount - 1, retryDelays.length - 1)];
            logger.info(`SignalR: Retrying connection in ${delay}ms...`);
            setTimeout(attemptConnection, delay);
          } else {
            logger.error('SignalR: Max retries exceeded. Connection will rely on automatic reconnect.');
            // Let automatic reconnect handle further attempts
          }
        }
      };

      attemptConnection();
    }
  }, [connection, autoConnect, onConnected]);

  // Manual connect function
  const connect = useCallback(async () => {
    if (!connection) {
      logger.warn('SignalR: Cannot connect, connection not initialized');
      return;
    }

    if (connection.state === HubConnectionState.Connected) {
      logger.debug('SignalR: Already connected');
      return;
    }

    try {
      logger.info('SignalR: Manually connecting...');
      await connection.start();
      logger.info('SignalR: Connected successfully', { connectionId: connection.connectionId });
      setConnectionState(HubConnectionState.Connected);
      isConnectedRef.current = true;
      onConnected?.();
    } catch (err) {
      logger.error('SignalR: Manual connection failed', err);
      setConnectionState(HubConnectionState.Disconnected);
      isConnectedRef.current = false;
      throw err;
    }
  }, [connection, onConnected]);

  // Manual disconnect function
  const disconnect = useCallback(async () => {
    if (!connection) {
      logger.warn('SignalR: Cannot disconnect, connection not initialized');
      return;
    }

    if (connection.state === HubConnectionState.Disconnected) {
      logger.debug('SignalR: Already disconnected');
      return;
    }

    try {
      logger.info('SignalR: Manually disconnecting...');
      await connection.stop();
      logger.info('SignalR: Disconnected successfully');
      setConnectionState(HubConnectionState.Disconnected);
      isConnectedRef.current = false;
    } catch (err) {
      logger.error('SignalR: Manual disconnection failed', err);
      throw err;
    }
  }, [connection]);

  // Subscribe to specific moderator
  const subscribeToModerator = useCallback(async (moderatorId: number) => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      logger.warn('SignalR: Cannot subscribe, not connected');
      throw new Error('SignalR connection not established');
    }

    try {
      logger.info(`SignalR: Subscribing to moderator ${moderatorId}`);
      await connection.invoke('SubscribeToModerator', moderatorId);
      logger.info(`SignalR: Successfully subscribed to moderator ${moderatorId}`);
    } catch (err) {
      logger.error(`SignalR: Failed to subscribe to moderator ${moderatorId}`, err);
      throw err;
    }
  }, [connection]);

  // Unsubscribe from specific moderator
  const unsubscribeFromModerator = useCallback(async (moderatorId: number) => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      logger.warn('SignalR: Cannot unsubscribe, not connected');
      return;
    }

    try {
      logger.info(`SignalR: Unsubscribing from moderator ${moderatorId}`);
      await connection.invoke('UnsubscribeFromModerator', moderatorId);
      logger.info(`SignalR: Successfully unsubscribed from moderator ${moderatorId}`);
    } catch (err) {
      logger.error(`SignalR: Failed to unsubscribe from moderator ${moderatorId}`, err);
      throw err;
    }
  }, [connection]);

  // Subscribe as admin
  const subscribeAsAdmin = useCallback(async () => {
    if (!connection || connection.state !== HubConnectionState.Connected) {
      logger.warn('SignalR: Cannot subscribe as admin, not connected');
      throw new Error('SignalR connection not established');
    }

    try {
      logger.info('SignalR: Subscribing as admin');
      await connection.invoke('SubscribeAsAdmin');
      logger.info('SignalR: Successfully subscribed as admin');
    } catch (err) {
      logger.error('SignalR: Failed to subscribe as admin', err);
      throw err;
    }
  }, [connection]);

  return {
    connection,
    connectionState,
    isConnected: connectionState === HubConnectionState.Connected,
    connect,
    disconnect,
    subscribeToModerator,
    unsubscribeFromModerator,
    subscribeAsAdmin,
  };
}
