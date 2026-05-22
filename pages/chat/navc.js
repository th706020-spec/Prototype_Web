document.addEventListener("DOMContentLoaded", async () => {
  const API = window.AppConfig.API;

  const authUser = window.Auth ? window.Auth.getUser() : null;
  const currentUser = authUser ? authUser.username : "Guest";
  const token = window.Auth ? window.Auth.getToken() : null;

  function avatarUrl(username, stored) {
    if (stored) return stored;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5b85f6&color=fff`;
  }

  const currentUserAvatar = avatarUrl(currentUser);

  // Update profile card
  const profileAvatar = document.querySelector(".profile-avatar");
  const profileName   = document.querySelector(".profile-name");
  const profileTitle  = document.querySelector(".profile-title");
  if (profileAvatar) profileAvatar.src = currentUserAvatar;
  if (profileName)   profileName.textContent = currentUser;
  if (profileTitle)  profileTitle.textContent = authUser?.tier === "premium" ? "Premium Member" : "Member";

  // DOM refs
  const activeChatEl          = document.getElementById("active-chat");
  const noChatEl              = document.getElementById("no-chat-selected");
  const chatAvatarEl          = document.getElementById("chat-header-avatar");
  const chatNameEl            = document.getElementById("chat-header-name");
  const chatStatusEl          = document.getElementById("chat-header-status");
  const chatMessagesContainer = document.getElementById("chat-messages-container");
  const chatInput             = document.getElementById("chat-text-input");
  const sendBtn               = document.getElementById("chat-send-btn");
  const fileInput             = document.getElementById("chat-file-input");
  const sidebarMainView       = document.getElementById("sidebar-main-view");
  const sidebarListView       = document.getElementById("sidebar-list-view");
  const btnBackSidebar        = document.getElementById("btn-back-sidebar");
  const listViewTitle         = document.getElementById("list-view-title");
  const listViewContent       = document.getElementById("list-view-content");
  const btnViewAllMembers     = document.getElementById("btn-view-all-members");
  const btnViewAllMentors     = document.getElementById("btn-view-all-mentors");
  const btnFindMentor         = document.getElementById("btn-find-mentor");
  const memberRowsEl          = document.getElementById("member-rows");
  const mentorRowsEl          = document.getElementById("mentor-rows");

  const conversationRowsEl = document.getElementById("conversation-rows");

  let currentActiveUser = null;
  let pollInterval = null;
  let onlineRefreshInterval = null;

  // Fetch users (online only)
  async function fetchUsers() {
    try {
      const res = await fetch(`${API}/users`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  function buildMemberRow(user) {
    const avatar = avatarUrl(user.username, user.avatar_url);
    const status = user.tier === "premium" ? "Premium Member" : "Member";
    return `
      <div class="messenger-row" data-username="${user.username}" data-avatar="${avatar}">
        <div class="avatar-with-status">
          <img class="row-avatar" src="${avatar}" alt="${user.username}">
          <span class="status-dot"></span>
        </div>
        <div class="row-info">
          <h4>${user.username}</h4>
          <span>${status}</span>
        </div>
      </div>`;
  }

  // Render message — handles file attachments
  function renderMessage(msg, peerAvatar) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const fileMatch = msg.content.match(/^\[file:(.+?):(.+?)\]$/);
    let bubble;
    if (fileMatch) {
      const [, fileName, fileUrl] = fileMatch;
      bubble = `<a href="${fileUrl}" download="${fileName}" class="msg-file-link">[file] ${fileName}</a>`;
    } else {
      bubble = msg.content;
    }
    if (msg.sender === currentUser) {
      return `<div class="msg-time">${time}</div><div class="msg-row msg-send"><div class="msg-content"><div class="msg-bubble primary-bubble">${bubble}</div></div></div>`;
    }
    return `<div class="msg-time">${time}</div><div class="msg-row msg-receive"><img class="msg-avatar" src="${peerAvatar}" alt="Avatar"><div class="msg-content"><div class="msg-bubble">${bubble}</div></div></div>`;
  }

  // Load messages for active chat
  async function loadMessages() {
    if (!currentActiveUser) return;
    try {
      const res = await fetch(`${API}/messages/${encodeURIComponent(currentUser)}/${encodeURIComponent(currentActiveUser)}`);
      const messages = await res.json();
      const peerAvatar = chatAvatarEl ? chatAvatarEl.src : currentUserAvatar;
      const wasAtBottom = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop <= chatMessagesContainer.clientHeight + 40;
      chatMessagesContainer.innerHTML = messages.length
        ? messages.map((m) => renderMessage(m, peerAvatar)).join("")
        : '<div class="msg-time">Start a new conversation</div>';
      if (wasAtBottom) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch {}
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(loadMessages, 3000);
  }

  function openChat(username, userAvatar) {
    currentActiveUser = username;
    if (chatAvatarEl) chatAvatarEl.src = userAvatar;
    if (chatNameEl) chatNameEl.textContent = username;
    if (chatStatusEl) chatStatusEl.textContent = "Online";
    if (noChatEl) noChatEl.style.display = "none";
    if (activeChatEl) activeChatEl.style.display = "flex";
    loadMessages();
    startPolling();
  }

  // Build a conversation row (Messenger-style recent chat)
  function buildConversationRow(conv) {
    const avatar = conv.avatar_url
      ? conv.avatar_url
      : avatarUrl(conv.peer);
    const preview = conv.last_message
      ? (conv.last_message.length > 40 ? conv.last_message.slice(0, 40) + "…" : conv.last_message)
      : "";
    return `
      <div class="messenger-row" data-username="${conv.peer}" data-avatar="${avatar}">
        <div class="avatar-with-status">
          <img class="row-avatar" src="${avatar}" alt="${conv.peer}">
        </div>
        <div class="row-info">
          <h4>${conv.peer}</h4>
          <span style="font-size:12px;color:var(--clr-muted)">${preview}</span>
        </div>
      </div>`;
  }

  // Fetch and render online member/mentor lists
  async function refreshOnlineLists() {
    const allUsers = await fetchUsers();
    const onlineUsers = allUsers.filter((u) => u.username !== currentUser && u.is_online);
    const onlineMembers = onlineUsers.filter((u) => u.tier !== "premium");
    const onlineMentors = onlineUsers.filter((u) => u.tier === "premium");

    if (memberRowsEl) {
      memberRowsEl.innerHTML = onlineMembers.length
        ? onlineMembers.slice(0, 3).map(buildMemberRow).join("")
        : `<p style="padding:12px;color:var(--clr-muted);font-size:13px">No members online</p>`;
    }
    if (mentorRowsEl) {
      mentorRowsEl.innerHTML = onlineMentors.length
        ? onlineMentors.slice(0, 1).map(buildMemberRow).join("")
        : `<p style="padding:12px;color:var(--clr-muted);font-size:13px">No mentors online</p>`;
    }
  }

  // Fetch and render conversation history
  async function refreshConversations() {
    if (!conversationRowsEl || !token) return;
    try {
      const res = await fetch(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const convs = await res.json();
      conversationRowsEl.innerHTML = convs.length
        ? convs.map(buildConversationRow).join("")
        : `<p style="padding:12px;color:var(--clr-muted);font-size:13px">No conversations yet</p>`;
    } catch {}
  }

  // Initial load
  await refreshOnlineLists();
  await refreshConversations();

  // Auto-refresh online list every 15s
  onlineRefreshInterval = setInterval(async () => {
    await refreshOnlineLists();
    await refreshConversations();
  }, 15000);

  // Click on member row
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".messenger-row");
    if (!row) return;
    const username = row.dataset.username;
    const avatar = row.dataset.avatar || currentUserAvatar;
    if (username) openChat(username, avatar);
  });

  // Send text message
  async function sendMessage() {
    const text = chatInput ? chatInput.value.trim() : "";
    if (!text || !currentActiveUser) return;
    try {
      await fetch(`${API}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ receiver: currentActiveUser, content: text }),
      });
      if (chatInput) chatInput.value = "";
      await loadMessages();
      await refreshConversations();
    } catch {}
  }

  // Send file
  async function sendFile(file) {
    if (!file || !currentActiveUser) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("receiver", currentActiveUser);
    try {
      await fetch(`${API}/messages/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      await loadMessages();
    } catch {}
  }

  if (sendBtn) sendBtn.addEventListener("click", sendMessage);
  if (chatInput) chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
  if (fileInput) fileInput.addEventListener("change", (e) => { if (e.target.files[0]) sendFile(e.target.files[0]); });

  // Sidebar view switch
  const switchToList = (title, contentHTML) => {
    sidebarMainView.style.display = "none";
    sidebarListView.style.display = "block";
    listViewTitle.innerText = title;
    listViewContent.innerHTML = contentHTML;
  };

  btnViewAllMembers?.addEventListener("click", async (e) => {
    e.preventDefault();
    const users = await fetchUsers();
    const online = users.filter((u) => u.username !== currentUser && u.is_online && u.tier !== "premium");
    switchToList(
      "Online Members",
      online.length ? online.map(buildMemberRow).join("") : `<p style="padding:16px;color:var(--clr-muted)">No members online</p>`
    );
  });

  btnViewAllMentors?.addEventListener("click", async (e) => {
    e.preventDefault();
    const users = await fetchUsers();
    const online = users.filter((u) => u.is_online && u.tier === "premium");
    switchToList(
      "Online Mentors",
      online.length ? online.map(buildMemberRow).join("") : `<p style="padding:16px;color:var(--clr-muted)">No mentors online</p>`
    );
  });

  btnFindMentor?.addEventListener("click", async (e) => {
    e.preventDefault();
    const users = await fetchUsers();
    const online = users.filter((u) => u.is_online && u.tier === "premium");
    switchToList(
      "Available Mentors",
      online.length ? online.map(buildMemberRow).join("") : `<p style="padding:16px;color:var(--clr-muted)">No mentors online right now</p>`
    );
  });

  btnBackSidebar?.addEventListener("click", () => {
    sidebarListView.style.display = "none";
    sidebarMainView.style.display = "block";
  });
});
