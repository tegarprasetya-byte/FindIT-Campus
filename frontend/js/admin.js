document.addEventListener('DOMContentLoaded', async () => {
  try {
    await requireLogin({ adminOnly: true });
  } catch (e) { return; }

  document.getElementById('adminName').innerText = currentUser.nama;
  mountThemeToggle(document.getElementById('themeMount'), { dark: true });
  mountBell(document.getElementById('bellMount'), { dark: true });
  await loadDashboardStats();
});

const TABS = { stats: 'Stats', verifikasi: 'Verifikasi', klaim: 'Klaim', users: 'Users', lokasi: 'Lokasi', abuse: 'Abuse' };

function showAdminTab(tab) {
  Object.keys(TABS).forEach((t) => {
    document.getElementById(`tabContent${TABS[t]}`).style.display = t === tab ? 'block' : 'none';
    document.getElementById(`menu${TABS[t]}`).classList.toggle('active', t === tab);
  });

  if (tab === 'stats') loadDashboardStats();
  if (tab === 'verifikasi') loadAntrean();
  if (tab === 'klaim') loadDaftarKlaim();
  if (tab === 'users') loadDaftarUsers();
  if (tab === 'lokasi') loadMasterLokasi();
  if (tab === 'abuse') loadAbuse();
}

// Menu titik tiga: items = [{ label, fn: "namaFungsi(1)", danger }]
function kebab(items) {
  return `<div class="kebab"><button class="kebab-btn" onclick="toggleKebab(event, this)" title="Aksi">⋮</button>
    <div class="kebab-menu">${items.map((i) => `<button class="${i.danger ? 'danger' : ''}" onclick="${i.fn}">${i.label}</button>`).join('')}</div></div>`;
}
function toggleKebab(e, btn) {
  e.stopPropagation();
  const menu = btn.nextElementSibling;
  const open = menu.classList.contains('open');
  document.querySelectorAll('.kebab-menu.open').forEach((m) => m.classList.remove('open'));
  if (!open) menu.classList.add('open');
}
document.addEventListener('click', () => document.querySelectorAll('.kebab-menu.open').forEach((m) => m.classList.remove('open')));

// ---------- Skeleton shimmer ----------
const skelRows = (cols, n = 4) => Array.from({ length: n }, () =>
  `<tr>${Array.from({ length: cols }, (_, i) => `<td><div class="skeleton" style="height:14px;width:${[70, 85, 55, 65, 45, 60][i % 6]}%"></div></td>`).join('')}</tr>`).join('');
const skelStats = (n = 11) => Array.from({ length: n }, () =>
  '<div class="stat-card"><div class="skeleton" style="width:46px;height:46px;border-radius:14px;flex-shrink:0"></div><div style="flex:1"><div class="skeleton" style="height:12px;width:70%;margin-bottom:10px"></div><div class="skeleton" style="height:24px;width:35%"></div></div></div>').join('');

const emptyRow = (cols, text) => `<tr><td colspan="${cols}" style="text-align:center; color:var(--text-muted); padding:24px;">${text}</td></tr>`;

