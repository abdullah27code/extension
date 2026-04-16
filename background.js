const DEFAULT_AI_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Build a clean prompt from extracted LinkedIn job data.
 */
function buildPrompt(job) {
  return [
    'You are an expert career assistant.',
    'Write a concise, personalized job application message (120-180 words).',
    'Use a confident but human tone and mention why the candidate fits the role.',
    'Avoid placeholders and avoid hallucinating achievements.',
    '',
    `Job Title: ${job.title || 'N/A'}`,
    `Company: ${job.company || 'N/A'}`,
    `Job Description: ${job.description || 'N/A'}`
  ].join('\n');
}

/**
 * Best-effort parser for the Responses API output.
 */
function extractTextFromResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const firstOutput = Array.isArray(payload.output) ? payload.output[0] : null;
  const firstContent = firstOutput && Array.isArray(firstOutput.content) ? firstOutput.content[0] : null;
  if (firstContent && typeof firstContent.text === 'string' && firstContent.text.trim()) {
    return firstContent.text.trim();
  }

  return '';
}

async function generateMessageWithAI(jobData) {
  const { aiApiKey, aiApiUrl = DEFAULT_AI_API_URL, aiModel = DEFAULT_MODEL } = await chrome.storage.sync.get([
    'aiApiKey',
    'aiApiUrl',
    'aiModel'
  ]);

  if (!aiApiKey) {
    throw new Error('Missing API key. Set `aiApiKey` in chrome.storage.sync first.');
  }

  const response = await fetch(aiApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiApiKey}`
    },
    body: JSON.stringify({
      model: aiModel,
      input: buildPrompt(jobData)
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI API request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const payload = await response.json();
  const message = extractTextFromResponse(payload);

  if (!message) {
    throw new Error('AI API returned an empty message.');
  }

  return message;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'GENERATE_AI_APPLICATION_MESSAGE') {
    return false;
  }

  (async () => {
    try {
      const generatedMessage = await generateMessageWithAI(message.jobData || {});
      sendResponse({ ok: true, generatedMessage });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
});
