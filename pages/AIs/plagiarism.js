import { bindSettings, loadSettings, postJson, setBusy, setStatus } from './http.js';
import { readTextFromFile } from './file-utils.js';
import { bindFileLabel } from './ui.js';

const settingsForm = document.getElementById('plagiarism-settings');
const form = document.getElementById('plagiarism-form');
const textArea = document.getElementById('plagiarism-text');
const fileInput = document.getElementById('plagiarism-file');
const fileName = document.getElementById('plagiarism-file-name');
const textSection = document.getElementById('plagiarism-text-section');
const fileSection = document.getElementById('plagiarism-file-section');
const inputType = document.getElementById('plagiarism-input-type');
const statusEl = document.getElementById('plagiarism-status');
const outputEl = document.getElementById('plagiarism-output');
const submitButton = document.getElementById('plagiarism-submit');

bindSettings(settingsForm);
bindFileLabel(fileInput, fileName);

function applyInputMode() {
  const mode = inputType.value;
  if (mode === 'file') {
    textSection.classList.add('ai-hidden');
    fileSection.classList.remove('ai-hidden');
    textArea.value = '';
    return;
  }
  textSection.classList.remove('ai-hidden');
  fileSection.classList.add('ai-hidden');
  fileInput.value = '';
  fileName.textContent = 'No file selected';
}

inputType.addEventListener('change', applyInputMode);
applyInputMode();

function renderResult(data) {
  const lines = [];
  if (typeof data?.score === 'number') {
    lines.push(`Similarity score: ${data.score}`);
  }
  if (typeof data?.percent === 'number') {
    lines.push(`Similarity percent: ${data.percent}`);
  }
  const matches = data?.matches || data?.sources;
  if (Array.isArray(matches) && matches.length > 0) {
    lines.push('Matches:');
    matches.forEach((match, index) => {
      const label = match.source || match.url || `Match ${index + 1}`;
      const value = match.similarity ?? match.percent ?? match.score ?? '';
      lines.push(`- ${label} ${value !== '' ? `(${value})` : ''}`);
    });
  }
  if (lines.length === 0) {
    outputEl.textContent = JSON.stringify(data, null, 2);
    return;
  }
  outputEl.textContent = lines.join('\n');
}

async function getInputText() {
  if (inputType.value === 'file') {
    const file = fileInput.files?.[0];
    if (!file) {
      throw new Error('Select a file to check.');
    }
    return readTextFromFile(file);
  }

  const text = textArea.value.trim();
  if (!text) {
    throw new Error('Provide text to check.');
  }
  return text;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(submitButton, true, 'Checking...');
  setStatus(statusEl, 'Processing...');
  outputEl.textContent = '';

  try {
    const text = await getInputText();
    const settings = loadSettings();
    const data = await postJson(settings.plagiarismEndpoint, { text });
    renderResult(data);
    setStatus(statusEl, 'Check complete.', 'success');
  } catch (error) {
    setStatus(statusEl, error.message, 'error');
  } finally {
    setBusy(submitButton, false);
  }
});
