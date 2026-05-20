// API base URL — set by js/config.js (loaded first)
const API = window.AppConfig.API;

let docs = [];
let pendingFile = null;

// Format interest count
function fmt(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

// Render document list
function renderList(list) {
  const el = document.getElementById("doc-list");
  const pill = document.getElementById("count-pill");
  if (!el || !pill) return;

  pill.textContent = String(list.length).padStart(2, "0") + " Tài liệu hệ thống";

  if (!list.length) {
    el.innerHTML = '<div class="doc-empty">Không tìm thấy tài liệu nào</div>';
    return;
  }

  el.innerHTML = list
    .map(
      (d) => `
    <div class="doc-item">
      <div style="flex:1">
        <div class="doc-meta">
          <span class="q1">Q1</span>
          <span class="doc-author">${d.uploader || d.author || "—"}</span>
        </div>
        <h4 class="doc-title">${d.name || d.title}</h4>
        <p class="doc-univ">${d.univ || "—"}</p>
        <div class="doc-footer">
          <span>${d.field || "—"}</span>
          ${d.original_name ? `<span class="doc-interest">📄 ${d.original_name}</span>` : ""}
          ${d.interest ? `<span class="doc-interest"><span class="fire">🔥</span> ${fmt(d.interest)} Quan Tâm</span>` : ""}
          ${(d.tags || []).map((t) => `<span class="doc-tag">${t}</span>`).join("")}
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn-dl" style="border-color:#a855f7;color:#a855f7"
          onclick="analyzeDoc('${(d.name || d.title || "").replace(/'/g, "\\'")}')">✨ Phân tích AI</button>
        ${
          d.filename
            ? `<button class="btn-dl" onclick="viewDocument('${d.filename}','${(d.name||"").replace(/'/g,"\\'")}','${(d.original_name||"").replace(/'/g,"\\'")}')">👁 Xem</button>
               <button class="btn-dl" onclick="downloadDoc('${d.filename}','${(d.original_name || "").replace(/'/g, "\\'")}')">⬇ Tải về</button>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");
}

// Safe fetch wrapper — returns parsed JSON or throws a readable error
async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error("Server returned an unexpected response (is the server running?)");
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Load docs from server
async function loadDocs() {
  try {
    docs = await fetchJSON(`${API}/docs`);
    renderList(docs);
  } catch {
    renderList([]);
  }
}

// File input change
function handleFile(input) {
  const label = document.getElementById("file-label");
  if (input.files.length) {
    pendingFile = input.files[0];
    if (label) label.textContent = pendingFile.name;
  }
}

// Drag and drop
function handleDrop(e) {
  e.preventDefault();
  const zone = document.getElementById("drop-zone");
  const label = document.getElementById("file-label");
  if (zone) zone.classList.remove("over");
  const f = e.dataTransfer.files[0];
  if (f) {
    pendingFile = f;
    if (label) label.textContent = f.name;
  }
}

// Upload file to server
async function handleSave() {
  const nameInput = document.getElementById("doc-name");
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert("Vui lòng nhập tên tài liệu!");
    return;
  }
  if (!pendingFile) {
    alert("Vui lòng chọn tệp tin!");
    return;
  }

  const btn = document.querySelector(".btn-green");
  if (btn) { btn.disabled = true; btn.textContent = "Đang lưu..."; }

  try {
    const formData = new FormData();
    formData.append("file", pendingFile);
    formData.append("name", name);

    const token = window.Auth ? window.Auth.getToken() : null;
    const headers = token ? { Authorization: "Bearer " + token } : {};

    const data = await fetchJSON(`${API}/docs/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!data.id) throw new Error("Upload did not return a document ID");

    // Reset form
    nameInput.value = "";
    pendingFile = null;
    const label = document.getElementById("file-label");
    const fileReal = document.getElementById("file-real");
    if (label) label.textContent = "";
    if (fileReal) fileReal.value = "";

    await loadDocs();
  } catch (err) {
    alert("Lỗi: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Lưu vào kho tài liệu"; }
  }
}

// Download a file
function downloadDoc(filename, originalName) {
  if (!filename) return;
  const a = document.createElement("a");
  a.href = `${API}/docs/file/${filename}`;
  a.download = originalName || filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Fill search from tag chips
function fillSearch(val) {
  const input = document.getElementById("search-q");
  if (input) {
    input.value = val;
    handleSearch();
  }
}

// Search/filter
function handleSearch() {
  const input = document.getElementById("search-q");
  if (!input) return;
  const q = input.value.toLowerCase().trim();
  if (!q) { renderList(docs); return; }
  const res = docs.filter(
    (d) =>
      (d.name || d.title || "").toLowerCase().includes(q) ||
      (d.field || "").toLowerCase().includes(q) ||
      (d.original_name || "").toLowerCase().includes(q)
  );
  renderList(res);
}

function viewDocument(filename, name, originalName) {
  if (!filename) { alert("Không có tệp để xem."); return; }

  let modal = document.getElementById("doc-viewer-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "doc-viewer-modal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.innerHTML = `
      <div class="modal-box" style="width:90vw;max-width:960px;height:88vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-shrink:0">
          <h3 id="doc-viewer-title" style="font-size:15px;font-weight:600;color:var(--clr-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%"></h3>
          <button class="modal-close" id="doc-viewer-close">✕</button>
        </div>
        <div id="doc-viewer-body" style="flex:1;overflow:hidden;border-radius:8px;"></div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById("doc-viewer-close").onclick = () => { modal.style.display = "none"; };
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
  }

  document.getElementById("doc-viewer-title").textContent = name;
  const body = document.getElementById("doc-viewer-body");
  const ext = (originalName || filename).split(".").pop().toLowerCase();
  const fileUrl = `${API}/docs/file/${filename}`;

  if (ext === "pdf") {
    body.innerHTML = `<iframe src="${fileUrl}" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>`;
  } else {
    body.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--clr-muted)">
        <div style="font-size:56px;margin-bottom:16px">📄</div>
        <p style="font-size:15px;margin-bottom:8px">Định dạng <strong>.${ext}</strong> không xem trực tiếp được.</p>
        <p style="font-size:13px;margin-bottom:24px;color:var(--clr-muted)">Tải về máy để mở bằng ứng dụng phù hợp.</p>
        <a href="${fileUrl}" download="${originalName || filename}" class="btn btn-primary">⬇ Tải về</a>
      </div>`;
  }

  modal.style.display = "flex";
}

function analyzeDoc(title) {
  alert(`Đang gửi "${title}" sang hệ thống AI để kiểm tra...`);
}

// Init
document.getElementById("search-q")?.addEventListener("keypress", function (e) {
  if (e.key === "Enter") handleSearch();
});

loadDocs();
