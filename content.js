const GENERATE_BUTTON_ID = 'liai-generate-btn';
const OVERLAY_ID = 'liai-overlay';
const REQUEST_TIMEOUT_MS = 45000;

function isLinkedInJobPage() {
  return location.hostname.endsWith('linkedin.com') && location.pathname.startsWith('/jobs/');
}

function extractJobData() {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() || '';

  const title =
    text('.job-details-jobs-unified-top-card__job-title h1') ||
    text('.jobs-unified-top-card__job-title') ||
    text('.job-card-container__title') ||
    text('.top-card-layout__title') ||
    text('h1');

  const company =
    text('.job-details-jobs-unified-top-card__company-name a') ||
    text('.jobs-unified-top-card__company-name') ||
    text('.job-card-container__company-name') ||
    text('.topcard__org-name-link');

  const description =
    text('#job-details') ||
    text('.jobs-description__content') ||
    text('.jobs-box__html-content') ||
    text('.show-more-less-html__markup');

  return { title, company, description, url: location.href };
}

function ensureModal() {
  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) return overlay;

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
    if (event.target === overlay) overlay.style.display = 'none';
  });

  document.body.appendChild(overlay);

  document.getElementById('liai-close-btn')?.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  document.getElementById('liai-copy-btn')?.addEventListener('click', async () => {
    const output = document.getElementById('liai-output')?.textContent || '';
    if (!output.trim()) return;
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
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b91c1c' : '#6b7280';
}

function setOutput(content) {
  const outputEl = document.getElementById('liai-output');
  if (outputEl) outputEl.textContent = content;
}

function buildLocalFallbackMessage(jobData) {
  return [
    `Hi Hiring Team at ${jobData.company || 'your company'},`,
    '',
    `I’m excited to apply for the ${jobData.title || 'open role'} position.` +
      ' My background aligns with the responsibilities described, and I can contribute quickly with ownership and strong execution.',
    '',
    'I would value the opportunity to discuss how I can support your team’s goals.',
    '',
    'Best regards,'
  ].join('\n');
}

function requestGeneratedMessage(jobData) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for background response.'));
    }, REQUEST_TIMEOUT_MS);

    chrome.runtime.sendMessage({ type: 'GENERATE_AI_APPLICATION_MESSAGE', jobData }, (response) => {
      clearTimeout(timeout);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || 'Unknown error from background worker.'));
        return;
      }

      resolve(response.generatedMessage);
    });
  });
}

async function onGenerateClicked() {
  const overlay = ensureModal();
  overlay.style.display = 'flex';

  setOutput('');
  const statusEl = document.getElementById('liai-status');
  if (statusEl) {
    statusEl.innerHTML = '<span class="liai-spinner"></span>Generating message...';
  }

  const jobData = extractJobData();

  try {
    if (!jobData.title && !jobData.company && !jobData.description) {
      throw new Error('Could not extract job details from this page.');
    }

    const generatedMessage = await requestGeneratedMessage(jobData);
    setStatus('Message generated successfully.');
    setOutput(generatedMessage);
  } catch (error) {
    const fallback = buildLocalFallbackMessage(jobData);
    setStatus(
      `AI request failed: ${error instanceof Error ? error.message : 'Unexpected error'}. Showing fallback message.`,
      true
    );
    setOutput(fallback);
  }
}

function ensureButton() {
  if (!isLinkedInJobPage()) return;
  if (document.getElementById(GENERATE_BUTTON_ID)) return;

  const button = document.createElement('button');
  button.id = GENERATE_BUTTON_ID;
  button.type = 'button';
  button.textContent = 'Generate AI Message';
  document.body.appendChild(button);
}

function bindGlobalClickHandler() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== GENERATE_BUTTON_ID) return;

    event.preventDefault();
    onGenerateClicked();
  });
}

function boot() {
  ensureModal();
  ensureButton();
  bindGlobalClickHandler();

  const observer = new MutationObserver(() => ensureButton());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
