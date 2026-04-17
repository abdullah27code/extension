const videoUrlInput = document.getElementById('videoUrl');
const saveButton = document.getElementById('saveButton');
const toggleButton = document.getElementById('toggleButton');
const runNowButton = document.getElementById('runNowButton');
const statusText = document.getElementById('status');

function isValidTikTokUrl(url) {
  return /^https:\/\/www\.tiktok\.com\/.+/i.test(url);
}

async function refreshUI() {
  const { videoUrl = '', automationEnabled = false } = await chrome.storage.sync.get([
    'videoUrl',
    'automationEnabled'
  ]);

  videoUrlInput.value = videoUrl;
  toggleButton.textContent = automationEnabled ? 'Disable' : 'Enable';
  statusText.textContent = `Status: ${automationEnabled ? 'Active' : 'Inactive'}${
    videoUrl ? ' | URL Saved' : ' | No URL'
  }`;
}

saveButton.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value.trim();

  if (!isValidTikTokUrl(videoUrl)) {
    statusText.textContent = 'Status: Please enter a valid TikTok URL.';
    return;
  }

  await chrome.storage.sync.set({ videoUrl });
  statusText.textContent = 'Status: URL saved.';
  console.log('[Popup] URL saved:', videoUrl);

  refreshUI();
});

toggleButton.addEventListener('click', async () => {
  const { automationEnabled = false } = await chrome.storage.sync.get('automationEnabled');
  await chrome.storage.sync.set({ automationEnabled: !automationEnabled });

  statusText.textContent = `Status: Automation ${!automationEnabled ? 'enabled' : 'disabled'}.`;
  console.log('[Popup] Automation toggled:', !automationEnabled);

  refreshUI();
});

runNowButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RUN_NOW' }, (response) => {
    if (chrome.runtime.lastError) {
      statusText.textContent = `Status: Error - ${chrome.runtime.lastError.message}`;
      return;
    }

    if (!response?.ok) {
      statusText.textContent = `Status: Run failed - ${response?.error || 'Unknown error'}`;
      return;
    }

    statusText.textContent = 'Status: Manual run triggered.';
  });
});

// Initial UI state.
refreshUI();
