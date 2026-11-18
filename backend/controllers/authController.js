const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { isValidUnilaEmail } = require('../utils/validators');
const { removeFiles } = require('../middleware/uploadMiddleware');
const { notifyAdmins } = require('../utils/notify');
const { sendOtp } = require('../utils/mailer');
require('dotenv').config();

const ROLE_LABEL = { mahasiswa: 'Mahasiswa', dosen: 'Dosen / Tenaga Pendidik', admin: 'Admin' };
const OTP_TTL_MENIT = 10;
const OTP_COOLDOWN_DETIK = 60;
const OTP_MAKS_PERCOBAAN = 5;
const SECRET = () => process.env.JWT_SECRET || 'super_secret_key_findcampus_unila_2026';

const signToken = (user) => {
  const payload = { id_user: user.id_user, nama: user.nama, email: user.email, tipe: user.role };
  const token = jwt.sign(payload, SECRET(), { expiresIn: '1d' });
  return { token, payload: { ...payload, status_verifikasi: user.status_verifikasi } };
};

const setCookie = (res, token) => {
  res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
};

// Cocokkan password. Mendukung hash bcrypt dan password teks biasa lama (otomatis di-upgrade ke bcrypt).
const checkPassword = async (user, password) => {
  const stored = user.password || '';
  if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
  if (stored === password) {
    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE user SET password = ? WHERE id_user = ?', [hash, user.id_user]);
    return true;
  }
  return false;
};

// ---------- OTP ----------
const hashOtp = (email, kode) => crypto.createHash('sha256').update(`${kode}:${email}:${SECRET()}`).digest('hex');

// Buat kode baru, simpan hash-nya, lalu kirim lewat email
const terbitkanOtp = async (user) => {
  const kode = String(crypto.randomInt(100000, 1000000));
  await db.query(
    `UPDATE user SET otp_hash = ?, otp_expires = NOW() + INTERVAL ${OTP_TTL_MENIT} MINUTE, otp_percobaan = 0, otp_dikirim = NOW() WHERE id_user = ?`,
    [hashOtp(user.email, kode), user.id_user]
  );
  await sendOtp(user.email, user.nama, kode);
};

// ---------- POST /api/auth/daftar (multipart) ----------
exports.daftar = async (req, res) => {
  const files = req.file ? [req.file] : [];
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const nama = (req.body.nama || '').trim();
  const tipe = req.body.tipe;
  const gagal = (status, message) => { removeFiles(files, 'kartu'); return res.status(status).json({ success: false, message }); };

  if (!nama || nama.length < 3) return gagal(400, 'Nama Lengkap wajib diisi (minimal 3 karakter).');
  if (!email) return gagal(400, 'Email wajib diisi.');
  if (!isValidUnilaEmail(email)) return gagal(400, 'Gunakan email kampus Unila (mahasiswa: npm@students.unila.ac.id, dosen/tendik: user@staff.unila.ac.id).');
  if (password.length < 6) return gagal(400, 'Password minimal 6 karakter.');
  if (!['mahasiswa', 'dosen'].includes(tipe)) return gagal(400, 'Pilih peran Anda (Mahasiswa atau Dosen / Tenaga Pendidik).');
  if (!req.file) return gagal(400, 'Unggah foto Kartu Tanda Mahasiswa (KTM) atau Kartu Tanda Identitas Dosen.');

  try {
    const [ada] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
    const hash = await bcrypt.hash(password, 10);
    let user;

    if (ada.length > 0) {
      // Email yang sudah terverifikasi tidak bisa didaftarkan ulang.
      // Pendaftaran yang belum diverifikasi OTP boleh ditimpa (salah ketik / bukan pemilik email).
      if (ada[0].email_terverifikasi || ada[0].role === 'admin') {
        return gagal(409, 'Email sudah terdaftar. Silakan masuk dengan email dan password Anda.');
      }
      await db.query(
        "UPDATE user SET nama = ?, password = ?, role = ?, kartu_identitas = ?, status_verifikasi = 'menunggu' WHERE id_user = ?",
        [nama, hash, tipe, req.file.filename, ada[0].id_user]
      );
      removeFiles([ada[0].kartu_identitas], 'kartu');
      user = { id_user: ada[0].id_user, nama, email };
    } else {
      const [result] = await db.query(
        `INSERT INTO user (nama, email, password, role, kartu_identitas, email_terverifikasi, status_verifikasi, status_akun)
         VALUES (?, ?, ?, ?, ?, 0, 'menunggu', 'aktif')`,
        [nama, email, hash, tipe, req.file.filename]
      );
      user = { id_user: result.insertId, nama, email };
    }

    try {
      await terbitkanOtp(user);
    } catch (mailErr) {
      console.error('[Auth Error] Kirim OTP:', mailErr.message);
      return res.status(502).json({ success: false, message: 'Gagal mengirim kode OTP ke email. Periksa alamat email Anda lalu coba lagi.' });
    }

    return res.status(201).json({
      success: true,
      need_otp: true,
      email,
      cooldown: OTP_COOLDOWN_DETIK,
      message: `Kode OTP 6 digit telah dikirim ke ${email}.`
    });
  } catch (error) {
    removeFiles(files, 'kartu');
    console.error('[Auth Error] Daftar:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mendaftar.' });
  }
};

