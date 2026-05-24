const SYSTEM_TAGS = ["Giải Đáp", "Học Thuật", "Xã Hội", "Đề Xuất"];
const API = window.AppConfig.API;
const POLLS_STORAGE_KEY = 'forum_polls';
const PIN_STORAGE_KEY = 'forum_pin_states';
const LEGACY_STORAGE_KEY = 'forumData';
const AVATAR_CACHE_KEY = 'protocol_avatar_url';

// Vote debounce: prevent rapid-fire voting
const _voteCooldown = new Map();

function getAuthUser() {
  return window.Auth ? window.Auth.getUser() : null;
}

function buildDefaultAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Người dùng ẩn danh')}&background=5b85f6&color=fff`;
}

function getCurrentProfile() {
  const user = getAuthUser();
  const username = user?.username || "Người dùng ẩn danh";
  const avatar = user?.avatar_url || localStorage.getItem(AVATAR_CACHE_KEY) || buildDefaultAvatar(username);
  return {
    user,
    username,
    avatar,
    isPremium: user?.tier === 'premium'
  };
}

function parseDateValue(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function normalizeTags(tags) {
  let safeTags = Array.isArray(tags) ? tags : [];
  safeTags = safeTags.filter(t => t !== "Trò Chuyện");
  if (safeTags.length === 0) safeTags = ["Giải Đáp"];
  return safeTags;
}

function getVoteStorageKey(postId) {
  return `forum_votes_${postId}`;
}

function loadVoteState(postId) {
  const value = localStorage.getItem(getVoteStorageKey(postId));
  return value === 'up' || value === 'down' ? value : null;
}

function saveVoteState(postId, value) {
  if (value === 'up' || value === 'down') localStorage.setItem(getVoteStorageKey(postId), value);
  else localStorage.removeItem(getVoteStorageKey(postId));
}

function loadPinStates() {
  try {
    const raw = JSON.parse(localStorage.getItem(PIN_STORAGE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function savePinStates(pinStates) {
  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pinStates || {}));
}

function readPollStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(POLLS_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function normalizeComment(comment) {
  const authorName = comment.author_name || comment.author || "Ẩn danh";
  return {
    id: Number(comment.id) || Date.now(),
    author: authorName,
    authorAvatar: comment.author_avatar || comment.authorAvatar || buildDefaultAvatar(authorName),
    text: comment.content || comment.text || "",
    time: comment.created_at ? parseDateValue(comment.created_at) : (Number(comment.time) || Date.now()),
    replyToId: comment.parent_comment_id ?? comment.replyToId ?? null
  };
}

function normalizeLocalPollPost(post) {
  const pinStates = loadPinStates();
  const localPin = pinStates[post.id] || null;
  const authorName = post.author || post.author_name || "Ẩn danh";
  return {
    ...post,
    source: 'local-poll',
    id: Number(post.id) || Date.now(),
    author: authorName,
    authorAvatar: post.authorAvatar || post.author_avatar || buildDefaultAvatar(authorName),
    title: post.title || "Không có tiêu đề",
    content: post.content || "",
    upvotes: Number(post.upvotes) || 0,
    downvotes: Number(post.downvotes) || 0,
    comments: Array.isArray(post.comments) ? post.comments.map(normalizeComment) : [],
    pollOptions: Array.isArray(post.pollOptions) ? post.pollOptions.filter(o => o) : [],
    currentUserPollVote: post.currentUserPollVote !== undefined ? post.currentUserPollVote : null,
    currentUserVote: loadVoteState(post.id) || post.currentUserVote || null,
    tags: normalizeTags(post.tags),
    privacy: post.privacy || 'public',
    createdAt: Number(post.createdAt) || Date.now(),
    lastActive: Number(post.lastActive) || Date.now(),
    isPinned: localPin ? Boolean(localPin.isPinned) : Boolean(post.isPinned),
    pinnedAt: localPin?.pinnedAt || post.pinnedAt || null,
    fileData: post.fileData || null,
    fileName: post.fileName || null,
    fileType: post.fileType || null,
    type: 'poll',
    authorColor: post.authorColor || '#1c1e24',
    isPremiumAuthor: Boolean(post.isPremiumAuthor),
    threadLoaded: true
  };
}

function loadPollPosts() {
  return readPollStorage().map(normalizeLocalPollPost);
}

function savePollPosts() {
  const localPolls = posts.filter(p => p.source === 'local-poll').map(p => ({
    ...p,
    comments: Array.isArray(p.comments) ? p.comments : []
  }));
  localStorage.setItem(POLLS_STORAGE_KEY, JSON.stringify(localPolls));
}

function migrateLegacyPolls() {
  if (localStorage.getItem(POLLS_STORAGE_KEY)) return;

  try {
    const legacyPosts = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]');
    if (!Array.isArray(legacyPosts)) return;
    const legacyPolls = legacyPosts.filter(p => p && p.type === 'poll').map(normalizeLocalPollPost);
    if (legacyPolls.length) localStorage.setItem(POLLS_STORAGE_KEY, JSON.stringify(legacyPolls));
  } catch {}
}

function normalizeServerPost(serverPost, existingPost = {}) {
  const authorName = serverPost.author_name || existingPost.author || "Ẩn danh";
  const pinStates = loadPinStates();
  const localPin = pinStates[serverPost.id] || null;
  const comments = Array.isArray(serverPost.comments)
    ? serverPost.comments.map(normalizeComment)
    : (Array.isArray(existingPost.comments) ? existingPost.comments : []);

  // Handle server-side poll data (from LEFT JOIN in GET /api/forum/posts)
  const postType = serverPost.type === 'poll' ? 'poll' : 'post';
  const pollId = serverPost.poll_id || existingPost.pollId || null;
  let pollOptions = existingPost.pollOptions || [];
  if (postType === 'poll' && Array.isArray(serverPost.poll_options)) {
    // Convert server string array to { id, text, votes } format
    pollOptions = serverPost.poll_options.map((text, i) => ({
      id: i,
      text: typeof text === 'string' ? text : String(text),
      votes: 0
    }));
  }

  // Handle image: server-stored image takes priority
  const imageUrl = serverPost.image_url || null;

  return {
    ...existingPost,
    id: Number(serverPost.id),
    source: 'server',
    author: authorName,
    authorAvatar: serverPost.author_avatar || existingPost.authorAvatar || buildDefaultAvatar(authorName),
    authorColor: existingPost.authorColor || '#1c1e24',
    isPremiumAuthor: Boolean(existingPost.isPremiumAuthor),
    privacy: existingPost.privacy || 'public',
    title: serverPost.title || existingPost.title || "Không có tiêu đề",
    content: serverPost.content || existingPost.content || "",
    // Image: use server image_url if present, else keep local fileData
    image_url: imageUrl,
    fileData: imageUrl ? null : (existingPost.fileData || null),
    fileName: imageUrl ? null : (existingPost.fileName || null),
    fileType: imageUrl ? null : (existingPost.fileType || null),
    type: postType,
    pollId,
    tags: normalizeTags(serverPost.tags),
    upvotes: Number(serverPost.upvotes) || 0,
    downvotes: Number(serverPost.downvotes) || 0,
    comment_count: Number(serverPost.comment_count) || 0,
    currentUserVote: loadVoteState(serverPost.id),
    pollOptions,
    currentUserPollVote: existingPost.currentUserPollVote !== undefined ? existingPost.currentUserPollVote : null,
    comments,
    createdAt: parseDateValue(serverPost.created_at || existingPost.createdAt),
    lastActive: parseDateValue(serverPost.last_active || serverPost.created_at || existingPost.lastActive),
    isPinned: localPin ? Boolean(localPin.isPinned) : Boolean(Number(serverPost.is_pinned)),
    pinnedAt: localPin?.pinnedAt || existingPost.pinnedAt || null,
    threadLoaded: Array.isArray(serverPost.comments) ? true : Boolean(existingPost.threadLoaded),
    user_id: serverPost.author_id || existingPost.user_id || null,
  };
}

function replacePost(updatedPost) {
  const index = posts.findIndex(p => p.id === updatedPost.id);
  if (index > -1) posts[index] = updatedPost;
  else posts.unshift(updatedPost);
}

function getPostById(postId) {
  return posts.find(p => p.id === postId);
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Server returned an unexpected response.");
    }
  }

  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function getAuthHeaders(includeJson = true) {
  const headers = {};
  const token = window.Auth ? window.Auth.getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}

function promptLogin(message) {
  alert(message);
  const loginBtn = document.getElementById('open-login');
  if (loginBtn) loginBtn.click();
}

function updateAvatarPreview(avatarUrl) {
  sysAvatar = avatarUrl;
  const preview = document.getElementById('sysAvatarPreview');
  if (preview) preview.src = avatarUrl;
  const navAvatar = document.getElementById('nav-avatar');
  if (navAvatar) navAvatar.src = avatarUrl;
}

function persistPinState(post) {
  if (post.source === 'local-poll') {
    savePollPosts();
    return;
  }

  const pinStates = loadPinStates();
  if (post.isPinned) pinStates[post.id] = { isPinned: true, pinnedAt: post.pinnedAt || Date.now() };
  else delete pinStates[post.id];
  savePinStates(pinStates);
}

async function fetchPosts() {
  const existingPostMap = new Map(posts.map(post => [post.id, post]));

  try {
    const serverPosts = await fetchJSON(`${API}/forum/posts`);
    const mappedServerPosts = Array.isArray(serverPosts)
      ? serverPosts.map(post => normalizeServerPost(post, existingPostMap.get(Number(post.id)) || {}))
      : [];

    posts = [...mappedServerPosts, ...loadPollPosts()];
  } catch (error) {
    console.error('Failed to load forum posts:', error);
    posts = loadPollPosts();
  }

  return posts;
}

async function fetchPostDetails(postId) {
  const post = getPostById(postId);
  if (!post || post.source === 'local-poll') return post;

  const data = await fetchJSON(`${API}/forum/posts/${postId}`);
  const updatedPost = normalizeServerPost(data, post);

  // Load actual poll vote counts if this is a poll post
  if (updatedPost.type === 'poll' && updatedPost.pollId) {
    try {
      const token = window.Auth ? window.Auth.getToken() : null;
      const pollRes = await fetch(`${API}/forum/polls/${postId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (pollRes.ok) {
        const pollData = await pollRes.json();
        if (pollData) {
          updatedPost.pollId = pollData.id;
          updatedPost.pollOptions = (pollData.options || []).map((text, i) => ({
            id: i,
            text: typeof text === 'string' ? text : String(text),
            votes: pollData.vote_counts ? (pollData.vote_counts[i] || 0) : 0
          }));
          updatedPost.currentUserPollVote = (pollData.my_vote !== null && pollData.my_vote !== undefined) ? pollData.my_vote : null;
        }
      }
    } catch {}
  }

  replacePost(updatedPost);
  return updatedPost;
}

function syncProfileFromAuth() {
  const profile = getCurrentProfile();
  sysName = profile.username;
  sysAvatar = profile.avatar;
  isPremium = profile.isPremium;
  return profile;
}

migrateLegacyPolls();

const initialProfile = getCurrentProfile();
let isPremium = initialProfile.isPremium;
let sysName = initialProfile.username;
let sysAvatar = initialProfile.avatar;
let replyingToCommentId = null;
let pendingVotes = {};
let posts = loadPollPosts();
let activeFilterTags = [...SYSTEM_TAGS];
let currentFilterType = 'all';
let uploadedFileData = null;
let uploadedFileName = null;
let uploadedFileType = null;
let currentOpenPostId = null;
let uploadedFileRaw = null; // raw File object for server upload


document.addEventListener('DOMContentLoaded', async () => {
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
      uploadedFileRaw = file;
      const reader = new FileReader();
      reader.onload = function(e) { uploadedFileData = e.target.result; };
      reader.readAsDataURL(file);
    });
  }

  loadSystemProfile();
  initSystemTags();
  await fetchPosts();
  await renderPosts(); 
});

// ================= HỆ THỐNG PROFILE =================
function loadSystemProfile() {
  const { user } = syncProfileFromAuth();
  const nameEl = document.getElementById('sysUserName');
  const avatarEl = document.getElementById('sysAvatarPreview');
  const statusText = document.getElementById('premiumStatusText');

  if (nameEl) nameEl.innerText = sysName;
  if (avatarEl) avatarEl.src = sysAvatar;
  if (statusText) statusText.innerText = user ? 'Tài khoản thường' : 'Chưa đăng nhập';
  updatePremiumUI();

  const token = window.Auth ? window.Auth.getToken() : null;
  if (user && token) {
    fetchJSON(`${API}/auth/me`, { headers: getAuthHeaders(false) })
      .then(data => {
        if (data?.user?.avatar_url) {
          localStorage.setItem(AVATAR_CACHE_KEY, data.user.avatar_url);
          updateAvatarPreview(data.user.avatar_url);
        }
      })
      .catch(() => {});
  }
}

function changeUserName() {
  alert("Tên hiển thị được quản lý bởi hệ thống tài khoản. Vui lòng cập nhật trong hồ sơ của bạn.");
}

async function updateSystemAvatar(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;

  if (!getAuthUser()) {
    promptLogin("Vui lòng đăng nhập để cập nhật avatar.");
    event.target.value = '';
    return;
  }

  try {
    const formData = new FormData();
    formData.append('avatar', file);
    const data = await fetchJSON(`${API}/auth/avatar`, {
      method: 'POST',
      headers: getAuthHeaders(false),
      body: formData
    });

    if (data?.avatar_url) {
      localStorage.setItem(AVATAR_CACHE_KEY, data.avatar_url);
      updateAvatarPreview(data.avatar_url);
      loadSystemProfile();
    }
  } catch (error) {
    alert("Lỗi: " + error.message);
  } finally {
    event.target.value = '';
  }
}

function buyPremium() {
  window.location.href = '../premium/premium.html';
}

function updatePremiumUI() {
  const statusText = document.getElementById('premiumStatusText');
  const btn = document.getElementById('buyPremiumBtn');
  const colorPicker = document.getElementById('premiumColorPickerSection');
  const user = getAuthUser();
  if (!statusText || !btn) return;

  if (isPremium && user) {
    statusText.innerHTML = "<b> Tài khoản Premium</b>";
    statusText.style.color = "#a16207";
    btn.style.display = "none";
    if (colorPicker) colorPicker.style.display = "flex";
    return;
  }

  statusText.innerHTML = user ? 'Tài khoản thường' : 'Chưa đăng nhập';
  statusText.style.color = '';
  btn.style.display = user ? 'inline-flex' : 'none';
  if (colorPicker) colorPicker.style.display = 'none';
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

function openCreateModal() {
  if (!getAuthUser()) return promptLogin("Vui lòng đăng nhập để tạo bài đăng.");
  document.getElementById('createPostModal').classList.add('active');
}
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

async function createPost() {
  if (!getAuthUser()) return promptLogin("Vui lòng đăng nhập để tạo bài đăng.");

  const title = document.getElementById('postTitle').value.trim();
  const content = document.getElementById('postContent').value.trim();
  const type = document.getElementById('postType').value;
  const privacy = document.getElementById('postPrivacy').value;

  if (!title) return alert("Vui lòng nhập tiêu đề!");
  if (!content) return alert("Vui lòng nhập nội dung!");
  const selectedTags = Array.from(document.querySelectorAll('.post-tag-checkbox:checked')).map(cb => cb.value);
  if (selectedTags.length === 0) return alert("Bắt buộc phải chọn ít nhất 1 Tag!");

  let pollOptions = [];
  if (type === 'poll') {
    const inputs = Array.from(document.querySelectorAll('.poll-option-input')).map(inp => inp.value.trim()).filter(v => v);
    if (inputs.length < 2) return alert("Khảo sát cần ít nhất 2 lựa chọn!");
    pollOptions = inputs.map((optName, index) => ({ id: index, text: optName, votes: 0 }));
  }

  const nameColor = isPremium ? document.getElementById('postNameColor').value : '#1c1e24';

  try {
    if (type === 'poll') {
      // Create poll on server (visible to all users)
      const newPostData = await fetchJSON(`${API}/forum/posts`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ title, content, tags: selectedTags, type: 'poll' })
      });
      // Create the poll options on server
      await fetchJSON(`${API}/forum/polls`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          post_id: newPostData.id,
          question: title,
          options: pollOptions.map(o => o.text)
        })
      });
      await fetchPosts();
    } else {
      const newPostData = await fetchJSON(`${API}/forum/posts`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ title, content, tags: selectedTags })
      });
      // Upload image to server if one was selected and is an image
      if (uploadedFileRaw && uploadedFileRaw.type.startsWith('image/') && newPostData.id) {
        try {
          const imgForm = new FormData();
          imgForm.append('image', uploadedFileRaw);
          await fetch(`${API}/forum/posts/${newPostData.id}/image`, {
            method: 'POST',
            headers: getAuthHeaders(false),
            body: imgForm,
          });
        } catch {}
      }
      await fetchPosts();
    }
    
    document.getElementById('postTitle').value = ''; document.getElementById('postContent').value = '';
    document.getElementById('postFile').value = ''; uploadedFileData = null; uploadedFileName = null; uploadedFileType = null; uploadedFileRaw = null;
    document.querySelectorAll('.post-tag-checkbox').forEach(cb => cb.checked = false);
    
    closeCreateModal(true);
    filterOnly('all'); // Tự động reset về tab Tất cả bài khi đăng xong
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
}

// ================= CƠ CHẾ KHẢO SÁT (POLL) =================
function stagePollOption(postId, optionId) {
  pendingVotes[postId] = optionId;
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

async function confirmPollVote(postId) {
  const post = posts.find(p => p.id === postId);
  const optionId = pendingVotes[postId];
  if (optionId === undefined || !post || !post.pollOptions[optionId]) return;

  if (post.source !== 'local-poll' && post.pollId) {
    // Server poll — call API
    if (!getAuthUser()) { promptLogin("Đăng nhập để bình chọn."); return; }
    try {
      const result = await fetchJSON(`${API}/forum/polls/${post.pollId}/vote`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ option_index: optionId })
      });
      post.pollOptions = (post.pollOptions || []).map((opt, i) => ({
        ...opt,
        votes: result.vote_counts ? (result.vote_counts[i] || 0) : opt.votes
      }));
      post.currentUserPollVote = result.my_vote !== null && result.my_vote !== undefined ? result.my_vote : optionId;
      post.lastActive = Date.now();
    } catch (err) {
      alert("Lỗi bình chọn: " + (err.message || "Unknown error"));
      return;
    }
    delete pendingVotes[postId];
  } else {
    // Local poll
    post.pollOptions[optionId].votes++;
    post.currentUserPollVote = optionId;
    post.lastActive = Date.now();
    delete pendingVotes[postId];
    savePollPosts();
  }
  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

function resetPollVote(postId) {
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  // For server polls: just reset local state so user can vote again (server keeps old vote until new one submitted)
  if (post.source !== 'local-poll' && post.pollId) {
    post.currentUserPollVote = null;
    post.lastActive = Date.now();
    if (currentOpenPostId) renderThreadView(); else renderPosts();
    return;
  }
  const oldVoteId = post.currentUserPollVote;
  if (oldVoteId !== null && post.pollOptions[oldVoteId]) {
    post.pollOptions[oldVoteId].votes = Math.max(0, post.pollOptions[oldVoteId].votes - 1);
  }
  post.currentUserPollVote = null;
  post.lastActive = Date.now();
  savePollPosts();
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

  const commentCount = post.comment_count ?? (Array.isArray(post.comments) ? post.comments.length : 0);
  
  // Pin button is only shown to the post author or admins/mods
  const authForPin = getAuthUser();
  const canPin = authForPin && (
    String(post.user_id) === String(authForPin.id) ||
    ['admin', 'mod'].includes(authForPin.role)
  );
  
  // Ẩn nội dung nếu không có quyền
  const contentSnippet = canView ? post.content : `<div style="padding: 12px; background: #f8fafc; border: 1px dashed var(--clr-border); border-radius: 8px; font-style: italic; color: #64748b; font-size: 0.95rem;"> Nội dung đã bị khóa. Tính năng xem giới hạn cho tài khoản Premium, bạn bè, hoặc người được cấp quyền.</div>`;

  let attachmentHTML = '';
  if (canView && post.image_url) {
    // Server-stored file — detect type by extension
    const url = post.image_url;
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const imgExts = ['jpg','jpeg','png','gif','webp','svg'];
    const vidExts = ['mp4','webm','mov','ogg'];
    if (imgExts.includes(ext)) {
      attachmentHTML = `<img src="${url}" class="card-image" alt="Image" style="cursor:pointer" onclick="window.open(this.src,'_blank')">`;
    } else if (vidExts.includes(ext)) {
      attachmentHTML = `<video src="${url}" class="card-image" controls style="max-width:100%;border-radius:8px"></video>`;
    } else {
      const fileName = url.split('/').pop();
      attachmentHTML = `<a href="${url}" download="${fileName}" class="file-attachment">📎 ${fileName}</a>`;
    }
  } else if (canView && post.fileData) {
    if (post.fileType && post.fileType.startsWith('image/')) attachmentHTML = `<img src="${post.fileData}" class="card-image" alt="Đính kèm">`;
    else if (post.fileType && post.fileType.startsWith('video/')) attachmentHTML = `<video src="${post.fileData}" class="card-image" controls style="max-width:100%;border-radius:8px"></video>`;
    else attachmentHTML = `<a href="${post.fileData}" download="${post.fileName}" class="file-attachment"> <span>Tải xuống: ${post.fileName}</span></a>`;
  }

  let pollHTML = '';
  if (canView && post.type === 'poll') {
    const safeOptions = Array.isArray(post.pollOptions) ? post.pollOptions : [];
    const totalPollVotes = safeOptions.reduce((sum, opt) => sum + (Number(opt.votes) || 0), 0);
    pollHTML = `<div style="background:var(--clr-surface); padding:16px; border-radius:12px; margin-bottom:16px; border: 1px solid var(--clr-border);">`;
    
    if (post.currentUserPollVote !== null && post.currentUserPollVote !== undefined) {
      safeOptions.forEach(opt => {
        const percent = totalPollVotes === 0 ? 0 : Math.round((opt.votes / totalPollVotes) * 100);
        const isMyVote = post.currentUserPollVote === opt.id;
        pollHTML += `
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:0.95rem; font-weight: ${isMyVote ? 'bold' : 'normal'}; color: ${isMyVote ? 'var(--clr-primary)' : 'var(--clr-text)'};">
              <span>${opt.text} ${isMyVote ? '✓' : ''}</span><span>${percent}%</span>
            </div>
            <div class="poll-bar"><div class="poll-fill" style="width:${percent}%; background: ${isMyVote ? 'var(--clr-primary)' : 'var(--clr-muted)'};"></div></div>
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
          <button class="vote-btn ghost">💬 ${commentCount}</button>
        </div>
        ${canPin ? `<button class="vote-btn ghost" onclick="togglePin(${post.id})">${post.isPinned ? '📌 Bỏ Ghim' : '📌 Ghim bài'}</button>` : ''}
      </div>
    </div>
  `;
}

async function submitComment() {
  if (!getAuthUser()) return promptLogin("Vui lòng đăng nhập để bình luận.");

  const inputEl = document.getElementById('commentInput');
  const text = inputEl.value.trim();
  if (!text) return;

  const post = posts.find(p => p.id === currentOpenPostId);
  if (!post) return;
  if (!Array.isArray(post.comments)) post.comments = [];

  try {
    if (post.source === 'local-poll') {
      post.comments.push({
        id: Date.now(),
        author: sysName, 
        authorAvatar: sysAvatar, 
        text: text,
        time: Date.now(),
        replyToId: replyingToCommentId
      });
      
      post.lastActive = Date.now();
      savePollPosts();
    } else {
      await fetchJSON(`${API}/forum/posts/${post.id}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ content: text, parent_comment_id: replyingToCommentId || undefined })
      });
      await fetchPostDetails(post.id);
    }

    inputEl.value = ''; cancelReply(); renderThreadView(); 
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
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
  const now = Date.now(); let dataChanged = false; let pollChanged = false; let pinChanged = false;
  const pinStates = loadPinStates();
  posts.forEach(p => {
    if (p.isPinned && p.pinnedAt && (now - p.pinnedAt) / (1000 * 60 * 60 * 24) >= 7) { 
      p.isPinned = false; p.pinnedAt = null; dataChanged = true; 
      if (p.source === 'local-poll') pollChanged = true;
      else { delete pinStates[p.id]; pinChanged = true; }
    }
  });
  if (dataChanged) {
    if (pollChanged) savePollPosts();
    if (pinChanged) savePinStates(pinStates);
  }
}

