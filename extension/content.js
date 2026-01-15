// Content script for WhatsApp Web page
// Handles DOM interaction and status detection

console.log('[WhatsApp Runner] Content script loaded');

// DOM selectors for WhatsApp Web - EXACT MATCH from WhatsAppConfiguration.cs (Playwright)
const SELECTORS = {
  // InputFieldSelectors - EXACT ORDER from Playwright
  inputFieldSelectors: [
    "footer div[contenteditable='true']",
    "div[contenteditable='true'][aria-label*='Type a message']",
    "div[contenteditable='true'][data-tab='10']"
  ],

  // SendButtonSelectors - EXACT ORDER from Playwright
  sendButtonSelectors: [
    "span[data-icon='wds-ic-send-filled']",
    "div[role='button'] span[data-icon='wds-ic-send-filled']",
    "[data-icon='wds-ic-send-filled']",
    "button[aria-label='Send']",
    "button[data-testid='send']",
    "span[data-icon='send']",
    "button[role='button'] span[data-icon='send']",
    "div[role='button'] span[data-icon='send']",
    "div[role='button'][data-testid='send']",
    "button[type='submit']",
    "[aria-label*='send' i]",
    "[title*='send' i]"
  ],

  // ProgressBarSelectors - EXACT ORDER from Playwright
  progressBarSelectors: [
    "div[role='progressbar']",
    "progress",
    "div[aria-label^='Loading your chats']",
    "div[class*='x1n2onr6'] progress"
  ],

  // ChatUIReadySelectors - EXACT ORDER from Playwright
  chatUIReadySelectors: [
    "div[aria-label='Chat list']",
    "div[data-testid='chat-list']",
    "div[role='listbox']",
    "header",
    "footer"
  ],

  // StartingChatDialogSelectors - EXACT ORDER from Playwright
  startingChatDialogSelectors: [
    "div[data-animate-modal-popup='true'][aria-label='Starting chat']",
    "div[aria-label='Starting chat']",
    "div[data-animate-modal-body='true']"
  ],

  // QrCodeSelectors - EXACT ORDER from Playwright
  qrCodeSelectors: [
    "div[data-ref]",
    "canvas",
    "div[aria-label*='QR']",
    "div[data-testid='qr-code']",
    "div[aria-label*='scan me' i]",
    "div[role='button'] canvas",
    "canvas[aria-label*='scan me' i]",
    "div[tabindex='-1'] canvas",
    "div[role='button'][data-testid='refresh-large']",
    "div[aria-label*='to use whatsapp on your computer' i]",
    "div[aria-label*='use whatsapp on your computer' i]",
    "div[aria-label*='scan qr code' i]",
    "div[aria-label*='link with qr code' i]",
    "div[aria-label*='log in' i]",
    "div[aria-label*='session expired' i]"
  ],

  // OutgoingMessageSelectors - EXACT from Playwright
  outgoingMessageSelectors: [
    "div.message-out"
  ],

  // OutgoingMessageTextSelectors - EXACT from Playwright
  outgoingMessageTextSelectors: [
    "span.selectable-text"
  ],

  // StatusIconSelectors - EXACT from Playwright
  statusIconSelectors: [
    "span[data-icon]"
  ],

  // SupportedStatusIconTypes - EXACT from Playwright
  supportedStatusIconTypes: [
    "msg-check",
    "msg-dblcheck",
    "msg-time"
  ],

  // ErrorDialogSelectors - For detecting invalid phone number errors
  // Note: We can't use Playwright's :has-text() selector in vanilla JS
  // So we focus on aria-label and data attributes, with manual text checking
  errorDialogSelectors: [
    "[aria-label*='Phone number shared via url is invalid']",
    "div[role='dialog'] div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid']",
    "div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid']",
    "div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid.']",
    "div[role='dialog'][aria-label*='invalid']"
  ],

  // Constants from Playwright
  statusIconAttribute: 'data-icon',
  sendEnterKey: 'Enter'
};

