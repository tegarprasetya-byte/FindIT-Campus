const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (process.env.MAIL_MODE === 'json') {
    transporter = nodemailer.createTransport({ jsonTransport: true }); // untuk pengujian
  } else if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  } else {
    transporter = null;
  }
  return transporter;
}

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Kirim kode OTP pendaftaran. Tanpa SMTP (mode pengembangan) kode dicetak di terminal server.
exports.sendOtp = async (to, nama, kode) => {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV === 'production') throw new Error('SMTP belum dikonfigurasi.');
    console.log(`[OTP][DEV] SMTP belum diatur. Kode OTP untuk ${to}: ${kode}`);
    return { dev: true };
  }

  const from = process.env.EMAIL_FROM || '"FindIT Campus" <no-reply@findcampus.local>';
  await t.sendMail({
    from,
    to,
    subject: `Kode verifikasi FindIT Campus: ${kode}`,
    text: `Halo ${nama},\n\nKode verifikasi FindIT Campus Anda: ${kode}\nKode berlaku 10 menit. Jangan berikan kode ini kepada siapa pun.\n\nJika Anda tidak mendaftar, abaikan email ini.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#013056;color:#fff;padding:20px 24px;font-size:20px;font-weight:bold;font-family:Georgia,serif">FindIT Campus</div>
      <div style="padding:24px;color:#1e293b">
        <p>Halo <b>${escapeHtml(nama)}</b>,</p>
        <p>Gunakan kode berikut untuk memverifikasi email kampus Anda:</p>
        <div style="font-size:34px;font-weight:bold;letter-spacing:10px;text-align:center;background:#F2F7FD;border-radius:12px;padding:16px;color:#013056">${kode}</div>
        <p style="font-size:13px;color:#64748b">Kode berlaku <b>10 menit</b>. Jangan berikan kode ini kepada siapa pun.<br>Jika Anda tidak mendaftar, abaikan email ini.</p>
      </div></div>`
  });
  return { dev: false };
};
