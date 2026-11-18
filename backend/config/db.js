// Konfigurasi koneksi database MySQL menggunakan mysql2/promise
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'findcampus',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

// Tes koneksi database
pool.getConnection()
  .then(connection => {
    console.log('[DB] Terhubung ke MySQL database findcampus.');
    connection.release();
  })
  .catch(err => {
    console.error('[DB Error] Gagal terhubung ke MySQL:', err.message);
  });

module.exports = pool;