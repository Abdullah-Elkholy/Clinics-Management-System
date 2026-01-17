'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuth } from './AuthContext';

interface SignalRContextType {
  connection: signalR.HubConnection | null;
  isConnected: boolean;
  error: string | null;
  
  // Event subscription helpers
  on: (eventName: string, callback: (...args: any[]) => void) => void;
  off: (eventName: string, callback: (...args: any[]) => void) => void;
  
  // Reconnection callbacks
  onReconnected: (callback: () => void) => void;
  offReconnected: (callback: () => void) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

// Set to track reconnection callbacks
const reconnectionHandlers = new Set<() => void>();

// Connection state management constants
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 5;
const CONNECTION_DEBOUNCE_MS = 1000; // 1 second debounce for connection attempts

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const { user, hasToken } = useAuth();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttemptRef = useRef<number>(0);
  const isConnectingRef = useRef<boolean>(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  // Track pending subscriptions made before connection is ready
  const pendingSubscriptionsRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  // SignalR hub is part of the main API (Clinics.Api) which runs on port 5000
  // Use NEXT_PUBLIC_API_URL which points to the main API endpoint
  // Memoize hubUrl to prevent unnecessary connection recreations
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const hubUrl = `${apiUrl}/dataUpdateHub`;
  const hubUrlRef = useRef(hubUrl);

  // Update ref if URL changes (shouldn't happen in production)
  if (hubUrlRef.current !== hubUrl) {
    hubUrlRef.current = hubUrl;
  }

  // Cleanup function to stop connection properly
  const cleanupConnection = useCallback(async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (connectionRef.current) {
      try {
        // Stop connection - handlers will be cleaned up automatically
        await connectionRef.current.stop();
      } catch (err) {
        console.error('Error stopping SignalR connection:', err);
      }
      connectionRef.current = null;
      setConnection(null);
      setIsConnected(false);
      isConnectingRef.current = false;
    }
  }, []);

  // Initialize SignalR connection when user is authenticated
  useEffect(() => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!hasToken || !token) {
      // No token - disconnect if connected
      cleanupConnection();
      lastTokenRef.current = null;
      return;
    }

    // Check if token changed - if same token and connection exists, don't recreate
    if (lastTokenRef.current === token && connectionRef.current) {
      const currentState = connectionRef.current.state;
      if (currentState === signalR.HubConnectionState.Connected || 
          currentState === signalR.HubConnectionState.Connecting ||
          currentState === signalR.HubConnectionState.Reconnecting) {
        // Connection exists with same token and is active - don't recreate
        return;
      }
    }

    // Update last token
    lastTokenRef.current = token;

    // Prevent creating duplicate connections
    if (isConnectingRef.current) {
      console.log('SignalR: Connection attempt already in progress, skipping...');
      return;
    }

