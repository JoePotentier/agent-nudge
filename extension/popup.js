// Agent Nudge Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const enabledToggle = document.getElementById('enabled-toggle');
  const serverStatus = document.getElementById('server-status');
  const clearDismissBtn = document.getElementById('clear-dismiss');
  const autoDismissInput = document.getElementById('auto-dismiss');
  const allowOverlayDismissToggle = document.getElementById('allow-overlay-dismiss');
  const soundEnabledToggle = document.getElementById('sound-enabled');
  const serverPortInput = document.getElementById('server-port');
  const sitesList = document.getElementById('sites-list');
  const newSiteInput = document.getElementById('new-site-input');
  const addSiteBtn = document.getElementById('add-site-btn');
  const resetSitesBtn = document.getElementById('reset-sites-btn');

  let currentWatchedSites = [];

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

      // Update allow overlay dismiss toggle
      if (response.allowOverlayDismiss !== undefined) {
        allowOverlayDismissToggle.checked = response.allowOverlayDismiss;
      }

      // Update sound enabled toggle
      if (response.soundEnabled !== undefined) {
        soundEnabledToggle.checked = response.soundEnabled;
      }

      // Update server port input
      if (response.serverPort !== undefined) {
        serverPortInput.value = response.serverPort;
      }

      // Update watched sites
      if (response.watchedSites !== undefined) {
        currentWatchedSites = response.watchedSites;
        renderSitesList();
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

  // Render the sites list
  function renderSitesList() {
    sitesList.innerHTML = '';
    currentWatchedSites.forEach((site) => {
      const li = document.createElement('li');
      li.className = 'site-item';

      const siteText = document.createElement('span');
      siteText.className = 'site-name';
      siteText.textContent = site;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'site-delete-btn';
      deleteBtn.textContent = '\u00D7';
      deleteBtn.title = 'Remove site';
      deleteBtn.addEventListener('click', () => removeSite(site));

      li.appendChild(siteText);
      li.appendChild(deleteBtn);
      sitesList.appendChild(li);
    });
  }

  // Add a new site
  function addSite() {
    let site = newSiteInput.value.trim().toLowerCase();
    if (!site) return;

    // Remove protocol if present
    site = site.replace(/^https?:\/\//, '');
    // Remove trailing slash
    site = site.replace(/\/$/, '');
    // Remove www. prefix
    site = site.replace(/^www\./, '');

    if (!site || currentWatchedSites.includes(site)) {
      newSiteInput.value = '';
      return;
    }

    currentWatchedSites.push(site);
    newSiteInput.value = '';

    chrome.runtime.sendMessage({
      type: 'SET_WATCHED_SITES',
      sites: currentWatchedSites
    }, () => {
      renderSitesList();
    });
  }

  // Remove a site
  function removeSite(site) {
    currentWatchedSites = currentWatchedSites.filter(s => s !== site);

    chrome.runtime.sendMessage({
      type: 'SET_WATCHED_SITES',
      sites: currentWatchedSites
    }, () => {
      renderSitesList();
    });
  }

  // Reset to default sites
  function resetSites() {
    chrome.runtime.sendMessage({ type: 'RESET_SITES_TO_DEFAULT' }, (response) => {
      if (response && response.sites) {
        currentWatchedSites = response.sites;
        renderSitesList();
      }
    });
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

  // Server port input
  serverPortInput.addEventListener('change', () => {
    const port = Math.max(1, Math.min(65535, parseInt(serverPortInput.value) || 9999));
    serverPortInput.value = port;
    chrome.runtime.sendMessage({
      type: 'SET_SERVER_PORT',
      port: port
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

  // Allow overlay dismiss toggle
  allowOverlayDismissToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SET_ALLOW_OVERLAY_DISMISS',
      allow: allowOverlayDismissToggle.checked
    });
  });

  // Sound enabled toggle
  soundEnabledToggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({
      type: 'SET_SOUND_ENABLED',
      enabled: soundEnabledToggle.checked
    });
  });

  // Add site button
  addSiteBtn.addEventListener('click', addSite);

  // Enter key to add site
  newSiteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSite();
    }
  });

  // Reset sites button
  resetSitesBtn.addEventListener('click', resetSites);

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
