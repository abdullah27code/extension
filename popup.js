const videoUrlInput = document.getElementById('videoUrl');
const saveButton = document.getElementById('saveButton');
const toggleButton = document.getElementById('toggleButton');
const runNowButton = document.getElementById('runNowButton');
const statusText = document.getElementById('status');

function isValidTikTokUrl(url) {
  return /^https:\/\/www\.tiktok\.com\/.+/i.test(url);
}

function formatTime(isoString) {
  if (!isoString) return 'never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString();
}

async function refreshUI() {
  const {
    videoUrl = '',
    automationEnabled = false,
    lastRunStatus = 'idle',
    lastRunDetails = 'Ready.',
    lastRunAt = ''
  } = await chrome.storage.sync.get([
    'videoUrl',
    'automationEnabled',
    'lastRunStatus',
    'lastRunDetails',
    'lastRunAt'
  ]);

  videoUrlInput.value = videoUrl;
  toggleButton.textContent = automationEnabled ? 'Disable' : 'Enable';

  statusText.textContent = [
    `Mode: ${automationEnabled ? 'Active' : 'Inactive'}`,
    `Last: ${lastRunStatus}`,
    `Detail: ${lastRunDetails}`,
    `At: ${formatTime(lastRunAt)}`
  ].join(' | ');
}

saveButton.addEventListener('click', async () => {
  const videoUrl = videoUrlInput.value.trim();

  if (!isValidTikTokUrl(videoUrl)) {
    statusText.textContent = 'Please enter a valid TikTok URL (https://www.tiktok.com/...).';
    return;
  }

  await chrome.storage.sync.set({ videoUrl });
  statusText.textContent = 'URL saved successfully.';
  refreshUI();
});

toggleButton.addEventListener('click', async () => {
  const { automationEnabled = false } = await chrome.storage.sync.get('automationEnabled');
  await chrome.storage.sync.set({ automationEnabled: !automationEnabled });
  statusText.textContent = `Automation ${!automationEnabled ? 'enabled' : 'disabled'}.`;
  refreshUI();
});

runNowButton.addEventListener('click', () => {
  statusText.textContent = 'Manual run started...';

  chrome.runtime.sendMessage({ type: 'RUN_NOW' }, (response) => {
    if (chrome.runtime.lastError) {
      statusText.textContent = `Error: ${chrome.runtime.lastError.message}`;
      return;
    }

    if (!response?.ok) {
      statusText.textContent = `Run failed: ${response?.error || 'Unknown error'}`;
      return;
    }

    statusText.textContent = 'Manual run sent. Check Last status below.';
    refreshUI();
  });
});

// Auto-refresh status every 2 seconds while popup is open.
setInterval(refreshUI, 2000);
refreshUI();
