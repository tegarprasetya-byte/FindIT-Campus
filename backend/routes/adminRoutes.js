const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/authMiddleware');
const verifyRole = require('../middleware/roleMiddleware');

router.use(verifyToken);

// Pengguna biasa: laporkan penyalahgunaan
router.post('/abuse', adminController.createAbuseReport);

// Khusus Admin
router.use(verifyRole(['admin']));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/grafik', adminController.getGrafik);

router.get('/laporan/menunggu', adminController.getLaporanMenunggu);
router.put('/laporan/:id/verifikasi', adminController.verifikasiLaporan);

router.get('/users', adminController.getAllUsers);
router.put('/users/status/:id', adminController.updateUserStatus);
router.put('/users/verifikasi/:id', adminController.verifikasiUser);
router.get('/users/:id/kartu', adminController.getKartuUser);

router.post('/lokasi', adminController.addLokasi);
router.delete('/lokasi/:id', adminController.deleteLokasi);

router.get('/abuse', adminController.getAbuseReports);
router.put('/abuse/status/:id', adminController.updateAbuseStatus);

module.exports = router;
