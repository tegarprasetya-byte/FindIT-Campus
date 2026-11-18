const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');
const { kartuIdentitas } = require('../middleware/uploadMiddleware');

// Pendaftaran: data + kartu -> kode OTP dikirim ke email kampus
router.post('/daftar', kartuIdentitas, authController.daftar);
router.post('/verifikasi-otp', authController.verifikasiOtp);
router.post('/kirim-ulang-otp', authController.kirimUlangOtp);

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.getProfile);
router.post('/logout', verifyToken, authController.logout);

module.exports = router;
