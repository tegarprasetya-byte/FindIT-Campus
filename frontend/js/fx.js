// ===== Interaksi & animasi halus (dipakai semua halaman) =====
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1. Efek riak saat tombol ditekan ----------
  const RIPPLE_SEL = '.btn-yellow,.btn-navy,.btn-outline,.btn-danger,.login-btn,.alt-btn,.role-tab,.admin-menu-btn,.nav-logout,.send-btn,.kebab-btn,.icon-btn,.avatar-btn,.ud-item,.lb-btn,.theme-toggle,.lp-close,.to-top,.kebab-menu button';
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest(RIPPLE_SEL);
    if (!b || b.disabled || reduce) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.6;
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    const dark = b.matches('.btn-yellow,.btn-outline,.login-btn,.alt-btn,.send-btn,.kebab-btn,.icon-btn,.ud-item,.lp-close,.to-top,.kebab-menu button') || (b.matches('.role-tab') && !b.classList.contains('active'));
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;background:${dark ? 'rgba(1,48,86,.16)' : 'rgba(255,255,255,.4)'}`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });

  // ---------- 2. Muncul bertahap saat di-scroll ----------
  const REVEAL_SEL = '.card-item,.stat-card,.chart-card,.saran-item,.empty-card,.hero-stat,.skel-card';
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        io.unobserve(el);
        // setelah selesai, lepas class agar efek hover normal kembali
        setTimeout(() => el.classList.remove('reveal', 'in'), 900 + (parseInt(el.style.getPropertyValue('--d')) || 0));
      });
    }, { threshold: 0.06 });

    const prep = (root) => {
      if (!root.querySelectorAll) return;
      root.querySelectorAll(REVEAL_SEL).forEach((el) => {
        if (el.dataset.fx || el.classList.contains('skel-card')) return;
        el.dataset.fx = '1';
        const idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.setProperty('--d', Math.min(idx, 10) * 70 + 'ms');
        el.classList.add('reveal');
        io.observe(el);
      });
    };
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      prep(n.parentElement || n);
    }))).observe(document.body, { childList: true, subtree: true });
    prep(document);
  }

  // ---------- 3. Konfeti perayaan ----------
  window.fxConfetti = function (opts = {}) {
    if (reduce) return;
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5000';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const W = (c.width = innerWidth), H = (c.height = innerHeight);
    const colors = ['#F7E439', '#1563A3', '#013056', '#16A34A', '#EC4899', '#9CC5E8', '#ffffff'];
    const ox = opts.x ?? W / 2, oy = opts.y ?? H * 0.35;
    const parts = Array.from({ length: 150 }, () => ({
      x: ox, y: oy,
      vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 3,
      w: 6 + Math.random() * 7, h: 4 + Math.random() * 6,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: colors[(Math.random() * colors.length) | 0], life: 0
    }));
    (function frame() {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      parts.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
        if (p.y < H + 20) alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - p.life / 170);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (alive > 0 && parts[0].life < 190) requestAnimationFrame(frame); else c.remove();
    })();
  };

  // ---------- 4. Transisi halus saat pindah halaman ----------
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || reduce || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript') || href.startsWith('mailto') || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
    e.preventDefault();
    document.body.classList.add('leaving');
    setTimeout(() => { location.href = url.href; }, 150);
  });
  window.addEventListener('pageshow', () => document.body.classList.remove('leaving'));

  // ---------- 5. Navbar menempel + bayangan saat scroll, tombol ke atas ----------
  const nav = document.querySelector('.navbar');
  let toTop;
  if (!document.querySelector('.login-page') && !document.getElementById('tabContentStats')) {
    toTop = document.createElement('button');
    toTop.className = 'to-top';
    toTop.title = 'Kembali ke atas';
    toTop.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(toTop);
  }
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', scrollY > 8);
    if (toTop) toTop.classList.toggle('show', scrollY > 420);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- 6. Placeholder pencarian yang mengetik sendiri ----------
  const search = document.getElementById('filterKeyword');
  if (search && !reduce) {
    const words = ['dompet cokelat', 'kunci motor', 'laptop Asus', 'tumbler biru', 'kartu mahasiswa', 'jaket almamater', 'payung hitam'];
    let w = 0, i = 0, del = false;
    (function tick() {
      if (document.activeElement === search || search.value) { search.placeholder = 'Cari nama barang...'; return setTimeout(tick, 800); }
      const word = words[w];
      i += del ? -1 : 1;
      search.placeholder = 'Cari ' + word.slice(0, i) + (i % 2 && !del ? '' : '') + '|';
      let delay = del ? 35 : 85;
      if (!del && i === word.length) { del = true; delay = 1500; }
      else if (del && i === 0) { del = false; w = (w + 1) % words.length; delay = 350; }
      setTimeout(tick, delay);
    })();
  }

  // ---------- 7. Parallax lembut pada hero & kartu tanda di halaman login ----------
  const hero = document.querySelector('.hero');
  if (hero && !reduce) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5) * 2);
      hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5) * 2);
    });
    hero.addEventListener('pointerleave', () => { hero.style.setProperty('--mx', 0); hero.style.setProperty('--my', 0); });
  }
  const loginPage = document.querySelector('.login-page');
  const idcard = document.querySelector('.login-idcard');
  if (loginPage && idcard && !reduce) {
    loginPage.addEventListener('pointermove', (e) => {
      const r = idcard.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      const dy = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      idcard.style.transform = `perspective(700px) rotateY(${dx * 22}deg) rotateX(${-dy * 22}deg)`;
    });
    loginPage.addEventListener('pointerleave', () => { idcard.style.transform = ''; });
  }
})();