// Timeouts - EXACT from WhatsAppConfiguration.cs (Playwright)
const TIMEOUTS = {
  defaultTaskTimeout: 150000,        // DefaultTaskTimeoutMs
  checksFrequencyDelay: 1000,        // defaultChecksFrequencyDelayMs
  defaultSelectorTimeout: 20000,     // DefaultSelectorTimeoutMs
  maxRetryErrorDialog: 20,           // DefaultMaxRetryErrorDialog
  maxRetryAttempts: 3,               // DefaultMaxRetryAttempts
  maxMonitoringWait: 900000,         // DefaultMaxMonitoringWaitMs (15 minutes)
  authenticationWait: 300000         // DefaultAuthenticationWaitMs (5 minutes)
};

// State
let currentStatus = 'unknown';
let statusCheckInterval = null;

// Helper to check if any selector matches
function anyMatch(selectors) {
  for (const selector of selectors) {
    if (document.querySelector(selector)) return true;
  }
  return false;
}

// Detect current WhatsApp status using Playwright selectors
// PRIORITY ORDER: Check connected state FIRST, then QR code
// This prevents false qr_pending when generic selectors like "canvas" match on authenticated pages
function detectStatus() {
  // Check for main chat interface (logged in) FIRST - using ChatUIReadySelectors
  // The most reliable indicator is having a footer (message input area)
  const hasFooter = !!document.querySelector("footer");
  const hasChatList = !!document.querySelector("div[aria-label='Chat list']") ||
    !!document.querySelector("div[data-testid='chat-list']");

  if (hasFooter && hasChatList) {
    // Definitely connected - has both footer and chat list
    return 'connected';
  }

  // Check for loading/startup - using ProgressBarSelectors
  if (anyMatch(SELECTORS.progressBarSelectors)) {
    return 'loading';
  }

  // Now check for QR code (not logged in) - but be more specific
  // Only use the most reliable QR selectors to avoid false positives
  const reliableQrSelectors = [
    "div[data-ref]",                                    // QR code data reference
    "div[aria-label*='scan qr code' i]",               // "Scan QR Code" aria label
    "div[aria-label*='link with qr code' i]",          // "Link with QR Code" aria label
    "div[aria-label*='to use whatsapp on your computer' i]", // Landing page text
    "div[aria-label*='session expired' i]"             // Session expired
  ];

  for (const selector of reliableQrSelectors) {
    if (document.querySelector(selector)) {
      console.log('[WhatsApp Runner] QR code detected via:', selector);
      return 'qr_pending';
    }
  }

  // Fallback: if footer exists but no chat list, still consider connected
  // This handles edge cases during navigation
  if (hasFooter) {
    return 'connected';
  }

  // Last resort: check all chat UI selectors
  if (anyMatch(SELECTORS.chatUIReadySelectors)) {
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
    }).catch(() => { });
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

// Wait for element with timeout (single selector)
function waitForElement(selector, timeout = TIMEOUTS.defaultSelectorTimeout) {
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

// Wait for any element from array of selectors with timeout (fallback logic)
function waitForAnyElement(selectors, timeout = TIMEOUTS.defaultSelectorTimeout) {
  return new Promise((resolve, reject) => {
    // Check immediately for any existing element
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('[WhatsApp Runner] Found element with selector:', selector);
        return resolve({ element, selector });
      }
    }

    const observer = new MutationObserver(() => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          console.log('[WhatsApp Runner] Found element with selector:', selector);
          resolve({ element, selector });
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`None of the elements found: ${selectors.join(', ')}`));
    }, timeout);
  });
}

