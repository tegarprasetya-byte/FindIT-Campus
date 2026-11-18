const idLaporan = new URLSearchParams(location.search).get('id');
let detailData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!idLaporan) {
    location.href = 'beranda.html';
    return;
  }
  try {
    await requireLogin();
  } catch (e) { return; }

  mountBell(document.getElementById('bellMount'));
  mountUserMenu();
  await loadDetail();
});

async function loadDetail() {
  try {
    const res = await apiFetch(`/laporan/detail/${idLaporan}`);
    const d = (detailData = res.data);
    const isHilang = d.jenis === 'hilang';

    document.querySelectorAll('.is-skel').forEach((el) => el.classList.remove('is-skel'));
    document.title = `${d.nama_barang} - FindIT Campus`;
    document.getElementById('txtNamaBarang').innerText = d.nama_barang;
    document.getElementById('badgeRow').innerHTML = jenisBadge(d.jenis) + statusBadge(d.status);
    document.getElementById('txtWaktu').innerText = `📅 Tanggal ${isHilang ? 'Hilang' : 'Ditemukan'}: ${formatTanggal(d.waktu_kejadian, true)}`;
    document.getElementById('txtLokasi').innerText = `📍 Lokasi: ${d.nama_lokasi}${d.detail_lokasi ? ` (${d.detail_lokasi})` : ''}`;
    document.getElementById('txtKategori').innerText = `🏷️ Kategori: ${d.nama_kategori}`;
    document.getElementById('txtPelapor').innerText = `👤 Pelapor: ${d.nama_pelapor}`;
    document.getElementById('txtDeskripsi').innerText = d.deskripsi;

    if (d.status === 'ditolak' && d.alasan_tolak) {
      const box = document.getElementById('boxDitolak');
      box.style.display = 'block';
      box.innerText = `Laporan ini ditolak Admin. Alasan: ${d.alasan_tolak}`;
    }

    setupGallery(d.fotos.map((f) => f.nama_file));
    renderTimeline(d, isHilang);

    configureActions(d, isHilang);
    loadSaran(isHilang);
  } catch (err) {
    document.querySelectorAll('.is-skel').forEach((el) => el.classList.remove('is-skel'));
    toast(err.message, 'error');
    setTimeout(() => (location.href = 'beranda.html'), 1500);
  }
}

// ---------- Galeri + lightbox ----------
let galeri = [];
let galeriIdx = 0;

function setupGallery(files) {
  galeri = files.map((f) => `/uploads/${encodeURIComponent(f)}`);
  galeriIdx = 0;
  const thumbs = document.getElementById('thumbContainer');
  if (galeri.length === 0) return;
  document.getElementById('noImg').style.display = 'none';
  document.getElementById('mainImg').style.display = 'block';
  document.getElementById('zoomHint').style.display = 'block';
  thumbs.innerHTML = galeri.length > 1 ? galeri.map((src, i) => `<img src="${src}" data-i="${i}" alt="" onerror="this.style.display='none'">`).join('') : '';
  thumbs.onclick = (e) => { if (e.target.dataset.i !== undefined) showFoto(parseInt(e.target.dataset.i)); };
  showFoto(0);
}
document.addEventListener('DOMContentLoaded', () => {
  const img = document.getElementById('mainImg');
  img.onerror = () => { img.style.display = 'none'; document.getElementById('noImg').style.display = 'block'; document.getElementById('zoomHint').style.display = 'none'; galeri = []; };
});

function showFoto(i) {
  galeriIdx = (i + galeri.length) % galeri.length;
  document.getElementById('mainImg').src = galeri[galeriIdx];
  document.querySelectorAll('#thumbContainer img').forEach((el, n) => el.classList.toggle('active', n === galeriIdx));
}
function openLightbox() {
  if (!galeri.length) return;
  document.getElementById('lbImg').src = galeri[galeriIdx];
  document.getElementById('lightbox').classList.add('open');
  const multi = galeri.length > 1;
  document.querySelector('.lb-prev').style.display = document.querySelector('.lb-next').style.display = multi ? '' : 'none';
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }
function stepLightbox(d) { showFoto(galeriIdx + d); document.getElementById('lbImg').src = galeri[galeriIdx]; }
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') stepLightbox(-1);
  if (e.key === 'ArrowRight') stepLightbox(1);
});

