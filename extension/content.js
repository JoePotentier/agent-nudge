// Agent Nudge Content Script
// Injected into watched sites - manages overlay and notification visibility

(function() {
  'use strict';

  const OVERLAY_ID = 'agent-nudge-overlay';
  const NOTIFICATION_ID = 'agent-nudge-notification';

  // Display modes (must match background.js)
  const DISPLAY_MODE = {
    HIDDEN: 'HIDDEN',
    NOTIFICATION: 'NOTIFICATION',
    FULL_OVERLAY: 'FULL_OVERLAY'
  };

  let overlay = null;
  let notification = null;
  let currentMode = DISPLAY_MODE.HIDDEN;
  let wasVideoPlaying = false;
  let notificationDismissed = false;
  let overlayDismissed = false;
  let allowOverlayDismiss = true;
  let soundEnabled = true;
  let autoDismissTimer = null;
  let autoDismissSeconds = 5;
  let lastStatusData = null;

  // Get the main video element on YouTube
  function getYouTubeVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  // Pause video and remember if it was playing
  function pauseVideo() {
    const video = getYouTubeVideo();
    if (video && !video.paused) {
      wasVideoPlaying = true;
      video.pause();
    }
  }

  // Resume video if it was playing before
  function resumeVideo() {
    if (wasVideoPlaying) {
      const video = getYouTubeVideo();
      if (video) {
        video.play();
      }
      wasVideoPlaying = false;
    }
  }

  // Play notification sound via background script (uses offscreen document)
  function playNotificationSound() {
    if (!soundEnabled) return;
    try {
      chrome.runtime.sendMessage({ type: 'PLAY_SOUND' });
    } catch (e) {
      // Extension context invalidated, fail silently
    }
  }

  // Create the full-screen overlay element
  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      return document.getElementById(OVERLAY_ID);
    }

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <button class="refocus-overlay-close" aria-label="Dismiss overlay" style="display: none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      <div class="refocus-content">
        <div class="refocus-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h1 class="refocus-title">Your agent needs attention!</h1>
        <p class="refocus-subtitle">Your AI assistant is waiting for input</p>
        <div class="refocus-pulse"></div>
      </div>
    `;

    // Add dismiss handler for overlay close button
    const closeBtn = overlay.querySelector('.refocus-overlay-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleOverlayDismiss();
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  // Handle overlay dismissal
  function handleOverlayDismiss() {
    overlayDismissed = true;
    hideOverlay();
    resumeVideo();
    logDismissalToServer();
  }

  // Log dismissal event via background script (avoids local network access prompts)
  function logDismissalToServer(dismissType = 'overlay_x_button') {
    try {
      const waitingCount = lastStatusData?.needsAttentionCount || 0;
      const site = window.location.hostname.replace(/^www\./, '');

      chrome.runtime.sendMessage({
        type: 'LOG_DISMISSAL',
        site: site,
        instancesWaiting: waitingCount,
        dismissType: dismissType
      });
    } catch (e) {
      // Extension context invalidated, fail silently
    }
  }

  // Update overlay close button visibility based on setting
  function updateOverlayCloseButton() {
    if (!overlay) return;
    const closeBtn = overlay.querySelector('.refocus-overlay-close');
    if (closeBtn) {
      closeBtn.style.display = allowOverlayDismiss ? 'flex' : 'none';
    }
  }

  // Create the notification element (top right corner)
  function createNotification() {
    if (document.getElementById(NOTIFICATION_ID)) {
      return document.getElementById(NOTIFICATION_ID);
    }

    notification = document.createElement('div');
    notification.id = NOTIFICATION_ID;
    notification.innerHTML = `
      <div class="refocus-notification-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="refocus-notification-content">
        <div class="refocus-notification-title">Agent needs attention</div>
        <div class="refocus-notification-subtitle"></div>
      </div>
      <button class="refocus-notification-close" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Add dismiss handler
    const closeBtn = notification.querySelector('.refocus-notification-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notificationDismissed = true;
      hideNotification();
      logDismissalToServer('notification_x_button');
    });

    document.body.appendChild(notification);
    return notification;
  }

  // Update notification text with instance info
  function updateNotificationText(statusData) {
    if (!notification) return;

    const subtitle = notification.querySelector('.refocus-notification-subtitle');
    if (!subtitle) return;

    if (!statusData || !statusData.instances || statusData.instances.length === 0) {
      subtitle.textContent = 'Waiting for input';
      return;
    }

    const waiting = statusData.instances.filter(i => !i.isActive);
    if (waiting.length === 0) {
      subtitle.textContent = 'Waiting for input';
    } else if (waiting.length === 1) {
      const name = waiting[0].name || waiting[0].id || 'Instance';
      subtitle.textContent = `${name} is waiting`;
    } else {
      subtitle.textContent = `${waiting.length} instances waiting`;
    }
  }

  // Show full-screen overlay
  function showOverlay(playSound = false) {
    // Don't show if dismissed
    if (overlayDismissed) return;

    if (!overlay) {
      overlay = createOverlay();
    }

    // Update close button visibility
    updateOverlayCloseButton();

    // Pause any playing video
    pauseVideo();

    // Play sound when overlay appears
    if (playSound) {
      playNotificationSound();
    }

    // Force reflow for animation
    overlay.offsetHeight;
    overlay.classList.add('refocus-visible');
  }

  // Hide full-screen overlay
  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove('refocus-visible');
  }

  // Show notification
  function showNotification(statusData, playSound = false) {
    if (notificationDismissed) return;

    if (!notification) {
      notification = createNotification();
    }

    updateNotificationText(statusData);

    // Play sound when notification appears
    if (playSound) {
      playNotificationSound();
    }

    // Only set up auto-dismiss timer when notification first appears
    const isAlreadyVisible = notification.classList.contains('refocus-visible');

    // Force reflow for animation
    notification.offsetHeight;
    notification.classList.add('refocus-visible');

    // Set up auto-dismiss timer only on first appearance
    if (!isAlreadyVisible && autoDismissSeconds > 0) {
      clearAutoDismissTimer();
      autoDismissTimer = setTimeout(() => {
        notificationDismissed = true;
        hideNotification();
      }, autoDismissSeconds * 1000);
    }
  }

  // Clear auto-dismiss timer
  function clearAutoDismissTimer() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
  }

  // Hide notification
  function hideNotification() {
    if (!notification) return;
    clearAutoDismissTimer();
    notification.classList.remove('refocus-visible');
  }

  // Update display based on mode
  function updateDisplay(mode, statusData) {
    const previousMode = currentMode;
    currentMode = mode;
    lastStatusData = statusData;

    // Reset dismissed states when mode changes from hidden (agent was working, now needs attention again)
    if (previousMode === DISPLAY_MODE.HIDDEN && mode !== DISPLAY_MODE.HIDDEN) {
      notificationDismissed = false;
      overlayDismissed = false;
    }

    // Determine if we should play a sound (only when transitioning to attention-needed state)
    const shouldPlaySound = previousMode === DISPLAY_MODE.HIDDEN && mode !== DISPLAY_MODE.HIDDEN;

    switch (mode) {
      case DISPLAY_MODE.FULL_OVERLAY:
        hideNotification();
        showOverlay(shouldPlaySound);
        break;

      case DISPLAY_MODE.NOTIFICATION:
        hideOverlay();
        showNotification(statusData, shouldPlaySound);
        // Resume video if transitioning from full overlay
        if (previousMode === DISPLAY_MODE.FULL_OVERLAY) {
          resumeVideo();
        }
        break;

      case DISPLAY_MODE.HIDDEN:
      default:
        hideOverlay();
        hideNotification();
        // Resume video if transitioning from full overlay
        if (previousMode === DISPLAY_MODE.FULL_OVERLAY) {
          resumeVideo();
        }
        break;
    }
  }

  // Listen for status updates from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATUS_UPDATE') {
      if (message.autoDismissSeconds !== undefined) {
        autoDismissSeconds = message.autoDismissSeconds;
        // Clear any existing timer if auto-dismiss is disabled
        if (autoDismissSeconds <= 0) {
          clearAutoDismissTimer();
        }
      }
      if (message.allowOverlayDismiss !== undefined) {
        allowOverlayDismiss = message.allowOverlayDismiss;
        updateOverlayCloseButton();
      }
      if (message.soundEnabled !== undefined) {
        soundEnabled = message.soundEnabled;
      }
      updateDisplay(message.mode, message.statusData);
      sendResponse({ received: true });
    }
    return true;
  });

  // Initialize elements (hidden by default)
  function init() {
    overlay = createOverlay();
    notification = createNotification();

    // Request current status from background
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response && response.isEnabled) {
        const now = Date.now();
        if (!response.dismissedUntil || response.dismissedUntil <= now) {
          updateDisplay(response.mode, response.statusData);
        }
      }
    });
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
