// ===== Sesi login + lonceng notifikasi (dipakai semua halaman setelah login) =====
let currentUser = null;

// ---------- Navbar: satu sumber markup agar SAMA di semua halaman ----------
function renderNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const page = location.pathname.split('/').pop() || 'index.html';
  const tab = new URLSearchParams(location.search).get('tab');
  const active = page === 'chat.html' ? 'chat' : page === 'beranda.html' ? (tab === 'riwayat' ? 'riwayat' : 'beranda') : '';
  const cls = (k) => `nav-item${active === k ? ' active' : ''}`;
  nav.innerHTML = `
    <a href="beranda.html" class="brand-logo">FindIT Campus</a>
    <div class="nav-links" id="navLinks">
      <a href="beranda.html" class="${cls('beranda')}" data-nav="beranda">Beranda</a>
      <a href="beranda.html?tab=riwayat" class="${cls('riwayat')}" data-nav="riwayat">Laporan Saya</a>
      <a href="chat.html" class="${cls('chat')}" data-nav="chat">Chat</a>
      <span id="bellMount"></span>
      <a href="beranda.html?buat=1" class="btn-yellow" id="navBuat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Buat Laporan
      </a>
      <span class="nav-skel"><i class="skeleton circle"></i><i class="skeleton pill"></i></span>
    </div>`;
}
renderNavbar();

async function requireLogin({ adminOnly = false } = {}) {
  if (!localStorage.getItem('token')) {
    location.href = 'index.html';
    throw new Error('Belum login');
  }
  const me = await apiFetch('/auth/me');
  currentUser = me.data;
  if (adminOnly && currentUser.tipe !== 'admin') {
    toast('Halaman ini khusus Administrator.', 'error');
    setTimeout(() => (location.href = 'beranda.html'), 800);
    throw new Error('Bukan admin');
  }
  return currentUser;
}

async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (e) { /* abaikan */ }
  localStorage.removeItem('token');
  location.href = 'index.html';
}

// ---------- Tema gelap / terang ----------
const ICON_MOON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_SUN = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

function isDark() { return document.documentElement.dataset.theme === 'dark'; }
function setTheme(t) {
  document.documentElement.classList.add('theme-anim');
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 500);
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
  document.querySelectorAll('[data-theme-icon]').forEach((el) => (el.innerHTML = isDark() ? ICON_SUN : ICON_MOON));
  document.querySelectorAll('[data-theme-label]').forEach((el) => (el.textContent = isDark() ? 'Mode Terang' : 'Mode Gelap'));
  document.dispatchEvent(new Event('themechange'));
}
function toggleTheme() { setTheme(isDark() ? 'light' : 'dark'); }

function mountThemeToggle(container, { dark = false } = {}) {
  if (!container) return;
  const b = document.createElement('button');
  b.className = 'theme-toggle';
  b.title = 'Ganti tema';
  if (dark) b.style.color = 'var(--heading)';
  b.innerHTML = `<span data-theme-icon>${isDark() ? ICON_SUN : ICON_MOON}</span>`;
  b.onclick = toggleTheme;
  container.appendChild(b);
}

// ---------- Avatar + dropdown di navbar ----------
function mountUserMenu() {
  const nav = document.querySelector('.nav-links');
  if (!nav || !currentUser) return;
  nav.querySelector('.nav-skel')?.remove();

  mountThemeToggle(nav);

  const wrap = document.createElement('div');
  wrap.className = 'user-menu';
  const peran = { mahasiswa: 'Mahasiswa', dosen: 'Dosen / Tenaga Pendidik', admin: 'Admin' }[currentUser.tipe];
  wrap.innerHTML = `
    <button class="avatar-btn" aria-haspopup="true">
      <div class="avatar-circle">${escapeHtml((currentUser.nama || '?').trim().charAt(0).toUpperCase())}</div>
      <span class="nm">${escapeHtml(currentUser.nama)}</span>
    </button>
    <div class="user-dropdown">
      <div class="ud-head"><b>${escapeHtml(currentUser.nama)}</b><small>${escapeHtml(currentUser.email || '')}</small><br><small>${escapeHtml(peran)}</small></div>
      <a class="ud-item" href="beranda.html">🏠 Beranda</a>
      <a class="ud-item" href="beranda.html?tab=riwayat">📄 Laporan Saya</a>
      <a class="ud-item" href="chat.html">💬 Chat</a>
      <button class="ud-item" data-act="theme">🌓 <span data-theme-label>${isDark() ? 'Mode Terang' : 'Mode Gelap'}</span></button>
      <button class="ud-item danger" data-act="logout">🚪 Keluar</button>
    </div>`;
  nav.appendChild(wrap);

  const dd = wrap.querySelector('.user-dropdown');
  wrap.querySelector('.avatar-btn').onclick = (e) => { e.stopPropagation(); dd.classList.toggle('open'); };
  dd.onclick = (e) => {
    e.stopPropagation();
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'logout') logout();
    if (act === 'theme') toggleTheme();
  };
  document.addEventListener('click', () => dd.classList.remove('open'));

  mountBottomNav();
}

