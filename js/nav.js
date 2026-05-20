(function () {
  // --- Base path (depth-aware) ---
  const segments = window.location.pathname.split("/").filter(Boolean);
  const depth = segments.length - 1;
  const base = depth > 0 ? "../".repeat(depth) : "";

  // --- Navbar: auth state ---
  const user = window.Auth ? window.Auth.getUser() : null;

  const authSection = user
    ? `<span class="navbar-user">
         <span class="navbar-username">${user.username}</span>
         <button id="logout-btn" class="btn btn-outline">Log Out</button>
       </span>`
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
        window.Auth.logout();
      });
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

  const API = window.AppConfig.API;

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
})();

