let currentJenis = '';
let currentTab = 'beranda';
let currentPage = 1;
const PAGE_SIZE = 12;

// Opsional: bila ada foto kampus di frontend/img/hero.jpg (atau .png), pakai sebagai gambar hero
function loadHeroPhoto() {
  ['img/hero.jpg', 'img/hero.png', 'img/hero.webp'].reduce((chain, src) => chain.then((found) => found || new Promise((res) => {
    const im = new Image();
    im.onload = () => res(src);
    im.onerror = () => res(null);
    im.src = src;
  })), Promise.resolve(null)).then((src) => {
    if (!src) return;
    const box = document.getElementById('heroPhoto');
    box.style.backgroundImage = `url('${src}')`;
    box.classList.add('has-photo');
    document.getElementById('heroArt').style.display = 'none';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await requireLogin();
  } catch (e) { return; }

  if (currentUser.tipe === 'admin') {
    // Admin diarahkan ke panel admin
    location.href = 'admin.html';
    return;
  }

  mountBell(document.getElementById('bellMount'));
  mountUserMenu();

  // Menu navbar di halaman ini berpindah tab tanpa memuat ulang (navbar tidak berkedip/berubah)
  document.querySelector('.navbar').addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav="beranda"], [data-nav="riwayat"], #navBuat');
    if (!a) return;
    e.preventDefault();
    if (a.id === 'navBuat') return openModalLaporan();
    history.replaceState(null, '', a.dataset.nav === 'riwayat' ? 'beranda.html?tab=riwayat' : 'beranda.html');
    switchTab(a.dataset.nav);
  });
  await loadOptions();
  loadStatistik();
  loadHeroPhoto();

  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'riwayat') switchTab('riwayat');
  else await loadLaporan(true);
  if (params.get('buat') === '1') openModalLaporan();
});

function switchTab(tabName) {
  currentTab = tabName;
  const isRiwayat = tabName === 'riwayat';

  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === (isRiwayat ? 'riwayat' : 'beranda')));
  document.getElementById('heroBox').style.display = isRiwayat ? 'none' : 'block';
  document.getElementById('filterBar').style.display = isRiwayat ? 'none' : 'flex';
  document.getElementById('jenisTabs').style.display = isRiwayat ? 'none' : 'flex';
  document.getElementById('pageTitle').innerText = isRiwayat ? 'Riwayat Laporan Saya' : 'Terbaru di Kampus';
  document.getElementById('pageSubTitle').innerText = isRiwayat
    ? 'Daftar semua laporan barang hilang & temuan yang pernah Anda buat'
    : 'Barang yang ditampilkan sudah diverifikasi oleh Admin';

  if (isRiwayat) loadRiwayatSaya();
  else loadLaporan(true);
}

async function loadOptions() {
  try {
    const [kat, lok] = await Promise.all([apiFetch('/master/kategori'), apiFetch('/master/lokasi')]);

    document.getElementById('filterKategori').innerHTML =
      '<option value="">Semua Kategori</option>' + kat.data.map((k) => `<option value="${k.id_kategori}">${escapeHtml(k.nama_kategori)}</option>`).join('');
    document.getElementById('lapKategori').innerHTML =
      '<option value="" disabled selected>-- Pilih Kategori --</option>' + kat.data.map((k) => `<option value="${k.id_kategori}">${escapeHtml(k.nama_kategori)}</option>`).join('');

    document.getElementById('filterLokasi').innerHTML =
      '<option value="">Semua Lokasi</option>' + lok.data.map((l) => `<option value="${l.id_lokasi}">${escapeHtml(l.nama_lokasi)}</option>`).join('');
    document.getElementById('lapLokasi').innerHTML =
      '<option value="" disabled selected>-- Pilih Area Kampus --</option>' + lok.data.map((l) => `<option value="${l.id_lokasi}">${escapeHtml(l.nama_lokasi)}</option>`).join('');
  } catch (err) {
    toast('Gagal memuat data kategori/lokasi.', 'error');
  }
}