// Simulate typing in an input with proper newline handling for WhatsApp
// Uses clipboard paste for reliability - this preserves newlines and is faster
async function typeText(element, text) {
  element.focus();

  // Log message text for debugging (check newline characters)
  console.log('[WhatsApp Runner] typeText received text length:', text.length);
  console.log('[WhatsApp Runner] typeText text has newlines:', text.includes('\n'));
  console.log('[WhatsApp Runner] typeText newline count:', (text.match(/\n/g) || []).length);

  // Method 2: Select All & Overwrite (Atomic Replacement)
  console.log('[WhatsApp Runner] preparing atomic overwrite...');

  // First, make sure field has focus
  element.focus();
  await new Promise(r => setTimeout(r, 100));

  // Use Range API to robustly Select All content
  // This ensures the first insertText will REPLACE everything
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);

  await new Promise(r => setTimeout(r, 50));

  console.log('[WhatsApp Runner] Content selected for overwrite. Range count:', selection.rangeCount);

  // Convert \n to actual newlines if needed (normalize)
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split by newlines and insert each line with Shift+Enter between them
  const lines = normalizedText.split('\n');
  console.log('[WhatsApp Runner] Message has', lines.length, 'lines');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // If this is the second line (index 1) or later, we need to collapse selection to end
    // because the first line replaced the selection, but subsequent lines should append
    if (i > 0) {
      selection.collapseToEnd();
    }

    // Insert the line text
    if (line.length > 0) {
      // For the first line (i===0), this REPLACES the 'Select All' selection
      // For subsequent lines, this appends at cursor
      const success = document.execCommand('insertText', false, line);

      if (!success && i === 0) {
        // Fallback if insertText fails on selection: delete then insert
        console.log('[WhatsApp Runner] insertText failed on selection, trying delete then insert...');
        document.execCommand('delete');
        document.execCommand('insertText', false, line);
      }

      // Dispatch input event for this text
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: line
      }));
    } else if (i === 0 && lines.length > 1) {
      // Special case: First line is empty but there are more lines (text starts with newline)
      // We still need to clear the selection!
      document.execCommand('delete');
    }

    // If not the last line, insert a line break
    if (i < lines.length - 1) {
      console.log('[WhatsApp Runner] Inserting line break after line', i + 1);

      // Method 1: Shift+Enter simulation with proper event sequence
      const shiftEnterDown = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        shiftKey: true
      });
      element.dispatchEvent(shiftEnterDown);

      // Try insertLineBreak command
      let breakInserted = document.execCommand('insertLineBreak', false, null);

      // Fallback: insertHTML with <br>
      if (!breakInserted) {
        breakInserted = document.execCommand('insertHTML', false, '<br>');
      }

      // Dispatch input event for line break
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertLineBreak'
      }));

      const shiftEnterUp = new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
        shiftKey: true
      });
      element.dispatchEvent(shiftEnterUp);

      // Small delay between lines
      await new Promise(r => setTimeout(r, 50));
    }
  }

  console.log('[WhatsApp Runner] Finished typing message');

  // Final delay to ensure WhatsApp processes everything
  await new Promise(r => setTimeout(r, 200));

  // Log final state
  console.log('[WhatsApp Runner] Final innerHTML length:', element.innerHTML.length);
}

// Navigate to a chat by phone number
async function navigateToChat(phoneNumber) {
  // Clean phone number (remove non-digits except +)
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');

  // Use WhatsApp Web URL scheme
  const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;

  // Navigate to the chat
  window.location.href = chatUrl;

  // Wait for chat UI to be ready (using ChatUIReadySelectors from Playwright)
  await waitForAnyElement(SELECTORS.chatUIReadySelectors, TIMEOUTS.defaultSelectorTimeout);

  // Additional wait for full load
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  return true;
}

// Send a message to the current chat
async function sendMessage(text) {
  // Wait for message input using InputFieldSelectors (from Playwright, 20s timeout)
  const { element: input, selector: inputSelector } = await waitForAnyElement(
    SELECTORS.inputFieldSelectors,
    TIMEOUTS.defaultSelectorTimeout
  );
  console.log('[WhatsApp Runner] Found input with selector:', inputSelector);

  // Type the message
  await typeText(input, text);

  // Wait a bit for send button to become active
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  // Click send button using SendButtonSelectors (from Playwright)
  const { element: sendBtn, selector: sendSelector } = await waitForAnyElement(
    SELECTORS.sendButtonSelectors,
    TIMEOUTS.defaultSelectorTimeout
  );
  console.log('[WhatsApp Runner] Found send button with selector:', sendSelector);
  sendBtn.click();

  // Wait for message to appear in chat
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  // Check for sent indicator using OutgoingMessageSelectors and StatusIconSelectors
  const lastMessage = document.querySelector(SELECTORS.outgoingMessageSelectors[0] + ':last-child');
  if (lastMessage) {
    const statusIcon = lastMessage.querySelector(SELECTORS.statusIconSelectors[0]);
    if (statusIcon) {
      const iconType = statusIcon.getAttribute(SELECTORS.statusIconAttribute);
      if (SELECTORS.supportedStatusIconTypes.includes(iconType) && iconType !== 'msg-time') {
        return { success: true, status: 'sent', iconType };
      }
    }
  }

  return { success: true, status: 'pending_confirmation' };
}

