// Options page script

const elements = {
  apiUrl: document.getElementById('api-url'),
  saveBtn: document.getElementById('save-btn'),
  clearBtn: document.getElementById('clear-btn'),
  message: document.getElementById('message'),
  version: document.getElementById('version'),
  deviceId: document.getElementById('device-id'),
  pairedStatus: document.getElementById('paired-status'),
  moderatorId: document.getElementById('moderator-id')
};

// Show message
function showMessage(text, type = 'success') {
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.classList.remove('hidden');
  setTimeout(() => {
    elements.message.classList.add('hidden');
  }, 3000);
}

// Load settings
async function loadSettings() {
  const stored = await chrome.storage.local.get([
    'apiBaseUrl',
    'deviceId',
    'deviceToken',
    'moderatorId'
  ]);
  
  elements.apiUrl.value = stored.apiBaseUrl || '';
  elements.version.textContent = chrome.runtime.getManifest().version;
  elements.deviceId.textContent = stored.deviceId || 'Not generated';
  elements.pairedStatus.textContent = stored.deviceToken ? 'Yes' : 'No';
  elements.moderatorId.textContent = stored.moderatorId || '-';
}

// Save settings
elements.saveBtn.addEventListener('click', async () => {
  const url = elements.apiUrl.value.trim();
  
  if (url) {
    try {
      new URL(url);
    } catch {
      showMessage('Invalid URL format', 'error');
      return;
    }
  }
  
  await chrome.storage.local.set({ apiBaseUrl: url });
  
  // Notify background script
  chrome.runtime.sendMessage({ type: 'SET_API_URL', url: url });
  
  showMessage('Settings saved successfully');
});

// Clear all data
elements.clearBtn.addEventListener('click', async () => {
  if (!confirm('This will clear all extension data including pairing information. Are you sure?')) {
    return;
  }
  
  // Release lease first
  try {
    await chrome.runtime.sendMessage({ type: 'RELEASE_LEASE' });
  } catch {}
  
  // Clear storage
  await chrome.storage.local.clear();
  
  showMessage('All data cleared');
  loadSettings();
});

// Initialize
loadSettings();
