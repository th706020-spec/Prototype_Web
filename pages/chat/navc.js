document.addEventListener("DOMContentLoaded", () => {
  const chatAvatar = document.getElementById("chat-header-avatar");
  const chatName = document.getElementById("chat-header-name");
  const chatStatus = document.getElementById("chat-header-status");
  const chatMessagesContainer = document.getElementById(
    "chat-messages-container",
  );
  const chatInput = document.querySelector(".chat-input-box input");
  const sendBtn = document.querySelector(".chat-send-btn");

  const sidebarMainView = document.getElementById("sidebar-main-view");
  const sidebarListView = document.getElementById("sidebar-list-view");
  const btnBackSidebar = document.getElementById("btn-back-sidebar");
  const listViewTitle = document.getElementById("list-view-title");
  const listViewContent = document.getElementById("list-view-content");

  const btnViewAllMembers = document.getElementById("btn-view-all-members");
  const btnViewAllMentors = document.getElementById("btn-view-all-mentors");
  const btnFindMentor = document.getElementById("btn-find-mentor");

  const currentUser = "Cu bin";
  let currentActiveUser = "chêm";

  const loadMessages = async (contactName) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/messages/${currentUser}/${contactName}`,
      );
      const messages = await response.json();

      chatMessagesContainer.innerHTML = "";

      if (messages.length === 0) {
        chatMessagesContainer.innerHTML =
          '<div class="msg-time">Bắt đầu cuộc trò chuyện mới</div>';
        return;
      }

      let html = "";
      messages.forEach((msg) => {
        const time = new Date(msg.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        html += `<div class="msg-time">${time}</div>`;

        if (msg.sender === currentUser) {
          html += `<div class="msg-row msg-send"><div class="msg-content"><div class="msg-bubble primary-bubble">${msg.content}</div></div></div>`;
        } else {
          html += `<div class="msg-row msg-receive"><img class="msg-avatar" src="${chatAvatar.src}" alt="Avatar"><div class="msg-content"><div class="msg-bubble">${msg.content}</div></div></div>`;
        }
      });

      chatMessagesContainer.innerHTML = html;
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    } catch (error) {
      console.error(error);
    }
  };

  document.addEventListener("click", (e) => {
    const row = e.target.closest(".messenger-row");
    if (row) {
      const avatarSrc = row.querySelector(".row-avatar").src;
      const name = row.querySelector(".row-info h4").innerText;
      const status = row.querySelector(".row-info span").innerText;

      chatAvatar.src = avatarSrc;
      chatName.innerText = name;
      chatStatus.innerText = status;
      currentActiveUser = name;

      loadMessages(currentActiveUser);
    }
  });

  const sendMessage = async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    try {
      await fetch("http://localhost:3000/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: currentUser,
          receiver: currentActiveUser,
          content: text,
        }),
      });

      chatInput.value = "";
      loadMessages(currentActiveUser);
    } catch (error) {
      console.error(error);
    }
  };

  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  const mockAllMembers = `
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vcdn1-giaitri.vnecdn.net/2026/01/08/james-nhom-cortis-tai-su-kien-dior-1767840271-1767840287-1767841187.jpg?w=460&h=0&q=100&dpr=2&fit=crop&s=3AqqCtG3qbDfymg-qNqUGA"><span class="status-dot"></span></div><div class="row-info"><h4>chêm</h4><span>Đang hoạt động</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vtcpay.vn/blog/wp-content/uploads/2026/03/cortis-thanh-vien-03.webp"></div><div class="row-info"><h4>chu hun</h4><span>Hoạt động 25 phút trước</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vtcpay.vn/blog/wp-content/uploads/2026/03/cortis-thanh-vien-04.webp"><span class="status-dot"></span></div><div class="row-info"><h4>sông hơi</h4><span>Đang hoạt động</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://stylerepublik.vn/media/full/2025/10/1760502614_martin_cortis_1757331923_3717092046088439761_36026758022-jpg.jpg"></div><div class="row-info"><h4>1</h4><span>Hoạt động 1 giờ trước</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vcdn1-giaitri.vnecdn.net/2026/01/08/james-nhom-cortis-tai-su-kien-dior-1767840271-1767840287-1767841187.jpg?w=460&h=0&q=100&dpr=2&fit=crop&s=3AqqCtG3qbDfymg-qNqUGA"><span class="status-dot"></span></div><div class="row-info"><h4>2</h4><span>Đang hoạt động</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vtcpay.vn/blog/wp-content/uploads/2026/03/cortis-thanh-vien-03.webp"></div><div class="row-info"><h4>3</h4><span>Hoạt động 3 giờ trước</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://vtcpay.vn/blog/wp-content/uploads/2026/03/cortis-thanh-vien-04.webp"><span class="status-dot"></span></div><div class="row-info"><h4>4</h4><span>Đang hoạt động</span></div></div>
  `;

  const mockAllMentors = `
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://bloganchoi.com/wp-content/uploads/2025/08/profile-nhom-nhac-cortis-kpop-7-696x910.jpg"><span class="status-dot"></span></div><div class="row-info"><h4>kẹo con</h4><span>nhảy nhảy</span></div></div>
    <div class="messenger-row"><div class="avatar-with-status"><img class="row-avatar" src="https://stylerepublik.vn/media/full/2025/10/1760502614_martin_cortis_1757331923_3717092046088439761_36026758022-jpg.jpg"></div><div class="row-info"><h4>Tus Nguyen</h4><span>Chuyên gia Code C</span></div></div>
  `;

  const switchToList = (title, contentHTML) => {
    sidebarMainView.style.display = "none";
    sidebarListView.style.display = "block";
    listViewTitle.innerText = title;
    listViewContent.innerHTML = contentHTML;
  };

  btnViewAllMembers.addEventListener("click", (e) => {
    e.preventDefault();
    switchToList("Tất cả thành viên", mockAllMembers);
  });

  btnViewAllMentors.addEventListener("click", (e) => {
    e.preventDefault();
    switchToList("Tất cả Mentor", mockAllMentors);
  });

  btnFindMentor.addEventListener("click", (e) => {
    e.preventDefault();
    switchToList("Gợi ý Mentor cho bạn", mockAllMentors);
  });

  btnBackSidebar.addEventListener("click", () => {
    sidebarListView.style.display = "none";
    sidebarMainView.style.display = "block";
  });

  loadMessages(currentActiveUser);
});