// Send message only (assumes already in correct chat after navigation)
async function sendMessageOnly(text) {
  console.log('[WhatsApp Runner] sendMessageOnly called with:', text?.substring(0, 50) + '...');
  console.log('[WhatsApp Runner] Full text length:', text?.length);
  console.log('[WhatsApp Runner] Text contains newlines:', text?.includes('\n'));
  console.log('[WhatsApp Runner] Newline character codes in text:',
    [...(text || '')].filter(c => c === '\n' || c === '\r').map(c => c.charCodeAt(0)));

  // Check for error dialog first (number might not have WhatsApp)
  for (const selector of SELECTORS.errorDialogSelectors) {
    const errorDialog = document.querySelector(selector);
    if (errorDialog) {
      console.log('[WhatsApp Runner] Error dialog detected:', selector);
      return { success: false, error: 'Phone number does not have WhatsApp' };
    }
  }

  // Wait for "Starting chat" dialog to disappear if present
  for (const selector of SELECTORS.startingChatDialogSelectors) {
    const startingDialog = document.querySelector(selector);
    if (startingDialog) {
      console.log('[WhatsApp Runner] Waiting for "Starting chat" dialog to close...');
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }

  // Wait for chat to be ready after navigation using InputFieldSelectors (from Playwright)
  // Original had 20s timeout for selector waits
  console.log('[WhatsApp Runner] Waiting for message input with InputFieldSelectors...');
  const { element: input, selector: inputSelector } = await waitForAnyElement(
    SELECTORS.inputFieldSelectors,
    TIMEOUTS.defaultSelectorTimeout
  );
  console.log('[WhatsApp Runner] Message input found with selector:', inputSelector);

  // Wait a moment for chat to stabilize (using checksFrequencyDelay)
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  // Type the message
  console.log('[WhatsApp Runner] Typing message...');
  await typeText(input, text);

  // Wait for send button to become active
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  // Click send button using SendButtonSelectors (from Playwright)
  console.log('[WhatsApp Runner] Finding send button with SendButtonSelectors...');
  const { element: sendBtn, selector: sendSelector } = await waitForAnyElement(
    SELECTORS.sendButtonSelectors,
    TIMEOUTS.defaultSelectorTimeout
  );
  console.log('[WhatsApp Runner] Found send button with selector:', sendSelector);
  sendBtn.click();
  console.log('[WhatsApp Runner] Clicked send button');

  // Wait for message to appear in chat
  await new Promise(r => setTimeout(r, TIMEOUTS.checksFrequencyDelay));

  // Check for sent indicator (poll like original did)
  // Original polled for up to 20s with 1s interval (checksFrequencyDelay)
  const maxWaitMs = TIMEOUTS.defaultSelectorTimeout;
  const pollIntervalMs = TIMEOUTS.checksFrequencyDelay;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    // Use OutgoingMessageSelectors from Playwright
    const lastMessage = document.querySelector(SELECTORS.outgoingMessageSelectors[0] + ':last-child');
    if (lastMessage) {
      // Check for status icons using StatusIconSelectors from Playwright
      const statusIcon = lastMessage.querySelector(SELECTORS.statusIconSelectors[0]);
      if (statusIcon) {
        const iconType = statusIcon.getAttribute(SELECTORS.statusIconAttribute);
        console.log('[WhatsApp Runner] Message status icon:', iconType);

        // Check against SupportedStatusIconTypes from Playwright
        if (iconType === 'msg-check' || iconType === 'msg-dblcheck') {
          console.log('[WhatsApp Runner] Message sent successfully, status:', iconType);
          return { success: true, status: 'sent', iconType };
        }
        if (iconType === 'msg-time') {
          console.log('[WhatsApp Runner] Message pending (msg-time), waiting...');
        }
      }
    }

    await new Promise(r => setTimeout(r, pollIntervalMs));
    elapsed += pollIntervalMs;
  }

  console.log('[WhatsApp Runner] Message sent but confirmation pending after polling');
  return { success: true, status: 'pending_confirmation' };
}

