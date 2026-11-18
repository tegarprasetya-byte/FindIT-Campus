const $ = (id) => document.getElementById(id);
let currentRole = 'mahasiswa';

function showMsg(el, text, type = 'error') {
  el.textContent = text;
  el.className = 'login-msg';
  void el.offsetWidth; // mulai ulang animasi getar
  el.className = `login-msg show ${type}`;
}
function clearMsg(el) { el.className = 'login-msg'; }
function markInvalid(...els) { void document.body.offsetWidth; els.forEach((e) => e.classList.add('invalid')); }
function clearInvalid(root) { root.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid')); }

function goHome(user, delay = 300) {
  setTimeout(() => { location.href = user.tipe === 'admin' ? 'admin.html' : 'beranda.html'; }, delay);
}

// ================= POPUP (latar blur) =================
function openModal(id) {
  const m = $(id);
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => m.querySelector('input:not([hidden])')?.focus(), 150);
}
function closeModal(m) {
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
document.querySelectorAll('.lp-overlay').forEach((m) => {
  m.addEventListener('mousedown', (e) => { if (e.target === m) closeModal(m); });
  m.querySelector('[data-close]').addEventListener('click', () => closeModal(m));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.lp-overlay.open').forEach(closeModal);
});
$('openDaftar').addEventListener('click', () => openModal('modalDaftar'));
$('openAdmin').addEventListener('click', () => openModal('modalAdmin'));

// ================= LOGIN BIASA (email + password) =================
$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearInvalid($('formLogin'));
  clearMsg($('loginMessage'));

  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  if (!email || !password) {
    if (!email) markInvalid($('loginEmail'));
    if (!password) markInvalid($('loginPassword'));
    return showMsg($('loginMessage'), 'Email dan password wajib diisi.');
  }

  const btn = $('btnLogin');
  setLoading(btn, true);
  try {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('token', res.token);
    showMsg($('loginMessage'), 'Berhasil masuk.', 'success');
    goHome(res.user);
  } catch (err) {
    if (err.data?.code === 'EMAIL_BELUM_VERIFIKASI') {
      // Lanjutkan ke langkah OTP dan kirim kode baru
      otpEmail = err.data.email || email;
      openModal('modalDaftar');
      showStep('otp');
      requestNewOtp(true);
    } else {
      showMsg($('loginMessage'), err.message, err.data?.code === 'MENUNGGU_VERIFIKASI' ? 'warn' : 'error');
    }
    setLoading(btn, false);
  }
});

// ================= LOGIN ADMIN =================
$('formAdmin').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearInvalid($('formAdmin'));
  clearMsg($('adminMessage'));

  const email = $('adminEmail').value.trim();
  const password = $('adminPassword').value;
  if (!email || !password) {
    if (!email) markInvalid($('adminEmail'));
    if (!password) markInvalid($('adminPassword'));
    return showMsg($('adminMessage'), 'Email dan password Admin wajib diisi.');
  }

  const btn = $('btnAdmin');
  setLoading(btn, true);
  try {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, sebagai: 'admin' }) });
    localStorage.setItem('token', res.token);
    showMsg($('adminMessage'), 'Berhasil masuk sebagai Admin.', 'success');
    goHome(res.user);
  } catch (err) {
    showMsg($('adminMessage'), err.message);
    setLoading(btn, false);
  }
});

// ================= DAFTAR AKUN =================
const drop = $('dropKartu');
const dropText = $('dropText');
const fileInput = $('inputKartu');
const DROP_DEFAULT = dropText.innerHTML;

function setRole(role) {
  currentRole = role;
  $('roleMahasiswa').classList.toggle('active', role === 'mahasiswa');
  $('roleDosen').classList.toggle('active', role === 'dosen');
  $('daftarEmail').placeholder = role === 'dosen' ? 'user@staff.unila.ac.id' : 'npm@students.unila.ac.id';
}
document.querySelectorAll('.role-tab').forEach((b) => b.addEventListener('click', () => setRole(b.dataset.role)));

function setKartu(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return showMsg($('daftarMessage'), 'File kartu harus berupa gambar (JPG/PNG).');
  if (file.size > 5 * 1024 * 1024) return showMsg($('daftarMessage'), 'Ukuran foto kartu maksimal 5MB.');

  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;

  const reader = new FileReader();
  reader.onload = (e) => {
    dropText.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    const label = document.createElement('span');
    label.textContent = file.name;
    dropText.append(img, label);
  };
  reader.readAsDataURL(file);
  drop.classList.add('filled');
  drop.classList.remove('invalid');
  clearMsg($('daftarMessage'));
}

drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => setKartu(fileInput.files[0]));
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('dragover'); }));
drop.addEventListener('drop', (e) => setKartu(e.dataTransfer.files[0]));

