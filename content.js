// Utility: wait helper.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Try multiple selectors and return the first matching element.
function findFirst(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

// Find an element with retries because TikTok UI may render late.
async function findWithRetries(selectors, attempts = 12, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    const element = findFirst(selectors);
    if (element) return element;
    await sleep(delayMs);
  }
  return null;
}

// Basic page check.
function isTikTokVideoPage() {
  return location.hostname.includes('tiktok.com') && location.pathname.includes('/video/');
}

async function runShareAutomation() {
  console.log('[TikTok Content] Starting share automation...');

  if (!isTikTokVideoPage()) {
    console.warn('[TikTok Content] Not on a TikTok video page.');
    return { ok: false, reason: 'not_video_page' };
  }

  // Share button selectors (fallback chain).
  const shareButtonSelectors = [
    'button[data-e2e="share-icon"]',
    'button[aria-label*="Share"]',
    '[data-e2e="browse-share-icon"]',
    'button:has(svg[data-e2e="share-icon"])'
  ];

  const shareButton = await findWithRetries(shareButtonSelectors);
  if (!shareButton) {
    console.warn('[TikTok Content] Share button not found.');
    return { ok: false, reason: 'share_button_not_found' };
  }

  shareButton.click();
  console.log('[TikTok Content] Share button clicked.');

  // Wait for share panel options to appear.
  await sleep(700);

  // Prefer "Copy link"; fallback to send options.
  const optionSelectors = [
    '[data-e2e="share-copy-link"]',
    'button[aria-label*="Copy link"]',
    '[role="button"][aria-label*="Copy"]',
    '[data-e2e="share-send-to-friends"]',
    'button[aria-label*="Send to friends"]',
    '[role="button"][aria-label*="Send"]'
  ];

  const optionButton = await findWithRetries(optionSelectors, 10, 400);
  if (!optionButton) {
    console.warn('[TikTok Content] Share option not found.');
    return { ok: false, reason: 'share_option_not_found' };
  }

  optionButton.click();
  console.log('[TikTok Content] Share option clicked successfully.');

  return { ok: true };
}

// Listen for background instructions.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'RUN_DAILY_SHARE') return;

  runShareAutomation()
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error('[TikTok Content] Automation failed:', error);
      sendResponse({ ok: false, reason: 'exception', error: String(error) });
    });

  return true;
});