async function handleVote(postId, voteType) {
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  if (!getAuthUser()) return promptLogin("Vui lòng đăng nhập để bình chọn.");

  // Debounce: ignore if less than 600ms since last vote on this post
  const now = Date.now();
  if ((_voteCooldown.get(postId) || 0) > now) return;
  _voteCooldown.set(postId, now + 600);

  const previousVote = post.currentUserVote;

  if (post.source === 'local-poll') {
    if (post.currentUserVote === voteType) {
      if (voteType === 'up') post.upvotes--; if (voteType === 'down') post.downvotes--;
      post.currentUserVote = null;
      saveVoteState(postId, null);
    } else {
      if (post.currentUserVote === 'up') post.upvotes--; if (post.currentUserVote === 'down') post.downvotes--;
      if (voteType === 'up') post.upvotes++; if (voteType === 'down') post.downvotes++;
      post.currentUserVote = voteType;
      saveVoteState(postId, voteType);
    }
    post.lastActive = Date.now(); savePollPosts();
    if (currentOpenPostId) renderThreadView(); else renderPosts();
    return;
  }

  try {
    const voteData = await fetchJSON(`${API}/forum/posts/${postId}/vote`, {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ direction: voteType })
    });

    post.upvotes = Number(voteData?.upvotes) || 0;
    post.downvotes = Number(voteData?.downvotes) || 0;
    // Same direction as previous = un-voted; otherwise voted
    post.currentUserVote = previousVote === voteType ? null : voteType;
    post.lastActive = Date.now();
    saveVoteState(postId, post.currentUserVote);
  } catch (error) {
    alert("Lỗi: " + error.message);
  }

  if (currentOpenPostId) renderThreadView(); else renderPosts();
}

