document.addEventListener("DOMContentLoaded", async () => {
  const API = window.AppConfig.API;
  const authUser = window.Auth ? window.Auth.getUser() : null;
  const currentUser = authUser ? authUser.username : "Guest";
  const token = window.Auth ? window.Auth.getToken() : null;

  // Cached avatar for current user
  const cachedAvatar = localStorage.getItem("protocol_avatar_url");
  function avatarUrl(username, stored) {
    if (stored) return stored;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=5b85f6&color=fff`;
  }
  const currentUserAvatar = avatarUrl(currentUser, cachedAvatar);

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
  const conversationListEl    = document.getElementById("conversation-list");
  const membersByRoleEl       = document.getElementById("members-by-role");
  const btnFindMentor         = document.getElementById("btn-find-mentor");

  let currentActiveUser = null;
  let pollInterval = null;
  let onlineRefreshInterval = null;
  // Track previous online state for animation
  let prevOnlineState = {};

  // ===================== CONVERSATIONS (left sidebar) =====================
  async function refreshConversations() {
    if (!conversationListEl || !token) return;
    try {
      const res = await fetch(`${API}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const convs = await res.json();

      // Fetch online status for conversation peers
      const allUsers = await fetchAllUsers();
      const onlineMap = {};
      allUsers.forEach(u => { onlineMap[u.username] = u.is_online; });

      if (!convs.length) {
        conversationListEl.innerHTML = `<div class="sidebar-loading" style="font-size:12px">No conversations yet.<br>Click a member to start chatting.</div>`;
        return;
      }
      conversationListEl.innerHTML = convs.map(c => {
        const avatar = c.avatar_url || avatarUrl(c.peer);
        const preview = c.last_message
          ? (c.last_message.length > 36 ? c.last_message.slice(0, 36) + "…" : c.last_message)
          : "Start a conversation";
        const isOnline = onlineMap[c.peer] ? 'online' : '';
        const isActive = c.peer === currentActiveUser ? 'active' : '';
        return `<div class="conv-item ${isActive}" data-username="${c.peer}" data-avatar="${avatar}">
          <div class="conv-avatar-wrap">
            <img class="conv-avatar" src="${avatar}" alt="${c.peer}">
            <span class="conv-status-dot ${isOnline}"></span>
          </div>
          <div class="conv-info">
            <div class="conv-name">${c.peer}</div>
            <div class="conv-preview">${preview}</div>
          </div>
        </div>`;
      }).join("");
    } catch {}
  }

  // ===================== MEMBER LIST (right sidebar, Discord-style) =====================
  async function fetchAllUsers() {
    try {
      const res = await fetch(`${API}/users`);
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  function buildMemberItem(user, roleClass) {
    const avatar = avatarUrl(user.username, user.avatar_url);
    const isOnline = user.is_online;
    const wasOnline = prevOnlineState[user.username];
    const justOnline = isOnline && !wasOnline ? 'just-online' : '';
    const offlineCls = isOnline ? '' : 'offline';
    return `<div class="member-item ${offlineCls} ${roleClass}" data-username="${user.username}" data-avatar="${avatar}">
      <div class="member-avatar-wrap">
        <img class="member-avatar" src="${avatar}" alt="${user.username}">
        <span class="member-status-dot${isOnline ? ' online ' + justOnline : ''}"></span>
      </div>
      <div class="member-info">
        <div class="member-name">${user.username}</div>
        <div class="member-role-badge">${getRoleLabel(user)}</div>
      </div>
    </div>`;
  }

  function getRoleLabel(user) {
    const role = user.role || 'member';
    const tier = user.tier || 'free';
    if (role === 'admin') return 'Admin';
    if (role === 'mentor') return 'Mentor';
    if (role === 'mod') return 'Mod';
    if (role === 'researcher') return 'Researcher';
    if (tier === 'premium') return '⭐ Premium';
    return 'Member';
  }

  function getRoleOrder(user) {
    const role = user.role || 'member';
    const tier = user.tier || 'free';
    if (role === 'admin') return 0;
    if (role === 'mentor') return 1;
    if (role === 'mod') return 2;
    if (role === 'researcher') return 3;
    if (tier === 'premium') return 4;
    return 5;
  }

  async function refreshMemberList() {
    const allUsers = await fetchAllUsers();
    const others = allUsers.filter(u => u.username !== currentUser);

    const online = others.filter(u => u.is_online).sort((a, b) => getRoleOrder(a) - getRoleOrder(b));
    const offline = others.filter(u => !u.is_online).sort((a, b) => getRoleOrder(a) - getRoleOrder(b));

    const groups = [
      { label: `Online — ${online.length}`, users: online },
      { label: `Offline — ${offline.length}`, users: offline },
    ];

    if (membersByRoleEl) {
      membersByRoleEl.innerHTML = groups.map(g => {
        if (!g.users.length) return '';
        return `<div class="role-group-header">${g.label}</div>` +
          g.users.map(u => {
            const roleClass = `role-${u.role || 'member'}`;
            return buildMemberItem(u, roleClass);
          }).join('');
      }).join('');
    }

    // Update prev state
    allUsers.forEach(u => { prevOnlineState[u.username] = u.is_online; });
  }

  // ===================== MESSAGES =====================

  // Group messages within 10 minutes from same sender
  function groupMessages(messages) {
    const groups = [];
    let currentGroup = null;
    messages.forEach(msg => {
      const ts = new Date(msg.timestamp).getTime();
      if (
        currentGroup &&
        currentGroup.sender === msg.sender &&
        ts - currentGroup.lastTs <= 10 * 60 * 1000
      ) {
        currentGroup.messages.push(msg);
        currentGroup.lastTs = ts;
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { sender: msg.sender, firstTs: ts, lastTs: ts, messages: [msg] };
      }
    });
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }

  function formatGroupTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatExactTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function isImageUrl(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url);
  }

  function renderBubble(msg, peerAvatar, isSelf, hideAvatar) {
    const exactTime = formatExactTime(msg.timestamp);
    const fileMatch = msg.content.match(/^\[file:(.+?):(.+?)\]$/);
    let bubbleContent;

    if (fileMatch) {
      const [, fileName, fileUrl] = fileMatch;
      const fullUrl = fileUrl.startsWith('http') ? fileUrl : `${API.replace('/api', '')}${fileUrl}`;
      if (isImageUrl(fileUrl)) {
        bubbleContent = `<img class="msg-media-img" src="${fullUrl}" alt="${fileName}" onclick="window.open(this.src,'_blank')">`;
      } else if (isVideoUrl(fileUrl)) {
        bubbleContent = `<video class="msg-media-video" src="${fullUrl}" controls></video>`;
      } else {
        bubbleContent = `<a href="${fullUrl}" download="${fileName}" class="msg-file-link">📎 ${fileName}</a>`;
      }
    } else {
      bubbleContent = msg.content;
    }

    if (isSelf) {
      return `<div class="msg-row msg-send${hideAvatar ? ' hide-avatar' : ''}">
        <div class="msg-content">
          <div class="msg-bubble primary-bubble" data-time="${exactTime}">${bubbleContent}</div>
        </div>
      </div>`;
    } else {
      return `<div class="msg-row msg-receive${hideAvatar ? ' hide-avatar' : ''}">
        <img class="msg-avatar" src="${peerAvatar}" alt="Avatar">
        <div class="msg-content">
          <div class="msg-bubble" data-time="${exactTime}">${bubbleContent}</div>
        </div>
      </div>`;
    }
  }

  function renderMessages(messages, peerAvatar) {
    if (!messages.length) {
      return `<div class="msg-group-header">Start a new conversation</div>`;
    }
    const groups = groupMessages(messages);
    return groups.map(group => {
      const isSelf = group.sender === currentUser;
      const bubbles = group.messages.map((msg, idx) => {
        const isLast = idx === group.messages.length - 1;
        return renderBubble(msg, peerAvatar, isSelf, !isLast);
      }).join('');
      return `<div class="msg-group">
        <div class="msg-group-header">${formatGroupTime(group.firstTs)}</div>
        ${bubbles}
      </div>`;
    }).join('');
  }

  async function loadMessages() {
    if (!currentActiveUser) return;
    try {
      const res = await fetch(`${API}/messages/${encodeURIComponent(currentUser)}/${encodeURIComponent(currentActiveUser)}`);
      const messages = await res.json();
      const peerAvatar = chatAvatarEl ? chatAvatarEl.src : avatarUrl(currentActiveUser);
      const wasAtBottom = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop <= chatMessagesContainer.clientHeight + 60;
      chatMessagesContainer.innerHTML = renderMessages(Array.isArray(messages) ? messages : [], peerAvatar);
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
    if (chatStatusEl) chatStatusEl.textContent = "Loading...";
    if (noChatEl) noChatEl.style.display = "none";
    if (activeChatEl) activeChatEl.style.display = "flex";
    // Update active state in conversation list
    document.querySelectorAll('.conv-item').forEach(el => {
      el.classList.toggle('active', el.dataset.username === username);
    });
    loadMessages();
    startPolling();
    // Update status from member list
    const allUserEls = document.querySelectorAll('.member-item');
    allUserEls.forEach(el => {
      if (el.dataset.username === username) {
        const dot = el.querySelector('.member-status-dot');
        if (chatStatusEl) chatStatusEl.textContent = dot && dot.classList.contains('online') ? 'Online' : 'Offline';
      }
    });
  }

  // ===================== SEND =====================
  async function sendMessage() {
    const text = chatInput ? chatInput.value.trim() : "";
    if (!text || !currentActiveUser || !token) return;
    try {
      await fetch(`${API}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiver: currentActiveUser, content: text }),
      });
      if (chatInput) chatInput.value = "";
      await loadMessages();
      await refreshConversations();
    } catch {}
  }

  async function sendFile(file) {
    if (!file || !currentActiveUser || !token) return;
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
      await refreshConversations();
    } catch {}
  }

  // ===================== EVENT LISTENERS =====================
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);
  if (chatInput) chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
  if (fileInput) fileInput.addEventListener("change", (e) => { if (e.target.files[0]) sendFile(e.target.files[0]); });

  // Click on conversation item (left sidebar)
  conversationListEl?.addEventListener("click", (e) => {
    const item = e.target.closest(".conv-item");
    if (!item) return;
    const username = item.dataset.username;
    const avatar = item.dataset.avatar || avatarUrl(username);
    if (username) openChat(username, avatar);
  });

  // Click on member item (right sidebar)
  membersByRoleEl?.addEventListener("click", (e) => {
    const item = e.target.closest(".member-item");
    if (!item) return;
    const username = item.dataset.username;
    const avatar = item.dataset.avatar || avatarUrl(username);
    if (username) openChat(username, avatar);
  });

  // Find Mentor button
  btnFindMentor?.addEventListener("click", () => {
    // Scroll right sidebar to mentor section or highlight mentors
    const mentorItems = membersByRoleEl?.querySelectorAll('.role-mentor');
    if (mentorItems && mentorItems.length) {
      mentorItems[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      alert("No mentors are available right now.");
    }
  });

  // ===================== INIT =====================
  await Promise.all([refreshConversations(), refreshMemberList()]);

  onlineRefreshInterval = setInterval(async () => {
    await refreshConversations();
    await refreshMemberList();
  }, 15000);
});
