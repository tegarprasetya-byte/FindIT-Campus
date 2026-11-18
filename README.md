# FindIT Campus - Lost & Found Universitas Lampung

Web Lost & Found kampus: lapor barang hilang/temuan, verifikasi Admin, klaim kepemilikan, chat real-time, notifikasi, arsip otomatis 3 bulan.

**Stack:** HTML/CSS/JS, Node.js + Express, MySQL (`mysql2`), Socket.IO, JWT + bcrypt, Multer, node-cron.

## Cara menjalankan (Laragon)
1. Start **MySQL** di Laragon.
2. Buat database: `npm run setup` (menghapus & membuat ulang DB `findcampus`) atau import `database/findcampus.sql`.
   Sudah punya data dan hanya ingin menambah fitur OTP? Jalankan `database/migrasi_otp.sql` saja.
3. `npm install`
4. Salin `.env.example` menjadi `.env` lalu isi pengaturan (lihat bagian OTP di bawah).
5. `npm start` lalu buka http://localhost:3000

## Kode OTP email kampus
Pendaftaran memakai kode OTP 6 digit yang dikirim ke email kampus (`@students.unila.ac.id` untuk mahasiswa, `@staff.unila.ac.id` untuk dosen/tendik), sehingga satu email kampus = satu pemilik akun.
- Kode berlaku 10 menit, maksimal 5 kali salah, kirim ulang setiap 60 detik.
- Pengirim memakai SMTP. Contoh Gmail: aktifkan *Verifikasi 2 Langkah* di akun Google, buat **App Password**, lalu isi di `.env`:
  ```
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=emailkamu@gmail.com
  SMTP_PASS=app_password_16_huruf
  EMAIL_FROM="FindIT Campus" <emailkamu@gmail.com>
  ```
- Bila `SMTP_USER`/`SMTP_PASS` dikosongkan, kode OTP **dicetak di terminal server** (mode pengembangan) sehingga bisa dites tanpa email.

## Akun admin bawaan
`admin@unila.ac.id` / `AdminFindCampus2026!`  (masuk lewat form MASUK, tab mana pun)

## Alur login
- **MASUK** (halaman utama): cukup Email + Password.
- **Daftar Akun** (popup): pilih peran, isi Nama Lengkap, Email kampus, Password (min. 6 karakter), unggah foto kartu identitas, lalu masukkan **kode OTP** yang dikirim ke email. Setelah mendaftar akun **belum bisa dipakai masuk** sampai Admin memverifikasi kartu identitas di menu *Kelola Pengguna* (Verifikasi kartu). Akun yang ditolak juga tidak bisa masuk.
- **Masuk sebagai Admin** (popup): khusus akun Admin. Akun bawaan: `admin@unila.ac.id` / `AdminFindCampus2026!`.
- Kartu identitas & bukti klaim disimpan di folder `private/` (tidak bisa diakses publik, hanya lewat Admin).

## Alur sistem
Pengguna buat laporan -> Admin setujui/tolak -> tampil di Beranda -> (barang temuan) pengguna lain ajukan klaim + bukti -> Admin terima/tolak -> status *dikembalikan*. Notifikasi (ikon lonceng) dikirim di tiap langkah. Chat real-time dengan pelapor dari halaman detail.

## Gambar hero (opsional)
Hero beranda memakai ilustrasi kampus bawaan. Untuk memakai foto sendiri (misalnya foto kampus Unila), simpan file dengan nama `hero.jpg` (atau `hero.png` / `hero.webp`) di folder `frontend/img/`. Foto otomatis menggantikan ilustrasi dan memudar halus ke sisi kiri.