async function togglePin(postId) {
  const authU = getAuthUser();
  if (!authU) return promptLogin("Vui lòng đăng nhập.");
  const targetPost = posts.find(p => p.id === postId);
  if (!targetPost) return;

  const canPin = String(targetPost.user_id) === String(authU.id) || ['admin', 'mod'].includes(authU.role);
  if (!canPin) return alert("Chỉ tác giả hoặc quản trị viên mới có thể ghim bài.");

  if (targetPost.source === 'local-poll') {
    targetPost.isPinned = !targetPost.isPinned;
    targetPost.pinnedAt = targetPost.isPinned ? Date.now() : null;
    savePollPosts();
    if (currentOpenPostId) renderThreadView(); else renderPosts();
    return;
  }

  try {
    const result = await fetchJSON(`${API}/forum/posts/${postId}/pin`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ pin: !targetPost.isPinned }),
    });
    targetPost.isPinned = Boolean(result.is_pinned);
    targetPost.pinnedAt = targetPost.isPinned ? Date.now() : null;
    persistPinState(targetPost);
  } catch (error) {
    alert("Lỗi: " + error.message);
  }
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

  if (post.source !== 'local-poll' && !post.threadLoaded) {
    fetchPostDetails(postId)
      .then(() => { if (currentOpenPostId === postId) renderThreadView(); })
      .catch(error => console.error('Failed to load thread:', error));
  }
}

function closeThread() {
  currentOpenPostId = null;
  document.getElementById('postsContainer').style.display = 'flex';
  document.getElementById('filterBar').style.display = 'flex';
  document.getElementById('threadContainer').style.display = 'none';
  document.querySelector('.forum-layout').classList.remove('thread-mode');
  renderPosts();
}

async function renderPosts() {
  if (currentOpenPostId) return; 
  if (posts.length === 0) await fetchPosts();
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
