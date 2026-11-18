// Jalankan: npm run setup  -> membuat ulang database `findcampus` dari findcampus.sql
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });
  await conn.query(fs.readFileSync(path.join(__dirname, 'findcampus.sql'), 'utf8'));
  console.log('Database findcampus berhasil dibuat ulang.');
  await conn.end();
})().catch((e) => { console.error('Gagal setup database:', e.message); process.exit(1); });
