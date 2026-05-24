(function () {
  const API = window.AppConfig.API;
  const auth = window.Auth;

  function getUser() { return auth ? auth.getUser() : null; }
  function getToken() { return auth ? auth.getToken() : null; }

  // ── Sidebar navigation ───────────────────────────────
  document.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById('section-' + btn.dataset.section);
      if (target) target.classList.add('active');
    });
  });

  // ── Font system ─────────────────────────────────────
  const FONT_URLS = {
    'JetBrains Mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
    'Fira Code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap',
    'Victor Mono': 'https://fonts.googleapis.com/css2?family=Victor+Mono:wght@400;500;600&display=swap',
    'Space Mono': 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
    'Inconsolata': 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;500;600;700&display=swap',
  };

  function applyFont(fontName) {
    const linkEl = document.getElementById('custom-font-link');
    const body = document.body;
    // Remove previous custom font
    body.style.fontFamily = '';
    if (!fontName) {
      if (linkEl) linkEl.href = '';
      return;
    }
    const url = FONT_URLS[fontName];
    if (url && linkEl) linkEl.href = url;
    body.style.fontFamily = `'${fontName}', monospace`;
    // Update font preview
    const preview = document.getElementById('font-preview');
    if (preview) preview.style.fontFamily = `'${fontName}', monospace`;
  }

  // Load font stored in localStorage (applied globally on every page by nav.js or here)
  const savedFont = localStorage.getItem('protocol_font') || '';
  const fontSelect = document.getElementById('settings-font-select');
  if (fontSelect) {
    fontSelect.value = savedFont;
    applyFont(savedFont);
    fontSelect.addEventListener('change', function () {
      const chosen = fontSelect.value;
      localStorage.setItem('protocol_font', chosen);
      applyFont(chosen);
    });
  }

  // ── Theme select (mirrors nav.js applyTheme) ─────────
  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) {
    const curTheme = localStorage.getItem('theme') || 'light';
    themeSelect.value = curTheme;
    themeSelect.addEventListener('change', function () {
      localStorage.setItem('theme', themeSelect.value);
      // Trigger nav.js applyTheme by dispatching a storage event
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: themeSelect.value }));
      // Also apply directly
      const body = document.body;
      body.classList.remove('dark', 'theme-gruvbox', 'theme-sage', 'theme-nord', 'theme-tokyo', 'theme-claude', 'theme-tide', 'theme-catppuccin', 'theme-caffeine');
      if (themeSelect.value === 'dark') body.classList.add('dark');
      else if (themeSelect.value !== 'light') body.classList.add('theme-' + themeSelect.value);
    });
  }

  // ── Load user info ───────────────────────────────────
  async function loadUserInfo() {
    const user = getUser();
    if (!user) {
      window.location.href = '../../index.html';
      return;
    }
    const usernameInput = document.getElementById('settings-username');
    const emailInput = document.getElementById('settings-email');
    const joinedEl = document.getElementById('settings-joined');
    const roleEl = document.getElementById('settings-role-badge');
    const tierEl = document.getElementById('settings-tier-badge');
    const avatarImg = document.getElementById('settings-avatar-img');
    const navAvatarCached = localStorage.getItem('protocol_avatar_url');
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=5b85f6&color=fff`;

    if (avatarImg) avatarImg.src = navAvatarCached || defaultAvatar;
    if (usernameInput) usernameInput.value = user.username || '';
    if (emailInput) emailInput.value = user.email || '';

    // Refresh from server
    try {
      const r = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) {
        const d = await r.json();
        const u = d.user || {};
        if (joinedEl && u.created_at) {
          joinedEl.textContent = new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
        if (roleEl) roleEl.textContent = u.role || 'member';
        if (tierEl) tierEl.textContent = u.tier === 'premium' ? '⭐ Premium' : '🔓 Free';
        if (u.avatar_url && avatarImg) {
          avatarImg.src = u.avatar_url;
          localStorage.setItem('protocol_avatar_url', u.avatar_url);
        }
      }
    } catch {}
  }

  // ── Avatar upload ────────────────────────────────────
  const avatarInput = document.getElementById('settings-avatar-input');
  const avatarBar = document.getElementById('settings-avatar-bar');
  const avatarProgress = document.getElementById('settings-avatar-progress');
  if (avatarInput) {
    avatarInput.addEventListener('change', function () {
      const file = avatarInput.files[0];
      if (!file) return;
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('avatar', file);
      if (avatarProgress) avatarProgress.style.display = 'block';
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && avatarBar) {
          avatarBar.style.width = Math.round(e.loaded / e.total * 100) + '%';
        }
      };
      xhr.onload = () => {
        if (avatarProgress) avatarProgress.style.display = 'none';
        if (avatarBar) avatarBar.style.width = '0';
        if (xhr.status === 200) {
          const d = JSON.parse(xhr.responseText);
          if (d.avatar_url) {
            localStorage.setItem('protocol_avatar_url', d.avatar_url);
            const avatarImg = document.getElementById('settings-avatar-img');
            if (avatarImg) avatarImg.src = d.avatar_url;
          }
        } else {
          alert('Avatar upload failed.');
        }
      };
      xhr.open('POST', `${API}/auth/avatar`);
      xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
      xhr.send(formData);
    });
  }

  // ── Save username ────────────────────────────────────
  const saveUsernameBtn = document.getElementById('save-username-btn');
  if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', async function () {
      const newUsername = document.getElementById('settings-username')?.value.trim();
      const pass = prompt('Confirm your current password to change username:');
      if (!pass) return;
      try {
        const r = await fetch(`${API}/auth/username`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ newUsername, password: pass }),
        });
        const d = await r.json();
        if (!r.ok) { alert(d.error || 'Failed to update username.'); return; }
        if (d.token) localStorage.setItem('protocol_token', d.token);
        alert('Username updated! Please log out and back in for changes to take full effect.');
      } catch { alert('Network error.'); }
    });
  }

  // ── Change password ──────────────────────────────────
  const savePassBtn = document.getElementById('save-password-btn');
  if (savePassBtn) {
    savePassBtn.addEventListener('click', async function () {
      const oldPass = document.getElementById('settings-old-pass')?.value;
      const newPass = document.getElementById('settings-new-pass')?.value;
      const confirmPass = document.getElementById('settings-confirm-pass')?.value;
      if (!oldPass || !newPass || !confirmPass) { alert('Please fill in all password fields.'); return; }
      if (newPass !== confirmPass) { alert('New passwords do not match.'); return; }
      if (newPass.length < 6) { alert('Password must be at least 6 characters.'); return; }
      try {
        const r = await fetch(`${API}/auth/password`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ currentPassword: oldPass, newPassword: newPass }),
        });
        const d = await r.json();
        if (!r.ok) { alert(d.error || 'Failed to update password.'); return; }
        alert('Password updated successfully!');
        ['settings-old-pass', 'settings-new-pass', 'settings-confirm-pass'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      } catch { alert('Network error.'); }
    });
  }

  // ── Logout ───────────────────────────────────────────
  const logoutBtn = document.getElementById('settings-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('protocol_avatar_url');
      if (auth) auth.logout();
    });
  }

  // ── Init ─────────────────────────────────────────────
  loadUserInfo();
})();
