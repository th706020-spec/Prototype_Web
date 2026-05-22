(function () {
  // --- Base path (depth-aware) ---
  const segments = window.location.pathname.split("/").filter(Boolean);
  const depth = segments.length - 1;
  const base = depth > 0 ? "../".repeat(depth) : "";

  const API = window.AppConfig.API;

  // --- Navbar: auth state ---
  const user = window.Auth ? window.Auth.getUser() : null;

  const cachedAvatar = localStorage.getItem("protocol_avatar_url");
  const defaultAvatar = user ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=5b85f6&color=fff` : "";

  const authSection = user
    ? `<div class="nav-user-box" id="nav-user-box">
         <img id="nav-avatar" src="${cachedAvatar || defaultAvatar}" class="nav-avatar-circle" alt="Avatar">
         <span class="navbar-username">${user.username}</span>
         <span class="nav-dropdown-chevron">▾</span>
         <div class="nav-user-dropdown" id="nav-user-dropdown">
           <div class="nav-dropdown-header">
             <label id="nav-avatar-label" title="Click to change avatar" style="cursor:pointer">
               <img id="nav-avatar-lg" src="${cachedAvatar || defaultAvatar}" class="nav-avatar-lg" alt="Avatar">
               <input type="file" id="nav-avatar-input" accept="image/*" hidden>
               <div class="nav-avatar-overlay">📷</div>
             </label>
             <div class="nav-dropdown-info">
               <div class="nav-dropdown-name" id="nav-dropdown-username">${user.username}</div>
               <div class="nav-dropdown-email">${user.email || ""}</div>
               <div class="nav-dropdown-joined" id="nav-dropdown-joined">Loading...</div>
               <div class="nav-dropdown-tier ${user.tier === 'premium' ? 'is-premium' : ''}" id="nav-dropdown-tier">${user.tier === 'premium' ? '⭐ Premium' : '🔓 Free Member'}</div>
             </div>
           </div>
           <div class="nav-dropdown-divider"></div>
           <button class="nav-dropdown-item" id="nav-settings-btn">⚙️ Settings</button>
           <button class="nav-dropdown-item danger" id="logout-btn">🚪 Log Out</button>
         </div>
       </div>`
    : `<button id="open-login" class="btn btn-outline">Log In</button>
       <button id="open-signup" class="btn btn-primary">Sign Up</button>`;

  // --- Inject navbar ---
  const navEl = document.getElementById("site-nav");

  if (navEl) {
    navEl.innerHTML = `
      <nav class="navbar" role="navigation" aria-label="Main navigation">
        <div class="navbar-inner">

          <ul class="navbar-links">
            <li><a href="${base}index.html">Home</a></li>
            <li><a href="#">About</a></li>
          </ul>

          <div class="navbar-logo">
            <a href="${base}index.html" class="logo-placeholder" title="Protocol">
              &#9670; Logo
            </a>
          </div>

          <div class="navbar-auth">
            <button id="theme-toggle" class="btn btn-outline" title="Toggle theme">🌙</button>
            ${user ? `
            <div class="nav-bell-wrapper" id="nav-bell-wrapper">
              <button class="nav-bell-btn" id="nav-bell" title="Notifications">🔔</button>
              <span class="nav-bell-badge" id="nav-bell-badge" style="display:none">0</span>
              <div class="nav-bell-dropdown" id="nav-bell-dropdown">
                <div class="nav-bell-header">Notifications</div>
                <div id="nav-notif-list" class="nav-notif-list"><p class="nav-notif-empty">Loading...</p></div>
              </div>
            </div>` : ""}
            ${authSection}
          </div>

        </div>
      </nav>
    `;

    // Active link
    navEl.querySelectorAll(".navbar-links a").forEach(function (link) {
      if (link.href === window.location.href) link.classList.add("active");
    });

    // Theme toggle
    const themeBtn = document.getElementById("theme-toggle");
    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark");
      if (themeBtn) themeBtn.innerText = "☀️";
    }
    if (themeBtn) {
      themeBtn.addEventListener("click", function () {
        document.body.classList.toggle("dark");
        const isDark = document.body.classList.contains("dark");
        themeBtn.innerText = isDark ? "☀️" : "🌙";
        localStorage.setItem("theme", isDark ? "dark" : "light");
      });
    }

    // Logout
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("protocol_avatar_url");
        window.Auth.logout();
      });
    }

    // User box dropdown toggle
    const userBox = document.getElementById("nav-user-box");
    const userDropdown = document.getElementById("nav-user-dropdown");
    if (userBox && userDropdown) {
      userBox.addEventListener("click", function (e) {
        // Don't toggle if click originated from inside the dropdown (except the box itself)
        if (e.target.closest(".nav-user-dropdown") && e.target !== userBox) return;
        userDropdown.classList.toggle("is-open");
        e.stopPropagation();
      });
      document.addEventListener("click", function (e) {
        if (!userBox.contains(e.target)) userDropdown.classList.remove("is-open");
      });
    }

    // Settings button
    const settingsBtn = document.getElementById("nav-settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", function () {
        if (userDropdown) userDropdown.classList.remove("is-open");
        openModal("nav-settings-modal");
      });
    }

    // Avatar upload
    if (user) {
      const navAvatarInput = document.getElementById("nav-avatar-input");
      const navAvatarImg = document.getElementById("nav-avatar");

    // Async refresh avatar + profile info from server
      (async function () {
        try {
          const token = window.Auth.getToken();
          const r = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const d = await r.json();
            if (d.user) {
              if (d.user.avatar_url) {
                localStorage.setItem("protocol_avatar_url", d.user.avatar_url);
                if (navAvatarImg) navAvatarImg.src = d.user.avatar_url;
                const navAvatarLg = document.getElementById("nav-avatar-lg");
                if (navAvatarLg) navAvatarLg.src = d.user.avatar_url;
              }
              const joinedEl = document.getElementById("nav-dropdown-joined");
              if (joinedEl && d.user.created_at) {
                const date = new Date(d.user.created_at);
                joinedEl.textContent = "Joined " + date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
              } else if (joinedEl) {
                joinedEl.textContent = "";
              }
            }
          }
        } catch {}
      })();

      if (navAvatarInput) {
        navAvatarInput.addEventListener("change", async function () {
          const file = this.files[0];
          if (!file) return;
          const formData = new FormData();
          formData.append("avatar", file);
          try {
            const token = window.Auth.getToken();
            const res = await fetch(`${API}/auth/avatar`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
            if (res.ok) {
              const data = await res.json();
              if (data.avatar_url) {
                localStorage.setItem("protocol_avatar_url", data.avatar_url);
                if (navAvatarImg) navAvatarImg.src = data.avatar_url;
                const navAvatarLg = document.getElementById("nav-avatar-lg");
                if (navAvatarLg) navAvatarLg.src = data.avatar_url;
              }
            }
          } catch {}
        });
      }
    }

    // Open modals from navbar buttons
    const openLoginBtn = document.getElementById("open-login");
    const openSignupBtn = document.getElementById("open-signup");
    if (openLoginBtn) openLoginBtn.addEventListener("click", function () { openModal("login-modal"); });
    if (openSignupBtn) openSignupBtn.addEventListener("click", function () { openModal("signup-modal"); });
  }

  // --- Inject footer ---
  const footerEl = document.getElementById("site-footer");
  if (footerEl) {
    footerEl.innerHTML = `
      <footer>
        <p>&copy; DEADLINE 22/5/2026.</p>
      </footer>
    `;
  }

  // --- Inject auth modals ---
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="login-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-label="Log in">
      <div class="modal-box">
        <button class="modal-close" aria-label="Close">&times;</button>
        <h2 class="modal-title">Log In</h2>
        <form id="login-form" class="auth-form" novalidate>
          <div class="auth-field">
            <label for="login-identifier">Email or Username</label>
            <input id="login-identifier" type="text" class="auth-input" required placeholder="you@example.com or yourname" autocomplete="username" />
          </div>
          <div class="auth-field">
            <label for="login-password">Password</label>
            <input id="login-password" type="password" class="auth-input" required placeholder="••••••••" autocomplete="current-password" />
          </div>
          <p id="login-error" class="auth-error" hidden></p>
          <button type="submit" class="btn btn-primary auth-submit">Log In</button>
        </form>
        <p class="auth-switch">
          Don't have an account?
          <button class="auth-switch-btn" id="goto-signup">Sign Up</button>
        </p>
      </div>
    </div>

    <div id="signup-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-label="Sign up">
      <div class="modal-box">
        <button class="modal-close" aria-label="Close">&times;</button>
        <h2 class="modal-title">Sign Up</h2>
        <form id="signup-form" class="auth-form" novalidate>
          <div class="auth-field">
            <label for="signup-username">Username</label>
            <input id="signup-username" type="text" class="auth-input" required placeholder="yourname" autocomplete="username" />
            <span id="username-status" class="username-status" hidden></span>
          </div>
          <div class="auth-field">
            <label for="signup-email">Email</label>
            <input id="signup-email" type="email" class="auth-input" required placeholder="you@example.com" autocomplete="email" />
          </div>
          <div class="auth-field">
            <label for="signup-password">Password</label>
            <input id="signup-password" type="password" class="auth-input" required placeholder="••••••••" autocomplete="new-password" />
          </div>
          <div class="auth-field">
            <label for="signup-confirm">Confirm Password</label>
            <input id="signup-confirm" type="password" class="auth-input" required placeholder="••••••••" autocomplete="new-password" />
          </div>
          <p id="signup-error" class="auth-error" hidden></p>
          <button type="submit" class="btn btn-primary auth-submit">Create Account</button>
        </form>
        <p class="auth-switch">
          Already have an account?
          <button class="auth-switch-btn" id="goto-login">Log In</button>
        </p>
      </div>
    </div>

    <div id="nav-settings-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div class="modal-box settings-modal-box">
        <button class="modal-close" aria-label="Close">&times;</button>
        <h2 class="modal-title">⚙️ Account Settings</h2>

        <div class="settings-section">
          <h3 class="settings-section-title">Change Username</h3>
          <form id="change-username-form" class="auth-form" novalidate>
            <div class="auth-field">
              <label for="new-username">New Username</label>
              <input id="new-username" type="text" class="auth-input" placeholder="new_username" autocomplete="off" />
            </div>
            <div class="auth-field">
              <label for="confirm-pwd-username">Current Password</label>
              <input id="confirm-pwd-username" type="password" class="auth-input" placeholder="••••••••" />
            </div>
            <p id="username-change-msg" class="auth-error" hidden></p>
            <button type="submit" class="btn btn-primary auth-submit">Update Username</button>
          </form>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Change Password</h3>
          <form id="change-password-form" class="auth-form" novalidate>
            <div class="auth-field">
              <label for="current-password">Current Password</label>
              <input id="current-password" type="password" class="auth-input" placeholder="••••••••" />
            </div>
            <div class="auth-field">
              <label for="new-password">New Password</label>
              <input id="new-password" type="password" class="auth-input" placeholder="Min 6 characters" />
            </div>
            <div class="auth-field">
              <label for="confirm-new-password">Confirm New Password</label>
              <input id="confirm-new-password" type="password" class="auth-input" placeholder="••••••••" />
            </div>
            <p id="password-change-msg" class="auth-error" hidden></p>
            <button type="submit" class="btn btn-primary auth-submit">Update Password</button>
          </form>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Member Status</h3>
          <div class="settings-status-row">
            <span id="settings-tier-badge" class="settings-tier-badge">Loading...</span>
            <a href="${base}pages/premium/premium.html" id="settings-upgrade-link" class="btn btn-primary settings-upgrade-btn" style="display:none">⭐ Upgrade to Premium</a>
          </div>
          <p class="settings-tier-info" id="settings-tier-info"></p>
        </div>
      </div>
    </div>
  `
  );

  // --- Modal helpers ---
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("is-open");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("is-open");
  }

  // Close on backdrop click or X button
  document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.classList.remove("is-open");
    });
    const closeBtn = overlay.querySelector(".modal-close");
    if (closeBtn) closeBtn.addEventListener("click", function () { overlay.classList.remove("is-open"); });
  });

  // --- Settings modal: populate tier info ---
  if (user) {
    const tierBadge = document.getElementById("settings-tier-badge");
    const tierInfo = document.getElementById("settings-tier-info");
    const upgradeLink = document.getElementById("settings-upgrade-link");
    if (tierBadge) {
      if (user.tier === "premium") {
        tierBadge.textContent = "⭐ Premium Member";
        tierBadge.className = "settings-tier-badge premium";
        if (tierInfo) tierInfo.textContent = "You have full access to all premium features.";
      } else {
        tierBadge.textContent = "🔓 Free Member";
        tierBadge.className = "settings-tier-badge free";
        if (tierInfo) tierInfo.textContent = "Upgrade to Premium for exclusive features.";
        if (upgradeLink) upgradeLink.style.display = "inline-flex";
      }
    }
  }

  // Change username form
  const changeUsernameForm = document.getElementById("change-username-form");
  if (changeUsernameForm) {
    changeUsernameForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const newUsername = document.getElementById("new-username").value.trim();
      const password = document.getElementById("confirm-pwd-username").value;
      const msgEl = document.getElementById("username-change-msg");
      const btn = changeUsernameForm.querySelector(".auth-submit");
      msgEl.hidden = true;
      if (!newUsername || !password) { msgEl.textContent = "All fields are required"; msgEl.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Updating...";
      try {
        const token = window.Auth.getToken();
        const data = await fetchJSON(`${API}/auth/username`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ newUsername, password }),
        });
        window.Auth.saveToken(data.token);
        msgEl.textContent = "Username updated! Reloading...";
        msgEl.style.color = "#22c55e"; msgEl.hidden = false;
        setTimeout(() => window.location.reload(), 1200);
      } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = ""; msgEl.hidden = false;
        btn.disabled = false; btn.textContent = "Update Username";
      }
    });
  }

  // Change password form
  const changePasswordForm = document.getElementById("change-password-form");
  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmNew = document.getElementById("confirm-new-password").value;
      const msgEl = document.getElementById("password-change-msg");
      const btn = changePasswordForm.querySelector(".auth-submit");
      msgEl.hidden = true;
      if (!currentPassword || !newPassword || !confirmNew) { msgEl.textContent = "All fields are required"; msgEl.hidden = false; return; }
      if (newPassword !== confirmNew) { msgEl.textContent = "New passwords do not match"; msgEl.hidden = false; return; }
      if (newPassword.length < 6) { msgEl.textContent = "New password must be at least 6 characters"; msgEl.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Updating...";
      try {
        const token = window.Auth.getToken();
        await fetchJSON(`${API}/auth/password`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        msgEl.textContent = "Password updated successfully!";
        msgEl.style.color = "#22c55e"; msgEl.hidden = false;
        changePasswordForm.reset();
        btn.disabled = false; btn.textContent = "Update Password";
      } catch (err) {
        msgEl.textContent = err.message;
        msgEl.style.color = ""; msgEl.hidden = false;
        btn.disabled = false; btn.textContent = "Update Password";
      }
    });
  }

  // Switch between modals
  document.getElementById("goto-signup").addEventListener("click", function () {
    closeModal("login-modal");
    openModal("signup-modal");
  });
  document.getElementById("goto-login").addEventListener("click", function () {
    closeModal("signup-modal");
    openModal("login-modal");
  });

  // --- Safe JSON fetch helper ---
  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Server returned an unexpected response. Make sure the server is running.");
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // --- Login form ---
  const loginForm = document.getElementById("login-form");
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;
    const errorEl = document.getElementById("login-error");
    const submitBtn = loginForm.querySelector(".auth-submit");

    errorEl.hidden = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    try {
      const data = await fetchJSON(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      window.Auth.saveToken(data.token);
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
    }
  });

  // --- Signup form ---
  const signupForm = document.getElementById("signup-form");

  // Username availability check on blur
  const usernameInput = document.getElementById("signup-username");
  const usernameStatus = document.getElementById("username-status");
  usernameInput.addEventListener("blur", async function () {
    const val = this.value.trim();
    if (!val) { usernameStatus.hidden = true; return; }
    try {
      const data = await fetchJSON(`${API}/auth/check-username/${encodeURIComponent(val)}`);
      usernameStatus.hidden = false;
      if (data.available) {
        usernameStatus.textContent = "Available";
        usernameStatus.className = "username-status available";
      } else {
        usernameStatus.textContent = "Already taken";
        usernameStatus.className = "username-status taken";
      }
    } catch {
      usernameStatus.hidden = true;
    }
  });

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("signup-username").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirm = document.getElementById("signup-confirm").value;
    const errorEl = document.getElementById("signup-error");
    const submitBtn = signupForm.querySelector(".auth-submit");

    errorEl.hidden = true;

    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match";
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";

    try {
      const data = await fetchJSON(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      window.Auth.saveToken(data.token);
      window.location.reload();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
  });

  // --- Auth guard on feature cards ---
  if (!window.Auth || !window.Auth.isLoggedIn()) {
    document.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function (e) {
        e.preventDefault();
        openModal("login-modal");
      });
    });
  }

  // --- bfcache fix: re-apply theme on back/forward restore ---
  window.addEventListener("pageshow", function(e) {
    if (e.persisted) {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") {
        document.body.classList.add("dark");
        const btn = document.getElementById("theme-toggle");
        if (btn) btn.innerText = "☀️";
      } else {
        document.body.classList.remove("dark");
        const btn = document.getElementById("theme-toggle");
        if (btn) btn.innerText = "🌙";
      }
    }
  });

  // --- Global heartbeat — keeps user "online" on every page ---
  if (user) {
    const _hb = async function() {
      try {
        await fetch(`${API}/users/heartbeat`, {
          method: "PUT",
          headers: { Authorization: "Bearer " + window.Auth.getToken() },
        });
      } catch {}
    };
    _hb();
    setInterval(_hb, 30000);
  }

  // --- Notification polling ---
  if (user) {
    const bellEl = document.getElementById("nav-bell");
    const badgeEl = document.getElementById("nav-bell-badge");
    const notifList = document.getElementById("nav-notif-list");
    const bellDropdown = document.getElementById("nav-bell-dropdown");

    async function fetchNotifications() {
      try {
        const token = window.Auth.getToken();
        const r = await fetch(`${API}/notifications`, { headers: { Authorization: "Bearer " + token } });
        if (!r.ok) return;
        const items = await r.json();
        const unread = items.filter(function(n) { return !n.read; }).length;
        if (badgeEl) {
          badgeEl.textContent = unread > 9 ? "9+" : String(unread);
          badgeEl.style.display = unread > 0 ? "flex" : "none";
        }
        if (notifList) {
          notifList.innerHTML = items.length
            ? items.slice(0, 10).map(function(n) {
                const icon = n.type === "message" ? "💬" : "🗨️";
                return `<div class="nav-notif-item${n.read ? "" : " unread"}">
                  <span class="nav-notif-icon">${icon}</span>
                  <div class="nav-notif-body">
                    <p>${n.message}</p>
                    <span class="nav-notif-time">${new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>`;
              }).join("")
            : `<p class="nav-notif-empty">No notifications</p>`;
        }
      } catch {}
    }

    fetchNotifications();
    setInterval(fetchNotifications, 30000);

    if (bellEl && bellDropdown) {
      bellEl.addEventListener("click", async function(e) {
        e.stopPropagation();
        bellDropdown.classList.toggle("is-open");
        if (bellDropdown.classList.contains("is-open")) {
          try {
            await fetch(`${API}/notifications/read`, {
              method: "PATCH",
              headers: { Authorization: "Bearer " + window.Auth.getToken() },
            });
            if (badgeEl) badgeEl.style.display = "none";
          } catch {}
        }
      });
      document.addEventListener("click", function(e) {
        if (!bellEl.closest(".nav-bell-wrapper").contains(e.target)) {
          bellDropdown.classList.remove("is-open");
        }
      });
    }
  }
})();

