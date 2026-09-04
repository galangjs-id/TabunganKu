# Tabungaja

Aplikasi pencatatan keuangan (pemasukan & pengeluaran) berbasis web — single-page app, installable sebagai PWA, dengan sistem akun ringan buat sinkronisasi data lintas device.

## Fitur

**Pencatatan transaksi**
- Catat pemasukan & pengeluaran dengan kategori (Gaji, Hadiah, Investasi, Uang Saku, dll — otomatis dapat ikon)
- Filter transaksi: Semua / Pemasukan / Pengeluaran, per bulan
- Edit & hapus transaksi
- Reset data (per tipe atau semua)

**Target tabungan**
- Set goal nominal tabungan, progress otomatis kehitung dari saldo berjalan

**Grafik**
- Chart tren pemasukan vs pengeluaran per bulan (canvas custom, tanpa library eksternal)
- Card grafik bisa di-collapse

**Tampilan**
- Dark mode / light mode (tersimpan di local storage)
- Avatar warna custom per akun
- Format Rupiah otomatis di input angka

**Akun & sinkronisasi (Vercel Blob)**
- Bikin akun cukup dengan Nama — sistem generate ID unik 8 karakter (huruf/angka, exclude karakter yang gampang ketuker: 0/O, 1/I/l)
- Nama unik per akun (gak bisa dobel, walau beda ID)
- Login pakai Nama + ID dari device lain — data otomatis sync
- Satu akun cuma bisa aktif di satu device dalam satu waktu (session lock), ada warning kalau akun lagi dipakai di device lain
- Auto-sync ke server tiap ada perubahan data (debounced)
- Merge otomatis: kalau ada data lokal (belum login) pas login ke akun yang udah ada, digabung bukan ketimpa
- Hapus akun dengan konfirmasi Nama + ID

**PWA**
- Installable ke home screen (manifest.json + service worker)
- Bisa dipakai offline (local storage sebagai cache), auto-sync lagi begitu online & login

## Tech Stack

- Frontend: HTML/CSS/JS vanilla (single file `index.html`), custom canvas chart
- Backend: Vercel Serverless Functions (`/api/account/*`)
- Storage: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) — tiap akun disimpan sebagai `users/{uid}.json`
- Deployment: Vercel

## Struktur Project

```
tabungaja/
├── index.html              # Seluruh UI + logic frontend
├── manifest.json            # PWA manifest
├── sw.js                     # Service worker (offline cache)
├── icons/icon.png            # App icon
├── package.json
├── vercel.json                # Header config (cache-control utk sw.js & manifest)
└── api/account/
    ├── create.js              # Bikin akun baru (cek nama unik dulu)
    ├── login.js                # Login pakai Nama + ID
    ├── logout.js               # Lepas session aktif
    ├── refresh.js               # Re-validasi & re-claim session
    ├── sync.js                   # Push data terbaru ke server
    └── delete.js                  # Hapus akun
```

## Cara Deploy ke Vercel

### 1. Siapkan Vercel Blob Store
1. Buka [vercel.com](https://vercel.com) → login/daftar.
2. Bikin project baru (bisa dari zip ini langsung, atau connect ke GitHub repo — lihat opsi di bawah).
3. Di dashboard project → tab **Storage** → **Create Database** → pilih **Blob**.
4. Connect Blob store ke project ini. Vercel otomatis nyuntik env var `BLOB_READ_WRITE_TOKEN` ke project — gak perlu setting manual.

### 2A. Deploy via Vercel CLI (paling cepat)
```bash
npm i -g vercel
cd tabungaja
vercel login
vercel --prod
```
Ikuti prompt buat link/bikin project baru. Selesai, dapet URL live.

### 2B. Deploy via GitHub (auto-deploy tiap update)
1. Push isi folder ini ke repo GitHub.
2. Di Vercel dashboard → **Add New → Project** → import repo tersebut.
3. Deploy sekali, habis itu tiap `git push` ke branch utama otomatis re-deploy.

> Pastikan Blob store udah ke-connect ke project (langkah 1) sebelum atau langsung setelah deploy pertama, karena semua endpoint di `api/account/` bergantung ke `@vercel/blob`.

### 3. Cek
- Buka URL project → coba bikin akun baru → refresh → login pakai Nama + ID yang sama dari browser lain buat mastiin sync jalan.

## Catatan

- Auth di sini bukan password-based — kombinasi Nama + ID (8 karakter) berfungsi sebagai kredensial. Cukup buat aplikasi pencatatan personal, bukan didesain buat data finansial sensitif/institusional.
- Pengecekan nama unik saat ini scan seluruh data user (`list()` dari Vercel Blob) tiap kali ada pendaftaran akun baru — cocok buat skala kecil-menengah; kalau jumlah user udah sangat besar, pertimbangkan index terpisah biar lebih efisien.
