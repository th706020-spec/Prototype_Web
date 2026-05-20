const FORUM_KEY = "smartstudy_forum_posts_v2";
const currentUser = {
  username: "Trung",
  avatar: "https://ui-avatars.com/api/?name=Trung",
};

let posts = [];
let selectedTag = null;
let expandedPostId = null;

const forumService = {
  getPosts: () => {
    const data = localStorage.getItem(FORUM_KEY);
    if (!data) {
      localStorage.setItem(FORUM_KEY, JSON.stringify([]));
      return [];
    }
    return JSON.parse(data);
  },
  createPost: (post) => {
    const currentPosts = forumService.getPosts();
    const newPosts = [post, ...currentPosts];
    localStorage.setItem(FORUM_KEY, JSON.stringify(newPosts));
    return newPosts;
  },
  addComment: (postId, comment) => {
    const currentPosts = forumService.getPosts();
    const updatedPosts = currentPosts.map((p) => {
      if (p.id === postId) {
        return { ...p, comments: [...(p.comments || []), comment] };
      }
      return p;
    });
    localStorage.setItem(FORUM_KEY, JSON.stringify(updatedPosts));
    return updatedPosts;
  },
  toggleLike: (postId, username) => {
    const currentPosts = forumService.getPosts();
    const updatedPosts = currentPosts.map((p) => {
      if (p.id === postId) {
        const currentLikes = p.likes || [];
        const hasLiked = currentLikes.includes(username);
        const newLikes = hasLiked
          ? currentLikes.filter((u) => u !== username)
          : [...currentLikes, username];
        return { ...p, likes: newLikes };
      }
      return p;
    });
    localStorage.setItem(FORUM_KEY, JSON.stringify(updatedPosts));
    return updatedPosts;
  },
};

const tagsContainer = document.getElementById("tags-container");
const postsContainer = document.getElementById("posts-container");
const createModal = document.getElementById("create-modal");
const btnOpenModal = document.getElementById("btn-open-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const btnSubmitPost = document.getElementById("btn-submit-post");

function init() {
  posts = forumService.getPosts();
  renderTags();
  renderPosts();
  setupEventListeners();
}

function renderTags() {
  const tagCounts = posts
    .flatMap((p) => p.tags)
    .reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});

  const sortedTags = Object.keys(tagCounts).sort(
    (a, b) => tagCounts[b] - tagCounts[a],
  );

  let tagsHTML = `
        <div class="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 mr-2">
            <i data-lucide="filter" class="w-4 h-4"></i> Chủ đề:
        </div>
        <button onclick="handleTagClick(null)" class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
          selectedTag === null
            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-[#1e1e2d] dark:border-gray-700 dark:text-gray-300"
        }">Tất cả</button>
    `;

  sortedTags.forEach((tag) => {
    const isActive = selectedTag === tag;
    tagsHTML += `
            <button onclick="handleTagClick('${tag}')" class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              isActive
                ? "bg-indigo-600 text-white border border-indigo-600"
                : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:bg-[#1e1e2d] dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-500"
            }">
                <i data-lucide="hash" class="w-3 h-3 opacity-60"></i> ${tag}
            </button>
        `;
  });

  tagsContainer.innerHTML = tagsHTML;
  lucide.createIcons();
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
  const commentText = input.value.trim();
  if (!commentText) return;

  posts = forumService.addComment(postId, {
    id: Date.now().toString(),
    author: currentUser.username,
    authorAvatar: currentUser.avatar,
    content: commentText,
    createdAt: new Date().toISOString(),
  });
  renderPosts();
};

window.handleCommentKeyPress = (event, postId) => {
  if (event.key === "Enter") {
    submitComment(postId);
  }
};

