let socket;
let currentLaporanId = null;
let currentLawanId = null;
let pendingImage = null; // File yang dipilih, belum dikirim

const ROLE_LABEL = { mahasiswa: 'Mahasiswa', dosen: 'Dosen / Tenaga Pendidik', admin: 'Admin' };
const EMOJIS = ['😀', '😊', '😂', '🙂', '😉', '😍', '🙏', '👍', '👌', '🙌', '😅', '🤝', '😢', '😮', '🎉', '❤️', '👋', '✅', '🕒', '📍', '🎒', '👜', '📱', '🔑'];

const $ = (id) => document.getElementById(id);
const initial = (nama) => (nama || '?').trim().charAt(0).toUpperCase();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await requireLogin();
  } catch (e) { return; }

  mountBell($('bellMount'));
  mountUserMenu();

  if (currentUser.tipe === 'admin') {
    location.href = 'admin.html';
    return;
  }

  setupInput();
  socket = io({ auth: { token: localStorage.getItem('token') } });
  socket.on('connect_error', (err) => toast(`Chat tidak terhubung: ${err.message}`, 'error'));
  socket.on('receive_message', onReceiveMessage);
  socket.on('notif_baru', () => window.refreshBell && window.refreshBell());
  socket.on('typing', onTyping);

  await loadDaftarPercakapan();

  // Dibuka dari halaman detail -> langsung masuk ke percakapan dengan pelapor
  const p = new URLSearchParams(location.search);
  if (p.get('id_laporan') && p.get('id_penerima')) {
    await switchChat(parseInt(p.get('id_laporan')), parseInt(p.get('id_penerima')), p.get('nama') || 'Pelapor', null);
  }
});

function setupInput() {
  $('emojiPanel').innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join('');
  $('emojiPanel').addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    const input = $('inputPesan');
    input.value += e.target.textContent;
    input.focus();
  });
  $('btnEmoji').onclick = (e) => { e.stopPropagation(); $('emojiPanel').classList.toggle('open'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('#emojiPanel')) $('emojiPanel').classList.remove('open'); });

  $('btnGambar').onclick = () => $('inputGambar').click();
  $('inputGambar').onchange = () => {
    const f = $('inputGambar').files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('File harus berupa gambar.', 'error'); return batalGambar(); }
    if (f.size > 5 * 1024 * 1024) { toast('Ukuran gambar maksimal 5MB.', 'error'); return batalGambar(); }
    pendingImage = f;
    $('previewImg').src = URL.createObjectURL(f);
    $('previewName').textContent = f.name;
    $('previewBar').classList.add('show');
  };

  $('btnKirim').onclick = kirimPesan;
  let lastTyping = 0;
  $('inputPesan').addEventListener('input', () => {
    if (!socket || !currentLaporanId || !currentLawanId || Date.now() - lastTyping < 1500) return;
    lastTyping = Date.now();
    socket.emit('typing', { id_laporan: currentLaporanId, id_penerima: currentLawanId });
  });
  $('inputPesan').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); kirimPesan(); } });
}

function batalGambar() {
  pendingImage = null;
  $('inputGambar').value = '';
  $('previewBar').classList.remove('show');
}

function setAktif(aktif) {
  ['inputPesan', 'btnGambar', 'btnEmoji', 'btnKirim'].forEach((id) => ($(id).disabled = !aktif));
}

