// Wait for popup DOM to be ready.
document.addEventListener('DOMContentLoaded', () => {
  const runActionButton = document.getElementById('runActionButton');

  // Send a message to the content script in the active tab.
  runActionButton.addEventListener('click', async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Guard: If no active tab exists, do nothing.
    if (!activeTab?.id) {
      return;
    }

    // Popup -> Content Script communication happens here.
    chrome.tabs.sendMessage(activeTab.id, { type: 'RUN_PAGE_ACTIONS' });
  });
});
