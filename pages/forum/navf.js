const FORUM_KEY = "smartstudy_forum_posts_v2";

// Use logged-in user if available
const _authUser = window.Auth ? window.Auth.getUser() : null;
const currentUser = {
  username: _authUser ? _authUser.username : "Khách",
  avatar: _authUser
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(_authUser.username)}&background=5b85f6&color=fff`
    : "https://ui-avatars.com/api/?name=Guest&background=aaa&color=fff",
};

let posts = [];
let selectedTag = null;
let expandedPostId = null;

const forumService = {
  getPosts: () => {
    try {
      const data = localStorage.getItem(FORUM_KEY);
      if (!data) { localStorage.setItem(FORUM_KEY, JSON.stringify([])); return []; }
      return JSON.parse(data);
    } catch {
      localStorage.removeItem(FORUM_KEY);
      return [];
    }
  },
  createPost: (post) => {
    const updated = [post, ...forumService.getPosts()];
    localStorage.setItem(FORUM_KEY, JSON.stringify(updated));
    return updated;
  },
  addComment: (postId, comment) => {
    const updated = forumService.getPosts().map((p) =>
      p.id === postId ? { ...p, comments: [...(p.comments || []), comment] } : p
    );
    localStorage.setItem(FORUM_KEY, JSON.stringify(updated));
    return updated;
  },
  toggleLike: (postId, username) => {
    const updated = forumService.getPosts().map((p) => {
      if (p.id !== postId) return p;
      const likes = p.likes || [];
      return { ...p, likes: likes.includes(username) ? likes.filter((u) => u !== username) : [...likes, username] };
    });
    localStorage.setItem(FORUM_KEY, JSON.stringify(updated));
    return updated;
  },
};

const tagsContainer   = document.getElementById("tags-container");
const postsContainer  = document.getElementById("posts-container");
const createModal     = document.getElementById("create-modal");
const btnOpenModal    = document.getElementById("btn-open-modal");
const btnCloseModal   = document.getElementById("btn-close-modal");
const btnCancelModal  = document.getElementById("btn-cancel-modal");
const btnSubmitPost   = document.getElementById("btn-submit-post");

function init() {
  posts = forumService.getPosts();
  renderTags();
  renderPosts();
  setupEventListeners();
}

function renderTags() {
  const tagCounts = posts.flatMap((p) => p.tags).reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
  const sorted = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]);

  tagsContainer.innerHTML =
    `<span class="tag-filter-label">🏷 Chủ đề:</span>
     <button onclick="handleTagClick(null)" class="tag-filter ${selectedTag === null ? "all-active" : ""}">Tất cả</button>` +
    sorted
      .map(
        (tag) =>
          `<button onclick="handleTagClick('${tag}')" class="tag-filter ${selectedTag === tag ? "active" : ""}">${tag}</button>`
      )
      .join("");
}

window.handleTagClick = (tag) => {
  selectedTag = selectedTag === tag ? null : tag;
  renderTags();
  renderPosts();
};

window.toggleExpandPost = (postId) => {
  expandedPostId = expandedPostId === postId ? null : postId;
  renderPosts();
};

window.handleLike = (postId, event) => {
  event.stopPropagation();
  posts = forumService.toggleLike(postId, currentUser.username);
  renderPosts();
};

window.submitComment = (postId) => {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input ? input.value.trim() : "";
  if (!text) return;
  posts = forumService.addComment(postId, {
    id: Date.now().toString(),
    author: currentUser.username,
    authorAvatar: currentUser.avatar,
    content: text,
    createdAt: new Date().toISOString(),
  });
  renderPosts();
};

window.handleCommentKeyPress = (event, postId) => {
  if (event.key === "Enter") submitComment(postId);
};

function avatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&background=random`;
}