async function loadDaftarPercakapan() {
  try {
    const res = await apiFetch('/chat/percakapan');
    const container = $('listPercakapan');

    if (res.data.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Belum ada percakapan.</p>';
      return;
    }

    container.innerHTML = '';
    res.data.forEach((p) => {
      const aktif = p.id_laporan === currentLaporanId && p.id_lawan_bicara === currentLawanId;
      const item = document.createElement('div');
      item.className = `chat-item${aktif ? ' active' : ''}`;

      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = initial(p.nama_lawan_bicara);

      const info = document.createElement('div');
      info.className = 'info';
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = p.nama_lawan_bicara;
      const pv = document.createElement('div');
      pv.className = 'pv';
      pv.textContent = p.pesan_terakhir || (p.gambar_terakhir ? '📷 Foto' : '...');
      info.append(nm, pv);
      item.append(av, info);

      if (p.belum_dibaca > 0 && !aktif) {
        const b = document.createElement('div');
        b.className = 'unread-badge';
        b.textContent = p.belum_dibaca;
        item.appendChild(b);
      }

      item.onclick = () => switchChat(p.id_laporan, p.id_lawan_bicara, p.nama_lawan_bicara, p);
      container.appendChild(item);
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function switchChat(id_laporan, id_lawan, nama_lawan, info) {
  currentLaporanId = id_laporan;
  currentLawanId = id_lawan;
  batalGambar();

  $('roomHead').style.visibility = 'visible';
  $('roomAvatar').textContent = initial(nama_lawan);
  $('txtNamaLawan').textContent = nama_lawan;
  $('txtRoleLawan').textContent = info?.role_lawan_bicara ? ROLE_LABEL[info.role_lawan_bicara] : '';
  setAktif(true);

  // Kartu barang terkait + peran lawan bicara bila belum diketahui
  apiFetch(`/laporan/detail/${id_laporan}`).then((r) => {
    const d = r.data;
    $('itemName').textContent = d.nama_barang;
    $('itemThumb').innerHTML = d.foto_utama ? `<img src="/uploads/${encodeURIComponent(d.foto_utama)}" alt="">` : '';
    $('itemCard').classList.add('show');
    $('itemCard').onclick = () => (location.href = `detail.html?id=${id_laporan}`);
  }).catch(() => $('itemCard').classList.remove('show'));

  await loadRiwayatChat();
  await loadDaftarPercakapan();
  if (window.refreshBell) window.refreshBell();
  $('inputPesan').focus();
}

function skeletonMessages() {
  const row = (mine, w) => `<div class="msg-row ${mine ? 'out' : 'in'}" style="animation:none">${mine ? '' : '<i class="skeleton" style="width:34px;height:34px;border-radius:50%;flex-shrink:0"></i>'}<i class="skeleton" style="display:block;height:54px;width:${w}px;border-radius:10px"></i></div>`;
  return row(false, 260) + row(true, 200) + row(false, 320) + row(true, 240);
}

async function loadRiwayatChat() {
  $('chatBody').innerHTML = skeletonMessages();
  try {
    const res = await apiFetch(`/chat/riwayat/${currentLaporanId}?dengan=${currentLawanId}`);
    const body = $('chatBody');
    body.innerHTML = '';
    if (res.data.length === 0) {
      body.innerHTML = '<p class="room-empty" id="chatKosong">Belum ada pesan. Mulai sapa sekarang!</p>';
      return;
    }
    res.data.forEach(appendMessage);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function appendMessage(msg) {
  const body = $('chatBody');
  $('chatKosong')?.remove();
  const mine = msg.id_pengirim === currentUser.id_user;

  const row = document.createElement('div');
  row.className = `msg-row ${mine ? 'out' : 'in'}`;

  if (!mine) {
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = initial(msg.nama_pengirim);
    row.appendChild(av);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (msg.gambar) {
    const img = document.createElement('img');
    img.src = `/uploads/${encodeURIComponent(msg.gambar)}`;
    img.alt = 'Gambar';
    img.onclick = () => window.open(img.src, '_blank');
    img.onload = () => (body.scrollTop = body.scrollHeight);
    bubble.appendChild(img);
  }
  if (msg.pesan) {
    const t = document.createElement('span');
    t.textContent = msg.pesan;
    bubble.appendChild(t);
  }
  const time = document.createElement('time');
  time.textContent = new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);

  row.appendChild(bubble);
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
}

let typingTimer;
function onTyping(d) {
  if (d.id_laporan !== currentLaporanId || d.dari !== currentLawanId) return;
  $('typingName').textContent = $('txtNamaLawan').textContent;
  $('typingBar').classList.add('show');
  $('chatBody').scrollTop = $('chatBody').scrollHeight;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => $('typingBar').classList.remove('show'), 2600);
}

async function onReceiveMessage(msg) {
  if (msg.id_pengirim !== currentUser.id_user) $('typingBar').classList.remove('show');
  const lawan = msg.id_pengirim === currentUser.id_user ? msg.id_penerima : msg.id_pengirim;
  if (msg.id_laporan === currentLaporanId && lawan === currentLawanId) {
    appendMessage(msg);
    if (msg.id_pengirim !== currentUser.id_user) {
      apiFetch(`/chat/riwayat/${currentLaporanId}?dengan=${currentLawanId}`).catch(() => {}); // tandai terbaca
    }
  }
  loadDaftarPercakapan();
}

async function kirimPesan() {
  const input = $('inputPesan');
  const pesan = input.value.trim();
  if ((!pesan && !pendingImage) || !currentLaporanId || !currentLawanId) return;

  $('btnKirim').disabled = true;
  try {
    let gambar = null;
    if (pendingImage) {
      const fd = new FormData();
      fd.append('gambar', pendingImage);
      const up = await apiFetch('/chat/gambar', { method: 'POST', body: fd });
      gambar = up.data.nama_file;
    }
    socket.emit('send_message', { id_laporan: currentLaporanId, id_penerima: currentLawanId, pesan, gambar }, (res) => {
      if (res && !res.success) toast(res.message, 'error');
    });
    input.value = '';
    batalGambar();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    $('btnKirim').disabled = false;
    input.focus();
  }
}
