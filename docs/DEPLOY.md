# Deploy & pasang di iPhone

**URL produksi: https://arus-9wy.pages.dev** (project Cloudflare Pages `arus`, dibuat 21 Nov 2026).

Arus dihosting di **Cloudflare Pages** (gratis, HTTPS, bandwidth tak terbatas). Service worker butuh HTTPS, jadi app harus diakses lewat URL `https://…pages.dev`, bukan IP lokal.

## Deploy pertama (sekali saja)

1. Buat akun gratis di https://dash.cloudflare.com/sign-up (jika belum).
2. Di folder proyek:
   ```powershell
   npm run build
   npx wrangler login            # membuka browser untuk izin akun Cloudflare
   npx wrangler pages project create arus --production-branch main --force   # --force: wrangler 4.x mengalihkan ke Workers tanpa ini
   npx wrangler pages deploy dist --project-name arus --branch main
   ```
3. URL produksi muncul di output (`https://arus-9wy.pages.dev`).

Jika `wrangler login` gagal dengan "localhost refused to connect": jalankan dari jendela PowerShell biasa dan biarkan terbuka sampai selesai (jangan lewat `!` di Claude Code), atau pakai `$env:CLOUDFLARE_API_TOKEN` (izin Account → Cloudflare Pages → Edit).

## Update berikutnya

```powershell
npm run build; if ($?) { npx wrangler pages deploy dist --project-name arus --branch main --commit-dirty=true }
```

Di iPhone, app menampilkan toast **"Versi baru tersedia"** saat dibuka berikutnya; ketuk untuk memuat ulang.

## Pasang di iPhone

1. Buka URL di **Safari** (bukan Chrome).
2. Tombol Bagikan → **Add to Home Screen / Tambahkan ke Layar Utama** → Tambah.
3. Buka **Arus dari ikon di Home Screen** (bukan dari tab Safari). Data hanya aman dari pembersihan otomatis iOS jika dibuka sebagai app Home Screen.
4. Pengaturan → Data: pastikan status penyimpanan "Permanen", lalu lakukan **Backup** berkala (Simpan ke File / iCloud Drive).

## Catatan

- Data tersimpan **hanya di iPhone** (IndexedDB). Menghapus app dari Home Screen = menghapus data. Selalu punya backup JSON.
- Opsional: kunci URL dengan Cloudflare Access (gratis hingga 50 user) agar hanya Anda yang bisa membuka halaman — meski tanpa itu pun data tidak pernah meninggalkan perangkat.
- `public/_headers` sudah mengatur `sw.js` dan `index.html` tanpa cache agar update cepat sampai.