// Execute a command from the server
async function executeCommand(command) {
  console.log('[WhatsApp Runner] Executing command:', command.commandType);
  console.log('[WhatsApp Runner] Command payload:', command.payload);

  try {
    switch (command.commandType) {
      case 'SendMessage': {
        // Handle payload as either JSON string or object
        let payload = command.payload;
        if (typeof payload === 'string') {
          payload = JSON.parse(payload);
        }
        console.log('[WhatsApp Runner] Parsed payload:', payload);

        // Get phone number - might be phoneNumber or patientPhone
        const phoneNumber = payload.phoneNumber || payload.patientPhone;
        // Get message text - might be text, messageText, or content
        const messageText = payload.text || payload.messageText || payload.content;

        if (!phoneNumber) {
          throw new Error('Phone number not provided in payload');
        }
        if (!messageText) {
          throw new Error('Message text not provided in payload');
        }

        console.log('[WhatsApp Runner] Sending to:', phoneNumber, 'Text:', messageText.substring(0, 50) + '...');

        // Navigate to chat
        await navigateToChat(phoneNumber);

        // Send message
        const result = await sendMessage(messageText);

        return {
          success: true,
          data: result
        };
      }

      case 'CheckWhatsAppNumber': {
        // Handle payload as either JSON string or object
        let payload = command.payload;
        if (typeof payload === 'string') {
          payload = JSON.parse(payload);
        }
        console.log('[WhatsApp Runner] CheckWhatsAppNumber payload:', payload);

        // Extract phone number and optional sessionId
        const phoneNumber = payload.phoneNumber || payload.phone;
        const sessionId = payload.sessionId; // Used for server-side tracking

        if (!phoneNumber) {
          throw new Error('Phone number not provided in payload');
        }

        console.log('[WhatsApp Runner] Checking WhatsApp for:', phoneNumber, sessionId ? `(session: ${sessionId})` : '');

        // Navigate to the phone number's chat
        const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
        const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;

        // Store current URL to detect navigation
        const previousUrl = window.location.href;

        // Navigate to the chat
        window.location.href = chatUrl;

        // CRITICAL: Wait for navigation and page to be ready
        // This matches the Playwright logic in CheckWhatsAppNumberInternalAsync
        const maxWaitMs = TIMEOUTS.defaultSelectorTimeout;
        const pollInterval = TIMEOUTS.checksFrequencyDelay; // Use same as Playwright (300ms)
        let elapsed = 0;
        let hasWhatsApp = null;

        // Phase 1: Wait for "Starting chat" dialog to appear and then DISAPPEAR
        // This is critical - we must wait for this dialog to go away before checking
        console.log('[WhatsApp Runner] Phase 1: Waiting for "Starting chat" dialog to appear/disappear...');
        let startingChatSeen = false;
        let startingChatGone = false;

        while (elapsed < maxWaitMs && !startingChatGone) {
          await new Promise(r => setTimeout(r, pollInterval));
          elapsed += pollInterval;

          // Check if "Starting chat" dialog is present
          let startingChatPresent = false;
          for (const selector of SELECTORS.startingChatDialogSelectors) {
            if (document.querySelector(selector)) {
              startingChatPresent = true;
              startingChatSeen = true;
              break;
            }
          }

          if (startingChatSeen && !startingChatPresent) {
            // Dialog was seen and is now gone
            startingChatGone = true;
            console.log('[WhatsApp Runner] "Starting chat" dialog disappeared after', elapsed, 'ms');
          } else if (!startingChatSeen && elapsed > 3000) {
            // If we haven't seen the dialog after 3 seconds, maybe it already went
            // or the page loaded differently - proceed to phase 2
            console.log('[WhatsApp Runner] "Starting chat" dialog not seen after 3s, proceeding...');
            break;
          } else if (startingChatPresent) {
            console.log('[WhatsApp Runner] "Starting chat" dialog still showing...', elapsed, 'ms');
          }
        }

        // Phase 2: Check for WhatsApp status - MATCH PLAYWRIGHT ORDER
        // Playwright: First checks input field (hasWhatsApp), THEN error dialog (doesn't have)
        console.log('[WhatsApp Runner] Phase 2: Checking for chat input or error dialog...');

        // Reset elapsed for phase 2
        elapsed = 0;
        const phase2MaxWait = Math.max(maxWaitMs - elapsed, 10000); // At least 10 seconds for phase 2

        while (elapsed < phase2MaxWait && hasWhatsApp === null) {
          await new Promise(r => setTimeout(r, pollInterval));
          elapsed += pollInterval;

          // CRITICAL: Check for error dialog FIRST since false positives are worse than false negatives
          // Note: Playwright checks input first, but we've seen false positives from stale inputs
          // So we prioritize detecting the error dialog to avoid false positives

          // Check for error dialog first
          let errorDialogFound = false;
          for (const selector of SELECTORS.errorDialogSelectors) {
            const errorDialog = document.querySelector(selector);
            if (errorDialog) {
              console.log('[WhatsApp Runner] 🚫 Error dialog found via selector - number does NOT have WhatsApp');
              hasWhatsApp = false;
              errorDialogFound = true;
              break;
            }
          }

          // Fallback: Check for text content in any dialog element
          if (!errorDialogFound && hasWhatsApp === null) {
            const dialogs = document.querySelectorAll('div[role="dialog"], div[data-animate-modal-popup="true"], div[data-animate-modal-body="true"]');
            for (const dialog of dialogs) {
              const text = dialog.textContent || dialog.innerText || '';
              if (text.includes('Phone number shared via url is invalid') ||
                (text.toLowerCase().includes('phone number') && text.toLowerCase().includes('invalid'))) {
                console.log('[WhatsApp Runner] 🚫 Error dialog found via text content - number does NOT have WhatsApp');
                hasWhatsApp = false;
                errorDialogFound = true;
                break;
              }
            }
          }

          // Only check for input field if no error dialog was found
          // AND we're sure the "Starting chat" dialog is gone
          if (hasWhatsApp === null && !errorDialogFound) {
            // First verify "Starting chat" dialog is not present
            let stillStarting = false;
            for (const selector of SELECTORS.startingChatDialogSelectors) {
              if (document.querySelector(selector)) {
                stillStarting = true;
                break;
              }
            }

            if (stillStarting) {
              console.log('[WhatsApp Runner] "Starting chat" still showing, waiting...');
              continue; // Don't check input yet
            }

            // Now safe to check for input field
            for (const selector of SELECTORS.inputFieldSelectors) {
              const input = document.querySelector(selector);
              if (input) {
                // Additional validation: check if we're on the correct URL
                const currentUrl = window.location.href;
                if (currentUrl.includes(cleanNumber) || currentUrl.includes('send?phone=')) {
                  // Double-check no error dialog appeared while we were checking
                  let errorAfterInput = false;
                  for (const errSelector of SELECTORS.errorDialogSelectors) {
                    if (document.querySelector(errSelector)) {
                      errorAfterInput = true;
                      break;
                    }
                  }

                  if (!errorAfterInput) {
                    console.log('[WhatsApp Runner] ✅ Input field found - number has WhatsApp');
                    hasWhatsApp = true;
                    break;
                  } else {
                    console.log('[WhatsApp Runner] 🚫 Error dialog appeared after input check - number does NOT have WhatsApp');
                    hasWhatsApp = false;
                    break;
                  }
                }
              }
            }
          }
        }

        // Return result in format expected by backend MapCommandResultToCheckResult
        // Backend expects: { checked: boolean, hasWhatsApp: boolean }
        console.log('[WhatsApp Runner] Final result: checked=', hasWhatsApp !== null, ', hasWhatsApp =', hasWhatsApp);
        return {
          success: true,
          data: {
            checked: hasWhatsApp !== null,
            hasWhatsApp: hasWhatsApp === true,
            status: hasWhatsApp === true ? 'valid' : (hasWhatsApp === false ? 'not_registered' : 'timeout')
          }
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

  // Handle PING for health check
  if (message.type === 'PING') {
    sendResponse({ success: true, status: detectStatus() });
    return false;
  }

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

  // Handle navigate to chat - this will cause page reload
  if (message.type === 'NAVIGATE_TO_CHAT') {
    const cleanNumber = message.phoneNumber.replace(/[^\d+]/g, '');
    const chatUrl = `https://web.whatsapp.com/send?phone=${cleanNumber}`;
    console.log('[WhatsApp Runner] Navigating to:', chatUrl);
    window.location.href = chatUrl;
    // Page will reload - don't try to respond
    return false;
  }

  // Handle send message after navigation
  if (message.type === 'SEND_MESSAGE_ONLY') {
    sendMessageOnly(message.text)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Handle check number status (after navigation)
  if (message.type === 'CHECK_NUMBER_STATUS') {
    checkNumberStatus(message.phoneNumber)
      .then(result => sendResponse(result)) // Result is already { success, data }
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Check number status without navigation (assumes already on correct URL)
async function checkNumberStatus(phoneNumber) {
  console.log('[WhatsApp Runner] checkNumberStatus called for:', phoneNumber);

  // Wait for either:
  // 1. Chat UI to be ready (number has WhatsApp)
  // 2. Error dialog to appear (number doesn't have WhatsApp)
  // 3. Timeout
  const maxWaitMs = TIMEOUTS.defaultSelectorTimeout;
  const pollInterval = 500;
  let elapsed = 0;
  let hasWhatsApp = null;

  while (elapsed < maxWaitMs && hasWhatsApp === null) {
    await new Promise(r => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    // Check for error dialog (number doesn't have WhatsApp)
    for (const selector of SELECTORS.errorDialogSelectors) {
      const errorDialog = document.querySelector(selector);
      if (errorDialog) {
        console.log('[WhatsApp Runner] Error dialog found - number does not have WhatsApp');
        hasWhatsApp = false;
        break;
      }
    }

    // If no error dialog, check if chat UI is ready (number has WhatsApp)
    if (hasWhatsApp === null) {
      // Check for input field (indicates successful chat open)
      for (const selector of SELECTORS.inputFieldSelectors) {
        const input = document.querySelector(selector);
        if (input) {
          console.log('[WhatsApp Runner] Input field found - number has WhatsApp');
          hasWhatsApp = true;
          break;
        }
      }
    }

    // Also check for "Starting chat" dialog still showing
    let stillStarting = false;
    for (const selector of SELECTORS.startingChatDialogSelectors) {
      if (document.querySelector(selector)) {
        stillStarting = true;
        break;
      }
    }
    if (stillStarting) {
      console.log('[WhatsApp Runner] Still showing "Starting chat"...');
      continue;
    }
  }

  // Return result in format expected by backend MapCommandResultToCheckResult
  // Backend expects: { checked: boolean, hasWhatsApp: boolean }
  if (hasWhatsApp === null) {
    console.log('[WhatsApp Runner] checkNumberStatus timed out');
    return {
      success: true,
      data: {
        checked: false,
        hasWhatsApp: false,
        status: 'timeout',
        message: 'Timeout waiting for check result'
      }
    };
  }

  console.log('[WhatsApp Runner] checkNumberStatus result: checked=true, hasWhatsApp=', hasWhatsApp);
  return {
    success: true,
    data: {
      checked: true,
      hasWhatsApp: hasWhatsApp === true,
      status: hasWhatsApp === true ? 'valid' : 'not_registered'
    }
  };
}

// Initialize
startStatusMonitoring();
