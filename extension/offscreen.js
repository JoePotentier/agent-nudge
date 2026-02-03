// Agent Nudge Offscreen Document
// Handles audio playback to avoid autoplay policy restrictions in content scripts

let audioContext = null;

// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAY_SOUND') {
    playNotificationSound();
  }
});

// Play a pleasant notification sound using Web Audio API
function playNotificationSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Resume context if suspended
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
