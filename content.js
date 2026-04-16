const GENERATE_BUTTON_ID = 'liai-generate-btn';
const OVERLAY_ID = 'liai-overlay';

function isLinkedInJobPage() {
  return location.hostname === 'www.linkedin.com' && location.pathname.includes('/jobs/view/');
}

function extractJobData() {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';

  const title =
    text('.job-details-jobs-unified-top-card__job-title h1') ||
    text('.top-card-layout__title') ||
    text('h1');

  const company =
    text('.job-details-jobs-unified-top-card__company-name a') ||
    text('.topcard__org-name-link') ||
    text('.jobs-unified-top-card__company-name');

  const description =
    text('#job-details') ||
    text('.jobs-description__content') ||
    text('.show-more-less-html__markup');

  return { title, company, description, url: location.href };
}

function ensureModal() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div id="liai-modal" role="dialog" aria-modal="true" aria-label="Generated AI message">
      <div class="liai-header">
        <h2 class="liai-title">AI Application Message</h2>
        <button class="liai-close" id="liai-close-btn" aria-label="Close">×</button>
      </div>
      <div id="liai-status"></div>
      <div id="liai-output"></div>
      <div class="liai-actions">
        <button id="liai-copy-btn" class="liai-btn-secondary" type="button">Copy</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.style.display = 'none';
    }
  });

  document.body.appendChild(overlay);

  document.getElementById('liai-close-btn')?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  document.getElementById('liai-copy-btn')?.addEventListener('click', async () => {
    const output = document.getElementById('liai-output')?.textContent || '';
    if (!output.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setStatus('Copied to clipboard.');
    } catch {
      setStatus('Could not copy automatically. Please copy manually.', true);
    }
  });

  return overlay;
}

function setStatus(message, isError = false) {
  const statusEl = document.getElementById('liai-status');
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b91c1c' : '#6b7280';
}

function setOutput(content) {
  const outputEl = document.getElementById('liai-output');
  if (outputEl) {
    outputEl.textContent = content;
  }
}

async function onGenerateClicked() {
  const overlay = ensureModal();
  overlay.style.display = 'flex';

  setStatus('Generating message...');
  setOutput('');
  setOutput('⏳ Please wait while AI writes your personalized message.');

  const statusEl = document.getElementById('liai-status');
  if (statusEl) {
    statusEl.innerHTML = '<span class="liai-spinner"></span>Generating message...';
  }

  const jobData = extractJobData();

  chrome.runtime.sendMessage({ type: 'GENERATE_AI_APPLICATION_MESSAGE', jobData }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus(`Runtime error: ${chrome.runtime.lastError.message}`, true);
      return;
    }

    if (!response?.ok) {
      setStatus(response?.error || 'Unknown error from background worker.', true);
      return;
    }

    setStatus('Message generated successfully.');
    setOutput(response.generatedMessage);
  });
}

function injectButton() {
  if (!isLinkedInJobPage()) {
    return;
  }

  if (document.getElementById(GENERATE_BUTTON_ID)) {
    return;
  }

  const targetContainer =
    document.querySelector('.job-details-jobs-unified-top-card__primary-description-container') ||
    document.querySelector('.jobs-unified-top-card__content--two-pane') ||
    document.querySelector('main');

  if (!targetContainer) {
    return;
  }

  const button = document.createElement('button');
  button.id = GENERATE_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Generate AI Message';
  button.addEventListener('click', onGenerateClicked);

  targetContainer.prepend(button);
}

function boot() {
  injectButton();

  const observer = new MutationObserver(() => {
    injectButton();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

boot();
