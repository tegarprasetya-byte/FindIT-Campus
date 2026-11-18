require('dotenv').config();

// Email harus berakhiran domain resmi Unila (diatur di .env -> ALLOWED_EMAIL_DOMAINS)
const DEFAULT_DOMAINS = ['@unila.ac.id', '@students.unila.ac.id', '@staff.unila.ac.id', '@mail.unila.ac.id', '@pasca.unila.ac.id'];

const isValidUnilaEmail = (email) => {
  if (!email || typeof email !== 'string') return false;

  const extra = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const allowedDomains = [...new Set([...DEFAULT_DOMAINS, ...extra])];

  const emailLower = email.trim().toLowerCase();
  return allowedDomains.some((domain) => emailLower.endsWith(domain));
};

// Ubah "2026-11-04T10:30" (datetime-local) menjadi format DATETIME MySQL; null jika tidak valid
const toMysqlDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const str = String(value).replace('T', ' ');
  // Pakai string asli bila sudah berformat lengkap (menghindari pergeseran zona waktu)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?/.test(str)) {
    return str.length === 16 ? `${str}:00` : str.slice(0, 19);
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

module.exports = { isValidUnilaEmail, toMysqlDateTime };