// ---------- Menu bawah untuk layar HP ----------
function mountBottomNav() {
  if (document.querySelector('.bottom-nav') || currentUser?.tipe === 'admin') return;
  const page = location.pathname.split('/').pop() || 'index.html';
  const tab = new URLSearchParams(location.search).get('tab');
  const icon = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = `
    <a href="beranda.html" class="${page === 'beranda.html' && tab !== 'riwayat' ? 'active' : ''}">${icon('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>')}Beranda</a>
    <a href="beranda.html?tab=riwayat" class="${tab === 'riwayat' ? 'active' : ''}">${icon('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>')}Laporan</a>
    <a href="beranda.html?buat=1" class="plus"><span class="pl">${icon('<path d="M12 5v14M5 12h14"/>')}</span>Buat</a>
    <a href="chat.html" class="${page === 'chat.html' ? 'active' : ''}">${icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}Chat</a>`;
  document.body.appendChild(nav);
}

// Lonceng notifikasi. `container` = elemen tempat lonceng dipasang.
function mountBell(container, { dark = false } = {}) {
  if (!container) return;
  const wrap = document.createElement('div');
  wrap.className = 'bell-wrap';
  wrap.innerHTML = `
    <button class="bell-btn" title="Notifikasi" style="${dark ? 'color:#013056' : ''}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span class="bell-badge"></span>
    </button>
    <div class="bell-panel"></div>`;
  container.appendChild(wrap);

  const btn = wrap.querySelector('.bell-btn');
  const badge = wrap.querySelector('.bell-badge');
  const panel = wrap.querySelector('.bell-panel');

  let lastCount = null;
  function ring() { btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring'); }

  async function refresh(renderList = false) {
    try {
      const res = await apiFetch('/notifikasi');
      if (lastCount !== null && res.unread_count > lastCount) ring();
      lastCount = res.unread_count;
      badge.textContent = res.unread_count > 99 ? '99+' : res.unread_count;
      badge.classList.toggle('show', res.unread_count > 0);
      if (renderList) renderPanel(res.data);
    } catch (e) { /* diam */ }
  }

  function renderPanel(list) {
    const items = list.length
      ? list.map((n) => `
        <div class="bell-item ${n.status_baca ? '' : 'unread'}" data-id="${n.id_notifikasi}" data-laporan="${n.id_laporan || ''}" data-judul="${escapeHtml(n.judul)}">
          <strong>${escapeHtml(n.judul)}</strong>
          <span>${escapeHtml(n.pesan)}</span>
          <small>${formatTanggal(n.created_at, true)}</small>
        </div>`).join('')
      : '<div class="bell-empty">Belum ada notifikasi.</div>';
    panel.innerHTML = `<div class="bell-head"><span>Notifikasi</span><button data-act="all">Tandai semua dibaca</button></div>${items}`;
  }

  btn.onclick = async (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    if (open) {
      panel.innerHTML = '<div class="bell-head"><span>Notifikasi</span></div>' + Array.from({ length: 3 }, () => '<div class="bell-item"><div class="skeleton" style="height:13px;width:55%;margin-bottom:8px"></div><div class="skeleton" style="height:11px;width:90%"></div></div>').join('');
      await refresh(true);
    }
  };
  panel.onclick = async (e) => {
    e.stopPropagation();
    if (e.target.dataset.act === 'all') {
      await apiFetch('/notifikasi/read-all', { method: 'PUT' });
      return refresh(true);
    }
    const item = e.target.closest('.bell-item');
    if (!item) return;
    await apiFetch(`/notifikasi/read/${item.dataset.id}`, { method: 'PUT' });
    const idLap = item.dataset.laporan;
    if (item.dataset.judul === 'Pesan baru') location.href = 'chat.html';
    else if (idLap) location.href = `detail.html?id=${idLap}`;
    else refresh(true);
  };
  document.addEventListener('click', () => panel.classList.remove('open'));

  refresh();
  setInterval(refresh, 20000);
  window.refreshBell = refresh;
}
