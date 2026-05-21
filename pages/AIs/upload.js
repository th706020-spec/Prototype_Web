import { bindSettings, loadSettings, postJson, setBusy, setStatus } from './http.js';
import { readTextFromFile } from './file-utils.js';
import { bindFileLabel } from './ui.js';

const settingsForm = document.getElementById('upload-settings');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('upload-file');
const fileName = document.getElementById('upload-file-name');
const textInput = document.getElementById('upload-text');
const fileSection = document.getElementById('upload-file-section');
const textSection = document.getElementById('upload-text-section');
const inputType = document.getElementById('upload-input-type');
const readButton = document.getElementById('upload-read');
const uploadButton = document.getElementById('upload-send');
const statusEl = document.getElementById('upload-status');
const previewEl = document.getElementById('upload-preview');
const resultEl = document.getElementById('upload-result');
const previewPanel = document.getElementById('upload-preview-panel');
const resultPanel = document.getElementById('upload-result-panel');

function showStatus() {
  if (statusEl) {
    statusEl.classList.remove('ai-hidden');
  }
}

bindSettings(settingsForm);
bindFileLabel(fileInput, fileName);

function applyInputMode() {
  const mode = inputType.value;
  if (mode === 'text') {
    fileSection.classList.add('ai-hidden');
    textSection.classList.remove('ai-hidden');
    readButton.textContent = 'Preview text';
    fileInput.value = '';
    fileName.textContent = 'No file selected';
    return;
  }
  fileSection.classList.remove('ai-hidden');
  textSection.classList.add('ai-hidden');
  readButton.textContent = 'Read file';
  textInput.value = '';
}

inputType.addEventListener('change', applyInputMode);
applyInputMode();

function requireFileFromInput() {
  if (inputType.value === 'text') {
    const text = textInput.value.trim();
    if (!text) {
      throw new Error('Paste text first.');
    }
    return new File([text], 'upload.txt', { type: 'text/plain' });
  }
  const file = fileInput.files?.[0];
  if (!file) {
    throw new Error('Select a file first.');
  }
  return file;
}

function renderPreview(text) {
  const clipped = text.length > 4000 ? `${text.slice(0, 4000)}\n\n...[truncated]` : text;
  previewEl.textContent = clipped || 'No text extracted.';
}

async function requestUploadUrl(settings, file) {
  const payload = {
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    size: file.size,
  };
  return postJson(settings.uploadSignEndpoint, payload);
}

async function performUpload(signed, file) {
  if (!signed?.uploadUrl) {
    throw new Error('Signing response missing uploadUrl.');
  }

  if (signed.uploadFields) {
    const formData = new FormData();
    Object.entries(signed.uploadFields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file);
    const response = await fetch(signed.uploadUrl, { method: 'POST', body: formData });
    if (!response.ok) {
      throw new Error(`Upload failed with ${response.status}.`);
    }
    return;
  }

  const response = await fetch(signed.uploadUrl, {
    method: signed.method || 'PUT',
    headers: signed.headers || {},
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}.`);
  }
}

readButton.addEventListener('click', async () => {
  setBusy(readButton, true, 'Reading...');
  showStatus();
  setStatus(statusEl, inputType.value === 'text' ? 'Preparing text preview...' : 'Reading file...');
  previewEl.textContent = '';
  if (previewPanel) {
    previewPanel.classList.remove('is-hidden');
  }

  try {
    if (inputType.value === 'text') {
      const text = textInput.value.trim();
      if (!text) {
        throw new Error('Paste text first.');
      }
      renderPreview(text);
      setStatus(statusEl, 'Text preview ready.', 'success');
      return;
    }

    const file = requireFileFromInput();
    const text = await readTextFromFile(file);
    renderPreview(text);
    setStatus(statusEl, 'Text extracted.', 'success');
  } catch (error) {
    setStatus(statusEl, error.message, 'error');
  } finally {
    setBusy(readButton, false);
  }
});

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBusy(uploadButton, true, 'Uploading...');
  showStatus();
  setStatus(statusEl, 'Requesting upload URL...');
  resultEl.textContent = '';
  if (resultPanel) {
    resultPanel.classList.remove('is-hidden');
  }

  try {
    const file = requireFileFromInput();
    const settings = loadSettings();
    const signed = await requestUploadUrl(settings, file);
    setStatus(statusEl, 'Uploading to cloud...');
    await performUpload(signed, file);

    if (settings.uploadFinalizeEndpoint) {
      await postJson(settings.uploadFinalizeEndpoint, {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        size: file.size,
        fileUrl: signed.fileUrl || signed.publicUrl || '',
      });
    }

    const fileUrl = signed.fileUrl || signed.publicUrl || '(upload complete)';
    resultEl.textContent = `Upload complete.\n${fileUrl}`;
    setStatus(statusEl, 'Upload complete.', 'success');
  } catch (error) {
    setStatus(statusEl, error.message, 'error');
  } finally {
    setBusy(uploadButton, false);
  }
});
