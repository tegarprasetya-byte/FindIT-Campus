const db = require('../config/db');

exports.getKategori = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM kategori ORDER BY id_kategori ASC');
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Master Error] Get Kategori:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data kategori.' });
  }
};

exports.getLokasi = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM lokasi ORDER BY nama_lokasi ASC');
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[Master Error] Get Lokasi:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data lokasi.' });
  }
};
