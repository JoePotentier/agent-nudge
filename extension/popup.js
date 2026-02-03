// Refocus Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const enabledToggle = document.getElementById('enabled-toggle');
  const serverStatus = document.getElementById('server-status');
  const clearDismissBtn = document.getElementById('clear-dismiss');
  const autoDismissInput = document.getElementById('auto-dismiss');

  // Get current status from background
  function updateStatus() {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus('error', 'Error');
        setServerStatus('error', 'Extension error');
        return;
      }

      if (!response) {
        setStatus('error', 'No response');
        return;
      }

      // Update enabled toggle
      enabledToggle.checked = response.isEnabled;

      // Update auto-dismiss input
      if (response.autoDismissSeconds !== undefined) {
        autoDismissInput.value = response.autoDismissSeconds;
      }

      // Update status badge based on mode
      switch (response.mode) {
        case 'HIDDEN':
          setStatus('working', 'All Working');
          setServerStatus('connected', 'Connected');
          break;
        case 'NOTIFICATION':
          setStatus('attention', 'Some Need Attention');
          setServerStatus('connected', 'Connected');
          break;
        case 'FULL_OVERLAY':
          if (response.statusData && response.statusData.totalCount > 0) {
            setStatus('attention', 'Needs Attention');
            setServerStatus('connected', 'Connected');
          } else {
            setStatus('attention', 'Server Offline');
            setServerStatus('disconnected', 'Not connected');
          }
          break;
        default:
          setStatus('working', 'Ready');
          setServerStatus('connected', 'Connected');
      }

      // Update instance count if available
      if (response.statusData) {
        const { activeCount, needsAttentionCount, totalCount } = response.statusData;
        if (totalCount > 0) {
          const instanceText = document.querySelector('.server-text');
          if (instanceText) {
            instanceText.textContent = `${activeCount}/${totalCount} instances active`;
          }
        }
      }

      // Show/hide clear dismiss button
      const now = Date.now();
      if (response.dismissedUntil && response.dismissedUntil > now) {
        const remainingMinutes = Math.ceil((response.dismissedUntil - now) / 60000);
        clearDismissBtn.style.display = 'block';
        clearDismissBtn.textContent = `Clear Dismissal (${remainingMinutes}m left)`;
      } else {
        clearDismissBtn.style.display = 'none';
      }
    });
  }

  function setStatus(type, text) {
    statusBadge.className = 'status-badge status-' + type;
    statusText.textContent = text;
  }

  function setServerStatus(type, text) {
    serverStatus.className = 'server-status server-' + type;
    serverStatus.querySelector('.server-text').textContent = text;
  }

  // Enable/disable toggle
  enabledToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SET_ENABLED',
      enabled: enabledToggle.checked
    }, () => {
      updateStatus();
    });
  });

  // Auto-dismiss seconds input
  autoDismissInput.addEventListener('change', () => {
    const seconds = Math.max(0, Math.min(60, parseInt(autoDismissInput.value) || 0));
    autoDismissInput.value = seconds;
    chrome.runtime.sendMessage({
      type: 'SET_AUTO_DISMISS_SECONDS',
      seconds: seconds
    });
  });

  // Dismiss buttons
  document.getElementById('dismiss-5').addEventListener('click', () => {
    dismiss(5);
  });

  document.getElementById('dismiss-15').addEventListener('click', () => {
    dismiss(15);
  });

  document.getElementById('dismiss-30').addEventListener('click', () => {
    dismiss(30);
  });

  function dismiss(minutes) {
    chrome.runtime.sendMessage({
      type: 'DISMISS',
      minutes: minutes
    }, () => {
      updateStatus();
    });
  }

  // Clear dismiss button
  clearDismissBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_DISMISS' }, () => {
      updateStatus();
    });
  });

  // Initial status update
  updateStatus();

  // Refresh status every 2 seconds while popup is open
  setInterval(updateStatus, 2000);
});
