const express = require('express');
const router = express.Router();
const klaimController = require('../controllers/klaimController');
const verifyToken = require('../middleware/authMiddleware');
const verifyRole = require('../middleware/roleMiddleware');
const { buktiKlaim } = require('../middleware/uploadMiddleware');

router.use(verifyToken);

// Pengguna
router.post('/create', buktiKlaim, klaimController.createKlaim);
router.get('/bukti/:file', klaimController.getBukti);

// Admin
router.get('/admin/list', verifyRole(['admin']), klaimController.getDaftarKlaimAdmin);
router.put('/verifikasi-klaim/:id', verifyRole(['admin']), klaimController.verifikasiKlaim);

module.exports = router;
