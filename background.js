// Alarm name used across the extension.
const DAILY_ALARM_NAME = 'dailyTiktokShare';

// Create/refresh the daily alarm.
async function ensureDailyAlarm() {
  const { automationEnabled = false } = await chrome.storage.sync.get('automationEnabled');

  if (!automationEnabled) {
    chrome.alarms.clear(DAILY_ALARM_NAME);
    console.log('[TikTok Scheduler] Automation disabled. Alarm cleared.');
    return;
  }

  // Run first after 1 minute, then every 24 hours.
  chrome.alarms.create(DAILY_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
  console.log('[TikTok Scheduler] Daily alarm scheduled.');
}

// Send a message to content script when the tab is fully loaded.
function triggerShareOnTab(tabId) {
  chrome.tabs.sendMessage(tabId, { type: 'RUN_DAILY_SHARE' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[TikTok Scheduler] Could not message content script:', chrome.runtime.lastError.message);
      return;
    }

    console.log('[TikTok Scheduler] Content script response:', response);
  });
}

// Open TikTok video and trigger automation.
async function runDailyShare() {
  const { videoUrl = '', automationEnabled = false } = await chrome.storage.sync.get([
    'videoUrl',
    'automationEnabled'
  ]);

  if (!automationEnabled) {
    console.log('[TikTok Scheduler] Skipping run: automation is disabled.');
    return;
  }

  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    console.warn('[TikTok Scheduler] Skipping run: no valid TikTok URL saved.');
    return;
  }

  // Open a background tab (inactive) with saved TikTok URL.
  const tab = await chrome.tabs.create({ url: videoUrl, active: false });
  if (!tab.id) {
    console.warn('[TikTok Scheduler] Could not create tab for daily share.');
    return;
  }

  // Wait for page load, then ask content script to execute clicks.
  const onUpdated = (updatedTabId, info) => {
    if (updatedTabId === tab.id && info.status === 'complete') {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      triggerShareOnTab(tab.id);
    }
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
}

// Initialize default settings and schedule alarm.
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(['videoUrl', 'automationEnabled']);

  if (typeof data.automationEnabled !== 'boolean') {
    await chrome.storage.sync.set({ automationEnabled: false });
  }

  if (typeof data.videoUrl !== 'string') {
    await chrome.storage.sync.set({ videoUrl: '' });
  }

  await ensureDailyAlarm();
  console.log('[TikTok Scheduler] Extension installed and initialized.');
});

// Re-schedule when storage values change.
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'sync') return;

  if (changes.automationEnabled) {
    await ensureDailyAlarm();
  }
});

// Execute on alarm trigger.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM_NAME) {
    console.log('[TikTok Scheduler] Alarm fired. Running daily share flow.');
    runDailyShare();
  }
});

// Allow popup to force a manual run for testing.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'RUN_NOW') return;

  runDailyShare()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
