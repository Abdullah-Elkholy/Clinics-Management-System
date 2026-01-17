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
  backendDeviceId: null, // UUID from backend (ExtensionDevice.Id)
  leaseToken: null,
  leaseId: null, // Store lease ID for heartbeat
  moderatorId: null,
  moderatorUsername: null,
  moderatorName: null,
  isConnected: false,
  whatsAppStatus: 'unknown', // unknown, qr_pending, connected, disconnected
  hubConnection: null,
  heartbeatTimer: null,
  pollTimer: null,
  reconnectAttempts: 0,
  currentUrl: null,
  // Command queue for sequential processing
  commandQueue: [],
  isProcessingCommand: false,
  // Track processed command IDs to prevent duplicates
  processedCommandIds: new Set()
};

// Load configuration from storage
async function loadConfig() {
  const stored = await chrome.storage.local.get(['apiBaseUrl', 'deviceToken', 'backendDeviceId', 'moderatorId', 'moderatorUsername', 'moderatorName', 'leaseToken', 'isConnected', 'leaseId']);
  if (stored.apiBaseUrl) {
    CONFIG.apiBaseUrl = stored.apiBaseUrl;
  }
  if (stored.deviceToken) {
    state.deviceToken = stored.deviceToken;
  }
  if (stored.backendDeviceId) {
    state.backendDeviceId = stored.backendDeviceId;
  }
  if (stored.moderatorId) {
    state.moderatorId = stored.moderatorId;
  }
  if (stored.moderatorUsername) {
    state.moderatorUsername = stored.moderatorUsername;
  }
  if (stored.moderatorName) {
    state.moderatorName = stored.moderatorName;
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
async function saveDeviceToken(token, backendDeviceId, moderatorId, moderatorUsername, moderatorName) {
  state.deviceToken = token;
  state.backendDeviceId = backendDeviceId;
  state.moderatorId = moderatorId;
  state.moderatorUsername = moderatorUsername || null;
  state.moderatorName = moderatorName || null;
  await chrome.storage.local.set({
    deviceToken: token,
    backendDeviceId: backendDeviceId,
    moderatorId: moderatorId,
    moderatorUsername: moderatorUsername || null,
    moderatorName: moderatorName || null
  });
  console.log('[Extension] Device token saved');
}

// Clear device token
async function clearDeviceToken() {
  state.deviceToken = null;
  state.backendDeviceId = null;
  state.leaseToken = null;
  state.moderatorId = null;
  state.moderatorUsername = null;
  state.moderatorName = null;
  await chrome.storage.local.remove(['deviceToken', 'backendDeviceId', 'moderatorId', 'moderatorUsername', 'moderatorName']);
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

    // Check for invalid/revoked device token - auto-unpair
    const isInvalidToken = response.status === 401 || response.status === 403 ||
      errorMessage.toLowerCase().includes('invalid device token') ||
      errorMessage.toLowerCase().includes('device not found') ||
      errorMessage.toLowerCase().includes('device revoked') ||
      errorMessage.toLowerCase().includes('token expired') ||
      errorMessage.includes('الجهاز غير موجود') ||
      errorMessage.includes('رمز غير صالح');

    if (isInvalidToken && state.deviceToken) {
      console.warn('[Extension] Device token is invalid or revoked. Auto-clearing for re-pairing.');
      await clearDeviceToken();
      // Also clear any active lease
      state.leaseToken = null;
      state.leaseId = null;
      state.isConnected = false;
      await chrome.storage.local.remove(['leaseToken', 'leaseId', 'isConnected']);
      stopHeartbeat();
      disconnectSignalR();
      broadcastState();
      throw new Error('DEVICE_REVOKED');
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

    // Backend returns: { deviceId, moderatorUserId, moderatorUsername, moderatorName, deviceToken, tokenExpiresAt }
    // Check if we got a valid token back
    console.log('[Extension] Pairing API response:', JSON.stringify(result));
    if (result && result.deviceToken) {
      await saveDeviceToken(result.deviceToken, result.deviceId, result.moderatorUserId, result.moderatorUsername, result.moderatorName);
      console.log('[Extension] Pairing successful for moderator:', result.moderatorUserId, result.moderatorUsername);
      console.log('[Extension] Device token saved, state.deviceToken is now:', state.deviceToken ? 'set' : 'null');
      // Broadcast the updated state to the popup
      broadcastState();
      return { success: true, moderatorId: result.moderatorUserId, moderatorUsername: result.moderatorUsername, moderatorName: result.moderatorName };
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
    // Need device token AND backend device ID to acquire lease
    if (!state.deviceToken) {
      return { success: false, error: 'Device not paired' };
    }

    // CRITICAL FIX: Use backendDeviceId (returned from pairing), not local getOrCreateDeviceId()
    // The backend validates the token against the device ID it issued
    if (!state.backendDeviceId) {
      console.error('[Extension] backendDeviceId is missing - pairing may be incomplete');
      return { success: false, error: 'Device pairing incomplete - missing device ID' };
    }

    const deviceId = state.backendDeviceId;
    console.log('[Extension] Acquiring lease with backendDeviceId:', deviceId);

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

    // Check if device was revoked - return special flag for UI
    if (error.message === 'DEVICE_REVOKED') {
      return { success: false, error: 'تم إلغاء إقران الجهاز. يرجى إعادة الإقران.', deviceRevoked: true };
    }

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

    // Clear command queue immediately to stop any pending commands
    const queueLength = state.commandQueue.length;
    state.commandQueue = [];
    state.isProcessingCommand = false;

    // Clear processed command IDs for fresh start on next session
    state.processedCommandIds.clear();

    if (queueLength > 0) {
      console.log('[Extension] Cleared command queue on lease release, discarded:', queueLength, 'commands');
    }

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

    // If device was revoked, the apiCall already handled cleanup
    if (error.message === 'DEVICE_REVOKED') {
      console.log('[Extension] Device revoked during heartbeat, state already cleared');
      return;
    }

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

    // Handle incoming commands - queue them for sequential processing
    state.hubConnection.on('ExecuteCommand', async (command) => {
      console.log('[Extension] Received command via SignalR:', command.commandType);
      queueCommand(command);
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
    // Use already acquired lease state instead of calling API (which requires web auth)
    if (!state.leaseId || !state.leaseToken || !state.moderatorId) {
      console.log('[Extension] Cannot register with hub - no active lease');
      return;
    }

    const deviceId = await getOrCreateDeviceId();

    const result = await state.hubConnection.invoke('Register',
      state.leaseId,
      state.leaseToken,
      state.moderatorId,
      deviceId
    );

    if (result.success) {
      console.log('[Extension] Registered with hub, pending commands:', result.pendingCommands?.length || 0);
      // Queue any pending commands for sequential processing
      if (result.pendingCommands) {
        for (const cmd of result.pendingCommands) {
          queueCommand(cmd);
        }
      }
    } else {
      console.error('[Extension] Hub registration failed:', result.error);
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

// Queue a command for sequential processing
function queueCommand(command) {
  const cmdId = command.commandId || command.id;

  // Don't queue if no active lease
  if (!state.leaseId || !state.leaseToken) {
    console.log('[Extension] Ignoring command - no active lease:', cmdId);
    return;
  }

  // Check if command was already processed (prevent duplicates)
  if (state.processedCommandIds.has(cmdId)) {
    console.log('[Extension] Ignoring duplicate command (already processed):', cmdId);
    return;
  }

  // Check if command is already in queue
  if (state.commandQueue.some(c => (c.commandId || c.id) === cmdId)) {
    console.log('[Extension] Ignoring duplicate command (already in queue):', cmdId);
    return;
  }

  state.commandQueue.push(command);
  console.log('[Extension] Command queued, queue length:', state.commandQueue.length);
  processNextCommand();
}

// Process commands sequentially from queue
async function processNextCommand() {
  // If already processing or queue empty, return
  if (state.isProcessingCommand || state.commandQueue.length === 0) {
    return;
  }

  // Check if lease is still active - if not, clear queue
  if (!state.leaseId || !state.leaseToken) {
    console.log('[Extension] Clearing queue - no active lease. Discarding:', state.commandQueue.length, 'commands');
    state.commandQueue = [];
    return;
  }

  // Check if WhatsApp is ready
  if (state.whatsAppStatus !== 'connected') {
    console.log('[Extension] Waiting for WhatsApp to be connected. Current status:', state.whatsAppStatus);
    // Don't process yet, will retry when status changes
    return;
  }

  state.isProcessingCommand = true;
  const command = state.commandQueue.shift();

  try {
    await processCommand(command);
  } finally {
    state.isProcessingCommand = false;
    // Process next command after a delay to avoid overwhelming WhatsApp
    if (state.commandQueue.length > 0) {
      setTimeout(() => processNextCommand(), 200); // 200ms delay between commands (Reduced from 2000)
    }
  }
}

// Process a command from the server
async function processCommand(command) {
  const cmdId = command.commandId || command.id; // Support both formats
  console.log('[Extension] Processing command:', command.commandType, cmdId);

  // Double-check for duplicates (in case of race condition)
  if (state.processedCommandIds.has(cmdId)) {
    console.log('[Extension] Skipping duplicate command in processCommand:', cmdId);
    return;
  }

  // Mark as processed immediately to prevent re-processing
  state.processedCommandIds.add(cmdId);

  // Clean up old processed IDs to prevent memory leak (keep last 100)
  if (state.processedCommandIds.size > 100) {
    const idsArray = Array.from(state.processedCommandIds);
    state.processedCommandIds = new Set(idsArray.slice(-50));
  }

  // Validate state before processing
  if (!state.leaseId || !state.leaseToken) {
    console.error('[Extension] Cannot process command - no active lease. leaseId:', state.leaseId, 'leaseToken:', !!state.leaseToken);
    return;
  }

  // Auth payload required for all command API calls
  const authPayload = {
    leaseId: state.leaseId,
    leaseToken: state.leaseToken
  };

  console.log('[Extension] Command auth - leaseId:', state.leaseId);

  try {
    // Check if WhatsApp tab exists
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length === 0) {
      throw new Error('WhatsApp tab not found - please open web.whatsapp.com');
    }

    const tab = tabs[0];

    // Acknowledge receipt first
    await apiCall(`/api/extension/commands/${cmdId}/ack`, 'POST', authPayload);
    console.log('[Extension] Command acknowledged:', cmdId);

    let result;

    // Special handling for SendMessage - use two-phase approach
    if (command.commandType === 'SendMessage') {
      result = await handleSendMessage(tab, command, authPayload);
    } else if (command.commandType === 'CheckWhatsAppNumber') {
      result = await handleCheckNumber(tab, command, authPayload);
    } else {
      // For other commands, use simple content script execution
      result = await executeSimpleCommand(tab, command);
    }

    console.log('[Extension] Command result:', result);

    // Report result
    if (result && result.success) {
      await apiCall(`/api/extension/commands/${cmdId}/complete`, 'POST', {
        ...authPayload,
        resultStatus: 'success',
        resultData: result.data
      });
      console.log('[Extension] Command completed successfully:', cmdId);
    } else {
      await apiCall(`/api/extension/commands/${cmdId}/complete`, 'POST', {
        ...authPayload,
        resultStatus: 'failed',
        resultData: { error: result?.error || 'Unknown error', category: result?.category || 'unknown' }
      });
      console.log('[Extension] Command failed:', cmdId, result?.error);
    }
  } catch (error) {
    console.error('[Extension] Command execution error:', error);
    try {
      await apiCall(`/api/extension/commands/${cmdId}/complete`, 'POST', {
        ...authPayload,
        resultStatus: 'failed',
        resultData: { error: error.message, category: 'extension_error' }
      });
    } catch (completeError) {
      console.error('[Extension] Failed to report command completion:', completeError);
    }
  }
}

// Execute a simple command through content script (non-navigation)
async function executeSimpleCommand(tab, command) {
  // Ensure content script is injected and ready
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
  } catch (pingError) {
    console.log('[Extension] Content script not ready yet, waiting...');
    // Don't inject manually, rely on manifest. Just wait a bit.
    await new Promise(r => setTimeout(r, 1000));
    await new Promise(r => setTimeout(r, 1000));
  }

  // Send command with timeout
  return await Promise.race([
    chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_COMMAND',
      command: command
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Content script timeout - 60 seconds')), 60000)
    )
  ]);
}

// Handle CheckWhatsAppNumber with two-phase approach
async function handleCheckNumber(tab, command, authPayload) {
  console.log('[Extension] handleCheckNumber - starting two-phase approach');

  // Parse payload
  let payload = command.payload;
  if (typeof payload === 'string') {
    payload = JSON.parse(payload);
  }

  const phoneNumber = payload.phoneNumber || payload.phone;
  // Prioritize E164 format if available (provided by backend)
  const e164Phone = payload.e164Phone || payload.E164Phone;
  const countryCode = payload.countryCode || '';

  // Get session ID for logging
  const sessionId = payload.sessionId;

  if (!phoneNumber) {
    throw new Error('Phone number not provided in payload');
  }

  // Determine the best number to use for navigation
  let cleanNumber;

  if (e164Phone) {
    console.log('[Extension] Using E164 phone from payload:', e164Phone);
    cleanNumber = e164Phone.replace(/[^\d]/g, '');
  } else {
    // Fallback to manual construction
    cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

    // If phone doesn't start with country code digits and we have a country code, prepend it
    // (Logic matched with handleSendMessage)
    if (countryCode && !cleanNumber.startsWith(countryCode.replace('+', ''))) {
      cleanNumber = countryCode.replace('+', '') + cleanNumber.replace(/^0+/, '');
      console.log('[Extension] Applied country code correction. Result:', cleanNumber);
    }
  }

  const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;

  console.log('[Extension] Phase 1 - Navigating to chat URL:', chatUrl);

  // Check if we are already on the correct URL to avoid reload
  if (tab.url === chatUrl) {
    console.log('[Extension] Already on correct URL, skipping navigation');
  } else {
    // Navigate to the chat URL
    await chrome.tabs.update(tab.id, { url: chatUrl });

    // Wait for the tab to complete loading
    await waitForTabComplete(tab.id, 30000);
    console.log('[Extension] Tab loaded after navigation');

    // Wait additional time for WhatsApp to initialize
    await new Promise(r => setTimeout(r, 2000));
  }

  // Content script is loaded by manifest.json, so we don't need to inject it again manually
  console.log('[Extension] Waiting for content script to be ready (loaded by manifest)...');

  // Wait for content script to initialize
  await new Promise(r => setTimeout(r, 1000));

  // Phase 2: Check status without navigation
  console.log('[Extension] Phase 2 - Checking status...');

  const result = await Promise.race([
    chrome.tabs.sendMessage(tab.id, {
      type: 'CHECK_NUMBER_STATUS',
      phoneNumber: phoneNumber,
      sessionId: sessionId
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Check number timeout - 60 seconds')), 60000)
    )
  ]);

  console.log('[Extension] Check result:', result);
  return result;
}

// Handle SendMessage with two-phase approach
async function handleSendMessage(tab, command, authPayload) {
  console.log('[Extension] handleSendMessage - starting two-phase approach');

  // Parse payload
  let payload = command.payload;
  if (typeof payload === 'string') {
    payload = JSON.parse(payload);
  }

  const phoneNumber = payload.phoneNumber || payload.patientPhone;
  const countryCode = payload.countryCode || '';
  const messageText = payload.text || payload.messageText || payload.content;

  if (!phoneNumber) {
    throw new Error('Phone number not provided in payload');
  }
  if (!messageText) {
    throw new Error('Message text not provided in payload');
  }

  // Debug logging for newlines
  console.log('[Extension] SendMessage to:', phoneNumber, 'CountryCode:', countryCode);
  console.log('[Extension] Message text length:', messageText.length);
  console.log('[Extension] Message has newlines:', messageText.includes('\n'));
  console.log('[Extension] Newline count:', (messageText.match(/\n/g) || []).length);
  console.log('[Extension] First 100 chars:', messageText.substring(0, 100));
  console.log('[Extension] Message text char codes (first 50):', [...messageText.substring(0, 50)].map(c => c.charCodeAt(0)));

  // Clean phone number and ensure it includes country code
  let cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

  // If phone doesn't start with country code digits and we have a country code, prepend it
  if (countryCode && !cleanNumber.startsWith(countryCode.replace('+', ''))) {
    // Remove leading zeros from local number and prepend country code (without +)
    cleanNumber = countryCode.replace('+', '') + cleanNumber.replace(/^0+/, '');
  }

  const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;

  console.log('[Extension] Phase 1 - Navigating to chat URL:', chatUrl);

  // Navigate to the chat URL directly (this handles navigation without needing content script)
  await chrome.tabs.update(tab.id, { url: chatUrl });

  // Wait for the tab to complete loading
  await waitForTabComplete(tab.id, 30000);
  console.log('[Extension] Tab loaded after navigation');

  // Wait additional time for WhatsApp to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Content script is loaded by manifest.json, so we don't need to inject it again manually
  // This prevents double-loading which causes duplicate message listeners
  console.log('[Extension] Waiting for content script to be ready (loaded by manifest)...');

  // Wait for content script to initialize
  await new Promise(r => setTimeout(r, 1000));

  // Verify content script is ready with retries
  let contentReady = false;
  let lastStatus = 'unknown';
  for (let i = 0; i < 5; i++) {
    try {
      const pingResult = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      console.log('[Extension] Content script ping result:', pingResult);
      if (pingResult && pingResult.success) {
        lastStatus = pingResult.status || 'unknown';
        // Wait for 'connected' status before proceeding (chat UI is ready)
        if (lastStatus === 'connected') {
          contentReady = true;
          break;
        }
        console.log('[Extension] WhatsApp status is', lastStatus, '- waiting for connected...');
      }
    } catch (e) {
      console.log('[Extension] Ping attempt', i + 1, 'failed:', e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // If still not connected after 5 attempts, try a few more times with longer waits
  if (!contentReady) {
    console.log('[Extension] WhatsApp not connected after initial attempts, waiting longer...');
    for (let i = 0; i < 10; i++) {
      try {
        const pingResult = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        if (pingResult && pingResult.success && pingResult.status === 'connected') {
          contentReady = true;
          lastStatus = 'connected';
          console.log('[Extension] WhatsApp now connected');
          break;
        }
        lastStatus = pingResult?.status || 'unknown';
        console.log('[Extension] Still waiting for connected, current status:', lastStatus);
      } catch (e) {
        console.log('[Extension] Extended ping attempt', i + 1, 'failed:', e.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (!contentReady) {
    throw new Error(`Content script not ready after navigation. Last status: ${lastStatus}`);
  }

  console.log('[Extension] Phase 2 - Sending message...');

  // Send the message
  const result = await Promise.race([
    chrome.tabs.sendMessage(tab.id, {
      type: 'SEND_MESSAGE_ONLY',
      text: messageText
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send message timeout - 60 seconds')), 60000)
    )
  ]);

  console.log('[Extension] SendMessage result:', result);
  return result;
}

// Wait for tab to complete loading
function waitForTabComplete(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, timeout);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Also check current state in case it's already complete
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
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
      moderatorUsername: state.moderatorUsername,
      moderatorName: state.moderatorName,
      whatsAppStatus: state.whatsAppStatus
    }
  };

  // Send to popup
  chrome.runtime.sendMessage(stateMsg).catch(() => { });

  // Send to content script
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, stateMsg).catch(() => { });
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
            moderatorUsername: state.moderatorUsername,
            moderatorName: state.moderatorName,
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
          // First, revoke the device on the backend using the self-revoke endpoint
          if (state.deviceToken) {
            try {
              await apiCall('/api/extension/self-revoke', 'POST', {
                deviceToken: state.deviceToken,
                reason: 'UserRequestedUnpair'
              });
              console.log('[Extension] Device revoked on backend via self-revoke');
            } catch (error) {
              console.warn('[Extension] Failed to revoke device on backend:', error);
              // Continue with local cleanup even if backend call fails
            }
          }
          // Release lease and clear local storage
          await releaseLease();
          await clearDeviceToken();
          sendResponse({ success: true });
          break;

        case 'WHATSAPP_STATUS':
          const previousStatus = state.whatsAppStatus;
          state.whatsAppStatus = message.status;
          state.currentUrl = message.url;
          console.log('[Extension] WhatsApp status updated:', message.status);
          broadcastState();
          // Report to server immediately (also update heartbeat)
          if (state.isConnected && state.leaseId && state.leaseToken) {
            sendHeartbeat().catch(console.error);
          }
          // If status changed to connected, try processing queued commands
          if (message.status === 'connected' && previousStatus !== 'connected') {
            console.log('[Extension] WhatsApp now connected, processing queued commands');
            processNextCommand();
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

// CRITICAL: Listen for tab removal to detect when WhatsApp tab is closed
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // Check if any WhatsApp tabs remain after this removal
  try {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length === 0) {
      console.log('[Extension] Last WhatsApp tab closed, resetting status to unknown');
      state.whatsAppStatus = 'unknown';
      state.currentUrl = null;
      broadcastState();

      // Send heartbeat to update server about the status change
      if (state.isConnected && state.leaseId && state.leaseToken) {
        sendHeartbeat().catch(console.error);
      }
    }
  } catch (error) {
    console.error('[Extension] Error checking WhatsApp tabs after removal:', error);
  }
});

// Periodic check for WhatsApp tab presence (catches edge cases like browser restart)
// Runs every 10 seconds when there's an active session
setInterval(async () => {
  // Only check if we have an active session and status is 'connected'
  if (!state.isConnected || state.whatsAppStatus !== 'connected') {
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length === 0) {
      console.log('[Extension] No WhatsApp tab found during periodic check, resetting status');
      state.whatsAppStatus = 'unknown';
      state.currentUrl = null;
      broadcastState();

      // Send heartbeat to update server
      if (state.leaseId && state.leaseToken) {
        sendHeartbeat().catch(console.error);
      }
    }
  } catch (error) {
    console.error('[Extension] Error during periodic WhatsApp tab check:', error);
  }
}, 10000); // Check every 10 seconds
