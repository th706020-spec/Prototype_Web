// API base URL — set by js/config.js (loaded first)
const API = window.AppConfig.API;

let docs = [];
let pendingFile = null;
let currentView = 'list';
let currentType = 'all';
let currentDate = '';

// ===== FILE TYPE ICON =====
function fileIcon(filename) {
  if (!filename) return '📁';
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'pdf')  return '📄';
  if (ext === 'docx' || ext === 'doc') return '📝';
  if (ext === 'txt' || ext === 'md')   return '📃';
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼';
  if (['xlsx','xls','csv'].includes(ext)) return '📊';
  return '📁';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function fmtDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function safeAttr(s) {
  return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ===== SAFE FETCH =====
async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error('Server returned an unexpected response (is the server running?)');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ===== LOAD DOCS =====
async function loadDocs() {
  const params = new URLSearchParams();
  if (currentType !== 'all') params.set('type', currentType);
  if (currentDate)           params.set('date', currentDate);

  const qs = params.toString();
  try {
    docs = await fetchJSON(`${API}/docs${qs ? '?' + qs : ''}`);
    applySearch();
  } catch {
    render([]);
  }
}

// ===== SEARCH (client-side on top of server-filtered results) =====
function applySearch() {
  const q = (document.getElementById('search-q')?.value || '').toLowerCase().trim();
  if (!q) { render(docs); return; }
  const filtered = docs.filter(d =>
    (d.name || d.title || '').toLowerCase().includes(q) ||
    (d.field || '').toLowerCase().includes(q) ||
    (d.doc_type || '').toLowerCase().includes(q) ||
    (d.univ || '').toLowerCase().includes(q) ||
    (d.original_name || '').toLowerCase().includes(q)
  );
  render(filtered);
}

function handleSearch() { applySearch(); }

function handleFilter() {
  const typeEl = document.getElementById('type-filter');
  const dateEl = document.getElementById('date-filter');
  if (typeEl) currentType = typeEl.value;
  if (dateEl) currentDate = dateEl.value;
  loadDocs();
}

// ===== VIEW MODE =====
function setView(mode) {
  currentView = mode;
  ['list','grid','compact'].forEach(v => {
    document.getElementById('btn-view-' + v)?.classList.toggle('active', v === mode);
  });
  applySearch();
}

// ===== RENDER DISPATCHER =====
function render(list) {
  const pill = document.getElementById('count-pill');
  if (pill) pill.textContent = list.length + ' document' + (list.length !== 1 ? 's' : '');

  if (currentView === 'grid')    renderGrid(list);
  else if (currentView === 'compact') renderCompact(list);
  else renderList(list);
}

// ===== LIST VIEW =====
function renderList(list) {
  const el = document.getElementById('doc-list');
  if (!el) return;
  el.className = 'view-list';

  if (!list.length) {
    el.innerHTML = '<div class="doc-empty">No documents found</div>';
    return;
  }

  el.innerHTML = list.map(d => {
    const icon = fileIcon(d.original_name || d.filename);
    const size = fmtSize(d.size);
    const date = fmtDate(d.uploaded_at);
    const name = safeAttr(d.name || d.title);
    const orig = safeAttr(d.original_name);
    const fname = safeAttr(d.filename);
    return `
    <div class="doc-item">
      <div style="flex:1">
        <div class="doc-meta">
          <span style="font-size:20px">${icon}</span>
          ${d.doc_type ? `<span class="doc-type-badge">${d.doc_type}</span>` : ''}
          <span class="doc-author">${d.uploader || '—'}</span>
        </div>
        <h4 class="doc-title" onclick="viewDocument(${d.id},'${fname}','${name}','${orig}')">${d.name || d.title}</h4>
        ${d.univ ? `<p class="doc-univ">${d.univ}</p>` : ''}
        <div class="doc-footer">
          ${d.field ? `<span>${d.field}</span>` : ''}
          ${size  ? `<span>${size}</span>`  : ''}
          ${date  ? `<span>${date}</span>`  : ''}
        </div>
      </div>
      <div class="doc-actions">
        ${d.filename ? `
          <button class="btn-view" onclick="viewDocument(${d.id},'${fname}','${name}','${orig}')">👁 View</button>
          <button class="btn-dl"   onclick="downloadDoc('${fname}','${orig}')">⬇ Download</button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

// ===== GRID VIEW =====
function renderGrid(list) {
  const el = document.getElementById('doc-list');
  if (!el) return;
  el.className = 'view-grid';

  if (!list.length) {
    el.innerHTML = '<div class="doc-empty">No documents found</div>';
    return;
  }

  el.innerHTML = list.map(d => {
    const icon = fileIcon(d.original_name || d.filename);
    const size = fmtSize(d.size);
    const date = fmtDate(d.uploaded_at);
    const name = safeAttr(d.name || d.title);
    const orig = safeAttr(d.original_name);
    const fname = safeAttr(d.filename);
    return `
    <div class="doc-card-grid">
      <div class="card-file-icon">${icon}</div>
      <div class="card-title" onclick="viewDocument(${d.id},'${fname}','${name}','${orig}')">${d.name || d.title}</div>
      <div class="card-meta">
        ${d.doc_type ? `<span>${d.doc_type}</span>` : ''}
        ${d.uploader ? `<span>${d.uploader}</span>` : ''}
        ${d.univ     ? `<span>${d.univ}</span>`     : ''}
        ${size       ? `<span>${size}</span>`        : ''}
        ${date       ? `<span>${date}</span>`        : ''}
      </div>
      <div class="card-actions">
        ${d.filename ? `
          <button class="btn-view" onclick="viewDocument(${d.id},'${fname}','${name}','${orig}')">👁 View</button>
          <button class="btn-dl"   onclick="downloadDoc('${fname}','${orig}')">⬇</button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

// ===== COMPACT VIEW =====
function renderCompact(list) {
  const el = document.getElementById('doc-list');
  if (!el) return;
  el.className = 'view-compact';

  if (!list.length) {
    el.innerHTML = '<div class="doc-empty">No documents found</div>';
    return;
  }

  el.innerHTML = list.map(d => {
    const icon = fileIcon(d.original_name || d.filename);
    const name = safeAttr(d.name || d.title);
    const orig = safeAttr(d.original_name);
    const fname = safeAttr(d.filename);
    return `
    <div class="doc-card-compact" onclick="viewDocument(${d.id},'${fname}','${name}','${orig}')">
      <span class="compact-icon">${icon}</span>
      <span class="compact-title">${d.name || d.title}</span>
    </div>`;
  }).join('');
}

// ===== FILE PICK / DROP =====
function handleFile(input) {
  const label = document.getElementById('file-label');
  if (input.files.length) {
    pendingFile = input.files[0];
    if (label) label.textContent = pendingFile.name;
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone')?.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) {
    pendingFile = f;
    const label = document.getElementById('file-label');
    if (label) label.textContent = f.name;
  }
}

// ===== UPLOAD MODAL =====
function openUpload() {
  const modal = document.getElementById('upload-modal');
  if (modal) modal.classList.add('is-open');
}

function closeUpload() {
  const modal = document.getElementById('upload-modal');
  if (modal) modal.classList.remove('is-open');
  pendingFile = null;
  ['up-name','up-univ','up-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sel = document.getElementById('up-type');
  if (sel) sel.value = 'General';
  const label = document.getElementById('file-label');
  if (label) label.textContent = '';
  const fileReal = document.getElementById('file-real');
  if (fileReal) fileReal.value = '';
}

async function handleUploadSubmit() {
  const name = document.getElementById('up-name')?.value.trim();
  const doc_type = document.getElementById('up-type')?.value || 'General';
  const univ  = document.getElementById('up-univ')?.value.trim() || '';
  const field = document.getElementById('up-field')?.value.trim() || '';

  if (!name) { alert('Please enter a document title.'); return; }
  if (!pendingFile) { alert('Please select a file.'); return; }

  const submitBtn = document.querySelector('#upload-modal .btn-primary');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading…'; }

  try {
    const formData = new FormData();
    formData.append('file', pendingFile);
    formData.append('name', name);
    formData.append('doc_type', doc_type);
    formData.append('univ', univ);
    formData.append('field', field);

    const token = window.Auth ? window.Auth.getToken() : null;
    const headers = token ? { Authorization: 'Bearer ' + token } : {};

    const data = await fetchJSON(`${API}/docs/upload`, { method: 'POST', headers, body: formData });
    if (!data.id) throw new Error('Upload did not return a document ID');

    closeUpload();
    await loadDocs();
  } catch (err) {
    alert('Upload failed: ' + err.message);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Upload'; }
  }
}

// ===== DOWNLOAD =====
function downloadDoc(filename, originalName) {
  if (!filename) return;
  const a = document.createElement('a');
  a.href = `${API}/docs/file/${filename}`;
  a.download = originalName || filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ===== VIEW DOCUMENT =====
function viewDocument(id, filename, name, originalName) {
  if (!filename) { alert('No file to view.'); return; }

  let modal = document.getElementById('doc-viewer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'doc-viewer-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="modal-box" style="width:90vw;max-width:960px;height:88vh;display:flex;flex-direction:column;padding:0;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--clr-border);flex-shrink:0">
          <h3 id="doc-viewer-title" style="font-size:15px;font-weight:600;color:var(--clr-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:85%;margin:0"></h3>
          <button class="modal-close" id="doc-viewer-close">✕</button>
        </div>
        <div id="doc-viewer-body" style="flex:1;overflow:hidden;"></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('doc-viewer-close').onclick = () => { modal.style.display = 'none'; };
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  }

  document.getElementById('doc-viewer-title').textContent = name;
  const body = document.getElementById('doc-viewer-body');
  const ext = (originalName || filename).split('.').pop().toLowerCase();
  const viewable = ['pdf','docx','doc','txt','md'];

  if (id && viewable.includes(ext)) {
    // Always show preview on white background regardless of page dark mode
    body.style.background = "#fff";
    body.innerHTML = `<iframe src="${API}/docs/${id}/view" style="width:100%;height:100%;border:none;background:#fff;" title="${name}"></iframe>`;
  } else {
    body.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--clr-muted)">
        <div style="font-size:56px;margin-bottom:16px">📁</div>
        <p style="font-size:15px;margin-bottom:8px">Format <strong>.${ext}</strong> cannot be previewed.</p>
        <p style="font-size:13px;margin-bottom:24px;color:var(--clr-muted)">Download to open with an appropriate app.</p>
        <a href="${API}/docs/file/${filename}" download="${originalName || filename}" class="btn btn-primary">⬇ Download</a>
      </div>`;
  }

  modal.style.display = 'flex';
}

// ===== CLOSE UPLOAD MODAL ON OVERLAY CLICK (nav.js also handles this) =====
document.getElementById('upload-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeUpload();
});

// ===== SEARCH ON ENTER =====
document.getElementById('search-q')?.addEventListener('input', applySearch);

// ===== INIT =====
loadDocs();
