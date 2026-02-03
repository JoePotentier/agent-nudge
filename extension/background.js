// Agent Nudge Background Service Worker
// Polls status server and broadcasts to content scripts

const DEFAULT_PORT = 9999;
const DEFAULT_SITES = [
  'youtube.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitch.tv'
];
const POLL_INTERVAL = 2000; // 2 seconds
const CONTENT_SCRIPT_ID = 'agent-nudge-content-script';

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
let allowOverlayDismiss = true; // Allow X button on full overlay
let soundEnabled = true; // Enable sound notifications
let serverPort = DEFAULT_PORT;
let watchedSites = [...DEFAULT_SITES];

// Offscreen document management for audio playback
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Playing notification sound for agent attention alerts'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// Build status URL from port
function getStatusUrl() {
  return `http://localhost:${serverPort}/api/status`;
}

// Convert domain to match pattern for content scripts
function domainToMatchPattern(domain) {
  // Remove any protocol if present
  domain = domain.replace(/^https?:\/\//, '');
  // Remove trailing slash
  domain = domain.replace(/\/$/, '');
  // Add wildcard for subdomains
  return `*://*.${domain}/*`;
}

// Register content scripts dynamically based on watched sites
async function registerContentScripts() {
  try {
    // First, unregister any existing scripts
    try {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    } catch (e) {
      // Script might not exist, ignore
    }

    if (watchedSites.length === 0) {
      console.log('No sites configured, content scripts not registered');
      return;
    }

    const matches = watchedSites.map(domainToMatchPattern);

    await chrome.scripting.registerContentScripts([{
      id: CONTENT_SCRIPT_ID,
      matches: matches,
      js: ['content.js'],
      css: ['content.css'],
      runAt: 'document_idle'
    }]);

    console.log('Content scripts registered for:', watchedSites);
  } catch (error) {
    console.error('Error registering content scripts:', error);
  }
}

// Initialize extension state from storage
async function initializeState() {
  const result = await chrome.storage.sync.get([
    'isEnabled',
    'dismissedUntil',
    'autoDismissSeconds',
    'allowOverlayDismiss',
    'soundEnabled',
    'serverPort',
    'watchedSites'
  ]);

  if (result.isEnabled !== undefined) {
    isEnabled = result.isEnabled;
  }
  if (result.dismissedUntil !== undefined) {
    dismissedUntil = result.dismissedUntil;
  }
  if (result.autoDismissSeconds !== undefined) {
    autoDismissSeconds = result.autoDismissSeconds;
  }
  if (result.allowOverlayDismiss !== undefined) {
    allowOverlayDismiss = result.allowOverlayDismiss;
  }
  if (result.soundEnabled !== undefined) {
    soundEnabled = result.soundEnabled;
  }
  if (result.serverPort !== undefined) {
    serverPort = result.serverPort;
  }
  if (result.watchedSites !== undefined) {
    watchedSites = result.watchedSites;
  }

  // Register content scripts with current sites
  await registerContentScripts();
}

// Determine display mode based on server status
function determineDisplayMode(data) {
  if (!data) {
    // Server unavailable - show full overlay as safe default
    return DISPLAY_MODE.FULL_OVERLAY;
  }

  if (data.totalCount === 0) {
    // No instances registered - no agent sessions running, allow browsing
    return DISPLAY_MODE.HIDDEN;
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
    const response = await fetch(getStatusUrl(), {
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
            autoDismissSeconds: autoDismissSeconds,
            allowOverlayDismiss: allowOverlayDismiss,
            soundEnabled: soundEnabled,
            serverPort: serverPort
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

// Initialize on startup
initializeState().then(() => {
  pollStatus(); // Initial poll
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({
      mode: currentMode,
      statusData: lastStatus,
      isEnabled: isEnabled,
      dismissedUntil: dismissedUntil,
      autoDismissSeconds: autoDismissSeconds,
      allowOverlayDismiss: allowOverlayDismiss,
      soundEnabled: soundEnabled,
      serverPort: serverPort,
      watchedSites: watchedSites,
      defaultSites: DEFAULT_SITES
    });
    return true;
  }

  if (message.type === 'PLAY_SOUND') {
    ensureOffscreenDocument().then(() => {
      chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_SOUND_ENABLED') {
    soundEnabled = message.enabled;
    chrome.storage.sync.set({ soundEnabled: soundEnabled });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_AUTO_DISMISS_SECONDS') {
    autoDismissSeconds = message.seconds;
    chrome.storage.sync.set({ autoDismissSeconds: autoDismissSeconds });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_ALLOW_OVERLAY_DISMISS') {
    allowOverlayDismiss = message.allow;
    chrome.storage.sync.set({ allowOverlayDismiss: allowOverlayDismiss });
    pollStatus(); // Trigger immediate status update to content scripts
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_ENABLED') {
    isEnabled = message.enabled;
    chrome.storage.sync.set({ isEnabled: isEnabled });
    pollStatus(); // Trigger immediate status update
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_SERVER_PORT') {
    serverPort = message.port;
    chrome.storage.sync.set({ serverPort: serverPort });
    pollStatus(); // Trigger immediate status update with new port
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SET_WATCHED_SITES') {
    watchedSites = message.sites;
    chrome.storage.sync.set({ watchedSites: watchedSites });
    registerContentScripts().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'RESET_SITES_TO_DEFAULT') {
    watchedSites = [...DEFAULT_SITES];
    chrome.storage.sync.set({ watchedSites: watchedSites });
    registerContentScripts().then(() => {
      sendResponse({ success: true, sites: watchedSites });
    });
    return true;
  }

  if (message.type === 'DISMISS') {
    dismissedUntil = Date.now() + (message.minutes * 60 * 1000);
    chrome.storage.sync.set({ dismissedUntil: dismissedUntil });
    pollStatus(); // Trigger immediate status update
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLEAR_DISMISS') {
    dismissedUntil = 0;
    chrome.storage.sync.set({ dismissedUntil: 0 });
    pollStatus();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'LOG_DISMISSAL') {
    // Log dismissal to server
    fetch(`http://localhost:${serverPort}/api/dismiss-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: message.site,
        instancesWaiting: message.instancesWaiting,
        dismissType: message.dismissType
      })
    }).catch(e => {
      console.log('Could not log dismissal:', e);
    });
    sendResponse({ success: true });
    return true;
  }
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Agent Nudge extension installed/updated');
  // Initialize with defaults if not set
  chrome.storage.sync.get(['watchedSites'], (result) => {
    if (result.watchedSites === undefined) {
      chrome.storage.sync.set({ watchedSites: DEFAULT_SITES });
    }
  });
});
