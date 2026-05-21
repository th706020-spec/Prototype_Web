import { bindSettings, loadSettings, postJson, setBusy, setStatus } from './http.js';

const settingsForm = document.getElementById('chat-settings');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');
const chatStatus = document.getElementById('chat-status');
const chatSend = document.getElementById('chat-send');
const chatLayout = document.getElementById('chat-layout');
const sidebarToggle = document.getElementById('chat-sidebar-toggle');
const newChatButton = document.getElementById('chat-new');
const chatHistoryList = document.getElementById('chat-history-list');

const chats = [];
let activeChat = null;

bindSettings(settingsForm);

function resizeChatInput() {
  chatInput.style.height = 'auto';
  const nextHeight = Math.min(chatInput.scrollHeight, 160);
  chatInput.style.height = `${nextHeight}px`;
}

chatInput.addEventListener('input', resizeChatInput);
resizeChatInput();

function createChat() {
  return {
    id: `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: 'New chat',
    messages: [],
  };
}

function renderChatList() {
  if (!chatHistoryList) {
    return;
  }
  chatHistoryList.innerHTML = '';
  chats.forEach((chat) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ai-chat-history-item';
    button.dataset.chatId = chat.id;
    if (activeChat && chat.id === activeChat.id) {
      button.classList.add('is-active');
    }
    const label = document.createElement('span');
    label.textContent = chat.title;
    button.appendChild(label);
    chatHistoryList.appendChild(button);
  });
}

function renderEmptyState() {
  chatHistory.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'ai-chat-empty';
  empty.textContent = 'Start a new chat by sending a message.';
  chatHistory.appendChild(empty);
}

function renderMessage(role, text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ai-message';
  wrapper.dataset.role = role;

  const empty = chatHistory.querySelector('.ai-chat-empty');
  if (empty) {
    empty.remove();
  }

  const title = document.createElement('div');
  title.className = 'ai-message-title';
  title.textContent = role === 'user' ? 'You' : 'Assistant';

  const body = document.createElement('div');
  body.textContent = text;

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  chatHistory.appendChild(wrapper);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function renderChatMessages(chat) {
  if (!chat || chat.messages.length === 0) {
    renderEmptyState();
    return;
  }
  chatHistory.innerHTML = '';
  chat.messages.forEach((message) => {
    renderMessage(message.role, message.text);
  });
}

function setActiveChatById(chatId) {
  const next = chats.find((chat) => chat.id === chatId);
  if (!next) {
    return;
  }
  activeChat = next;
  renderChatList();
  renderChatMessages(activeChat);
}

async function callGemini(settings, history) {
  if (!settings.geminiApiKey) {
    throw new Error('Gemini API key is required when no chat endpoint is set.');
  }
  const url = `${settings.geminiApiBase}/models/${settings.geminiModel}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
  const contents = history.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.text }],
  }));
  const payload = { contents };
  const data = await postJson(url, payload);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned no text.');
  }
  return text;
}

async function sendMessage(message) {
  const settings = loadSettings();
  const payload = {
    message,
    messages: activeChat.messages.map((item) => ({ role: item.role, text: item.text })),
  };

  if (settings.chatEndpoint) {
    const data = await postJson(settings.chatEndpoint, payload);
    return data?.reply || data?.message || JSON.stringify(data, null, 2);
  }

  return callGemini(settings, activeChat.messages);
}

if (!activeChat) {
  activeChat = createChat();
  chats.push(activeChat);
  renderChatList();
  renderChatMessages(activeChat);
}

if (chatHistoryList) {
  chatHistoryList.addEventListener('click', (event) => {
    const target = event.target.closest('[data-chat-id]');
    if (!target) {
      return;
    }
    setActiveChatById(target.dataset.chatId);
  });
}

if (sidebarToggle && chatLayout) {
  sidebarToggle.addEventListener('click', () => {
    chatLayout.classList.toggle('is-collapsed');
  });
}

if (newChatButton) {
  newChatButton.addEventListener('click', () => {
    const freshChat = createChat();
    chats.unshift(freshChat);
    activeChat = freshChat;
    renderChatList();
    renderChatMessages(activeChat);
    setStatus(chatStatus, 'New chat started.');
  });
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  activeChat.messages.push({ role: 'user', text });
  renderMessage('user', text);
  chatInput.value = '';
  resizeChatInput();

  if (activeChat.title === 'New chat') {
    activeChat.title = text.slice(0, 28);
    renderChatList();
  }

  setBusy(chatSend, true, 'Sending...');
  setStatus(chatStatus, 'Sending message...');

  try {
    const reply = await sendMessage(text);
    activeChat.messages.push({ role: 'assistant', text: reply });
    renderMessage('assistant', reply);
    setStatus(chatStatus, 'Reply received.', 'success');
  } catch (error) {
    setStatus(chatStatus, error.message, 'error');
  } finally {
    setBusy(chatSend, false);
  }
});