function renderPosts() {
  const filtered = selectedTag ? posts.filter((p) => p.tags.includes(selectedTag)) : posts;

  if (!filtered.length) {
    postsContainer.innerHTML = `
      <div class="forum-empty">
        <div class="forum-empty-icon">🔍</div>
        <h3>Không tìm thấy bài viết nào</h3>
        <p>Hãy thử chọn chủ đề khác hoặc tạo bài viết mới.</p>
        <button onclick="handleTagClick(null)" class="btn btn-outline" style="margin-top:14px">Xem tất cả</button>
      </div>`;
    return;
  }

  postsContainer.innerHTML = filtered
    .map((post) => {
      const isExpanded  = expandedPostId === post.id;
      const hasLiked    = (post.likes || []).includes(currentUser.username);
      const displayText = isExpanded || post.content.length <= 150
        ? post.content
        : post.content.substring(0, 150) + "…";

      const tagsHTML = post.tags
        .map(
          (tag) =>
            `<button onclick="event.stopPropagation();handleTagClick('${tag}')" class="post-tag ${selectedTag === tag ? "active-tag" : ""}">${tag}</button>`
        )
        .join("");

      let commentsHTML = "";
      if (isExpanded) {
        const commentItems = (post.comments || []).length
          ? (post.comments || [])
              .map(
                (c) => `
              <div class="comment-item">
                <img class="comment-avatar" src="${c.authorAvatar || avatarUrl(c.author)}" alt="${c.author}">
                <div class="comment-bubble">
                  <div class="comment-meta">
                    <span class="comment-author">${c.author}</span>
                    <span class="comment-time">${new Date(c.createdAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <p class="comment-text">${c.content}</p>
                </div>
              </div>`
              )
              .join("")
          : `<p style="text-align:center;color:var(--clr-muted);font-size:13px;font-style:italic;padding:8px 0">Chưa có bình luận nào. Hãy là người đầu tiên!</p>`;

        commentsHTML = `
          <div class="comments-section">
            <div>${commentItems}</div>
            <div class="comment-input-row">
              <input type="text" id="comment-input-${post.id}" class="comment-input"
                onkeydown="handleCommentKeyPress(event,'${post.id}')"
                placeholder="Viết bình luận..." />
              <button class="comment-send-btn" onclick="submitComment('${post.id}')">➤</button>
            </div>
          </div>`;
      }

      return `
        <div class="post-card animate-in">
          <div class="post-card-body">
            <div class="post-author">
              <img class="post-author-avatar" src="${post.authorAvatar || avatarUrl(post.author)}" alt="${post.author}">
              <div>
                <div class="post-author-name">${post.author}</div>
                <div class="post-author-time">${new Date(post.createdAt).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            </div>
            <h2 class="post-title" onclick="toggleExpandPost('${post.id}')">${post.title}</h2>
            <p class="post-content">${displayText}</p>
            <div class="post-tags">${tagsHTML}</div>
            <div class="post-actions">
              <button class="post-action-btn ${hasLiked ? "liked" : ""}" onclick="handleLike('${post.id}',event)">
                ♥ ${(post.likes || []).length}
              </button>
              <button class="post-action-btn" onclick="toggleExpandPost('${post.id}')">
                💬 ${(post.comments || []).length} Bình luận
              </button>
            </div>
          </div>
          ${commentsHTML}
        </div>`;
    })
    .join("");
}

function setupEventListeners() {
  const openModal = () => { createModal.style.display = "flex"; };
  const closeModal = () => {
    createModal.style.display = "none";
    document.getElementById("post-title").value = "";
    document.getElementById("post-content").value = "";
    document.getElementById("post-tags").value = "";
  };

  btnOpenModal.addEventListener("click", openModal);
  btnCloseModal.addEventListener("click", closeModal);
  btnCancelModal.addEventListener("click", closeModal);
  createModal.addEventListener("click", (e) => { if (e.target === createModal) closeModal(); });

  btnSubmitPost.addEventListener("click", () => {
    const title   = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();
    const tags    = document.getElementById("post-tags").value;
    if (!title || !content) return;

    posts = forumService.createPost({
      id: Date.now().toString(),
      author: currentUser.username,
      authorAvatar: currentUser.avatar,
      title,
      content,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
    });
    closeModal();
    renderTags();
    renderPosts();
  });
}

document.addEventListener("DOMContentLoaded", init);
