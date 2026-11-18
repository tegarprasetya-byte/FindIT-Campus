const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const masterRoutes = require('./routes/masterRoutes');
const laporanRoutes = require('./routes/laporanRoutes');
const klaimRoutes = require('./routes/klaimRoutes');
const notifikasiRoutes = require('./routes/notifikasiRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatSocket = require('./sockets/chatSocket');
const initCronArchiver = require('./utils/cronArchiver');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Hanya foto barang yang publik. Kartu identitas & bukti klaim ada di folder /private (tidak di-serve statis).
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/klaim', klaimRoutes);
app.use('/api/notifikasi', notifikasiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

chatSocket(io);
initCronArchiver();

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint API tidak ditemukan.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Penanganan error terakhir (JSON rusak, dsb.)
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({ success: false, message: err.status === 400 ? 'Permintaan tidak valid.' : 'Terjadi kesalahan pada server.' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('================================================');
  console.log(` Server FindCampus Berjalan di Port ${PORT}`);
  console.log(` URL Server : http://localhost:${PORT}`);
  console.log('================================================');
});