// ---------- Timeline status ----------
function renderTimeline(d, isHilang) {
  const ditolak = d.status === 'ditolak';
  const diarsip = d.status === 'diarsipkan';
  const sudahVerif = !['menunggu_verifikasi', 'ditolak'].includes(d.status);
  const adaKlaim = d.jumlah_klaim > 0 || (d.status === 'dikembalikan' && !isHilang);
  const selesai = d.status === 'dikembalikan';

  const steps = [
    { label: 'Dibuat', sub: formatTanggal(d.tanggal_laporan), state: 'done' },
    { label: ditolak ? 'Ditolak' : 'Diverifikasi', sub: ditolak ? 'Oleh Admin' : (d.tanggal_publikasi ? formatTanggal(d.tanggal_publikasi) : 'Menunggu Admin'),
      state: ditolak ? 'fail' : sudahVerif ? 'done' : 'current' }
  ];
  if (!isHilang) {
    steps.push({ label: 'Diklaim', sub: adaKlaim ? 'Klaim masuk' : 'Belum ada klaim', state: adaKlaim ? (selesai ? 'done' : 'current') : 'pending' });
  }
  steps.push({ label: diarsip ? 'Diarsipkan' : (isHilang ? 'Ditemukan' : 'Dikembalikan'), sub: selesai ? 'Selesai' : (diarsip ? 'Lewat 3 bulan' : 'Belum'), state: selesai ? 'done' : diarsip ? 'fail' : 'pending' });

  // Langkah aktif terakhir diberi tanda "current" bila belum ada yang current
  document.getElementById('timeline').innerHTML = steps.map((st, i) => `
    <div class="tl-step ${st.state}">
      <div class="tl-dot">${st.state === 'done' ? '✓' : st.state === 'fail' ? '✕' : i + 1}</div>
      <b>${st.label}</b>${escapeHtml(st.sub)}
    </div>`).join('');
}

function configureActions(d, isHilang) {
  const btnKlaim = document.getElementById('btnKlaim');
  const btnChat = document.getElementById('btnChat');
  const info = document.getElementById('infoBox');
  const isAdmin = currentUser.tipe === 'admin';

  // Pemilik laporan / admin tidak perlu tombol klaim & chat
  if (d.is_owner || isAdmin) {
    btnKlaim.style.display = 'none';
    btnChat.style.display = 'none';
    document.getElementById('btnAbuse').style.display = 'none';
    info.innerText = d.is_owner
      ? 'Ini adalah laporan Anda. Anda akan menerima notifikasi jika ada klaim atau pesan masuk.'
      : 'Anda melihat laporan ini sebagai Admin.';

    // Pemilik laporan HILANG: tandai sendiri bila barangnya sudah ketemu
    if (d.is_owner && isHilang && d.status === 'dipublikasikan') {
      const b = document.createElement('button');
      b.className = 'btn-yellow';
      b.style.cssText = 'width:100%; justify-content:center; padding:14px; margin-bottom:12px;';
      b.textContent = '✅ Barang Saya Sudah Ditemukan';
      b.onclick = tandaiDitemukan;
      document.getElementById('sidebarAksi').prepend(b);
      info.innerText = 'Sudah menemukan barangmu? Tekan tombol di atas agar laporan ditutup. Orang yang membantumu lewat chat akan diberi tahu.';
    }
    return;
  }

  if (isHilang) {
    // Barang hilang: orang lain yang menemukan cukup menghubungi pelapor
    btnKlaim.style.display = 'none';
    btnChat.innerText = '💬 Saya Menemukan Barang Ini';
    info.innerText = 'Jika Anda menemukan barang ini, hubungi pelapor melalui chat.';
    return;
  }

  // Barang temuan
  if (d.klaim_saya === 'menunggu') {
    btnKlaim.disabled = true;
    btnKlaim.innerText = 'Klaim Anda Sedang Diproses';
  } else if (d.klaim_saya === 'diterima') {
    btnKlaim.disabled = true;
    btnKlaim.innerText = 'Klaim Anda Diterima';
  } else if (d.status === 'dikembalikan') {
    btnKlaim.disabled = true;
    btnKlaim.innerText = 'Barang Sudah Dikembalikan';
  }
}

