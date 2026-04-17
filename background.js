// Alarm name used across the extension.
const DAILY_ALARM_NAME = 'dailyTiktokShare';
const RUN_TIMEOUT_MS = 90000;

async function setRunStatus(status, details = '') {
  const payload = {
    lastRunStatus: status,
    lastRunDetails: details,
    lastRunAt: new Date().toISOString()
  };

  await chrome.storage.sync.set(payload);
  console.log('[TikTok Scheduler]', status, details);
}

// Create/refresh the daily alarm.
async function ensureDailyAlarm() {
  const { automationEnabled = false } = await chrome.storage.sync.get('automationEnabled');

  if (!automationEnabled) {
    chrome.alarms.clear(DAILY_ALARM_NAME);
    await setRunStatus('idle', 'Automation disabled. Alarm cleared.');
    return;
  }

  // Run first after 1 minute, then every 24 hours.
  chrome.alarms.create(DAILY_ALARM_NAME, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
  await setRunStatus('scheduled', 'Daily alarm is active.');
}

function waitForTabComplete(tabId, timeoutMs = RUN_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Timed out waiting for TikTok page load.'));
    }, timeoutMs);

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function requestContentRun(tabId, timeoutMs = RUN_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for content script response.'));
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, { type: 'RUN_DAILY_SHARE' }, (response) => {
      clearTimeout(timer);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response || { ok: false, reason: 'empty_response' });
    });
  });
}

// Open TikTok video and trigger automation.
async function runDailyShare() {
  const { videoUrl = '', automationEnabled = false } = await chrome.storage.sync.get([
    'videoUrl',
    'automationEnabled'
  ]);

  if (!automationEnabled) {
    await setRunStatus('skipped', 'Automation is disabled.');
    return { ok: false, reason: 'disabled' };
  }

  if (!videoUrl || !videoUrl.includes('tiktok.com')) {
    await setRunStatus('failed', 'No valid TikTok URL saved.');
    return { ok: false, reason: 'invalid_url' };
  }

  await setRunStatus('running', 'Opening TikTok video...');

  // IMPORTANT: open active tab so full UI and click targets are actually rendered.
  const tab = await chrome.tabs.create({ url: videoUrl, active: true });
  if (!tab.id) {
    await setRunStatus('failed', 'Could not create TikTok tab.');
    return { ok: false, reason: 'tab_create_failed' };
  }

  await setRunStatus('running', 'Waiting page load...');
  await waitForTabComplete(tab.id);

  // Extra delay helps dynamic UI mount share controls.
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await setRunStatus('running', 'Trying share click flow...');
  const result = await requestContentRun(tab.id);

  if (!result?.ok) {
    await setRunStatus('failed', `Share flow failed: ${result?.reason || 'unknown'}`);
    return result;
  }

  await setRunStatus('success', 'Share flow completed successfully.');
  return result;
}

// Initialize default settings and schedule alarm.
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get([
    'videoUrl',
    'automationEnabled',
    'lastRunStatus',
    'lastRunDetails',
    'lastRunAt'
  ]);

  if (typeof data.automationEnabled !== 'boolean') {
    await chrome.storage.sync.set({ automationEnabled: false });
  }

  if (typeof data.videoUrl !== 'string') {
    await chrome.storage.sync.set({ videoUrl: '' });
  }

  if (typeof data.lastRunStatus !== 'string') {
    await chrome.storage.sync.set({ lastRunStatus: 'idle', lastRunDetails: 'Ready.' });
  }

  await ensureDailyAlarm();
});

// Re-schedule when storage values change.
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'sync') return;
  if (changes.automationEnabled) await ensureDailyAlarm();
});

// Execute on alarm trigger.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM_NAME) runDailyShare();
});

// Allow popup to force a manual run for testing.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'RUN_NOW') return;

  runDailyShare()
    .then((result) => sendResponse({ ok: true, result }))
    .catch(async (error) => {
      await setRunStatus('failed', String(error));
      sendResponse({ ok: false, error: String(error) });
    });

  return true;
});
