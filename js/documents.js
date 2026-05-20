// 1. Danh sách dữ liệu mẫu ban đầu
let docs = [
  { id: 1, author: 'Messi vô địch world cup!!!!!', title: 'Báo đời', univ: 'FPT University', field: 'Nghiên cứu động vật', interest: 2341, tags: ['Digital Marketing', 'Artificial Intelligence'], saved: false },
  { id: 2, author: '7 tạ mãi thua Messi', title: 'Báo nợ', univ: 'FPT University', field: 'Nghiên cứu động vật', interest: 942, tags: ['Multimedia Communications', 'Semiconductor microcircuits'], saved: false }
];

// 2. Hàm rút gọn định dạng số lượt quan tâm (Ví dụ: 2341 -> 2.3k)
function fmt(n) { 
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); 
}

// 3. Hàm đổ dữ liệu từ mảng ra giao diện HTML
function renderList(list) {
  const el = document.getElementById('doc-list');
  const pill = document.getElementById('count-pill');
  if (!el || !pill) return;

  pill.textContent = String(list.length).padStart(2, '0') + ' Tài liệu hệ thống';
  if (!list.length) {
    el.innerHTML = '<div class="doc-empty">Không tìm thấy tài liệu nào</div>';
    return;
  }
  el.innerHTML = list.map(d => `
    <div class="doc-item">
      <div style="flex:1">
        <div class="doc-meta">
          <span class="q1">Q1</span>
          <span class="doc-author">${d.author}</span>
        </div>
        <h4 class="doc-title" onclick="viewDocument('${d.title}')">${d.title}</h4>
        <p class="doc-univ">${d.univ}</p>
        <div class="doc-footer">
          <span>${d.field}</span>
          <span class="doc-interest"><span class="fire">🔥</span> ${fmt(d.interest)} Quan Tâm</span>
          ${d.tags.map(t => `<span class="doc-tag">${t}</span>`).join('')}
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn-bm ${d.saved ? 'saved' : ''}" onclick="toggleSave(${d.id})" title="Lưu Bookmark">🔖</button>
        <button class="btn-dl" style="border-color: #a855f7; color: #a855f7;" onclick="analyzeDoc('${d.title}')">✨ Phân tích AI</button>
        <button class="btn-dl">Tải về</button>
      </div>
    </div>
  `).join('');
}

// 4. Hàm bật/tắt trạng thái Bookmark (Lưu tài liệu)
function toggleSave(id) {
  const d = docs.find(x => x.id === id);
  if (d) d.saved = !d.saved;
  renderList(docs);
}

// 5. Hàm điền nhanh từ khóa từ khu vực "Gợi ý tìm kiếm" vào ô input
function fillSearch(val) {
  const input = document.getElementById('search-q');
  if (input) {
    input.value = val;
    handleSearch(); // Tự động chạy tìm kiếm luôn khi click vào chip gợi ý
  }
}

// 6. Hàm lọc và tìm kiếm tài liệu theo từ khóa
function handleSearch() {
  const input = document.getElementById('search-q');
  if (!input) return;
  
  const q = input.value.toLowerCase().trim();
  if (!q) { renderList(docs); return; }
  
  const res = docs.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.field.toLowerCase().includes(q) ||
    d.tags.some(t => t.toLowerCase().includes(q))
  );
  renderList(res);
}

// 7. Hàm bắt sự kiện khi click chọn file từ máy tính
function handleFile(input) {
  const label = document.getElementById('file-label');
  if (input.files.length && label) {
    label.textContent = input.files[0].name;
  }
}

// 8. Hàm bắt sự kiện khi kéo thả tệp tin vào vùng Dropzone
function handleDrop(e) {
  e.preventDefault();
  const zone = document.getElementById('drop-zone');
  const label = document.getElementById('file-label');
  
  if (zone) zone.classList.remove('over');
  
  const f = e.dataTransfer.files[0];
  if (f && label) label.textContent = f.name;
}

// 9. Hàm xử lý lưu thông tin tài liệu mới vào mảng tĩnh
function handleSave() {
  const nameInput = document.getElementById('doc-name');
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) { 
    alert('Vui lòng nhập tên tài liệu!'); 
    return; 
  }
  
  docs.push({
    id: docs.length + 1,
    author: 'Người dùng — ' + new Date().toLocaleDateString('vi-VN'), // Định dạng ngày Việt Nam DD/MM/YYYY
    title: name,
    univ: '—',
    field: 'Tài liệu cá nhân',
    interest: 0,
    tags: ['Mới lưu'],
    saved: false
  });
  
  // Cập nhật lại danh sách hiển thị
  renderList(docs);
  
  // Reset sạch các ô nhập liệu sau khi lưu thành công
  nameInput.value = '';
  const label = document.getElementById('file-label');
  const fileReal = document.getElementById('file-real');
  if (label) label.textContent = '';
  if (fileReal) fileReal.value = '';
}

// ==========================================================================
// TỰ ĐỘNG CHẠY KHI TẢI TRANG & LẮNG NGHE SỰ KIỆN KHÁC
// ==========================================================================

// Bắt sự kiện nhấn Enter trên ô nhập dữ liệu tìm kiếm
document.getElementById('search-q')?.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    handleSearch();
  }
});
// Hàm giả lập chức năng Đọc/Ghi tài liệu ngay trên giao diện web (Read/Write)
function viewDocument(title) {
  alert(`[Chức năng Đọc/Ghi]: Đang mở trình đọc nội dung cho tài liệu: "${title}". Bạn có thể viết ghi chú trực tiếp tại đây.`);
}

// Hàm giả lập gọi liên kết sang công cụ AI của Huy (Phân tích, check đạo văn, APA)
function analyzeDoc(title) {
  alert(`[Kích hoạt AI]: Đang gửi dữ liệu "${title}" sang hệ thống AI của Huy để kiểm tra đạo văn và trích xuất chuẩn APA...`);
}

// Tự động kích hoạt hiển thị danh sách tài liệu lần đầu tiên khi tải trang
renderList(docs) ;