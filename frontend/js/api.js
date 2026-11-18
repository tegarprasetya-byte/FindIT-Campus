// ===== Helper umum untuk semua halaman =====
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`/api${endpoint}`, { ...options, headers });

  let data = {};
  try { data = await response.json(); } catch (e) { /* respons bukan JSON */ }

  // Sesi habis / belum login -> kembali ke halaman masuk (kecuali sedang di halaman masuk)
  if (response.status === 401 && !endpoint.startsWith('/auth/masuk') && !endpoint.startsWith('/auth/login')) {
    localStorage.removeItem('token');
    if (!location.pathname.endsWith('index.html') && location.pathname !== '/') {
      location.href = 'index.html';
    }
  }

  // Akun belum diverifikasi / ditolak Admin -> keluarkan dari sesi
  if (response.status === 403 && ['MENUNGGU_VERIFIKASI', 'DITOLAK'].includes(data.code) && !endpoint.startsWith('/auth/login')) {
    localStorage.removeItem('token');
    if (!location.pathname.endsWith('index.html') && location.pathname !== '/') location.href = 'index.html';
  }

  if (!response.ok) {
    const err = new Error(data.message || 'Terjadi kesalahan pada server.');
    err.data = data;
    err.status = response.status;
    throw err;
  }
  return data;
}

// Tombol sedang memproses: tetap tampil seperti semula, hanya ada kilau (shimmer) berjalan
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  btn.classList.toggle('is-loading', on);
}

// Notifikasi kecil di pojok kanan atas
function toast(message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = { success: '✓', error: '!', info: 'i' }[type] || 'i';
  el.innerHTML = `<span class="ti">${icon}</span><span class="tm"></span>`;
  el.querySelector('.tm').textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

const STATUS_INFO = {
  menunggu_verifikasi: { label: 'Menunggu Verifikasi', cls: 'badge-proses' },
  dipublikasikan: { label: 'Dipublikasikan', cls: 'badge-temuan' },
  proses_klaim: { label: 'Proses Klaim', cls: 'badge-proses' },
  dikembalikan: { label: 'Selesai / Dikembalikan', cls: 'badge-dikembalikan' },
  ditolak: { label: 'Ditolak', cls: 'badge-ditolak' },
  diarsipkan: { label: 'Diarsipkan', cls: 'badge-netral' }
};
function statusBadge(status) {
  const s = STATUS_INFO[status] || { label: status, cls: 'badge-netral' };
  return `<span class="badge ${s.cls}">${escapeHtml(s.label)}</span>`;
}
function jenisBadge(jenis) {
  return `<span class="badge badge-${jenis === 'hilang' ? 'hilang' : 'temuan'}">${jenis === 'hilang' ? 'Hilang' : 'Ditemukan'}</span>`;
}
function formatTanggal(value, withTime = false) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return withTime
    ? d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString('id-ID', { dateStyle: 'medium' });
}
