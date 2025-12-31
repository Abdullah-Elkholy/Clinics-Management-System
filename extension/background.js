// Import SignalR library for service worker
try {
  importScripts('signalr.min.js');
} catch (e) {
  console.warn('[Extension] SignalR import failed, will use polling fallback:', e);
}

// Extension configuration
const CONFIG = {
  // API base URL - will be configured via options page
  apiBaseUrl: '',
  
  // SignalR hub URL
  extensionHubUrl: '/extensionHub',
  
  // Heartbeat interval (ms)
  heartbeatInterval: 30000, // 30 seconds
  
  // Command poll interval when SignalR disconnected (ms)
  pollInterval: 5000, // 5 seconds
  
  // Reconnect delay (ms)
  reconnectDelay: 3000,
  
  // Max reconnect attempts
  maxReconnectAttempts: 10
};

// State
let state = {
  deviceToken: null,
  leaseToken: null,
  leaseId: null, // Store lease ID for heartbeat
  moderatorId: null,
  isConnected: false,
  whatsAppStatus: 'unknown', // unknown, qr_pending, connected, disconnected
  hubConnection: null,
  heartbeatTimer: null,
  pollTimer: null,
  reconnectAttempts: 0,
  currentUrl: null
};

// Load configuration from storage
async function loadConfig() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'deviceToken', 'moderatorId', 'leaseToken', 'isConnected', 'leaseId']);
  if (stored.apiBaseUrl) {
    CONFIG.apiBaseUrl = stored.apiBaseUrl;
  }
  if (stored.deviceToken) {
    state.deviceToken = stored.deviceToken;
  }
  if (stored.moderatorId) {
    state.moderatorId = stored.moderatorId;
  }
  // Restore lease state (critical for service worker restart reliability)
  if (stored.leaseToken) {
    state.leaseToken = stored.leaseToken;
  }
  if (stored.leaseId) {
    state.leaseId = stored.leaseId;
  }
  if (stored.isConnected) {
    state.isConnected = stored.isConnected;
  }
  console.log('[Extension] Config loaded:', { apiBaseUrl: CONFIG.apiBaseUrl, hasToken: !!state.deviceToken, isConnected: state.isConnected, hasLease: !!state.leaseToken });
  
  // If we were connected, restart heartbeat
  if (state.isConnected && state.leaseToken) {
    console.log('[Extension] Resuming session after service worker restart');
    startHeartbeat();
  }
}

// Save device token
async function saveDeviceToken(token, moderatorId) {
  state.deviceToken = token;
  state.moderatorId = moderatorId;
  await chrome.storage.local.set({ deviceToken: token, moderatorId: moderatorId });
  console.log('[Extension] Device token saved');
}

// Clear device token
async function clearDeviceToken() {
  state.deviceToken = null;
  state.leaseToken = null;
  state.moderatorId = null;
  await chrome.storage.local.remove(['deviceToken', 'moderatorId']);
  console.log('[Extension] Device token cleared');
}

