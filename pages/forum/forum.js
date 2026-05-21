const SYSTEM_TAGS = ["Giải Đáp", "Học Thuật", "Xã Hội", "Đề Xuất"];

// HỆ THỐNG MOCK LOGIN (Tài khoản hiện tại)
let isPremium = localStorage.getItem('isPremium') === 'true';
let sysName = localStorage.getItem('sysName') || "Người dùng ẩn danh";
let sysAvatar = localStorage.getItem('sysAvatar') || "https://i.imgur.com/K3aDE8W.png"; 

let replyingToCommentId = null;
let pendingVotes = {}; 

// TẢI VÀ VÁ LỖI DỮ LIỆU CŨ TỪ LOCALSTORAGE
let posts = JSON.parse(localStorage.getItem('forumData')) || [];
posts = posts.map(p => {
  let safeTags = p.tags || [];
  safeTags = safeTags.filter(t => t !== "Trò Chuyện"); // Dọn dẹp tag cũ
  if (safeTags.length === 0) safeTags = ["Giải Đáp"];

  return {
    ...p,
    author: p.author || "Ẩn danh",
    authorAvatar: p.authorAvatar || "https://i.imgur.com/K3aDE8W.png", 
    title: p.title || "Không có tiêu đề",
    upvotes: p.upvotes || 0,
    downvotes: p.downvotes || 0,
    comments: p.comments || [],
    pollOptions: Array.isArray(p.pollOptions) ? p.pollOptions.filter(o => o) : [], // Bảo vệ crash mảng
    currentUserPollVote: p.currentUserPollVote !== undefined ? p.currentUserPollVote : null,
    tags: safeTags,
    privacy: p.privacy || 'public',
    createdAt: Number(p.createdAt) || Date.now(), // Bảo vệ crash khi sắp xếp
    lastActive: Number(p.lastActive) || Date.now(),
    isPinned: Boolean(p.isPinned)
  };
});

let activeFilterTags = [...SYSTEM_TAGS]; 
let currentFilterType = 'all'; 

let uploadedFileData = null;
let uploadedFileName = null;
let uploadedFileType = null;
let currentOpenPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('postFile');
  if(fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert("File quá lớn! Vui lòng chọn file dưới 2MB.");
        this.value = ''; return;
      }
      uploadedFileName = file.name;
      uploadedFileType = file.type;
      const reader = new FileReader();
      reader.onload = function(e) { uploadedFileData = e.target.result; };
      reader.readAsDataURL(file);
    });
  }

  loadSystemProfile();
  initSystemTags();
  renderPosts(); 
});

// ================= HỆ THỐNG PROFILE =================
function loadSystemProfile() {
  document.getElementById('sysUserName').innerText = sysName;
  document.getElementById('sysAvatarPreview').src = sysAvatar;
  updatePremiumUI();
}

function changeUserName() {
  const newName = prompt("Nhập tên hiển thị mới của bạn:", sysName);
  if (newName && newName.trim() !== "") {
    sysName = newName.trim();
    localStorage.setItem('sysName', sysName);
    loadSystemProfile();
  }
}

function updateSystemAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) { 
    sysAvatar = e.target.result;
    localStorage.setItem('sysAvatar', sysAvatar);
    loadSystemProfile();
  };
  reader.readAsDataURL(file);
}

