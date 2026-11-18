const express = require('express');
const router = express.Router();
const laporanController = require('../controllers/laporanController');
const verifyToken = require('../middleware/authMiddleware');
const { fotoBarang } = require('../middleware/uploadMiddleware');

// Semua endpoint laporan memerlukan login (civitas kampus)
router.use(verifyToken);

router.get('/publik', laporanController.getLaporanPublik);
router.get('/statistik', laporanController.getStatistik);
router.get('/saran', laporanController.getSaranMirip);
router.get('/riwayat-saya', laporanController.getRiwayatSaya);
router.get('/detail/:id', laporanController.getLaporanDetail);

router.post('/create', fotoBarang, laporanController.createLaporan);
router.put('/update/:id', laporanController.updateLaporan);
router.put('/ditemukan/:id', laporanController.tandaiDitemukan);
router.delete('/cancel/:id', laporanController.cancelLaporan);

module.exports = router;
