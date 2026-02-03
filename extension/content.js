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
  let audioContext = null;
  let autoDismissTimer = null;
  let autoDismissSeconds = 5;

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

  // Play a pleasant notification sound using Web Audio API
  function playNotificationSound() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const now = audioContext.currentTime;

      // Create a pleasant two-tone chime
      const frequencies = [523.25, 659.25]; // C5 and E5 - pleasant major third

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, now);

        // Gentle fade in and out
        const startTime = now + (index * 0.15);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.5);
      });
    } catch (e) {
      // Audio not available, fail silently
      console.log('Agent Nudge: Could not play notification sound', e);
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

    document.body.appendChild(overlay);
    return overlay;
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
    if (!overlay) {
      overlay = createOverlay();
    }

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

    // Force reflow for animation
    notification.offsetHeight;
    notification.classList.add('refocus-visible');

    // Set up auto-dismiss timer
    clearAutoDismissTimer();
    if (autoDismissSeconds > 0) {
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

    // Reset notification dismissed state when mode changes from hidden
    if (previousMode === DISPLAY_MODE.HIDDEN && mode !== DISPLAY_MODE.HIDDEN) {
      notificationDismissed = false;
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
