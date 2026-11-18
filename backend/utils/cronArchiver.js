const cron = require('node-cron');
const db = require('../config/db');

const arsipkanLaporanLama = async () => {
  const [result] = await db.query(
    `UPDATE laporan
     SET status = 'diarsipkan'
     WHERE status = 'dipublikasikan'
       AND tanggal_publikasi IS NOT NULL
       AND tanggal_publikasi <= (NOW() - INTERVAL 3 MONTH)`
  );
  return result.affectedRows;
};

const initCronArchiver = () => {
  // Setiap hari pukul 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      const total = await arsipkanLaporanLama();
      console.log(`[Cron] Pengarsipan selesai. Laporan diarsipkan: ${total}`);
    } catch (error) {
      console.error('[Cron Error] Pengarsipan laporan gagal:', error.message);
    }
  });
};

module.exports = initCronArchiver;
module.exports.arsipkanLaporanLama = arsipkanLaporanLama;
