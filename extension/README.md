# Clinics WhatsApp Runner Extension

Chrome extension for browser-based WhatsApp Web automation in the Clinics Management System.

## Overview

This extension replaces server-side Playwright automation with client-side browser extension automation. The extension runs on the moderator's machine and communicates with the Clinics Management API to:

1. **Detect WhatsApp status** (QR code, connected, disconnected)
2. **Execute commands** (send messages, navigate, refresh)
3. **Report results** back to the server

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Browser Extension (MV3)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Popup     │  │  Background │  │   Content   │ │
│  │    UI       │  │   Worker    │  │   Script    │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                 │        │
│         └────────────────┼─────────────────┘        │
│                          │                          │
└──────────────────────────┼──────────────────────────┘
                           │
                    REST API + SignalR
                           │
┌──────────────────────────┼──────────────────────────┐
│              Clinics Management API                  │
│  - ExtensionController (pairing, lease, commands)   │
│  - ExtensionHub (SignalR for push notifications)    │
└─────────────────────────────────────────────────────┘
```

## Components

### Background Worker (`background.js`)

- Manages device pairing and session lease
- Handles heartbeat to keep lease active
- Polls for pending commands (fallback when SignalR unavailable)
- Routes commands to content script

### Content Script (`content.js`)

- Injected into WhatsApp Web pages
- Detects WhatsApp status (QR, connected, etc.)
- Executes DOM automation commands
- Reports results back to background

### Popup (`popup.html`, `popup.js`)

- User interface for pairing and session management
- Shows connection status
- Allows starting/stopping sessions

### Options Page (`options.html`, `options.js`)

- Configure API server URL
- View extension information
- Clear all data

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder

## Usage

### First-time Setup

1. Click the extension icon in Chrome toolbar
2. Enter your Clinics Management API URL (e.g., `https://your-server.com`)
3. Click "Save API URL"

### Pairing

1. In the Clinics Management dashboard, go to Settings > WhatsApp Extension
2. Click "Generate Pairing Code" - you'll see an 8-digit code
3. In the extension popup, enter the 8-digit code
4. Click "Pair Extension"

### Starting a Session

1. After pairing, click "Start Session" in the extension popup
2. If another device already has an active session, you'll be asked to confirm takeover
3. Open WhatsApp Web in a browser tab
4. The extension will detect WhatsApp status and report it to the server

### Sending Messages

Once the session is active and WhatsApp is connected:

1. The server will send commands through the extension
2. Commands are executed automatically
3. Results are reported back to the server

## Security

- **Device tokens** are generated during pairing and stored securely
- **Lease tokens** enforce single-active-session per moderator
- **Token hashing** - tokens are stored as SHA256 hashes on the server
- **HTTPS required** for API communication

## Permissions

- `storage` - Store configuration and tokens
- `tabs` - Detect WhatsApp Web tabs
- `activeTab` - Interact with current tab
- `scripting` - Inject content scripts
- `host_permissions: web.whatsapp.com` - Access WhatsApp Web

## Troubleshooting

### "WhatsApp tab not found"

- Make sure WhatsApp Web is open in a browser tab
- The tab URL must be `https://web.whatsapp.com/*`

### "Session lease expired"

- The extension's heartbeat may have failed
- Click "Start Session" to re-acquire the lease

### "Another device has active session"

- Only one extension can have an active session per moderator
- Choose "Take over" to forcibly acquire the session

## Development

### Building for Production

For production, you should:

1. Add proper icons (16x16, 48x48, 128x128 PNG files)
2. Bundle any external dependencies
3. Minify JavaScript files
4. Package as `.crx` or submit to Chrome Web Store

### Updating DOM Selectors

WhatsApp Web may change its DOM structure. Update selectors in `content.js`:

```javascript
const SELECTORS = {
  qrCode: '[data-testid="qrcode"]',
  sidePanel: '#pane-side',
  // ... update as needed
};
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extension/pairing/complete` | POST | Complete pairing with code |
| `/api/extension/lease/acquire` | POST | Acquire session lease |
| `/api/extension/lease/heartbeat` | POST | Keep lease alive |
| `/api/extension/lease/release` | POST | Release lease |
| `/api/extension/commands/pending` | GET | Get pending commands |
| `/api/extension/commands/{id}/ack` | POST | Acknowledge command |
| `/api/extension/commands/{id}/complete` | POST | Complete command |
| `/api/extension/status` | POST | Report WhatsApp status |

## Version History

- **1.0.0** - Initial release with basic pairing, lease management, and message sending
