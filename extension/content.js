// Content script for WhatsApp Web page
// Handles DOM interaction and status detection

console.log('[WhatsApp Runner] Content script loaded');

// DOM selectors for WhatsApp Web (these may change with WhatsApp updates)
const SELECTORS = {
  // QR code container
  qrCode: '[data-testid="qrcode"]',
  qrCanvas: 'canvas[aria-label="Scan me!"]',
  
  // Main chat interface (indicates logged in)
  sidePanel: '#pane-side',
  chatList: '[data-testid="chat-list"]',
  
  // Search/new chat
  searchBox: '[data-testid="chat-list-search"]',
  newChatButton: '[data-testid="chat-list-search-container"] button',
  
  // Conversation
  conversationPanel: '#main',
  messageInput: '[data-testid="conversation-compose-box-input"]',
  sendButton: '[data-testid="send"]',
  
  // Message status indicators
  messageSent: '[data-testid="msg-check"]',
  messageDelivered: '[data-testid="msg-dblcheck"]',
  messageRead: '[data-testid="msg-dblcheck-ack"]',
  
  // Error states
  phoneDisconnected: '[data-testid="alert-phone"]',
  
  // Loading
  startup: '[data-testid="startup"]',
  progressBar: '[data-testid="progress-wheel"]'
};

// State
let currentStatus = 'unknown';
let statusCheckInterval = null;

// Detect current WhatsApp status
function detectStatus() {
  // Check for QR code (not logged in)
  if (document.querySelector(SELECTORS.qrCode) || document.querySelector(SELECTORS.qrCanvas)) {
    return 'qr_pending';
  }
  
  // Check for loading/startup
  if (document.querySelector(SELECTORS.startup) || document.querySelector(SELECTORS.progressBar)) {
    return 'loading';
  }
  
  // Check for phone disconnected alert
  if (document.querySelector(SELECTORS.phoneDisconnected)) {
    return 'phone_disconnected';
  }
  
  // Check for main chat interface (logged in)
  if (document.querySelector(SELECTORS.sidePanel) || document.querySelector(SELECTORS.chatList)) {
    return 'connected';
  }
  
  return 'unknown';
}

// Report status to background script
function reportStatus() {
  const newStatus = detectStatus();
  
  if (newStatus !== currentStatus) {
    currentStatus = newStatus;
    console.log('[WhatsApp Runner] Status changed:', newStatus);
    
    chrome.runtime.sendMessage({
      type: 'WHATSAPP_STATUS',
      status: newStatus,
      url: window.location.href
    }).catch(() => {});
  }
}

// Start status monitoring
function startStatusMonitoring() {
  if (statusCheckInterval) return;
  
  // Check immediately
  reportStatus();
  
  // Then check periodically
  statusCheckInterval = setInterval(reportStatus, 2000);
  
  // Also observe DOM changes
  const observer = new MutationObserver(() => {
    reportStatus();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

// Wait for element with timeout
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element not found: ${selector}`));
    }, timeout);
  });
}

// Simulate typing in an input
async function typeText(element, text) {
  element.focus();
  
  // Clear existing content
  element.innerHTML = '';
  
  // Use execCommand for contenteditable divs
  document.execCommand('insertText', false, text);
  
  // Dispatch input event
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: text
  }));
  
  // Small delay for WhatsApp to process
  await new Promise(r => setTimeout(r, 100));
}

// Navigate to a chat by phone number
async function navigateToChat(phoneNumber) {
  // Clean phone number (remove non-digits except +)
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
  
  // Use WhatsApp Web URL scheme
  const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;
  
  // Navigate to the chat
  window.location.href = chatUrl;
  
  // Wait for conversation panel to load
  await waitForElement(SELECTORS.conversationPanel, 15000);
  
  // Additional wait for full load
  await new Promise(r => setTimeout(r, 1000));
  
  return true;
}

// Send a message to the current chat
async function sendMessage(text) {
  // Wait for message input
  const input = await waitForElement(SELECTORS.messageInput, 10000);
  
  // Type the message
  await typeText(input, text);
  
  // Wait a bit for send button to become active
  await new Promise(r => setTimeout(r, 200));
  
  // Click send button
  const sendBtn = await waitForElement(SELECTORS.sendButton, 5000);
  sendBtn.click();
  
  // Wait for message to appear in chat (sent status)
  await new Promise(r => setTimeout(r, 500));
  
  // Check for sent indicator
  const lastMessage = document.querySelector('[data-testid="msg-container"]:last-child');
  if (lastMessage) {
    const sent = lastMessage.querySelector(SELECTORS.messageSent) || 
                 lastMessage.querySelector(SELECTORS.messageDelivered) ||
                 lastMessage.querySelector(SELECTORS.messageRead);
    if (sent) {
      return { success: true, status: 'sent' };
    }
  }
  
  return { success: true, status: 'pending_confirmation' };
}

// Execute a command from the server
async function executeCommand(command) {
  console.log('[WhatsApp Runner] Executing command:', command.commandType);
  
  try {
    switch (command.commandType) {
      case 'SendMessage': {
        const payload = JSON.parse(command.payloadJson);
        
        // Navigate to chat
        await navigateToChat(payload.phoneNumber);
        
        // Send message
        const result = await sendMessage(payload.text);
        
        return {
          success: true,
          data: result
        };
      }
      
      case 'GetStatus': {
        return {
          success: true,
          data: {
            status: detectStatus(),
            url: window.location.href
          }
        };
      }
      
      case 'RefreshPage': {
        window.location.reload();
        return {
          success: true,
          data: { refreshed: true }
        };
      }
      
      default:
        return {
          success: false,
          error: `Unknown command type: ${command.commandType}`,
          category: 'invalid_command'
        };
    }
  } catch (error) {
    console.error('[WhatsApp Runner] Command error:', error);
    
    // Categorize the error
    let category = 'unknown';
    if (error.message.includes('not found')) {
      category = 'element_not_found';
    } else if (error.message.includes('timeout')) {
      category = 'timeout';
    } else if (error.message.includes('disconnected')) {
      category = 'whatsapp_disconnected';
    }
    
    return {
      success: false,
      error: error.message,
      category: category
    };
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[WhatsApp Runner] Message received:', message.type);
  
  if (message.type === 'EXECUTE_COMMAND') {
    executeCommand(message.command)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open
  }
  
  if (message.type === 'STATE_UPDATE') {
    // Background script is updating state, we can react if needed
    return false;
  }
  
  if (message.type === 'GET_WHATSAPP_STATUS') {
    sendResponse({ status: detectStatus() });
    return false;
  }
});

// Initialize
startStatusMonitoring();
