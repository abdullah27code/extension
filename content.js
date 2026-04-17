// Utility delay.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Find first element matching selector array.
function findBySelectors(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

// Find clickable element by visible text (supports EN + TR fallbacks).
function findButtonByText(textCandidates) {
  const candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
  return (
    candidates.find((node) => {
      const text = (node.textContent || '').trim().toLowerCase();
      return textCandidates.some((t) => text.includes(t));
    }) || null
  );
}

async function findWithRetries(fn, attempts = 12, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    const value = fn();
    if (value) return value;
    await sleep(delayMs);
  }
  return null;
}

function isTikTokVideoPage() {
  return location.hostname.includes('tiktok.com') && location.pathname.includes('/video/');
}

async function runShareAutomation() {
  console.log('[TikTok Content] Share flow started:', location.href);

  if (!isTikTokVideoPage()) {
    return { ok: false, reason: 'not_video_page' };
  }

  const shareButton = await findWithRetries(() => {
    const bySelector = findBySelectors([
      'button[data-e2e="share-icon"]',
      '[data-e2e="browse-share-icon"]',
      'button[aria-label*="Share"]',
      '[role="button"][aria-label*="Share"]'
    ]);

    if (bySelector) return bySelector;

    return findButtonByText(['share', 'paylaş']);
  });

  if (!shareButton) {
    return { ok: false, reason: 'share_button_not_found' };
  }

  shareButton.click();
  console.log('[TikTok Content] Share button clicked.');

  // Wait for share panel animation/render.
  await sleep(900);

  const shareOption = await findWithRetries(() => {
    const bySelector = findBySelectors([
      '[data-e2e="share-copy-link"]',
      '[data-e2e="share-send-to-friends"]',
      'button[aria-label*="Copy link"]',
      '[role="button"][aria-label*="Copy link"]'
    ]);

    if (bySelector) return bySelector;

    return findButtonByText(['copy link', 'copy', 'bağlantıyı kopyala', 'kopyala', 'send to friends']);
  }, 14, 450);

  if (!shareOption) {
    return { ok: false, reason: 'share_option_not_found' };
  }

  shareOption.click();
  console.log('[TikTok Content] Share option clicked.');

  return { ok: true, reason: 'share_completed' };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'RUN_DAILY_SHARE') return;

  runShareAutomation()
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error('[TikTok Content] Share flow exception:', error);
      sendResponse({ ok: false, reason: 'exception', error: String(error) });
    });

  return true;
});