function renderPosts() {
  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags.includes(selectedTag))
    : posts;

  if (filteredPosts.length === 0) {
    postsContainer.innerHTML = `
            <div class="text-center py-20">
                <div class="bg-gray-100 dark:bg-gray-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="search" class="w-10 h-10 text-gray-400"></i>
                </div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">Không tìm thấy bài viết nào</h3>
                <p class="text-gray-500 dark:text-gray-400">Hãy thử chọn chủ đề khác hoặc tạo bài viết mới.</p>
                <button onclick="handleTagClick(null)" class="mt-4 text-indigo-600 font-medium hover:underline">Xem tất cả</button>
            </div>
        `;
    lucide.createIcons();
    return;
  }

  let postsHTML = "";
  filteredPosts.forEach((post) => {
    const isExpanded = expandedPostId === post.id;
    const hasLiked = (post.likes || []).includes(currentUser.username);
    const contentDisplay = isExpanded
      ? post.content
      : post.content.length > 150
        ? post.content.substring(0, 150) + "..."
        : post.content;

    let tagsHTML = post.tags
      .map(
        (tag) => `
            <button onclick="event.stopPropagation(); handleTagClick('${tag}')" class="text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${
              selectedTag === tag
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }">
                <i data-lucide="tag" class="w-3 h-3"></i> ${tag}
            </button>
        `,
      )
      .join("");

    let commentsHTML = "";
    if (isExpanded) {
      let commentsList = "";
      if (!post.comments || post.comments.length === 0) {
        commentsList = `<p class="text-center text-gray-400 text-sm italic">Chưa có bình luận nào. Hãy là người đầu tiên!</p>`;
      } else {
        commentsList = post.comments
          .map(
            (comment) => `
                    <div class="flex gap-3">
                        <img src="${comment.authorAvatar}" class="w-8 h-8 rounded-full border border-gray-200" alt="avt">
                        <div class="flex-1 bg-white dark:bg-[#1e1e2d] p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div class="flex justify-between items-center mb-1">
                                <div class="flex items-center gap-1">
                                    <span class="font-bold text-xs dark:text-white">${comment.author}</span>
                                    <i data-lucide="check-circle-2" class="w-3 h-3 text-blue-500"></i>
                                </div>
                                <span class="text-[10px] text-gray-400">${new Date(comment.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p class="text-sm text-gray-700 dark:text-gray-300">${comment.content}</p>
                        </div>
                    </div>
                `,
          )
          .join("");
      }

      commentsHTML = `
                <div class="bg-gray-50 dark:bg-[#252536] p-6 border-t border-gray-200 dark:border-gray-700">
                    <div class="space-y-4 mb-6">${commentsList}</div>
                    <div class="flex gap-2">
                        <input type="text" id="comment-input-${post.id}" onkeydown="handleCommentKeyPress(event, '${post.id}')" placeholder="Viết bình luận..." class="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1e1e2d] focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-white shadow-sm">
                        <button onclick="submitComment('${post.id}')" class="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-sm">
                            <i data-lucide="send" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            `;
    }

    postsHTML += `
            <div class="bg-white dark:bg-[#1e1e2d] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-in">
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <img src="${post.authorAvatar || `https://ui-avatars.com/api/?name=${post.author}`}" alt="avatar" class="w-10 h-10 rounded-full bg-gray-100 border border-gray-200">
                        <div>
                            <div class="flex items-center gap-1">
                                <h3 class="font-bold text-gray-900 dark:text-white text-sm">${post.author}</h3>
                                <i data-lucide="check-circle-2" class="w-3 h-3 text-blue-500"></i>
                            </div>
                            <span class="text-xs text-gray-500">${new Date(post.createdAt).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                    </div>
                    <h2 onclick="toggleExpandPost('${post.id}')" class="text-xl font-bold text-gray-800 dark:text-white mb-2 cursor-pointer hover:text-indigo-600 transition-colors">
                        ${post.title}
                    </h2>
                    <p class="text-gray-600 dark:text-gray-300 mb-4 whitespace-pre-wrap">${contentDisplay}</p>
                    <div class="flex flex-wrap gap-2 mb-4">${tagsHTML}</div>
                    <div class="flex items-center gap-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <button onclick="handleLike('${post.id}', event)" class="flex items-center gap-2 text-sm font-medium transition-colors ${hasLiked ? "text-pink-500" : "text-gray-500 hover:text-pink-500"}">
                            <i data-lucide="heart" class="w-5 h-5 ${hasLiked ? "fill-current" : ""}"></i>
                            ${(post.likes || []).length}
                        </button>
                        <button onclick="toggleExpandPost('${post.id}')" class="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-indigo-600 transition-colors">
                            <i data-lucide="message-square" class="w-5 h-5"></i>
                            ${(post.comments || []).length} Bình luận
                        </button>
                    </div>
                </div>
                ${commentsHTML}
            </div>
        `;
  });

  postsContainer.innerHTML = postsHTML;
  lucide.createIcons();
}

function setupEventListeners() {
  btnOpenModal.addEventListener("click", () => {
    createModal.classList.remove("hidden");
    createModal.classList.add("flex");
  });

  const closeModal = () => {
    createModal.classList.add("hidden");
    createModal.classList.remove("flex");
    document.getElementById("post-title").value = "";
    document.getElementById("post-content").value = "";
    document.getElementById("post-tags").value = "";
  };

  btnCloseModal.addEventListener("click", closeModal);
  btnCancelModal.addEventListener("click", closeModal);

  createModal.addEventListener("click", (e) => {
    if (e.target === createModal) closeModal();
  });

  btnSubmitPost.addEventListener("click", () => {
    const title = document.getElementById("post-title").value;
    const content = document.getElementById("post-content").value;
    const tagsInput = document.getElementById("post-tags").value;

    if (!title || !content) return;

    const post = {
      id: Date.now().toString(),
      author: currentUser.username,
      authorAvatar: currentUser.avatar,
      title: title,
      content: content,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };

    posts = forumService.createPost(post);
    closeModal();
    renderTags();
    renderPosts();
  });
}

document.addEventListener("DOMContentLoaded", init);
