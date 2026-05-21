import { defaultSettings } from './config.js';

const SETTINGS_KEY = 'ais-settings';

export function loadSettings() {
  let stored = {};
  const raw = sessionStorage.getItem(SETTINGS_KEY);
  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch (error) {
      throw new Error('Failed to parse stored settings.');
    }
  }
  return { ...defaultSettings, ...stored };
}

export function saveSettings(next) {
  sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export function bindSettings(form) {
  const settings = loadSettings();
  form.querySelectorAll('[data-setting]').forEach((input) => {
    const key = input.dataset.setting;
    if (!key) {
      return;
    }
    input.value = settings[key] ?? '';
  });

  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      return;
    }
    const key = target.dataset.setting;
    if (!key) {
      return;
    }
    const current = loadSettings();
    const next = { ...current, [key]: target.value.trim() };
    saveSettings(next);
  });
}

export function setStatus(element, message, variant = '') {
  element.textContent = message;
  element.classList.remove('ai-status--error', 'ai-status--success');
  if (variant) {
    element.classList.add(`ai-status--${variant}`);
  }
}

export function setBusy(button, busy, labelWhenBusy) {
  button.disabled = busy;
  if (labelWhenBusy) {
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = busy ? labelWhenBusy : button.dataset.label;
  }
}

export async function postJson(url, body, extraHeaders = {}) {
  if (!url) {
    throw new Error('Missing endpoint URL.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let data = text;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}
