// Refocus Background Service Worker
// Polls status server and broadcasts to content scripts

const STATUS_URL = 'http://localhost:9999/api/status';
const POLL_INTERVAL = 2000; // 2 seconds

// Display modes
const DISPLAY_MODE = {
  HIDDEN: 'HIDDEN',           // All instances working, hide everything
  NOTIFICATION: 'NOTIFICATION', // Some instances need attention, show notification
  FULL_OVERLAY: 'FULL_OVERLAY'  // All instances need attention, show full overlay
};

let currentMode = DISPLAY_MODE.HIDDEN;
let isEnabled = true;
let dismissedUntil = 0;
let lastStatus = null;
let autoDismissSeconds = 5; // Default 5 seconds, 0 = disabled

// Initialize extension state from storage
chrome.storage.local.get(['isEnabled', 'dismissedUntil', 'autoDismissSeconds'], (result) => {
  if (result.isEnabled !== undefined) {
    isEnabled = result.isEnabled;
  }
  if (result.dismissedUntil !== undefined) {
    dismissedUntil = result.dismissedUntil;
  }
  if (result.autoDismissSeconds !== undefined) {
    autoDismissSeconds = result.autoDismissSeconds;
  }
});

// Determine display mode based on server status
function determineDisplayMode(data) {
  if (!data || data.totalCount === 0) {
    // No instances registered - treat as server unavailable, show full overlay
    return DISPLAY_MODE.FULL_OVERLAY;
  }

  if (data.allNeedAttention) {
    // All instances need attention - full blocking overlay
    return DISPLAY_MODE.FULL_OVERLAY;
  }

  if (data.someNeedAttention) {
    // Some instances need attention - show notification
    return DISPLAY_MODE.NOTIFICATION;
  }

  // All instances working - hide everything
  return DISPLAY_MODE.HIDDEN;
}

// Poll status server
async function pollStatus() {
  if (!isEnabled) {
    broadcastStatus(DISPLAY_MODE.HIDDEN, null);
    return;
  }

  // Check if dismissed
  if (dismissedUntil > Date.now()) {
    broadcastStatus(DISPLAY_MODE.HIDDEN, null);
    return;
  }

  try {
    const response = await fetch(STATUS_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    lastStatus = data;
    currentMode = determineDisplayMode(data);
  } catch (error) {
    // Server unavailable - default to showing full overlay (safe default)
    currentMode = DISPLAY_MODE.FULL_OVERLAY;
    lastStatus = null;
  }

  broadcastStatus(currentMode, lastStatus);
}

// Broadcast status to all content scripts
async function broadcastStatus(mode, statusData) {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'STATUS_UPDATE',
            mode: mode,
            statusData: statusData,
            autoDismissSeconds: autoDismissSeconds
          });
        } catch (e) {
          // Content script not loaded on this tab, ignore
        }
      }
    }
  } catch (error) {
    console.error('Error broadcasting status:', error);
  }
}

// Start polling
setInterval(pollStatus, POLL_INTERVAL);
pollStatus(); // Initial poll

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({
      mode: currentMode,
      statusData: lastStatus,
      isEnabled: isEnabled,
      dismissedUntil: dismissedUntil,
      autoDismissSeconds: autoDismissSeconds
    });
    return true;
  }

  if (message.type === 'SET_AUTO_DISMISS_SECONDS') {
    autoDismissSeconds = message.seconds;
    chrome.storage.local.set({ autoDismissSeconds: autoDismissSeconds });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_ENABLED') {
    isEnabled = message.enabled;
    chrome.storage.local.set({ isEnabled: isEnabled });
    pollStatus(); // Trigger immediate status update
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'DISMISS') {
    dismissedUntil = Date.now() + (message.minutes * 60 * 1000);
    chrome.storage.local.set({ dismissedUntil: dismissedUntil });
    pollStatus(); // Trigger immediate status update
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLEAR_DISMISS') {
    dismissedUntil = 0;
    chrome.storage.local.set({ dismissedUntil: 0 });
    pollStatus();
    sendResponse({ success: true });
    return true;
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Refocus extension installed/updated');
});
