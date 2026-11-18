-- ============================================================
-- DATABASE: findcampus
-- Sistem Lost and Found Universitas Lampung (FindIT Campus)
-- Import ulang file ini (akan menghapus database lama bernama findcampus)
-- ============================================================

DROP DATABASE IF EXISTS `findcampus`;
CREATE DATABASE `findcampus` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `findcampus`;

-- ------------------------------------------------------------
-- 1. user  (Mahasiswa, Dosen/Tenaga Pendidik, Admin)
-- ------------------------------------------------------------
CREATE TABLE `user` (
  `id_user` INT AUTO_INCREMENT PRIMARY KEY,
  `nama` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('mahasiswa', 'dosen', 'admin') NOT NULL DEFAULT 'mahasiswa',
  `no_hp` VARCHAR(20) DEFAULT NULL,
  `kartu_identitas` VARCHAR(255) DEFAULT NULL,
  `email_terverifikasi` TINYINT(1) NOT NULL DEFAULT 0,
  `otp_hash` VARCHAR(64) DEFAULT NULL,
  `otp_expires` DATETIME DEFAULT NULL,
  `otp_percobaan` TINYINT NOT NULL DEFAULT 0,
  `otp_dikirim` DATETIME DEFAULT NULL,
  `status_verifikasi` ENUM('menunggu', 'terverifikasi', 'ditolak') NOT NULL DEFAULT 'menunggu',
  `status_akun` ENUM('aktif', 'nonaktif') NOT NULL DEFAULT 'aktif',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. kategori & lokasi (master data)
-- ------------------------------------------------------------
CREATE TABLE `kategori` (
  `id_kategori` INT AUTO_INCREMENT PRIMARY KEY,
  `nama_kategori` VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE `lokasi` (
  `id_lokasi` INT AUTO_INCREMENT PRIMARY KEY,
  `nama_lokasi` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. laporan  (barang hilang / ditemukan)
--    foto = nama file, jika lebih dari satu dipisah koma (maks 3)
-- ------------------------------------------------------------
CREATE TABLE `laporan` (
  `id_laporan` INT AUTO_INCREMENT PRIMARY KEY,
  `id_user` INT NOT NULL,
  `id_kategori` INT NOT NULL,
  `id_lokasi` INT NOT NULL,
  `jenis_laporan` ENUM('Hilang', 'Ditemukan') NOT NULL,
  `nama_barang` VARCHAR(150) NOT NULL,
  `detail_lokasi` VARCHAR(255) DEFAULT NULL,
  `deskripsi` TEXT NOT NULL,
  `foto` VARCHAR(600) DEFAULT NULL,
  `waktu` DATETIME NOT NULL,
  `status` ENUM('menunggu_verifikasi', 'dipublikasikan', 'proses_klaim', 'dikembalikan', 'ditolak', 'diarsipkan') NOT NULL DEFAULT 'menunggu_verifikasi',
  `alasan_tolak` TEXT DEFAULT NULL,
  `tanggal_laporan` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tanggal_publikasi` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_laporan_user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_laporan_kategori` FOREIGN KEY (`id_kategori`) REFERENCES `kategori` (`id_kategori`),
  CONSTRAINT `fk_laporan_lokasi` FOREIGN KEY (`id_lokasi`) REFERENCES `lokasi` (`id_lokasi`),
  INDEX `idx_jenis_status` (`jenis_laporan`, `status`),
  INDEX `idx_tgl_publikasi` (`tanggal_publikasi`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. verifikasi  (log verifikasi laporan oleh Admin)
-- ------------------------------------------------------------
CREATE TABLE `verifikasi` (
  `id_verifikasi` INT AUTO_INCREMENT PRIMARY KEY,
  `id_laporan` INT NOT NULL,
  `id_admin` INT DEFAULT NULL,
  `status_verifikasi` ENUM('disetujui', 'ditolak') NOT NULL,
  `catatan` TEXT DEFAULT NULL,
  `tanggal_verifikasi` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_verif_laporan` FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`) ON DELETE CASCADE,
  CONSTRAINT `fk_verif_admin` FOREIGN KEY (`id_admin`) REFERENCES `user` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. klaim  (pengajuan klaim kepemilikan barang temuan)
--    foto_bukti = nama file, jika lebih dari satu dipisah koma
-- ------------------------------------------------------------
CREATE TABLE `klaim` (
  `id_klaim` INT AUTO_INCREMENT PRIMARY KEY,
  `id_laporan` INT NOT NULL,
  `id_user` INT NOT NULL,
  `bukti_kepemilikan` TEXT NOT NULL,
  `foto_bukti` VARCHAR(600) DEFAULT NULL,
  `status_klaim` ENUM('menunggu', 'diterima', 'ditolak') NOT NULL DEFAULT 'menunggu',
  `alasan_penolakan` TEXT DEFAULT NULL,
  `id_admin` INT DEFAULT NULL,
  `tanggal_klaim` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `verified_at` DATETIME DEFAULT NULL,
  CONSTRAINT `fk_klaim_laporan` FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`) ON DELETE CASCADE,
  CONSTRAINT `fk_klaim_user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_klaim_admin` FOREIGN KEY (`id_admin`) REFERENCES `user` (`id_user`) ON DELETE SET NULL,
  INDEX `idx_klaim_laporan_user` (`id_laporan`, `id_user`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. notifikasi
-- ------------------------------------------------------------
CREATE TABLE `notifikasi` (
  `id_notifikasi` INT AUTO_INCREMENT PRIMARY KEY,
  `id_user` INT NOT NULL,
  `judul` VARCHAR(150) NOT NULL,
  `pesan` TEXT NOT NULL,
  `id_laporan` INT DEFAULT NULL,
  `status_baca` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`id_user`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_notif_laporan` FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`) ON DELETE SET NULL,
  INDEX `idx_notif_user` (`id_user`, `status_baca`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. chat  (pesan real-time antar pengguna per laporan)
-- ------------------------------------------------------------
CREATE TABLE `chat` (
  `id_chat` INT AUTO_INCREMENT PRIMARY KEY,
  `id_laporan` INT NOT NULL,
  `id_pengirim` INT NOT NULL,
  `id_penerima` INT NOT NULL,
  `pesan` TEXT NOT NULL,
  `gambar` VARCHAR(255) DEFAULT NULL,
  `status_baca` TINYINT(1) NOT NULL DEFAULT 0,
  `tanggal_kirim` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_chat_laporan` FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_pengirim` FOREIGN KEY (`id_pengirim`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_penerima` FOREIGN KEY (`id_penerima`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  INDEX `idx_chat_laporan` (`id_laporan`),
  INDEX `idx_chat_pasangan` (`id_pengirim`, `id_penerima`)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. laporan_abuse  (pelaporan penyalahgunaan)
-- ------------------------------------------------------------
CREATE TABLE `laporan_abuse` (
  `id_abuse` INT AUTO_INCREMENT PRIMARY KEY,
  `id_pelapor` INT NOT NULL,
  `id_laporan` INT DEFAULT NULL,
  `id_terlapor` INT DEFAULT NULL,
  `alasan` TEXT NOT NULL,
  `status` ENUM('baru', 'ditinjau', 'selesai') NOT NULL DEFAULT 'baru',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_abuse_pelapor` FOREIGN KEY (`id_pelapor`) REFERENCES `user` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_abuse_laporan` FOREIGN KEY (`id_laporan`) REFERENCES `laporan` (`id_laporan`) ON DELETE CASCADE,
  CONSTRAINT `fk_abuse_terlapor` FOREIGN KEY (`id_terlapor`) REFERENCES `user` (`id_user`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- VIEW dashboard admin
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW `v_dashboard` AS
SELECT
  (SELECT COUNT(*) FROM `laporan` WHERE `jenis_laporan` = 'Hilang') AS total_hilang,
  (SELECT COUNT(*) FROM `laporan` WHERE `jenis_laporan` = 'Ditemukan') AS total_temuan,
  (SELECT COUNT(*) FROM `laporan`) AS total_laporan,
  (SELECT COUNT(*) FROM `klaim`) AS total_klaim,
  (SELECT COUNT(*) FROM `klaim` WHERE `status_klaim` = 'menunggu') AS total_klaim_menunggu,
  (SELECT COUNT(*) FROM `laporan` WHERE `status` = 'dikembalikan') AS total_dikembalikan,
  (SELECT COUNT(*) FROM `laporan` WHERE `status` IN ('dipublikasikan', 'proses_klaim')) AS total_laporan_aktif,
  (SELECT COUNT(*) FROM `laporan` WHERE `status` = 'diarsipkan') AS total_diarsipkan,
  (SELECT COUNT(*) FROM `laporan` WHERE `status` = 'menunggu_verifikasi') AS total_menunggu_verifikasi,
  (SELECT COUNT(*) FROM `user` WHERE `role` <> 'admin') AS total_pengguna,
  (SELECT COUNT(*) FROM `laporan_abuse` WHERE `status` = 'baru') AS total_abuse_baru;

-- ------------------------------------------------------------
-- SEED DATA
-- ------------------------------------------------------------
INSERT INTO `kategori` (`nama_kategori`) VALUES
('Elektronik'), ('Dokumen/Kartu Identitas'), ('Buku/Alat Tulis'), ('Pakaian'),
('Aksesori'), ('Perlengkapan Kuliah'), ('Kunci'), ('Tas/Dompet'), ('Lainnya');

INSERT INTO `lokasi` (`nama_lokasi`) VALUES
('Fakultas Teknik (FT)'),
('Fakultas Matematika dan IPA (FMIPA)'),
('Fakultas Pertanian (FP)'),
('Fakultas Kedokteran (FK)'),
('Fakultas Hukum (FH)'),
('Fakultas Ekonomi dan Bisnis (FEB)'),
('Fakultas Ilmu Sosial dan Ilmu Politik (FISIP)'),
('Fakultas Keguruan dan Ilmu Pendidikan (FKIP)'),
('Perpustakaan Pusat Unila'),
('Gedung Rektorat Unila'),
('GSG (Gedung Serba Guna) Unila'),
('Embung Unila'),
('Kantin Pusat / Student Center'),
('Masjid Al-Wasii Unila');

-- Akun admin: admin@unila.ac.id / AdminFindCampus2026!
INSERT INTO `user` (`nama`, `email`, `password`, `role`, `email_terverifikasi`, `status_verifikasi`, `status_akun`) VALUES
('Administrator FindCampus', 'admin@unila.ac.id', '$2b$10$N49uJtXGvjZg6E/ty01hOezCnyVuUc/Abo5eqPVDiRv.0/xHI5Vnu', 'admin', 1, 'terverifikasi', 'aktif');
