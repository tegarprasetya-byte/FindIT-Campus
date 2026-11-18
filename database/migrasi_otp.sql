-- Migrasi OTP (tanpa menghapus data). Jalankan di database `findcampus` yang SUDAH ada.
-- Akun yang sudah ada dianggap emailnya terverifikasi.
USE `findcampus`;
ALTER TABLE `user`
  ADD COLUMN `email_terverifikasi` TINYINT(1) NOT NULL DEFAULT 0 AFTER `kartu_identitas`,
  ADD COLUMN `otp_hash` VARCHAR(64) DEFAULT NULL AFTER `email_terverifikasi`,
  ADD COLUMN `otp_expires` DATETIME DEFAULT NULL AFTER `otp_hash`,
  ADD COLUMN `otp_percobaan` TINYINT NOT NULL DEFAULT 0 AFTER `otp_expires`,
  ADD COLUMN `otp_dikirim` DATETIME DEFAULT NULL AFTER `otp_percobaan`;
UPDATE `user` SET `email_terverifikasi` = 1;