async function loadSaran(isHilang) {
  try {
    const res = await apiFetch(`/laporan/saran?id_laporan=${idLaporan}`);
    if (!res.data.length) return;
    document.getElementById('saranTitle').innerText = isHilang ? 'Barang Temuan yang Mungkin Cocok' : 'Laporan Kehilangan yang Mirip';
    document.getElementById('saranSection').style.display = 'block';
    document.getElementById('saranGrid').innerHTML = res.data.map((s) => `
      <div class="saran-item" onclick="location.href='detail.html?id=${s.id_laporan}'">
        <div class="img">${s.foto_utama ? `<img src="/uploads/${encodeURIComponent(s.foto_utama)}" alt="" onerror="this.outerHTML='Tidak Ada Foto'">` : 'Tidak Ada Foto'}</div>
        <strong>${escapeHtml(s.nama_barang)}</strong>
        <div style="color:var(--text-muted); margin-top:2px;">${escapeHtml(s.nama_lokasi)}</div>
      </div>`).join('');
  } catch (e) { /* saran bersifat opsional */ }
}

function openModalKlaim() { document.getElementById('modalKlaim').classList.add('active'); }
function closeModalKlaim() { document.getElementById('modalKlaim').classList.remove('active'); }

document.getElementById('klaimFoto').addEventListener('change', (e) => {
  if (e.target.files.length > 3) {
    toast('Maksimal 3 file. Silakan pilih ulang.', 'error');
    e.target.value = '';
  }
});

document.getElementById('formKlaim').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnKirimKlaim');
  const fd = new FormData();
  fd.append('id_laporan', idLaporan);
  fd.append('deskripsi_bukti', document.getElementById('klaimBukti').value);
  Array.from(document.getElementById('klaimFoto').files).forEach((f) => fd.append('files', f));

  setLoading(btn, true);
  try {
    const res = await apiFetch('/klaim/create', { method: 'POST', body: fd });
    toast(res.message, 'success');
    closeModalKlaim();
    document.getElementById('formKlaim').reset();
    await loadDetail();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(btn, false);
  }
});

async function tandaiDitemukan() {
  if (!confirm('Tandai barang ini sudah ditemukan? Laporan akan ditutup dan tidak bisa dibuka lagi.')) return;
  try {
    const res = await apiFetch(`/laporan/ditemukan/${idLaporan}`, { method: 'PUT' });
    toast(res.message, 'success');
    window.fxConfetti && fxConfetti();
    setTimeout(() => location.reload(), 1800);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function goToChat() {
  if (!detailData) return;
  const q = new URLSearchParams({
    id_laporan: idLaporan,
    id_penerima: detailData.id_user,
    nama: detailData.nama_pelapor,
    barang: detailData.nama_barang
  });
  location.href = `chat.html?${q}`;
}

async function laporkanAbuse() {
  const alasan = prompt('Jelaskan alasan Anda melaporkan postingan ini:');
  if (alasan === null) return;
  try {
    const res = await apiFetch('/admin/abuse', { method: 'POST', body: JSON.stringify({ id_laporan: idLaporan, alasan }) });
    toast(res.message, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}
