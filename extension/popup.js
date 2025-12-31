// Popup script for extension UI

// DOM elements
const elements = {
  loading: document.getElementById('loading'),
  content: document.getElementById('content'),
  notConfigured: document.getElementById('not-configured'),
  notPaired: document.getElementById('not-paired'),
  pairedDisconnected: document.getElementById('paired-disconnected'),
  connected: document.getElementById('connected'),
  errorMessage: document.getElementById('error-message'),
  
  apiUrlInput: document.getElementById('api-url-input'),
  saveUrlBtn: document.getElementById('save-url-btn'),
  pairingCodeInput: document.getElementById('pairing-code-input'),
  pairBtn: document.getElementById('pair-btn'),
  backToConfigBtn: document.getElementById('back-to-config-btn'),
  connectBtn: document.getElementById('connect-btn'),
  unpairBtn: document.getElementById('unpair-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  openWhatsAppBtn: document.getElementById('open-whatsapp-btn'),
  
  waStatusDot: document.getElementById('wa-status-dot'),
  waStatusText: document.getElementById('wa-status-text'),
  moderatorId: document.getElementById('moderator-id')
};

// Current state
let currentState = {
  isPaired: false,
  isConnected: false,
  moderatorId: null,
  whatsAppStatus: 'unknown',
  apiBaseUrl: ''
};

// Show error message
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove('hidden');
  setTimeout(() => {
    elements.errorMessage.classList.add('hidden');
  }, 5000);
}

// Hide all views
function hideAllViews() {
  elements.notConfigured.classList.add('hidden');
  elements.notPaired.classList.add('hidden');
  elements.pairedDisconnected.classList.add('hidden');
  elements.connected.classList.add('hidden');
}

// Update UI based on state
function updateUI(state) {
  currentState = { ...currentState, ...state };
  
  elements.loading.classList.add('hidden');
  elements.content.classList.remove('hidden');
  hideAllViews();
  
  if (!currentState.apiBaseUrl) {
    // Not configured
    elements.notConfigured.classList.remove('hidden');
  } else if (!currentState.isPaired) {
    // Not paired - show API URL
    elements.notPaired.classList.remove('hidden');
    const apiUrlDisplay = document.getElementById('api-url-display');
    if (apiUrlDisplay) {
      apiUrlDisplay.textContent = currentState.apiBaseUrl;
      // Highlight if using wrong port
      if (currentState.apiBaseUrl.includes(':3000')) {
        apiUrlDisplay.style.color = '#dc2626';
        apiUrlDisplay.textContent = currentState.apiBaseUrl + ' ⚠️ Wrong port! Use :5000';
      } else {
        apiUrlDisplay.style.color = '#16a34a';
      }
    }
  } else if (!currentState.isConnected) {
    // Paired but not connected
    elements.pairedDisconnected.classList.remove('hidden');
  } else {
    // Connected
    elements.connected.classList.remove('hidden');
    updateWhatsAppStatus(currentState.whatsAppStatus);
    elements.moderatorId.textContent = currentState.moderatorId || '-';
  }
}

// Update WhatsApp status display
function updateWhatsAppStatus(status) {
  const statusMap = {
    'unknown': { dot: 'gray', text: 'Unknown' },
    'loading': { dot: 'yellow', text: 'Loading...' },
    'qr_pending': { dot: 'yellow', text: 'Scan QR Code' },
    'connected': { dot: 'green', text: 'Connected' },
    'phone_disconnected': { dot: 'red', text: 'Phone Disconnected' },
    'disconnected': { dot: 'red', text: 'Disconnected' }
  };
  
  const info = statusMap[status] || statusMap['unknown'];
  elements.waStatusDot.className = `status-dot ${info.dot}`;
  elements.waStatusText.textContent = info.text;
}

// Send message to background script
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Event handlers
elements.saveUrlBtn.addEventListener('click', async () => {
  const url = elements.apiUrlInput.value.trim();
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    showError('Invalid URL format');
    return;
  }
  
  elements.saveUrlBtn.disabled = true;
  try {
    await sendMessage({ type: 'SET_API_URL', url: url });
    currentState.apiBaseUrl = url;
    updateUI(currentState);
  } catch (error) {
    showError(error.message);
  } finally {
    elements.saveUrlBtn.disabled = false;
  }
});

