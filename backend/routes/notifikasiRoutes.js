const express = require('express');
const router = express.Router();
const notifikasiController = require('../controllers/notifikasiController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, notifikasiController.getNotifikasiSaya);
router.put('/read-all', verifyToken, notifikasiController.markAllAsRead);
router.put('/read/:id', verifyToken, notifikasiController.markAsRead);

module.exports = router;