$('formDaftar').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearInvalid($('formDaftar'));
  clearMsg($('daftarMessage'));

  const nama = $('daftarNama').value.trim();
  const email = $('daftarEmail').value.trim();
  const password = $('daftarPassword').value;
  const kartu = fileInput.files[0];

  const kosong = [];
  if (nama.length < 3) kosong.push($('daftarNama'));
  if (!email) kosong.push($('daftarEmail'));
  if (password.length < 6) kosong.push($('daftarPassword'));
  if (!kartu) kosong.push(drop);
  if (kosong.length) {
    markInvalid(...kosong);
    return showMsg($('daftarMessage'),
      !kartu && nama.length >= 3 && email && password.length >= 6
        ? 'Unggah foto Kartu Tanda Mahasiswa (KTM) atau Kartu Tanda Identitas Dosen.'
        : 'Lengkapi semua data: nama (min. 3 huruf), email, password (min. 6 karakter), dan kartu identitas.');
  }

  const fd = new FormData();
  fd.append('tipe', currentRole);
  fd.append('nama', nama);
  fd.append('email', email);
  fd.append('password', password);
  fd.append('kartu', kartu);

  const btn = $('btnDaftar');
  setLoading(btn, true);
  try {
    const res = await apiFetch('/auth/daftar', { method: 'POST', body: fd });
    otpEmail = res.email || email;
    $('loginEmail').value = otpEmail;
    showStep('otp');
    startCooldown(res.cooldown || 60);
    setLoading(btn, false);
  } catch (err) {
    if (err.status === 409) markInvalid($('daftarEmail'));
    showMsg($('daftarMessage'), err.message);
    setLoading(btn, false);
  }
});

$('btnMengerti').addEventListener('click', () => {
  closeModal($('modalDaftar'));
  setTimeout(() => { resetDaftar(); $('loginPassword').focus(); }, 300);
});

// ================= LANGKAH: form -> OTP -> menunggu verifikasi Admin =================
let otpEmail = '';
let cooldownTimer = null;

function showStep(step) {
  $('formDaftar').style.display = step === 'form' ? '' : 'none';
  $('daftarOtp').style.display = step === 'otp' ? 'block' : 'none';
  $('daftarSukses').style.display = step === 'sukses' ? 'block' : 'none';
  const header = step === 'form' ? '' : 'none';
  $('daftarTitle').style.display = header;
  $('daftarSub').style.display = header;
  if (step === 'otp') {
    $('otpEmailText').textContent = otpEmail;
    $('otpInput').value = '';
    clearMsg($('otpMessage'));
    setTimeout(() => $('otpInput').focus(), 150);
  }
}

function resetDaftar() {
  showStep('form');
  clearMsg($('daftarMessage'));
  $('formDaftar').reset();
  fileInput.value = '';
  dropText.innerHTML = DROP_DEFAULT;
  drop.classList.remove('filled');
  clearInvalid($('formDaftar'));
}

function startCooldown(detik) {
  clearInterval(cooldownTimer);
  const btn = $('btnKirimUlang');
  let sisa = detik;
  const render = () => {
    btn.disabled = sisa > 0;
    btn.textContent = sisa > 0 ? `Kirim ulang kode (${sisa}d)` : 'Kirim ulang kode';
  };
  render();
  cooldownTimer = setInterval(() => { sisa -= 1; render(); if (sisa <= 0) clearInterval(cooldownTimer); }, 1000);
}

async function requestNewOtp(silent = false) {
  try {
    const res = await apiFetch('/auth/kirim-ulang-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail }) });
    startCooldown(res.cooldown || 60);
    if (!silent) showMsg($('otpMessage'), 'Kode baru telah dikirim ke email Anda.', 'success');
    else showMsg($('otpMessage'), 'Email Anda belum diverifikasi. Kode baru telah dikirim.', 'warn');
  } catch (err) {
    if (err.data?.cooldown) startCooldown(err.data.cooldown);
    showMsg($('otpMessage'), err.message, silent ? 'warn' : 'error');
  }
}

$('btnKirimUlang').addEventListener('click', () => requestNewOtp(false));
$('btnGantiEmail').addEventListener('click', () => { clearInterval(cooldownTimer); showStep('form'); });
$('otpInput').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });

$('formOtp').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg($('otpMessage'));
  const kode = $('otpInput').value.trim();
  if (!/^\d{6}$/.test(kode)) return showMsg($('otpMessage'), 'Masukkan kode OTP 6 digit.');

  const btn = $('btnOtp');
  setLoading(btn, true);
  try {
    await apiFetch('/auth/verifikasi-otp', { method: 'POST', body: JSON.stringify({ email: otpEmail, kode }) });
    clearInterval(cooldownTimer);
    showStep('sukses');
  } catch (err) {
    showMsg($('otpMessage'), err.message);
    $('otpInput').select();
  } finally {
    setLoading(btn, false);
  }
});

// Jika sesi masih berlaku, langsung masuk
(async () => {
  if (!localStorage.getItem('token')) return;
  try {
    const me = await apiFetch('/auth/me');
    goHome(me.data, 0);
  } catch (e) { localStorage.removeItem('token'); }
})();