    // Debounce connection attempts to prevent rapid recreations
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const startConnection = async () => {
        // Double-check connection state before creating new one
        if (connectionRef.current && 
            connectionRef.current.state !== signalR.HubConnectionState.Disconnected &&
            connectionRef.current.state !== signalR.HubConnectionState.Disconnecting) {
          console.log('SignalR: Connection already exists and is active, skipping creation');
          isConnectingRef.current = false;
          return;
        }

        // Cleanup existing connection if any
        if (connectionRef.current) {
          await cleanupConnection();
        }

        isConnectingRef.current = true;
        connectionAttemptRef.current += 1;

        // Create new connection with JWT token for authentication
        const newConnection = new signalR.HubConnectionBuilder()
          .withUrl(hubUrlRef.current, {
            accessTokenFactory: () => {
              const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
              return currentToken || '';
            },
            // Use only LongPolling to avoid WebSocket/SSE fallback errors
            transport: signalR.HttpTransportType.LongPolling,
            skipNegotiation: false,
          })
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              // Exponential backoff: 0s, 2s, 10s, 30s, then 60s
              if (retryContext.previousRetryCount === 0) return 0;
              if (retryContext.previousRetryCount === 1) return 2000;
              if (retryContext.previousRetryCount === 2) return 10000;
              if (retryContext.previousRetryCount === 3) return 30000;
              return 60000; // Max 60s between retries
            }
          })
          .configureLogging(signalR.LogLevel.Error) // Only log actual errors
          .build();

        // Connection event handlers
        newConnection.onclose((error) => {
          console.log('SignalR connection closed', error ? error.message : 'No error');
          setIsConnected(false);
          isConnectingRef.current = false;
          if (error) {
            setError(error.message || 'Connection closed with error');
            // Only retry if we haven't exceeded max attempts and token still exists
            if (connectionAttemptRef.current < MAX_RETRY_ATTEMPTS) {
              const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
              if (currentToken) {
                reconnectTimeoutRef.current = setTimeout(() => {
                  console.log(`SignalR: Retrying connection (attempt ${connectionAttemptRef.current + 1}/${MAX_RETRY_ATTEMPTS})...`);
                  startConnection();
                }, CONNECTION_RETRY_DELAY);
              }
            } else {
              console.warn('SignalR: Max retry attempts reached, stopping retries');
              setError('Connection failed after multiple attempts');
            }
          } else {
            setError(null);
          }
        });

        newConnection.onreconnecting((error) => {
          console.log('SignalR reconnecting...', error ? error.message : '');
          setIsConnected(false);
          setError('Reconnecting...');
        });

        newConnection.onreconnected((connectionId) => {
          console.log('SignalR reconnected', connectionId);
          setIsConnected(true);
          setError(null);
          connectionAttemptRef.current = 0; // Reset retry counter on successful reconnect
          
          // Trigger all reconnection callbacks
          console.log(`SignalR: Triggering ${reconnectionHandlers.size} reconnection handlers`);
          reconnectionHandlers.forEach(handler => {
            try {
              handler();
            } catch (err) {
              console.error('SignalR: Error in reconnection handler:', err);
            }
          });
        });

        // Start connection
        try {
          await newConnection.start();
          console.log('SignalR connected successfully');
          setIsConnected(true);
          setError(null);
          connectionAttemptRef.current = 0; // Reset retry counter on successful connection
          connectionRef.current = newConnection;
          setConnection(newConnection);
          isConnectingRef.current = false;
        } catch (err: any) {
          console.error('Error starting SignalR connection:', err);
          setError(err.message || 'Failed to connect');
          setIsConnected(false);
          isConnectingRef.current = false;
          
          // Only retry if we haven't exceeded max attempts
          if (connectionAttemptRef.current < MAX_RETRY_ATTEMPTS) {
            const retryToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (retryToken) {
              reconnectTimeoutRef.current = setTimeout(() => {
                console.log(`SignalR: Retrying connection (attempt ${connectionAttemptRef.current + 1}/${MAX_RETRY_ATTEMPTS})...`);
                startConnection();
              }, CONNECTION_RETRY_DELAY);
            }
          } else {
            console.warn('SignalR: Max retry attempts reached, stopping retries');
            setError('Connection failed after multiple attempts');
          }
        }
      };

      startConnection();
    }, CONNECTION_DEBOUNCE_MS);

    // Cleanup on unmount or token change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      // Don't cleanup connection here if token is still valid - let it stay connected
      // Only cleanup if component is unmounting (which will happen when hasToken becomes false)
    };
  }, [hasToken, cleanupConnection]); // Added cleanupConnection to dependencies

  // Apply any pending subscriptions when connection becomes ready
  useEffect(() => {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
      const pending = pendingSubscriptionsRef.current;
      if (pending.size > 0) {
        // Apply pending subscriptions silently
        pending.forEach((callbacks, eventName) => {
          callbacks.forEach(callback => {
            connection.on(eventName, callback);
          });
        });
        // Clear pending after applying
        pendingSubscriptionsRef.current = new Map();
      }
    }
  }, [connection, isConnected]);

  // Event subscription helper - queues if not connected
  const on = useCallback((eventName: string, callback: (...args: any[]) => void) => {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
      connection.on(eventName, callback);
    } else {
      // Queue subscription for when connection becomes ready
      const pending = pendingSubscriptionsRef.current;
      if (!pending.has(eventName)) {
        pending.set(eventName, new Set());
      }
      pending.get(eventName)!.add(callback);
      // Subscription queued silently - will be applied when connected
    }
  }, [connection]);

  // Event unsubscription helper - also removes from pending queue
  const off = useCallback((eventName: string, callback: (...args: any[]) => void) => {
    // Remove from pending queue if present
    const pending = pendingSubscriptionsRef.current;
    if (pending.has(eventName)) {
      pending.get(eventName)!.delete(callback);
      if (pending.get(eventName)!.size === 0) {
        pending.delete(eventName);
      }
    }
    // Remove from active connection
    if (connection) {
      connection.off(eventName, callback);
    }
  }, [connection]);

  // Reconnection callback registration
  const onReconnected = useCallback((callback: () => void) => {
    reconnectionHandlers.add(callback);
  }, []);

  // Reconnection callback unregistration
  const offReconnected = useCallback((callback: () => void) => {
    reconnectionHandlers.delete(callback);
  }, []);

  const value: SignalRContextType = {
    connection,
    isConnected,
    error,
    on,
    off,
    onReconnected,
    offReconnected,
  };

  return (
    <SignalRContext.Provider value={value}>
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalR() {
  const context = useContext(SignalRContext);
  if (context === undefined) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
}