elements.pairBtn.addEventListener('click', async () => {
  const code = elements.pairingCodeInput.value.trim().replace(/-/g, ''); // Remove any dashes
  if (!code || code.length !== 8 || !/^\d+$/.test(code)) {
    showError('Please enter a valid 8-digit code');
    return;
  }
  
  elements.pairBtn.disabled = true;
  elements.pairBtn.textContent = 'Pairing...';
  try {
    const result = await sendMessage({ type: 'COMPLETE_PAIRING', code: code });
    if (result.success) {
      currentState.isPaired = true;
      currentState.moderatorId = result.moderatorId;
      elements.pairingCodeInput.value = ''; // Clear the input on success
      updateUI(currentState);
    } else {
      // Extract user-friendly error message
      let errorMsg = result.error || 'Pairing failed';
      if (errorMsg.includes('مستخدم بالفعل') || errorMsg.includes('already used')) {
        // Code was already used - might have succeeded on a previous attempt
        // Check if we're actually paired now
        const state = await sendMessage({ type: 'GET_STATE' });
        if (state.isPaired) {
          elements.pairingCodeInput.value = '';
          updateUI(state);
          return;
        }
        errorMsg = 'Code already used. Please generate a new code from the dashboard.';
      } else if (errorMsg.includes('غير صالح') || errorMsg.includes('منتهي')) {
        errorMsg = 'Invalid or expired code. Please generate a new code from the dashboard.';
      }
      showError(errorMsg);
    }
  } catch (error) {
    let errorMsg = error.message || 'Pairing failed';
    if (errorMsg.includes('غير صالح') || errorMsg.includes('منتهي')) {
      errorMsg = 'Invalid or expired code. Please generate a new code from the dashboard.';
    }
    showError(errorMsg);
  } finally {
    elements.pairBtn.disabled = false;
    elements.pairBtn.textContent = 'Pair Extension';
  }
});

// Back to config button handler
if (elements.backToConfigBtn) {
  elements.backToConfigBtn.addEventListener('click', async () => {
    // Clear the API URL and go back to config screen
    await chrome.storage.local.remove(['apiBaseUrl']);
    currentState.apiBaseUrl = '';
    updateUI(currentState);
  });
}

elements.connectBtn.addEventListener('click', async () => {
  elements.connectBtn.disabled = true;
  try {
    const result = await sendMessage({ type: 'ACQUIRE_LEASE', forceTakeover: false });
    if (result.success) {
      currentState.isConnected = true;
      updateUI(currentState);
    } else if (result.existingDevice) {
      // Another device has the session
      if (confirm(`Another device (${result.existingDevice}) has an active session. Take over?`)) {
        const takeoverResult = await sendMessage({ type: 'ACQUIRE_LEASE', forceTakeover: true });
        if (takeoverResult.success) {
          currentState.isConnected = true;
          updateUI(currentState);
        } else {
          showError(takeoverResult.error || 'Failed to take over session');
        }
      }
    } else {
      showError(result.error || 'Failed to start session');
    }
  } catch (error) {
    showError(error.message);
  } finally {
    elements.connectBtn.disabled = false;
  }
});

elements.disconnectBtn.addEventListener('click', async () => {
  elements.disconnectBtn.disabled = true;
  try {
    await sendMessage({ type: 'RELEASE_LEASE' });
    currentState.isConnected = false;
    updateUI(currentState);
  } catch (error) {
    showError(error.message);
  } finally {
    elements.disconnectBtn.disabled = false;
  }
});

elements.unpairBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to unpair this device?')) {
    return;
  }
  
  elements.unpairBtn.disabled = true;
  try {
    await sendMessage({ type: 'UNPAIR' });
    currentState.isPaired = false;
    currentState.isConnected = false;
    currentState.moderatorId = null;
    updateUI(currentState);
  } catch (error) {
    showError(error.message);
  } finally {
    elements.unpairBtn.disabled = false;
  }
});

elements.openWhatsAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://web.whatsapp.com' });
});

// Listen for state updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_UPDATE') {
    updateUI(message.state);
  }
});

// Initialize
async function init() {
  try {
    const state = await sendMessage({ type: 'GET_STATE' });
    updateUI(state);
  } catch (error) {
    console.error('Failed to get state:', error);
    showError('Failed to initialize');
  }
}

init();
