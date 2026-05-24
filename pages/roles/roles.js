(function () {
  const API = window.AppConfig.API;
  const auth = window.Auth;

  // ── Helpers ──────────────────────────────────────────
  function getUser() { return auth ? auth.getUser() : null; }
  function getToken() { return auth ? auth.getToken() : null; }

  const ROLE_LABELS = {
    member: 'Member',
    premium: 'Premium Member',
    mentor: 'Mentor',
    researcher: 'Researcher',
    mod: 'Moderator',
    admin: 'Admin',
  };
  const ROLE_ICONS = {
    member: '👤', premium: '⭐', mentor: '🎓',
    researcher: '🔬', mod: '🛡️', admin: '🔑',
  };

  // ── Show current role banner ──────────────────────────
  async function initCurrentRole() {
    const user = getUser();
    if (!user) return;
    const banner = document.getElementById('current-role-banner');
    const iconEl = document.getElementById('current-role-icon');
    const nameEl = document.getElementById('current-role-name');
    if (!banner) return;

    // Refresh from server
    let role = user.role || 'member';
    let tier = user.tier || 'member';
    try {
      const r = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) { const d = await r.json(); role = d.user.role || role; tier = d.user.tier || tier; }
    } catch {}

    if (tier === 'premium' && role === 'member') role = 'premium';
    banner.style.display = 'flex';
    if (iconEl) iconEl.textContent = ROLE_ICONS[role] || '👤';
    if (nameEl) nameEl.textContent = ROLE_LABELS[role] || role;

    // Highlight current role card
    document.querySelectorAll('.role-card').forEach(card => {
      const cardRole = card.dataset.role;
      if (cardRole === role || (cardRole === 'premium' && tier === 'premium')) {
        card.classList.add('is-current');
      }
    });
  }

  // ── Modal helpers ─────────────────────────────────────
  const modal = document.getElementById('role-modal');
  const modalTitle = document.getElementById('role-modal-title');
  const modalDesc = document.getElementById('role-modal-desc');
  const modalBody = document.getElementById('role-modal-body');
  const modalConfirm = document.getElementById('role-modal-confirm');
  const modalCancel = document.getElementById('role-modal-cancel');
  const modalClose = document.getElementById('role-modal-close');

  function openModal() { if (modal) modal.style.display = 'flex'; }
  function closeModal() { if (modal) modal.style.display = 'none'; }
  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // ── Role button handlers ──────────────────────────────
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const action = btn.dataset.action;
      const role = btn.dataset.role;
      if (!getUser()) {
        alert('Please log in to change your role.');
        return;
      }
      if (action === 'request') handleRequest(role);
      else if (action === 'premium') handlePremium();
      else if (action === 'admin-key') handleAdminKey();
    });
  });

  function handleRequest(role) {
    if (role === 'member') {
      // Demote to member — just confirm
      if (modalTitle) modalTitle.textContent = 'Switch to Member';
      if (modalDesc) modalDesc.textContent = 'This will reset your role to basic Member. Continue?';
      if (modalBody) modalBody.innerHTML = '';
      if (modalConfirm) {
        modalConfirm.textContent = 'Confirm';
        modalConfirm.onclick = () => submitRoleChange('member');
      }
      openModal();
      return;
    }
    const label = ROLE_LABELS[role] || role;
    if (modalTitle) modalTitle.textContent = `Apply for ${label}`;
    if (modalDesc) modalDesc.textContent = `Applying for ${label} requires admin approval. Please briefly explain your background.`;
    if (modalBody) modalBody.innerHTML = `
      <textarea class="role-reason-input" id="role-reason-text" placeholder="Tell admins why you qualify for this role…"></textarea>
    `;
    if (modalConfirm) {
      modalConfirm.textContent = 'Submit Application';
      modalConfirm.onclick = async () => {
        const reason = document.getElementById('role-reason-text')?.value.trim() || '';
        await submitRoleRequest(role, reason);
      };
    }
    openModal();
  }

  function handlePremium() {
    window.location.href = '../../pages/premium/premium.html';
  }

  function handleAdminKey() {
    if (modalTitle) modalTitle.textContent = 'Admin Access';
    if (modalDesc) modalDesc.textContent = 'Enter the secret admin key to gain admin privileges. This key is only shared with authorized personnel.';
    if (modalBody) modalBody.innerHTML = `
      <input type="password" class="role-key-input" id="admin-key-input" placeholder="Enter admin key…" autocomplete="off">
    `;
    if (modalConfirm) {
      modalConfirm.textContent = 'Verify Key';
      modalConfirm.onclick = () => {
        const key = document.getElementById('admin-key-input')?.value.trim() || '';
        submitAdminKey(key);
      };
    }
    openModal();
  }

  async function submitRoleChange(role) {
    closeModal();
    // Self-demoting to member requires no admin key — use request-role path as member is auto-granted
    // For now just notify user to contact admin
    alert('To change back to Member, contact an admin.');
  }

  async function submitRoleRequest(role, reason) {
    closeModal();
    try {
      const r = await fetch(`${API}/auth/request-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Failed to submit application.'); return; }
      alert(`Your application for ${ROLE_LABELS[role]} has been submitted. An admin will review it shortly.`);
    } catch { alert('Network error.'); }
  }

  async function submitAdminKey(key) {
    if (!key) { alert('Please enter the admin key.'); return; }
    closeModal();
    try {
      const r = await fetch(`${API}/auth/set-role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ role: 'admin', adminKey: key }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Invalid admin key.'); return; }
      alert('Admin role granted! Please log out and log back in to activate admin privileges.');
    } catch { alert('Network error.'); }
  }

  // ── Admin/Mod: Pending Role Requests ─────────────────────
  async function initPendingRequests() {
    const user = getUser();
    if (!user || !['admin', 'mod'].includes(user.role)) return;
    const section = document.getElementById('pending-requests-section');
    if (section) section.style.display = 'block';
    await loadPendingRequests();
    document.getElementById('refresh-requests-btn')?.addEventListener('click', loadPendingRequests);
  }

  async function loadPendingRequests() {
    const list = document.getElementById('pending-requests-list');
    if (!list) return;
    list.innerHTML = '<p class="pending-empty">Loading…</p>';
    try {
      const r = await fetch(`${API}/admin/role-requests`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) { list.innerHTML = '<p class="pending-empty">Failed to load requests.</p>'; return; }
      const items = await r.json();
      if (!items.length) { list.innerHTML = '<p class="pending-empty">No pending requests. 🎉</p>'; return; }
      const user = getUser();
      const isAdmin = user?.role === 'admin';
      list.innerHTML = items.map(req => `
        <div class="pending-request-card" id="req-${req.id}">
          <div class="pending-request-info">
            <div class="pending-request-user">👤 ${req.username} <span style="color:var(--clr-muted);font-weight:400;">&lt;${req.email}&gt;</span></div>
            <div class="pending-request-meta">
              <span class="pending-request-role">${ROLE_LABELS[req.requested_role] || req.requested_role}</span>
              Requested ${new Date(req.created_at).toLocaleDateString()}
            </div>
          </div>
          ${isAdmin ? `
          <div class="pending-request-actions">
            <button class="btn approve small" onclick="handleRoleDecision(${req.id}, 'approve')">✓ Approve</button>
            <button class="btn deny small" onclick="handleRoleDecision(${req.id}, 'deny')">✗ Deny</button>
          </div>` : `<span style="font-size:0.82rem;color:var(--clr-muted)">Awaiting admin action</span>`}
        </div>`).join('');
    } catch { list.innerHTML = '<p class="pending-empty">Error loading requests.</p>'; }
  }

  window.handleRoleDecision = async function(id, action) {
    try {
      const r = await fetch(`${API}/admin/role-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Failed'); return; }
      const card = document.getElementById(`req-${id}`);
      if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
        card.querySelector('.pending-request-actions').innerHTML =
          `<span style="font-size:0.85rem;color:${action === 'approve' ? '#22c55e' : '#ef4444'}">${action === 'approve' ? '✓ Approved' : '✗ Denied'}</span>`;
        setTimeout(() => { card.remove(); }, 2000);
      }
    } catch { alert('Network error.'); }
  };

  // ── Init ─────────────────────────────────────────────
  initCurrentRole();
  initPendingRequests();
})();