// ---------- 1. Dashboard ----------
async function loadDashboardStats() {
  document.getElementById('statGrid').innerHTML = skelStats();
  document.getElementById('chartMinggu').innerHTML = '<div class="skeleton" style="height:230px;border-radius:14px"></div>';
  document.getElementById('chartStatus').innerHTML = '<div class="skeleton" style="height:160px;width:160px;border-radius:50%"></div>';
  document.getElementById('legendStatus').innerHTML = '';
  try {
    const { data: d } = await apiFetch('/admin/dashboard');
    const cards = [
      ['📥', 'ic-blue', 'Total Laporan Masuk', d.total_laporan],
      ['⏳', 'ic-amber', 'Menunggu Verifikasi', d.total_menunggu_verifikasi],
      ['✅', 'ic-green', 'Laporan Aktif', d.total_laporan_aktif],
      ['🔍', 'ic-pink', 'Barang Hilang', d.total_hilang],
      ['📦', 'ic-green', 'Barang Temuan', d.total_temuan],
      ['📝', 'ic-blue', 'Total Klaim', d.total_klaim],
      ['🕒', 'ic-amber', 'Klaim Menunggu', d.total_klaim_menunggu],
      ['🤝', 'ic-purple', 'Barang Dikembalikan', d.total_dikembalikan],
      ['🗄️', 'ic-gray', 'Laporan Diarsipkan', d.total_diarsipkan],
      ['👥', 'ic-blue', 'Total Pengguna', d.total_pengguna],
      ['🪪', 'ic-amber', 'Menunggu Verifikasi Akun', d.total_user_menunggu],
      ['🚩', 'ic-red', 'Laporan Abuse Baru', d.total_abuse_baru]
    ];
    document.getElementById('statGrid').innerHTML = cards.map(([icon, cls, label, val]) => `
      <div class="stat-card"><div class="ic ${cls}">${icon}</div><div><span>${label}</span><h3>${val ?? 0}</h3></div></div>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
  loadGrafik();
}

const STATUS_COLOR = { menunggu_verifikasi: '#F59E0B', dipublikasikan: '#16A34A', proses_klaim: '#3B82F6', dikembalikan: '#8B5CF6', ditolak: '#EF4444', diarsipkan: '#94A3B8' };

async function loadGrafik() {
  try {
    const { data } = await apiFetch('/admin/grafik');
    drawLineChart(data.minggu);
    drawDonut(data.status);
  } catch (err) { /* grafik opsional */ }
}

function drawLineChart(minggu) {
  const W = 560, H = 230, pl = 34, pr = 12, pt = 14, pb = 30;
  const max = Math.max(4, ...minggu.map((m) => Math.max(m.hilang, m.temuan)));
  const x = (i) => pl + (i * (W - pl - pr)) / (minggu.length - 1);
  const y = (v) => pt + (H - pt - pb) * (1 - v / max);
  const line = (key, color) => {
    const pts = minggu.map((m, i) => `${x(i)},${y(m[key])}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
      minggu.map((m, i) => `<circle cx="${x(i)}" cy="${y(m[key])}" r="4" fill="${color}"><title>${key}: ${m[key]}</title></circle>`).join('');
  };
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = Math.round(max * f);
    return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--border-color)" stroke-dasharray="3 4"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" style="fill:var(--text-muted)">${v}</text>`;
  }).join('');
  const labels = minggu.map((m, i) => {
    const d = new Date(m.awal);
    return `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">${d.getDate()}/${d.getMonth() + 1}</text>`;
  }).join('');
  document.getElementById('chartMinggu').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;">${grid}${labels}${line('hilang', '#EC4899')}${line('temuan', '#16A34A')}</svg>`;
}

function drawDonut(rows) {
  const total = rows.reduce((a, r) => a + r.total, 0);
  const box = document.getElementById('chartStatus');
  if (!total) {
    box.innerHTML = '<p style="color:var(--text-muted); font-size:13px; padding:40px 0;">Belum ada data.</p>';
    document.getElementById('legendStatus').innerHTML = '';
    return;
  }
  const R = 54, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = rows.map((r) => {
    const len = (r.total / total) * C;
    const el = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${STATUS_COLOR[r.status] || '#999'}" stroke-width="22" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>`;
    offset += len;
    return el;
  }).join('');
  box.innerHTML = `<svg viewBox="0 0 140 140" width="160" height="160">${arcs}<text x="70" y="68" text-anchor="middle" font-size="22" font-weight="800" style="fill:var(--heading)">${total}</text><text x="70" y="84" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">laporan</text></svg>`;
  document.getElementById('legendStatus').innerHTML = rows.map((r) =>
    `<div><span><i style="background:${STATUS_COLOR[r.status] || '#999'}"></i>${(STATUS_INFO[r.status] || { label: r.status }).label}</span><b style="color:var(--text-dark)">${r.total}</b></div>`).join('');
}

