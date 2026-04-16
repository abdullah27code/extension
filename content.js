// Listen for messages from popup.js.
chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'RUN_PAGE_ACTIONS') {
    return;
  }

  // 1) Change current page background color.
  document.body.style.backgroundColor = '#fff3cd';

  // 2) Collect all image URLs from the page and log them.
  const imageElements = Array.from(document.querySelectorAll('img'));
  const imageUrls = imageElements
    .map((img) => img.src)
    .filter((src) => typeof src === 'string' && src.length > 0);

  console.log('[Extension] Found image URLs:', imageUrls);
});