async function loadStatistik() {
  try {
    const { data } = await apiFetch('/laporan/statistik');
    if (data.pengguna > 0) {
      document.getElementById('proofText').innerText = `Bergabung bersama ${data.pengguna} mahasiswa & dosen Unila`;
      document.getElementById('heroProof').style.display = 'flex';
    }
  } catch (e) { /* opsional */ }
}

function showSkeleton(n = 6) {
  document.getElementById('containerLaporan').innerHTML = Array.from({ length: n }, () =>
    '<div class="skel-card"><div class="skeleton skel-img"></div><div class="skeleton skel-line"></div><div class="skeleton skel-line short"></div></div>').join('');
}

function emptyState(judul, teks, tombol = true) {
  return `<div class="empty-card">
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none"><circle cx="48" cy="48" r="44" fill="var(--surface-2)"/><rect x="26" y="34" width="44" height="34" rx="6" fill="var(--surface)" stroke="#1563A3" stroke-width="3"/><path d="M26 44h44" stroke="#1563A3" stroke-width="3"/><circle cx="62" cy="62" r="11" fill="#F7E439" stroke="#013056" stroke-width="3"/><path d="M70 70l8 8" stroke="#013056" stroke-width="3" stroke-linecap="round"/></svg>
    <h4>${judul}</h4><p>${teks}</p>
    ${tombol ? '<button class="btn-yellow" onclick="openModalLaporan()">+ Buat Laporan</button>' : ''}
  </div>`;
}

function cardHtml(item, { riwayat = false } = {}) {
  const badges = riwayat ? jenisBadge(item.jenis) : jenisBadge(item.jenis) + (item.status === 'proses_klaim' ? statusBadge('proses_klaim') : '');
  return `
    <div class="card-item" onclick="location.href='detail.html?id=${item.id_laporan}'">
      <div class="card-img-placeholder"><div class="card-corner">${badges}</div>${cardFoto(item)}</div>
      <div class="card-body">
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">${escapeHtml(item.nama_barang)}</h4>
        <p style="font-size: 13px; color: var(--text-muted);">📍 ${escapeHtml(item.nama_lokasi)}</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">🕒 ${formatTanggal(item.waktu_kejadian)}</p>
        ${riwayat ? `<div style="margin-top:12px;">${statusBadge(item.status)}</div>` : ''}
        ${riwayat && item.status === 'ditolak' && item.alasan_tolak ? `<p style="font-size:12px; color:#EF4444; margin-top:10px;">Alasan ditolak: ${escapeHtml(item.alasan_tolak)}</p>` : ''}
        ${riwayat && item.jenis === 'hilang' && item.status === 'dipublikasikan'
          ? `<button class="btn-yellow btn-sm" style="margin-top:12px;" onclick="event.stopPropagation(); tandaiDitemukan(${item.id_laporan})">✅ Sudah Ditemukan</button>` : ''}
        ${riwayat && ['menunggu_verifikasi', 'ditolak'].includes(item.status)
          ? `<button class="btn-outline btn-sm" style="margin-top:12px;" onclick="event.stopPropagation(); batalkanLaporan(${item.id_laporan})">Batalkan Laporan</button>` : ''}
      </div>
    </div>`;
}

function cardFoto(item) {
  return item.foto_utama
    ? `<img src="/uploads/${encodeURIComponent(item.foto_utama)}" alt="${escapeHtml(item.nama_barang)}" onerror="this.outerHTML='<span>Foto tidak tersedia</span>'">`
    : '<span>Tidak Ada Foto</span>';
}

