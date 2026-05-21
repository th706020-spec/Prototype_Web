import { bindSettings, loadSettings, postJson, setBusy, setStatus } from './http.js';

const settingsForm = document.getElementById('references-settings');
const form = document.getElementById('references-form');
const doiInput = document.getElementById('references-doi');
const textInput = document.getElementById('references-text');
const doiSection = document.getElementById('references-doi-section');
const textSection = document.getElementById('references-text-section');
const inputType = document.getElementById('references-input-type');
const statusEl = document.getElementById('references-status');
const resultsEl = document.getElementById('references-results');
const panelEl = document.getElementById('references-panel');
const ieeeOutput = document.getElementById('references-ieee');
const apaOutput = document.getElementById('references-apa');
const submitButton = document.getElementById('references-submit');

bindSettings(settingsForm);

function applyInputMode() {
  const mode = inputType.value;
  if (mode === 'manual') {
    doiSection.classList.add('ai-hidden');
    textSection.classList.remove('ai-hidden');
    return;
  }
  if (mode === 'both') {
    doiSection.classList.remove('ai-hidden');
    textSection.classList.remove('ai-hidden');
    return;
  }
  doiSection.classList.remove('ai-hidden');
  textSection.classList.add('ai-hidden');
}

inputType.addEventListener('change', applyInputMode);
applyInputMode();

function renderCitations(data) {
  const ieee = data?.citations?.IEEE || data?.ieee || '';
  const apa = data?.citations?.APA || data?.apa || '';
  ieeeOutput.textContent = ieee || 'No IEEE citation returned.';
  apaOutput.textContent = apa || 'No APA citation returned.';
  if (resultsEl) {
    resultsEl.classList.add('is-visible');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(submitButton, true, 'Generating...');
  setStatus(statusEl, 'Generating citations...');
  if (panelEl) {
    panelEl.classList.remove('is-hidden');
  }
  ieeeOutput.textContent = '';
  apaOutput.textContent = '';
  if (resultsEl) {
    resultsEl.classList.remove('is-visible');
  }

  try {
    const doiOrUrl = doiInput.value.trim();
    const rawText = textInput.value.trim();
    if (inputType.value === 'manual' && !rawText) {
      throw new Error('Provide manual source details.');
    }
    if (inputType.value === 'doi' && !doiOrUrl) {
      throw new Error('Provide a DOI or URL.');
    }
    if (inputType.value === 'both' && !doiOrUrl && !rawText) {
      throw new Error('Provide a DOI/URL or manual details.');
    }
    const settings = loadSettings();
    const payload = { doiOrUrl, rawText, styles: ['IEEE', 'APA'] };
    const data = await postJson(settings.referencesEndpoint, payload);
    renderCitations(data);
    setStatus(statusEl, 'Citations generated.', 'success');
  } catch (error) {
    setStatus(statusEl, error.message, 'error');
  } finally {
    setBusy(submitButton, false);
  }
});