// API call helper
async function apiCall(endpoint, method = 'GET', body = null) {
  if (!CONFIG.apiBaseUrl) {
    throw new Error('API URL not configured');
  }
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (state.deviceToken) {
    headers['X-Extension-Token'] = state.deviceToken;
  }
  
  if (state.leaseToken) {
    headers['X-Lease-Token'] = state.leaseToken;
  }
  
  const options = {
    method,
    headers,
    credentials: 'include'
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${CONFIG.apiBaseUrl}${endpoint}`, options);
  
  if (!response.ok) {
    let errorMessage = `API error ${response.status}`;
    try {
      const errorText = await response.text();
      // Try to parse as JSON to get the error field
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorText || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
    } catch {
      // Ignore parse errors
    }
    throw new Error(errorMessage);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Complete pairing with code
async function completePairing(code) {
  try {
    const deviceId = await getOrCreateDeviceId();
    const result = await apiCall('/api/extension/pairing/complete', 'POST', {
      code: code,
      deviceId: deviceId,
      deviceName: navigator.userAgent.substring(0, 100),
      extensionVersion: chrome.runtime.getManifest().version,
      userAgent: navigator.userAgent
    });
    
    // Backend returns: { deviceId, moderatorUserId, deviceToken, tokenExpiresAt }
    // Check if we got a valid token back
    console.log('[Extension] Pairing API response:', JSON.stringify(result));
    if (result && result.deviceToken) {
      await saveDeviceToken(result.deviceToken, result.moderatorUserId);
      console.log('[Extension] Pairing successful for moderator:', result.moderatorUserId);
      console.log('[Extension] Device token saved, state.deviceToken is now:', state.deviceToken ? 'set' : 'null');
      // Broadcast the updated state to the popup
      broadcastState();
      return { success: true, moderatorId: result.moderatorUserId };
    } else if (result && result.error) {
      console.log('[Extension] Pairing returned error:', result.error);
      return { success: false, error: result.error };
    } else {
      console.log('[Extension] Unexpected pairing response - no deviceToken');
      return { success: false, error: 'Unexpected response from server' };
    }
  } catch (error) {
    console.error('[Extension] Pairing error:', error);
    return { success: false, error: error.message };
  }
}

// Get or create a unique device ID
async function getOrCreateDeviceId() {
  const stored = await chrome.storage.local.get(['deviceId']);
  if (stored.deviceId) {
    return stored.deviceId;
  }
  
  // Generate a new device ID
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId });
  return deviceId;
}

// Acquire session lease
async function acquireLease(forceTakeover = false) {
  try {
    // Need device token to acquire lease
    if (!state.deviceToken) {
      return { success: false, error: 'Device not paired' };
    }
    
    const deviceId = await getOrCreateDeviceId();
    const result = await apiCall('/api/extension/lease/acquire', 'POST', {
      deviceId: deviceId,
      deviceToken: state.deviceToken,
      forceTakeover: forceTakeover
    });
    
    // Backend returns: { leaseId, leaseToken, moderatorUserId, expiresAt }
    if (result && result.leaseToken) {
      state.leaseToken = result.leaseToken;
      state.leaseId = result.leaseId;
      state.isConnected = true;
      state.reconnectAttempts = 0;
      
      // CRITICAL: Persist lease state to survive service worker restart
      await chrome.storage.local.set({ 
        leaseToken: result.leaseToken, 
        leaseId: result.leaseId,
        isConnected: true 
      });
      
      console.log('[Extension] Lease acquired successfully, state persisted');
      startHeartbeat();
      await connectSignalR();
      broadcastState();
      return { success: true };
    } else if (result && result.error) {
      // Handle specific error for existing session
      return { 
        success: false, 
        error: result.error, 
        existingDevice: result.existingDeviceName 
      };
    } else {
      return { success: false, error: 'Failed to acquire lease' };
    }
  } catch (error) {
    console.error('[Extension] Lease acquire error:', error);
    // Check if error message contains info about existing session
    const errorMsg = error.message || '';
    if (errorMsg.includes('session') || errorMsg.includes('جلسة')) {
      return { success: false, error: errorMsg, existingDevice: 'another device' };
    }
    return { success: false, error: error.message };
  }
}

// Release session lease
async function releaseLease() {
  try {
    stopHeartbeat();
    disconnectSignalR();
    
    if (state.leaseToken && state.leaseId) {
      await apiCall('/api/extension/lease/release', 'POST', {
        leaseId: state.leaseId,
        leaseToken: state.leaseToken,
        reason: 'UserDisconnected'
      });
    }
    
    state.leaseToken = null;
    state.leaseId = null;
    state.isConnected = false;
    
    // Clear persisted lease state
    await chrome.storage.local.remove(['leaseToken', 'leaseId', 'isConnected']);
    
    broadcastState();
    return { success: true };
  } catch (error) {
    console.error('[Extension] Lease release error:', error);
    return { success: false, error: error.message };
  }
}

// Start heartbeat
function startHeartbeat() {
  stopHeartbeat();
  
  // Send immediate heartbeat
  sendHeartbeat();
  
  state.heartbeatTimer = setInterval(async () => {
    await sendHeartbeat();
  }, CONFIG.heartbeatInterval);
}

// Send a single heartbeat
async function sendHeartbeat() {
  try {
    if (!state.leaseId || !state.leaseToken) {
      console.warn('[Extension] Cannot send heartbeat: no lease');
      return;
    }
    
    console.log('[Extension] Sending heartbeat with status:', state.whatsAppStatus);
    
    await apiCall('/api/extension/lease/heartbeat', 'POST', {
      leaseId: state.leaseId,
      leaseToken: state.leaseToken,
      currentUrl: state.currentUrl,
      whatsAppStatus: state.whatsAppStatus
    });
    console.log('[Extension] Heartbeat sent successfully');
  } catch (error) {
    console.error('[Extension] Heartbeat failed:', error);
    // If heartbeat fails with lease error, mark as disconnected
    if (error.message?.includes('Lease') || error.message?.includes('lease') || error.message?.includes('expired')) {
      handleDisconnect();
    }
  }
}

// Stop heartbeat
function stopHeartbeat() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

// SignalR connection (using @microsoft/signalr)
async function connectSignalR() {
  // Check if SignalR library is available
  if (typeof signalR === 'undefined') {
    console.warn('[Extension] SignalR library not available, using polling fallback');
    startPolling();
    return;
  }

  try {
    const hubUrl = `${CONFIG.apiBaseUrl}${CONFIG.extensionHubUrl}`;
    console.log('[Extension] Connecting to SignalR hub:', hubUrl);

    state.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => state.deviceToken
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Handle incoming commands
    state.hubConnection.on('ExecuteCommand', async (command) => {
      console.log('[Extension] Received command via SignalR:', command.commandType);
      await processCommand(command);
    });

    // Handle session invalidation
    state.hubConnection.on('SessionInvalidated', async (reason) => {
      console.log('[Extension] Session invalidated:', reason);
      state.leaseToken = null;
      state.isConnected = false;
      broadcastState();
    });

    // Handle reconnection
    state.hubConnection.onreconnecting((error) => {
      console.log('[Extension] SignalR reconnecting...', error);
      state.reconnectAttempts++;
    });

    state.hubConnection.onreconnected(async (connectionId) => {
      console.log('[Extension] SignalR reconnected:', connectionId);
      state.reconnectAttempts = 0;
      // Re-register with the hub
      await registerWithHub();
    });

    state.hubConnection.onclose(async (error) => {
      console.log('[Extension] SignalR connection closed:', error);
      // Fall back to polling if connection lost
      startPolling();
    });

    await state.hubConnection.start();
    console.log('[Extension] SignalR connected');

    // Register with the hub
    await registerWithHub();

    // Stop polling since we have SignalR
    stopPolling();

  } catch (error) {
    console.error('[Extension] SignalR connection failed:', error);
    // Fall back to polling
    startPolling();
  }
}

// Register extension with the SignalR hub
async function registerWithHub() {
  if (!state.hubConnection || state.hubConnection.state !== signalR.HubConnectionState.Connected) {
    return;
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const leaseInfo = await apiCall('/api/extension/lease/status', 'GET');
    
    if (leaseInfo && leaseInfo.leaseId) {
      const result = await state.hubConnection.invoke('Register', 
        leaseInfo.leaseId, 
        state.leaseToken,
        state.moderatorId,
        deviceId
      );
      
      if (result.success) {
        console.log('[Extension] Registered with hub, pending commands:', result.pendingCommands?.length || 0);
        // Process any pending commands
        if (result.pendingCommands) {
          for (const cmd of result.pendingCommands) {
            await processCommand(cmd);
          }
        }
      } else {
        console.error('[Extension] Hub registration failed:', result.error);
      }
    }
  } catch (error) {
    console.error('[Extension] Hub registration error:', error);
  }
}

function disconnectSignalR() {
  if (state.hubConnection) {
    state.hubConnection.stop();
    state.hubConnection = null;
  }
  stopPolling();
}

// Polling fallback for commands
function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(async () => {
    if (!state.isConnected) return;
    
    try {
      const commands = await apiCall('/api/extension/commands/pending', 'GET');
      if (commands && commands.length > 0) {
        for (const cmd of commands) {
          await processCommand(cmd);
        }
      }
    } catch (error) {
      console.error('[Extension] Poll error:', error);
    }
  }, CONFIG.pollInterval);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

// Process a command from the server
async function processCommand(command) {
  console.log('[Extension] Processing command:', command.commandType, command.id);
  
  try {
    // Acknowledge receipt
    await apiCall(`/api/extension/commands/${command.id}/ack`, 'POST');
    
    // Send to content script for execution
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length === 0) {
      throw new Error('WhatsApp tab not found');
    }
    
    const result = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'EXECUTE_COMMAND',
      command: command
    });
    
    // Report result
    if (result.success) {
      await apiCall(`/api/extension/commands/${command.id}/complete`, 'POST', {
        success: true,
        result: result.data
      });
    } else {
      await apiCall(`/api/extension/commands/${command.id}/complete`, 'POST', {
        success: false,
        error: result.error,
        category: result.category || 'unknown'
      });
    }
  } catch (error) {
    console.error('[Extension] Command execution error:', error);
    await apiCall(`/api/extension/commands/${command.id}/complete`, 'POST', {
      success: false,
      error: error.message,
      category: 'extension_error'
    });
  }
}

// Handle disconnect
async function handleDisconnect() {
  state.isConnected = false;
  state.leaseToken = null;
  state.leaseId = null;
  stopHeartbeat();
  stopPolling();
  
  // Clear persisted lease state
  await chrome.storage.local.remove(['leaseToken', 'leaseId', 'isConnected']);
  
  broadcastState();
  
  // Attempt reconnect if we have a device token
  if (state.deviceToken && state.reconnectAttempts < CONFIG.maxReconnectAttempts) {
    state.reconnectAttempts++;
    console.log(`[Extension] Attempting reconnect ${state.reconnectAttempts}/${CONFIG.maxReconnectAttempts}`);
    setTimeout(() => {
      acquireLease();
    }, CONFIG.reconnectDelay * state.reconnectAttempts);
  }
}

// Broadcast state to popup and content script
function broadcastState() {
  const stateMsg = {
    type: 'STATE_UPDATE',
    state: {
      isPaired: !!state.deviceToken,
      isConnected: state.isConnected,
      moderatorId: state.moderatorId,
      whatsAppStatus: state.whatsAppStatus
    }
  };
  
  // Send to popup
  chrome.runtime.sendMessage(stateMsg).catch(() => {});
  
  // Send to content script
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, stateMsg).catch(() => {});
    });
  });
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Extension] Message received:', message.type);
  
  (async () => {
    try {
      switch (message.type) {
        case 'GET_STATE':
          sendResponse({
            isPaired: !!state.deviceToken,
            isConnected: state.isConnected,
            moderatorId: state.moderatorId,
            whatsAppStatus: state.whatsAppStatus,
            apiBaseUrl: CONFIG.apiBaseUrl
          });
          break;
          
        case 'SET_API_URL':
          CONFIG.apiBaseUrl = message.url;
          await chrome.storage.local.set({ apiBaseUrl: message.url });
          sendResponse({ success: true });
          break;
          
        case 'COMPLETE_PAIRING':
          const pairingResult = await completePairing(message.code);
          sendResponse(pairingResult);
          break;
          
        case 'ACQUIRE_LEASE':
          const leaseResult = await acquireLease(message.forceTakeover);
          sendResponse(leaseResult);
          break;
          
        case 'RELEASE_LEASE':
          const releaseResult = await releaseLease();
          sendResponse(releaseResult);
          break;
          
        case 'UNPAIR':
          await releaseLease();
          await clearDeviceToken();
          sendResponse({ success: true });
          break;
          
        case 'WHATSAPP_STATUS':
          state.whatsAppStatus = message.status;
          state.currentUrl = message.url;
          console.log('[Extension] WhatsApp status updated:', message.status);
          broadcastState();
          // Report to server immediately (also update heartbeat)
          if (state.isConnected && state.leaseId && state.leaseToken) {
            sendHeartbeat().catch(console.error);
          }
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Extension] Message handler error:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  return true; // Keep channel open for async response
});

// Initialize on startup
loadConfig().then(() => {
  console.log('[Extension] Background script initialized');
  
  // If we have a device token, try to acquire lease
  if (state.deviceToken) {
    acquireLease().catch(console.error);
  }
});

// Listen for tab updates to detect WhatsApp
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('https://web.whatsapp.com')) {
    console.log('[Extension] WhatsApp tab detected:', tabId);
    // Content script will report status
  }
});