async function loadLaporan(reset = true) {
  if (reset) currentPage = 1;

  const keyword = document.getElementById('filterKeyword').value.trim();
  const id_kategori = document.getElementById('filterKategori').value;
  const id_lokasi = document.getElementById('filterLokasi').value;

  const q = new URLSearchParams({ keyword, id_kategori, id_lokasi, limit: PAGE_SIZE, page: currentPage });
  if (currentJenis) q.set('jenis', currentJenis);

  if (reset) showSkeleton();
  try {
    const res = await apiFetch(`/laporan/publik?${q}`);
    const container = document.getElementById('containerLaporan');

    if (reset && res.data.length === 0) {
      container.innerHTML = emptyState('Belum ada barang yang cocok', 'Coba kata kunci atau filter lain, atau buat laporan baru.');
      document.getElementById('loadMoreWrap').style.display = 'none';
      return;
    }

    const html = res.data.map((item) => cardHtml(item)).join('');

    if (reset) container.innerHTML = html;
    else container.insertAdjacentHTML('beforeend', html);

    document.getElementById('loadMoreWrap').style.display = res.data.length === PAGE_SIZE ? 'block' : 'none';
    currentPage++;
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadRiwayatSaya() {
  document.getElementById('loadMoreWrap').style.display = 'none';
  showSkeleton(3);
  try {
    const res = await apiFetch('/laporan/riwayat-saya');
    const container = document.getElementById('containerLaporan');

    if (res.data.length === 0) {
      container.innerHTML = emptyState('Belum ada laporan', 'Laporan yang Anda buat akan muncul di sini beserta status verifikasinya.');
      return;
    }
    container.innerHTML = res.data.map((item) => cardHtml(item, { riwayat: true })).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function tandaiDitemukan(id) {
  if (!confirm('Tandai barang ini sudah ditemukan? Laporan akan ditutup.')) return;
  try {
    const res = await apiFetch(`/laporan/ditemukan/${id}`, { method: 'PUT' });
    toast(res.message, 'success');
    window.fxConfetti && fxConfetti();
    loadRiwayatSaya();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function batalkanLaporan(id) {
  if (!confirm('Batalkan dan hapus laporan ini?')) return;
  try {
    const res = await apiFetch(`/laporan/cancel/${id}`, { method: 'DELETE' });
    toast(res.message, 'success');
    loadRiwayatSaya();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function filterJenis(jenis) {
  currentJenis = jenis;
  document.getElementById('tabSemua').className = jenis === '' ? 'btn-navy' : 'btn-outline';
  document.getElementById('tabHilang').className = jenis === 'hilang' ? 'btn-navy' : 'btn-outline';
  document.getElementById('tabTemuan').className = jenis === 'temuan' ? 'btn-navy' : 'btn-outline';
  loadLaporan(true);
}

document.getElementById('filterKeyword').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadLaporan(true); });

function openModalLaporan() {
  // Batasi waktu kejadian sampai sekarang
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('lapWaktu').max = now.toISOString().slice(0, 16);
  document.getElementById('modalLaporan').classList.add('active');
}
function closeModalLaporan() {
  document.getElementById('modalLaporan').classList.remove('active');
}

function updateFotoPreview(input) {
  const p = document.getElementById('previewText');
  if (input.files.length > 3) {
    toast('Maksimal 3 foto. Silakan pilih ulang.', 'error');
    input.value = '';
    p.innerText = 'Klik untuk Mengunggah Foto';
    return;
  }
  p.innerText = input.files.length ? `Terpilih ${input.files.length} foto` : 'Klik untuk Mengunggah Foto';
}

document.getElementById('formBuatLaporan').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnKirimLaporan');
  const fd = new FormData();

  fd.append('jenis', document.querySelector('input[name="jenis"]:checked').value);
  fd.append('nama_barang', document.getElementById('lapNama').value);
  fd.append('id_kategori', document.getElementById('lapKategori').value);
  fd.append('waktu_kejadian', document.getElementById('lapWaktu').value);
  fd.append('id_lokasi', document.getElementById('lapLokasi').value);
  fd.append('detail_lokasi', document.getElementById('lapDetailLokasi').value);
  fd.append('deskripsi', document.getElementById('lapDeskripsi').value);
  Array.from(document.getElementById('lapFoto').files).forEach((f) => fd.append('files', f));

  setLoading(btn, true);
  try {
    const res = await apiFetch('/laporan/create', { method: 'POST', body: fd });
    toast(res.message, 'success');
    closeModalLaporan();
    document.getElementById('formBuatLaporan').reset();
    document.getElementById('previewText').innerText = 'Klik untuk Mengunggah Foto';
    switchTab('riwayat'); // tampilkan laporan baru beserta status verifikasinya
  } catch (err) {
    toast(err.message || 'Gagal mengirim laporan.', 'error');
  } finally {
    setLoading(btn, false);
  }
});