// ---------- 2. Verifikasi laporan ----------
async function loadAntrean() {
  document.getElementById('tableAntrean').innerHTML = skelRows(6);
  try {
    const res = await apiFetch('/admin/laporan/menunggu');
    const tbody = document.getElementById('tableAntrean');
    if (!res.data.length) {
      tbody.innerHTML = emptyRow(6, 'Tidak ada antrean verifikasi laporan saat ini.');
      return;
    }
    tbody.innerHTML = res.data.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.nama_barang)}</strong><br><a class="link-btn" href="detail.html?id=${item.id_laporan}" target="_blank">Lihat detail</a></td>
        <td>${escapeHtml(item.nama_pelapor)}</td>
        <td>${jenisBadge(item.jenis)}</td>
        <td>${escapeHtml(item.nama_lokasi)}${item.detail_lokasi ? `<br><small style="color:var(--text-muted)">${escapeHtml(item.detail_lokasi)}</small>` : ''}</td>
        <td>${formatTanggal(item.waktu_kejadian)}</td>
        <td>${kebab([
          { label: '✅ Setujui', fn: `verifikasiLaporan(${item.id_laporan}, 'setujui')` },
          { label: '❌ Tolak', fn: `verifikasiLaporan(${item.id_laporan}, 'tolak')`, danger: true }
        ])}</td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function verifikasiLaporan(id, tindakan) {
  let alasan_tolak = '';
  if (tindakan === 'tolak') {
    alasan_tolak = prompt('Masukkan alasan penolakan laporan:');
    if (alasan_tolak === null) return;
    if (!alasan_tolak.trim()) return toast('Alasan penolakan wajib diisi.', 'error');
  }
  try {
    const res = await apiFetch(`/admin/laporan/${id}/verifikasi`, { method: 'PUT', body: JSON.stringify({ tindakan, alasan_tolak }) });
    toast(res.message, 'success');
    loadAntrean();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- 3. Klaim ----------
async function loadDaftarKlaim() {
  document.getElementById('tableKlaim').innerHTML = skelRows(5);
  try {
    const res = await apiFetch('/klaim/admin/list');
    const tbody = document.getElementById('tableKlaim');
    if (!res.data.length) {
      tbody.innerHTML = emptyRow(5, 'Belum ada pengajuan klaim barang.');
      return;
    }
    const badgeCls = { menunggu: 'badge-proses', diterima: 'badge-temuan', ditolak: 'badge-ditolak' };
    tbody.innerHTML = res.data.map((k) => `
      <tr>
        <td>#${k.id_laporan} - <strong>${escapeHtml(k.nama_barang)}</strong><br><small style="color:var(--text-muted)">Pelapor: ${escapeHtml(k.nama_pelapor)}</small></td>
        <td>${escapeHtml(k.nama_pengaju)}<br><small style="color:var(--text-muted)">${escapeHtml(k.email_pengaju)}</small></td>
        <td style="max-width:320px; white-space:pre-wrap;">${escapeHtml(k.bukti_kepemilikan)}
          ${k.foto_bukti.map((f, i) => `<br><a class="link-btn" target="_blank" href="/api/klaim/bukti/${encodeURIComponent(f)}">Lihat bukti ${i + 1}</a>`).join('')}
        </td>
        <td><span class="badge ${badgeCls[k.status_klaim]}">${k.status_klaim}</span>
          ${k.alasan_penolakan ? `<br><small style="color:#B91C1C">${escapeHtml(k.alasan_penolakan)}</small>` : ''}</td>
        <td>${k.status_klaim === 'menunggu' ? kebab([
          { label: '✅ Terima klaim', fn: `verifikasiKlaim(${k.id_klaim}, 'diterima')` },
          { label: '❌ Tolak klaim', fn: `verifikasiKlaim(${k.id_klaim}, 'ditolak')`, danger: true }
        ]) : '-'}</td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function verifikasiKlaim(id, keputusan) {
  let alasan_tolak = null;
  if (keputusan === 'ditolak') {
    alasan_tolak = prompt('Masukkan alasan penolakan klaim:');
    if (alasan_tolak === null) return;
    if (!alasan_tolak.trim()) return toast('Alasan penolakan wajib diisi.', 'error');
  } else if (!confirm('Terima klaim ini? Barang akan ditandai sudah dikembalikan.')) {
    return;
  }
  try {
    const res = await apiFetch(`/klaim/verifikasi-klaim/${id}`, { method: 'PUT', body: JSON.stringify({ keputusan, alasan_tolak }) });
    toast(res.message, 'success');
    if (keputusan === 'diterima' && window.fxConfetti) fxConfetti();
    loadDaftarKlaim();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- 4. Pengguna ----------
const ROLE_LABEL = { mahasiswa: 'Mahasiswa', dosen: 'Dosen / Tendik', admin: 'Admin' };
const VERIF_BADGE = { menunggu: 'badge-proses', terverifikasi: 'badge-temuan', ditolak: 'badge-ditolak' };

async function loadDaftarUsers() {
  document.getElementById('tableUsers').innerHTML = skelRows(6);
  try {
    const res = await apiFetch('/admin/users');
    document.getElementById('tableUsers').innerHTML = res.data.map((u) => {
      const isAdmin = u.tipe === 'admin';
      return `
      <tr>
        <td><strong>${escapeHtml(u.nama)}</strong></td>
        <td>${escapeHtml(u.email)}</td>
        <td>${ROLE_LABEL[u.tipe]}</td>
        <td>${isAdmin ? '-' : `
          <span class="badge ${VERIF_BADGE[u.status_verifikasi]}">${u.status_verifikasi}</span>
          ${u.punya_kartu ? `<br><a class="link-btn" target="_blank" href="/api/admin/users/${u.id_user}/kartu">Lihat kartu</a>` : ''}`}
        </td>
        <td><span class="badge ${u.status_akun === 'aktif' ? 'badge-temuan' : 'badge-ditolak'}">${u.status_akun}</span></td>
        <td>${isAdmin ? '-' : kebab([
          ...(u.status_verifikasi !== 'terverifikasi' ? [{ label: '✅ Verifikasi kartu', fn: `verifikasiUser(${u.id_user}, 'terverifikasi')` }] : []),
          ...(u.status_verifikasi !== 'ditolak' ? [{ label: '🚫 Tolak kartu', fn: `verifikasiUser(${u.id_user}, 'ditolak')` }] : []),
          u.status_akun === 'aktif'
            ? { label: '⛔ Nonaktifkan akun', fn: `ubahStatusUser(${u.id_user}, 'nonaktif')`, danger: true }
            : { label: '♻️ Aktifkan akun', fn: `ubahStatusUser(${u.id_user}, 'aktif')` }
        ])}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function verifikasiUser(id, status_verifikasi) {
  try {
    const res = await apiFetch(`/admin/users/verifikasi/${id}`, { method: 'PUT', body: JSON.stringify({ status_verifikasi }) });
    toast(res.message, 'success');
    loadDaftarUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function ubahStatusUser(id, status_akun) {
  if (!confirm(`${status_akun === 'nonaktif' ? 'Nonaktifkan' : 'Aktifkan'} akun ini?`)) return;
  try {
    const res = await apiFetch(`/admin/users/status/${id}`, { method: 'PUT', body: JSON.stringify({ status_akun }) });
    toast(res.message, 'success');
    loadDaftarUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- 5. Master lokasi ----------
async function loadMasterLokasi() {
  document.getElementById('tableLokasi').innerHTML = skelRows(3);
  try {
    const res = await apiFetch('/master/lokasi');
    document.getElementById('tableLokasi').innerHTML = res.data.map((l) => `
      <tr>
        <td>#${l.id_lokasi}</td>
        <td><strong>${escapeHtml(l.nama_lokasi)}</strong></td>
        <td><button class="btn-danger btn-sm" onclick="hapusLokasi(${l.id_lokasi})">Hapus</button></td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.getElementById('formLokasi').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('inputLokasi');
  try {
    const res = await apiFetch('/admin/lokasi', { method: 'POST', body: JSON.stringify({ nama_lokasi: input.value }) });
    toast(res.message, 'success');
    input.value = '';
    loadMasterLokasi();
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function hapusLokasi(id) {
  if (!confirm('Hapus lokasi ini?')) return;
  try {
    const res = await apiFetch(`/admin/lokasi/${id}`, { method: 'DELETE' });
    toast(res.message, 'success');
    loadMasterLokasi();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- 6. Laporan abuse ----------
async function loadAbuse() {
  document.getElementById('tableAbuse').innerHTML = skelRows(5);
  try {
    const res = await apiFetch('/admin/abuse');
    const tbody = document.getElementById('tableAbuse');
    if (!res.data.length) {
      tbody.innerHTML = emptyRow(5, 'Belum ada laporan penyalahgunaan.');
      return;
    }
    const cls = { baru: 'badge-ditolak', ditinjau: 'badge-proses', selesai: 'badge-temuan' };
    tbody.innerHTML = res.data.map((a) => `
      <tr>
        <td>${escapeHtml(a.nama_pelapor)}<br><small style="color:var(--text-muted)">${formatTanggal(a.created_at, true)}</small></td>
        <td>${a.id_laporan ? `<a class="link-btn" target="_blank" href="detail.html?id=${a.id_laporan}">#${a.id_laporan} ${escapeHtml(a.nama_barang || '')}</a>` : '-'}
            ${a.nama_terlapor ? `<br><small style="color:var(--text-muted)">Terlapor: ${escapeHtml(a.nama_terlapor)}</small>` : ''}</td>
        <td style="max-width:320px; white-space:pre-wrap;">${escapeHtml(a.alasan)}</td>
        <td><span class="badge ${cls[a.status]}">${a.status}</span></td>
        <td>${a.status === 'selesai' ? '-' : kebab([
          ...(a.status === 'baru' ? [{ label: '👀 Tandai ditinjau', fn: `ubahAbuse(${a.id_abuse}, 'ditinjau')` }] : []),
          { label: '✅ Tandai selesai', fn: `ubahAbuse(${a.id_abuse}, 'selesai')` }
        ])}</td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function ubahAbuse(id, status) {
  try {
    const res = await apiFetch(`/admin/abuse/status/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    toast(res.message, 'success');
    loadAbuse();
  } catch (err) {
    toast(err.message, 'error');
  }
}
