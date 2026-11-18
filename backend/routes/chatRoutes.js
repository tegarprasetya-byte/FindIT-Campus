const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifyToken = require('../middleware/authMiddleware');
const { gambarChat } = require('../middleware/uploadMiddleware');

router.get('/riwayat/:id_laporan', verifyToken, chatController.getRiwayatChat); // ?dengan=<id_user lawan>
router.get('/percakapan', verifyToken, chatController.getDaftarPercakapan);

router.post('/gambar', verifyToken, gambarChat, chatController.uploadGambar);

module.exports = router;
