document.addEventListener("DOMContentLoaded", async () => {
  const API = window.AppConfig.API;

  // Use logged-in user
  const authUser = window.Auth ? window.Auth.getUser() : null;
  const currentUser = authUser ? authUser.username : "Guest";
  const currentUserAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=5b85f6&color=fff`;

  // Update profile card with logged-in user
  const profileAvatar = document.querySelector(".profile-avatar");
  const profileName   = document.querySelector(".profile-name");
  const profileTitle  = document.querySelector(".profile-title");
  if (profileAvatar) profileAvatar.src = currentUserAvatar;
  if (profileName)   profileName.textContent = currentUser;
  if (profileTitle)  profileTitle.textContent = authUser?.tier === "premium" ? "⭐ Premium Member" : "Member";

  // DOM refs
  const chatAvatar             = document.getElementById("chat-header-avatar");
  const chatName               = document.getElementById("chat-header-name");
  const chatStatus             = document.getElementById("chat-header-status");
  const chatMessagesContainer  = document.getElementById("chat-messages-container");
  const chatInput              = document.querySelector(".chat-input-box input");
  const sendBtn                = document.querySelector(".chat-send-btn");
  const sidebarMainView        = document.getElementById("sidebar-main-view");
  const sidebarListView        = document.getElementById("sidebar-list-view");
  const btnBackSidebar         = document.getElementById("btn-back-sidebar");
  const listViewTitle          = document.getElementById("list-view-title");
  const listViewContent        = document.getElementById("list-view-content");
  const btnViewAllMembers      = document.getElementById("btn-view-all-members");
  const btnViewAllMentors      = document.getElementById("btn-view-all-mentors");
  const btnFindMentor          = document.getElementById("btn-find-mentor");
  const memberRowsEl           = document.getElementById("member-rows");
  const mentorRowsEl           = document.getElementById("mentor-rows");

  let currentActiveUser = null;

  // Build a member row from a user object
  function buildMemberRow(user) {
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`;
    const status = user.tier === "premium" ? "⭐ Premium Member" : "Member";
    return `
      <div class="messenger-row">
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

  // Fetch registered users from DB
  async function fetchUsers() {
    try {
      const res = await fetch(`${API}/users`);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return [];
    }
  }

  // Populate the initial member list (first 3)
  const allUsers = await fetchUsers();
  const preview = allUsers.filter((u) => u.username !== currentUser).slice(0, 3);
  if (memberRowsEl) {
    memberRowsEl.innerHTML = preview.length
      ? preview.map(buildMemberRow).join("")
      : `<p style="padding:12px;color:var(--clr-muted);font-size:13px">Chưa có thành viên nào</p>`;
  }
  // Mentor preview: first 1 premium user
  const mentorPreview = allUsers.filter((u) => u.tier === "premium").slice(0, 1);
  if (mentorRowsEl) {
    mentorRowsEl.innerHTML = mentorPreview.length
      ? mentorPreview.map(buildMemberRow).join("")
      : `<p style="padding:12px;color:var(--clr-muted);font-size:13px">Chưa có mentor nào</p>`;
  }

  // Chat message loader
  const loadMessages = async (contactName) => {
    try {
      const res = await fetch(`${API}/messages/${encodeURIComponent(currentUser)}/${encodeURIComponent(contactName)}`);
      const messages = await res.json();
      chatMessagesContainer.innerHTML = "";

      if (!messages.length) {
        chatMessagesContainer.innerHTML = '<div class="msg-time">Bắt đầu cuộc trò chuyện mới</div>';
        return;
      }

      chatMessagesContainer.innerHTML = messages
        .map((msg) => {
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          if (msg.sender === currentUser) {
            return `<div class="msg-time">${time}</div><div class="msg-row msg-send"><div class="msg-content"><div class="msg-bubble primary-bubble">${msg.content}</div></div></div>`;
          }
          return `<div class="msg-time">${time}</div><div class="msg-row msg-receive"><img class="msg-avatar" src="${chatAvatar.src}" alt="Avatar"><div class="msg-content"><div class="msg-bubble">${msg.content}</div></div></div>`;
        })
        .join("");
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (err) {
      console.error(err);
    }
  };

  // Click on a member row to open chat
  document.addEventListener("click", (e) => {
    const row = e.target.closest(".messenger-row");
    if (!row) return;
    const avatarEl = row.querySelector(".row-avatar");
    const nameEl   = row.querySelector(".row-info h4");
    const statusEl = row.querySelector(".row-info span");
    if (!nameEl) return;

    chatAvatar.src        = avatarEl ? avatarEl.src : currentUserAvatar;
    chatName.innerText    = nameEl.innerText;
    chatStatus.innerText  = statusEl ? statusEl.innerText : "";
    currentActiveUser     = nameEl.innerText;
    loadMessages(currentActiveUser);
  });

  // Send message
  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text || !currentActiveUser) return;
    try {
      await fetch(`${API}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: currentUser, receiver: currentActiveUser, content: text }),
      });
      chatInput.value = "";
      loadMessages(currentActiveUser);
    } catch (err) {
      console.error(err);
    }
  };

  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

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
    switchToList(
      "Tất cả thành viên",
      users.length
        ? users.map(buildMemberRow).join("")
        : `<p style="padding:16px;color:var(--clr-muted)">Không có thành viên nào</p>`
    );
  });

  btnViewAllMentors?.addEventListener("click", async (e) => {
    e.preventDefault();
    const users = await fetchUsers();
    const premium = users.filter((u) => u.tier === "premium");
    switchToList(
      "Tất cả Mentor",
      premium.length
        ? premium.map(buildMemberRow).join("")
        : `<p style="padding:16px;color:var(--clr-muted)">Chưa có mentor nào</p>`
    );
  });

  btnFindMentor?.addEventListener("click", async (e) => {
    e.preventDefault();
    const users = await fetchUsers();
    const premium = users.filter((u) => u.tier === "premium");
    switchToList(
      "Gợi ý Mentor cho bạn",
      premium.length
        ? premium.map(buildMemberRow).join("")
        : `<p style="padding:16px;color:var(--clr-muted)">Chưa có mentor nào — nâng cấp lên Premium để trở thành mentor!</p>`
    );
  });

  btnBackSidebar?.addEventListener("click", () => {
    sidebarListView.style.display = "none";
    sidebarMainView.style.display = "block";
  });
});