// ---------- POST /api/auth/verifikasi-otp ----------
exports.verifikasiOtp = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const kode = String(req.body.kode || '').trim();

  if (!/^\d{6}$/.test(kode)) return res.status(400).json({ success: false, message: 'Masukkan kode OTP 6 digit.' });

  try {
    const [rows] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
    const u = rows[0];
    if (!u || u.email_terverifikasi || !u.otp_hash) {
      return res.status(400).json({ success: false, message: 'Kode tidak valid. Silakan kirim ulang kode.' });
    }
    if (u.otp_percobaan >= OTP_MAKS_PERCOBAAN) {
      return res.status(429).json({ success: false, code: 'OTP_HABIS', message: 'Terlalu banyak percobaan salah. Silakan kirim ulang kode baru.' });
    }
    const [[kedaluwarsa]] = await db.query('SELECT (otp_expires < NOW()) AS habis FROM user WHERE id_user = ?', [u.id_user]);
    if (kedaluwarsa.habis) {
      return res.status(400).json({ success: false, code: 'OTP_KEDALUWARSA', message: 'Kode sudah kedaluwarsa. Silakan kirim ulang kode baru.' });
    }

    const benar = crypto.timingSafeEqual(Buffer.from(hashOtp(email, kode)), Buffer.from(u.otp_hash));
    if (!benar) {
      await db.query('UPDATE user SET otp_percobaan = otp_percobaan + 1 WHERE id_user = ?', [u.id_user]);
      const sisa = OTP_MAKS_PERCOBAAN - (u.otp_percobaan + 1);
      return res.status(400).json({ success: false, message: sisa > 0 ? `Kode salah. Sisa percobaan: ${sisa}.` : 'Kode salah. Silakan kirim ulang kode baru.' });
    }

    await db.query('UPDATE user SET email_terverifikasi = 1, otp_hash = NULL, otp_expires = NULL, otp_percobaan = 0 WHERE id_user = ?', [u.id_user]);
    notifyAdmins('Pengguna baru mendaftar', `${u.nama} (${ROLE_LABEL[u.role]}) menunggu verifikasi kartu identitas.`).catch(() => {});

    return res.status(200).json({
      success: true,
      menunggu_verifikasi: true,
      message: 'Email berhasil diverifikasi. Akun Anda menunggu verifikasi Admin. Admin akan memverifikasi secepatnya.'
    });
  } catch (error) {
    console.error('[Auth Error] Verifikasi OTP:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// ---------- POST /api/auth/kirim-ulang-otp ----------
exports.kirimUlangOtp = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const generik = { success: true, cooldown: OTP_COOLDOWN_DETIK, message: 'Jika email terdaftar, kode OTP baru telah dikirim.' };

  try {
    const [rows] = await db.query('SELECT *, TIMESTAMPDIFF(SECOND, otp_dikirim, NOW()) AS detik FROM user WHERE email = ?', [email]);
    const u = rows[0];
    // Respons seragam agar tidak bisa dipakai menebak email yang terdaftar
    if (!u || u.email_terverifikasi || u.role === 'admin') return res.status(200).json(generik);

    if (u.otp_dikirim && u.detik !== null && u.detik < OTP_COOLDOWN_DETIK) {
      const sisa = OTP_COOLDOWN_DETIK - u.detik;
      return res.status(429).json({ success: false, cooldown: sisa, message: `Tunggu ${sisa} detik sebelum meminta kode baru.` });
    }

    try {
      await terbitkanOtp(u);
    } catch (mailErr) {
      console.error('[Auth Error] Kirim ulang OTP:', mailErr.message);
      return res.status(502).json({ success: false, message: 'Gagal mengirim kode OTP. Coba lagi beberapa saat.' });
    }
    return res.status(200).json(generik);
  } catch (error) {
    console.error('[Auth Error] Kirim ulang OTP:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
};

// ---------- POST /api/auth/login (JSON) ----------
exports.login = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });

  try {
    const [users] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
    const user = users[0];
    if (!user || !(await checkPassword(user, password))) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.' });
    }

    // Login lewat popup Admin: hanya akun berperan admin
    if (req.body.sebagai === 'admin' && user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Akun ini bukan akun Admin. Gunakan menu Masuk biasa.' });
    }
    if (user.status_akun === 'nonaktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan oleh Admin.' });
    }

    if (user.role !== 'admin') {
      if (!user.email_terverifikasi) {
        return res.status(403).json({ success: false, code: 'EMAIL_BELUM_VERIFIKASI', email: user.email, message: 'Email Anda belum diverifikasi. Masukkan kode OTP yang dikirim ke email kampus Anda.' });
      }
      if (user.status_verifikasi === 'ditolak') {
        return res.status(403).json({ success: false, code: 'DITOLAK', message: 'Verifikasi kartu identitas Anda ditolak oleh Admin. Silakan hubungi Admin kampus.' });
      }
      if (user.status_verifikasi !== 'terverifikasi') {
        return res.status(403).json({ success: false, code: 'MENUNGGU_VERIFIKASI', message: 'Akun Anda masih menunggu verifikasi Admin. Admin akan memverifikasi secepatnya, silakan coba masuk lagi nanti.' });
      }
    }

    const { token, payload } = signToken(user);
    setCookie(res, token);
    return res.status(200).json({ success: true, message: 'Login berhasil.', token, user: payload });
  } catch (error) {
    console.error('[Auth Error] Login:', error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id_user, nama, email, role AS tipe, no_hp, status_verifikasi, status_akun FROM user WHERE id_user = ?',
      [req.user.id_user]
    );
    if (users.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    return res.status(200).json({ success: true, data: users[0] });
  } catch (error) {
    console.error('[Auth Error] Profil:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data profil.' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({ success: true, message: 'Berhasil logout.' });
};
