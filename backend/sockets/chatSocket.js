const jwt = require('jsonwebtoken');
const db = require('../config/db');

const parseCookie = (header = '') =>
  Object.fromEntries(header.split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((p) => p[0]));

module.exports = (io) => {
  // Autentikasi socket: identitas pengirim diambil dari token, bukan dari data kiriman klien
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || parseCookie(socket.handshake.headers.cookie).token;
      if (!token) return next(new Error('Tidak terautentikasi'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_findcampus_unila_2026');
      const [rows] = await db.query('SELECT id_user, nama, role, status_akun, status_verifikasi FROM user WHERE id_user = ?', [decoded.id_user]);
      if (rows.length === 0 || rows[0].status_akun === 'nonaktif') return next(new Error('Akun tidak aktif'));
      if (rows[0].role !== 'admin' && rows[0].status_verifikasi !== 'terverifikasi') return next(new Error('Akun belum diverifikasi'));
      socket.user = rows[0];
      next();
    } catch (err) {
      next(new Error('Token tidak valid'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.user.id_user;
    socket.join(`user_${me}`);

    // Indikator "sedang mengetik" (tidak disimpan, hanya diteruskan ke lawan bicara)
    let lastTyping = 0;
    socket.on('typing', (data) => {
      const to = parseInt(data?.id_penerima);
      const lap = parseInt(data?.id_laporan);
      if (!to || !lap || to === me || Date.now() - lastTyping < 1000) return;
      lastTyping = Date.now();
      io.to(`user_${to}`).emit('typing', { id_laporan: lap, dari: me });
    });

    socket.on('send_message', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const id_laporan = parseInt(data?.id_laporan);
      const id_penerima = parseInt(data?.id_penerima);
      const pesan = (data?.pesan || '').toString().trim().slice(0, 1000);
      const gambar = /^[\w.-]+\.(jpe?g|png|webp|gif)$/i.test(data?.gambar || '') ? data.gambar : null;

      if (!id_laporan || !id_penerima || (!pesan && !gambar)) return reply({ success: false, message: 'Data pesan tidak lengkap.' });
      if (id_penerima === me) return reply({ success: false, message: 'Tidak bisa mengirim pesan ke diri sendiri.' });

      try {
        const [lap] = await db.query('SELECT id_user, nama_barang FROM laporan WHERE id_laporan = ?', [id_laporan]);
        if (lap.length === 0) return reply({ success: false, message: 'Laporan tidak ditemukan.' });

        // Percakapan selalu melibatkan pelapor
        if (lap[0].id_user !== me && lap[0].id_user !== id_penerima) {
          return reply({ success: false, message: 'Percakapan harus dengan pelapor barang.' });
        }
        const [pen] = await db.query("SELECT id_user FROM user WHERE id_user = ? AND status_akun = 'aktif'", [id_penerima]);
        if (pen.length === 0) return reply({ success: false, message: 'Penerima tidak ditemukan.' });

        const [result] = await db.query(
          'INSERT INTO chat (id_laporan, id_pengirim, id_penerima, pesan, gambar) VALUES (?, ?, ?, ?, ?)',
          [id_laporan, me, id_penerima, pesan, gambar]
        );
        const [rows] = await db.query(
          `SELECT c.id_chat, c.id_laporan, c.id_pengirim, c.id_penerima, c.pesan, c.gambar, c.tanggal_kirim AS created_at, u.nama AS nama_pengirim
           FROM chat c JOIN user u ON c.id_pengirim = u.id_user WHERE c.id_chat = ?`,
          [result.insertId]
        );

        io.to(`user_${me}`).to(`user_${id_penerima}`).emit('receive_message', rows[0]);

        // Satu notifikasi "pesan baru" per laporan selama belum dibaca (hindari spam)
        const judul = 'Pesan baru';
        const [ada] = await db.query(
          'SELECT id_notifikasi FROM notifikasi WHERE id_user = ? AND id_laporan = ? AND judul = ? AND status_baca = 0 LIMIT 1',
          [id_penerima, id_laporan, judul]
        );
        if (ada.length === 0) {
          await db.query(
            'INSERT INTO notifikasi (id_user, judul, pesan, id_laporan) VALUES (?, ?, ?, ?)',
            [id_penerima, judul, `${socket.user.nama} mengirim pesan tentang "${lap[0].nama_barang}".`, id_laporan]
          );
        }
        io.to(`user_${id_penerima}`).emit('notif_baru');

        reply({ success: true });
      } catch (error) {
        console.error('[Socket Error] Send Message:', error.message);
        reply({ success: false, message: 'Gagal mengirim pesan.' });
      }
    });
  });
};
