const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');

/**
 * GET /api/master/kategori
 */
router.get('/kategori', masterController.getKategori);

/**
 * GET /api/master/lokasi
 */
router.get('/lokasi', masterController.getLokasi);

module.exports = router;