function buyPremium() {
  isPremium = true;
  localStorage.setItem('isPremium', 'true');
  updatePremiumUI();
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function updatePremiumUI() {
  const statusText = document.getElementById('premiumStatusText');
  const btn = document.getElementById('buyPremiumBtn');
  const colorPicker = document.getElementById('premiumColorPickerSection');
  if (isPremium && statusText && btn) {
    statusText.innerHTML = "<b> Tài khoản Premium</b>";
    statusText.style.color = "#a16207";
    btn.style.display = "none";
    if (colorPicker) colorPicker.style.display = "flex";
  }
}

// ================= TẠO BÀI & TAGS =================
function initSystemTags() {
  const postTagsDiv = document.getElementById('postTagsContainer');
  const filterTagsDiv = document.getElementById('filterTagsContainer');
  if (!postTagsDiv || !filterTagsDiv) return;

  postTagsDiv.innerHTML = ''; 
  // Thêm nút xem tất cả bài để dễ dàng reset bộ lọc
  filterTagsDiv.innerHTML = `<button class="tag-btn active" id="filter-btn-all-types" onclick="filterOnly('all')" style="background: #eef1fb; border-color: var(--clr-primary); color: var(--clr-primary); font-weight: bold; margin-right: 8px;">🌐 Tất cả bài</button>`;
  
  SYSTEM_TAGS.forEach(tag => {
    postTagsDiv.innerHTML += `<label style="font-size: 0.9rem; display: flex; align-items: center; gap: 6px; cursor: pointer;"><input type="checkbox" class="post-tag-checkbox" value="${tag}"> ${tag}</label>`;
    filterTagsDiv.innerHTML += `<button class="tag-btn active" id="filter-btn-${tag}" onclick="toggleFilterTag('${tag}')">${tag}</button>`;
  });
}

function openCreateModal() { document.getElementById('createPostModal').classList.add('active'); }
function closeCreateModal(force = false) {
  if (force === true || (event && event.target.id === 'createPostModal')) {
    document.getElementById('createPostModal').classList.remove('active');
  }
}

function togglePollUI() { document.getElementById('pollUI').style.display = document.getElementById('postType').value === 'poll' ? 'block' : 'none'; }
function addPollInput() {
  const container = document.getElementById('pollInputsContainer');
  const input = document.createElement('input');
  input.type = 'text'; input.className = 'forum-input poll-option-input mt-8'; input.placeholder = `Lựa chọn ${container.children.length + 1}`;
  container.appendChild(input);
}

function createPost() {
  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const type = document.getElementById('postType').value;
  const privacy = document.getElementById('postPrivacy').value;

  if (!title) return alert("Vui lòng nhập tiêu đề!");
  const selectedTags = Array.from(document.querySelectorAll('.post-tag-checkbox:checked')).map(cb => cb.value);
  if (selectedTags.length === 0) return alert("Bắt buộc phải chọn ít nhất 1 Tag!");

  let pollOptions = [];
  if (type === 'poll') {
    const inputs = Array.from(document.querySelectorAll('.poll-option-input')).map(inp => inp.value.trim()).filter(v => v);
    if (inputs.length < 2) return alert("Khảo sát cần ít nhất 2 lựa chọn!");
    pollOptions = inputs.map((optName, index) => ({ id: index, text: optName, votes: 0 }));
  }

  const nameColor = isPremium ? document.getElementById('postNameColor').value : '#1c1e24';

  const newPost = {
    id: Date.now(),
    author: sysName, 
    authorAvatar: sysAvatar, 
    authorColor: nameColor, isPremiumAuthor: isPremium, privacy: privacy,
    title: title, content: content,
    fileData: uploadedFileData, fileName: uploadedFileName, fileType: uploadedFileType,
    type: type, tags: selectedTags,
    upvotes: 0, downvotes: 0, currentUserVote: null, 
    pollOptions: pollOptions, currentUserPollVote: null, 
    comments: [], 
    createdAt: Date.now(), lastActive: Date.now(), 
    isPinned: false, pinnedAt: null 
  };

  posts.unshift(newPost);
  localStorage.setItem('forumData', JSON.stringify(posts));
  
  document.getElementById('postTitle').value = ''; document.getElementById('postContent').value = '';
  document.getElementById('postFile').value = ''; uploadedFileData = null; uploadedFileName = null; uploadedFileType = null;
  document.querySelectorAll('.post-tag-checkbox').forEach(cb => cb.checked = false);
  
  closeCreateModal(true);
  filterOnly('all'); // Tự động reset về tab Tất cả bài khi đăng xong
}

// ================= CƠ CHẾ KHẢO SÁT (POLL) =================
function stagePollOption(postId, optionId) {
  pendingVotes[postId] = optionId;
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function confirmPollVote(postId) {
  const post = posts.find(p => p.id === postId);
  const optionId = pendingVotes[postId];
  if (optionId === undefined || !post.pollOptions[optionId]) return;

  post.pollOptions[optionId].votes++; 
  post.currentUserPollVote = optionId; 
  post.lastActive = Date.now();
  
  delete pendingVotes[postId]; 
  localStorage.setItem('forumData', JSON.stringify(posts));
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function resetPollVote(postId) {
  const post = posts.find(p => p.id === postId);
  const oldVoteId = post.currentUserPollVote;
  if (oldVoteId !== null && post.pollOptions[oldVoteId]) {
    post.pollOptions[oldVoteId].votes = Math.max(0, post.pollOptions[oldVoteId].votes - 1);
  }
  
  post.currentUserPollVote = null; 
  post.lastActive = Date.now();
  localStorage.setItem('forumData', JSON.stringify(posts));
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

// ================= RENDER & BÌNH LUẬN =================
function generatePostHTML(post, isThreadView = false) {
  const isUpvoted = post.currentUserVote === 'up' ? 'active-up' : '';
  const isDownvoted = post.currentUserVote === 'down' ? 'active-down' : '';
  const badgeHTML = post.isPremiumAuthor ? `<span class="premium-badge"> Premium</span>` : '';
  
  // Xác định quyền xem bài (Quyền khóa)
  const canView = !(post.privacy === 'locked' && !isPremium && post.author !== sysName);
  const lockHTML = post.privacy === 'locked' ? `<span style="font-size: 0.8rem; margin-right: 6px;"> Khóa</span>` : '';
  
  let pinIcon = '';
  if (post.isPinned) {
    const daysLeft = post.pinnedAt ? Math.max(0, 7 - Math.floor((Date.now() - post.pinnedAt) / (1000 * 60 * 60 * 24))) : 7;
    pinIcon = `<span style="color:#ef4444; font-size: 0.8rem; margin-right: 6px; font-weight: bold;">📌 Đã ghim (${daysLeft} ngày)</span>`;
  }

  const commentCount = Array.isArray(post.comments) ? post.comments.length : 0;
  
  // Ẩn nội dung nếu không có quyền
  const contentSnippet = canView ? post.content : `<div style="padding: 12px; background: #f8fafc; border: 1px dashed var(--clr-border); border-radius: 8px; font-style: italic; color: #64748b; font-size: 0.95rem;"> Nội dung đã bị khóa. Tính năng xem giới hạn cho tài khoản Premium, bạn bè, hoặc người được cấp quyền.</div>`;

  let attachmentHTML = '';
  if (canView && post.fileData) {
    if (post.fileType && post.fileType.startsWith('image/')) attachmentHTML = `<img src="${post.fileData}" class="card-image" alt="Đính kèm">`;
    else attachmentHTML = `<a href="${post.fileData}" download="${post.fileName}" class="file-attachment"> <span>Tải xuống: ${post.fileName}</span></a>`;
  }

  let pollHTML = '';
  if (canView && post.type === 'poll') {
    const safeOptions = Array.isArray(post.pollOptions) ? post.pollOptions : [];
    const totalPollVotes = safeOptions.reduce((sum, opt) => sum + (Number(opt.votes) || 0), 0);
    pollHTML = `<div style="background:#f8fafc; padding:16px; border-radius:12px; margin-bottom:16px; border: 1px solid var(--clr-border);">`;
    
    if (post.currentUserPollVote !== null && post.currentUserPollVote !== undefined) {
      safeOptions.forEach(opt => {
        const percent = totalPollVotes === 0 ? 0 : Math.round((opt.votes / totalPollVotes) * 100);
        const isMyVote = post.currentUserPollVote === opt.id;
        pollHTML += `
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.95rem; font-weight: ${isMyVote ? 'bold' : 'normal'}; color: ${isMyVote ? 'var(--clr-primary)' : 'var(--clr-text)'};">
              <span>${opt.text} ${isMyVote ? '✓' : ''}</span><span>${percent}%</span>
            </div>
            <div class="poll-bar"><div class="poll-fill" style="width:${percent}%; background: ${isMyVote ? 'var(--clr-primary)' : '#94a3b8'};"></div></div>
          </div>`;
      });
      pollHTML += `<div style="text-align:right; margin-top:16px;"><button class="forum-btn outline small" onclick="resetPollVote(${post.id})">↺ Vote lại</button></div>`;
    } else {
      const stagedOpt = pendingVotes[post.id];
      safeOptions.forEach(opt => {
        const isSelected = stagedOpt === opt.id;
        pollHTML += `<div class="poll-option-row ${isSelected ? 'selected' : ''}" onclick="stagePollOption(${post.id}, ${opt.id})">${opt.text}</div>`;
      });
      if (stagedOpt !== undefined) pollHTML += `<div style="text-align:right; margin-top:16px;"><button class="forum-btn primary small" onclick="confirmPollVote(${post.id})">Xác nhận Vote</button></div>`;
    }
    pollHTML += `</div>`;
  }

  const cursorStyle = isThreadView ? 'cursor: default;' : '';
  const textClass = isThreadView ? 'card-snippet full-text' : 'card-snippet';
  const clickEvent = isThreadView ? '' : `onclick="openThread(event, ${post.id})"`;

  return `
    <div class="discord-card" style="${cursorStyle}" ${clickEvent}>
      <div class="card-tags">
        ${lockHTML} ${pinIcon}
        ${post.tags.map(t => `<span class="tag-badge">${t}</span>`).join('')}
        <span style="float:right; font-size:0.8rem; color:#94a3b8;">${new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="card-title" style="color: ${post.authorColor}">${post.title}</div>
      <div class="card-author">
        <img src="${post.authorAvatar || 'https://i.imgur.com/K3aDE8W.png'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border: 1px solid var(--clr-border);">
        Bởi <strong style="color: var(--clr-text);">${post.author}</strong> ${badgeHTML}
      </div>
      <div class="${textClass}">${contentSnippet}</div>
      
      ${attachmentHTML}
      ${pollHTML}

      <div class="card-footer">
        <div class="action-group">
          <button class="vote-btn ${isUpvoted}" onclick="handleVote(${post.id}, 'up')">▲ ${post.upvotes}</button>
          <button class="vote-btn ${isDownvoted}" onclick="handleVote(${post.id}, 'down')">▼ ${post.downvotes}</button>
          <button class="vote-btn"> ${commentCount}</button>
        </div>
        <button class="vote-btn" style="border:none;" onclick="togglePin(${post.id})">${post.isPinned ? 'Bỏ Ghim' : '📌 Ghim bài'}</button>
      </div>
    </div>
  `;
}

function submitComment() {
  const inputEl = document.getElementById('commentInput');
  const text = inputEl.value.trim();
  if (!text) return;

  const post = posts.find(p => p.id === currentOpenPostId);
  if (!Array.isArray(post.comments)) post.comments = [];

  post.comments.push({
    id: Date.now(),
    author: sysName, 
    authorAvatar: sysAvatar, 
    text: text,
    time: Date.now(),
    replyToId: replyingToCommentId
  });
  
  post.lastActive = Date.now();
  localStorage.setItem('forumData', JSON.stringify(posts));
  inputEl.value = ''; cancelReply(); renderThreadView(); 
}

function renderThreadView() {
  checkExpirations();
  const post = posts.find(p => p.id === currentOpenPostId);
  if (!post) { closeThread(); return; }

  document.getElementById('threadContent').innerHTML = generatePostHTML(post, true);
  const commentsList = document.getElementById('threadCommentsList');
  
  // Khóa bình luận nếu không có quyền xem
  const canView = !(post.privacy === 'locked' && !isPremium && post.author !== sysName);
  if(!canView) {
    commentsList.innerHTML = '';
    document.querySelector('.comment-input-area').style.display = 'none';
    return;
  } else {
    document.querySelector('.comment-input-area').style.display = 'flex';
  }

  if (!Array.isArray(post.comments) || post.comments.length === 0) {
    commentsList.innerHTML = '<div style="color:var(--clr-muted); font-style:italic; font-size:0.95rem; text-align:center; padding: 20px 0;">Chưa có bình luận nào. Hãy là người đầu tiên!</div>';
  } else {
    commentsList.innerHTML = post.comments.map(c => {
      let replySnippetHTML = '';
      if (c.replyToId) {
        const parentComment = post.comments.find(pc => pc.id === c.replyToId);
        if (parentComment) {
          const snippetText = parentComment.text.length > 40 ? parentComment.text.substring(0, 40) + '...' : parentComment.text;
          replySnippetHTML = `<div class="comment-reply-snippet"><strong>@${parentComment.author}</strong>: ${snippetText}</div>`;
        }
      }
      return `
      <div class="comment-item">
        <img src="${c.authorAvatar || 'https://i.imgur.com/K3aDE8W.png'}" class="comment-avatar">
        <div class="comment-body">
          ${replySnippetHTML}
          <div class="comment-header">
            <span class="comment-name">${c.author}</span>
            <span class="comment-time">${new Date(c.time).toLocaleString()}</span>
          </div>
          <div class="comment-text">${c.text}</div>
          <div class="comment-actions">
            <span onclick="setReply(${c.id}, '${c.author}')">Trả lời</span>
          </div>
        </div>
      </div>
    `}).join('');
  }
}

// ================= CÁC HÀM TIỆN ÍCH =================
function handleCommentEnter(event) { if (event.key === "Enter") submitComment(); }
function setReply(commentId, authorName) {
  replyingToCommentId = commentId;
  document.getElementById('replyingToName').innerText = authorName;
  document.getElementById('replyIndicator').classList.add('active');
  document.getElementById('commentInput').focus();
}
function cancelReply() {
  replyingToCommentId = null;
  const indicator = document.getElementById('replyIndicator');
  if(indicator) indicator.classList.remove('active');
}

function filterOnly(type) {
  currentFilterType = type;
  
  // Highlight nút Tất cả bài
  const allBtn = document.getElementById('filter-btn-all-types');
  if(allBtn) {
    if(type === 'all') allBtn.style.background = '#eef1fb';
    else allBtn.style.background = 'transparent';
  }

  const searchEl = document.getElementById('searchInput');
  if(searchEl) searchEl.value = '';
  closeThread(); renderPosts(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleFilterTag(tag) {
  const index = activeFilterTags.indexOf(tag); 
  const btn = document.getElementById(`filter-btn-${tag}`);
  if (index > -1) { activeFilterTags.splice(index, 1); btn.classList.remove('active'); } 
  else { activeFilterTags.push(tag); btn.classList.add('active'); }
  closeThread(); renderPosts();
}

function checkExpirations() {
  const now = Date.now(); let dataChanged = false;
  posts.forEach(p => {
    if (p.isPinned && p.pinnedAt && (now - p.pinnedAt) / (1000 * 60 * 60 * 24) >= 7) { 
      p.isPinned = false; p.pinnedAt = null; dataChanged = true; 
    }
  });
  if (dataChanged) localStorage.setItem('forumData', JSON.stringify(posts));
}

function handleVote(postId, voteType) {
  const post = posts.find(p => p.id === postId);
  if (post.currentUserVote === voteType) {
    if (voteType === 'up') post.upvotes--; if (voteType === 'down') post.downvotes--;
    post.currentUserVote = null;
  } else {
    if (post.currentUserVote === 'up') post.upvotes--; if (post.currentUserVote === 'down') post.downvotes--;
    if (voteType === 'up') post.upvotes++; if (voteType === 'down') post.downvotes++;
    post.currentUserVote = voteType;
  }
  post.lastActive = Date.now(); localStorage.setItem('forumData', JSON.stringify(posts));
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function togglePin(postId) {
  const targetPost = posts.find(p => p.id === postId);
  if (!targetPost.isPinned) {
    targetPost.isPinned = true; targetPost.pinnedAt = Date.now();
  } else { targetPost.isPinned = false; targetPost.pinnedAt = null; }
  localStorage.setItem('forumData', JSON.stringify(posts));
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function openThread(event, postId) {
  if (event && event.target.closest('button')) return;
  const post = posts.find(p => p.id === postId);
  
  if (post.privacy === 'locked' && !isPremium && post.author !== sysName) return alert(" Bài đăng này đã bị khóa. Tính năng xem giới hạn cho tài khoản Premium, bạn bè, hoặc người được cấp quyền. Bạn hãy gửi yêu cầu để xem!");
  
  currentOpenPostId = postId;
  document.getElementById('postsContainer').style.display = 'none';
  document.getElementById('filterBar').style.display = 'none';
  document.getElementById('threadContainer').style.display = 'block';
  document.querySelector('.forum-layout').classList.add('thread-mode');
  cancelReply(); window.scrollTo({ top: 0, behavior: 'smooth' }); renderThreadView();
}

function closeThread() {
  currentOpenPostId = null;
  document.getElementById('postsContainer').style.display = 'flex';
  document.getElementById('filterBar').style.display = 'flex';
  document.getElementById('threadContainer').style.display = 'none';
  document.querySelector('.forum-layout').classList.remove('thread-mode');
  renderPosts();
}

function renderPosts() {
  if (currentOpenPostId) return; 
  checkExpirations(); 
  const searchEl = document.getElementById('searchInput');
  const searchKey = searchEl ? searchEl.value.toLowerCase().trim() : '';
  const sortMode = document.getElementById('sortMode') ? document.getElementById('sortMode').value : 'recent_interact';
  
  let filtered = [...posts];
  if (currentFilterType !== 'all') filtered = filtered.filter(p => p.type === currentFilterType);
  if (searchKey) filtered = filtered.filter(p => p.title.toLowerCase().includes(searchKey) || p.content.toLowerCase().includes(searchKey));
  filtered = filtered.filter(p => activeFilterTags.some(tag => p.tags.includes(tag)));

  // Sắp xếp an toàn chống crash do NaN
  filtered.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (sortMode === 'date_desc') return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    return (Number(b.lastActive) || 0) - (Number(a.lastActive) || 0);
  });

  const container = document.getElementById('postsContainer');
  if(!container) return;
  container.innerHTML = filtered.length === 0 ? '<div style="text-align:center; padding: 40px; color: var(--clr-muted); background: var(--clr-surface); border-radius: 12px; border: 1px dashed var(--clr-border);">Không có dữ liệu hiển thị.</div>' : filtered.map(p => generatePostHTML(p, false)).join('');
  renderWidgets();
}

function renderWidgets() {
  const trendingContainer = document.getElementById('trendingPostsWidget');
  const pollsContainer = document.getElementById('activePollsWidget');
  if(trendingContainer) {
    const trending = [...posts].filter(p => p.type === 'post').sort((a, b) => (b.upvotes + (Array.isArray(b.comments)?b.comments.length:0)) - (a.upvotes + (Array.isArray(a.comments)?a.comments.length:0))).slice(0, 3);
    trendingContainer.innerHTML = trending.length ? trending.map(p => `<div class="widget-item"><div style="font-size:1.2rem;"></div><div><div class="widget-item-title" onclick="openThread(null, ${p.id})">${p.title}</div><div class="widget-item-meta">${p.upvotes} Votes • Bởi ${p.author}</div></div></div>`).join('') : '<div style="font-size:0.8rem; color:#94a3b8;">Chưa có dữ liệu</div>';
  }
  if(pollsContainer) {
    const polls = [...posts].filter(p => p.type === 'poll').sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)).slice(0, 3);
    pollsContainer.innerHTML = polls.length ? polls.map(p => {
      const safeOptions = Array.isArray(p.pollOptions) ? p.pollOptions : [];
      const totalVotes = safeOptions.reduce((s,o)=>s+(Number(o.votes)||0), 0);
      return `<div class="widget-item"><div style="font-size:1.2rem;"></div><div><div class="widget-item-title" onclick="openThread(null, ${p.id})">${p.title}</div><div class="widget-item-meta">${totalVotes} Lượt bình chọn</div></div></div>`
    }).join('') : '<div style="font-size:0.8rem; color:#94a3b8;">Chưa có khảo sát</div>';
  }
}