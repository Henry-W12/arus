# Money Tracker (PWA untuk iOS)

Aplikasi pencatat keuangan pribadi, dipasang di iPhone lewat Safari → "Add to Home Screen". Tanpa biaya Apple Developer.

## Status & melanjutkan pekerjaan
- Progres terkini ada di `docs/PROGRESS.md`. **Selalu baca file itu dulu** saat melanjutkan sesi; perbarui tiap fase selesai.
- Alur: Riset (`docs/RESEARCH.md`) → PRD (`docs/PRD.md`) → Implementasi → QA (`docs/QA_REPORT.md`) → perbaikan → selesai.

## Keputusan
- PWA (bukan native): gratis, offline, data lokal di perangkat (IndexedDB), backup/restore JSON.
- Stack: Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Tanpa backend.
- Hosting: Cloudflare Pages. Catatan teknis iOS di `docs/IOS_PWA_NOTES.md` (ekspor pakai `navigator.share({files})`, safe-area, font input ≥16px).

- Nama app: **Arus**. Spesifikasi produk di `docs/PRD.md` (acceptance criteria AC-* untuk QA), visual di `docs/DESIGN.md` (semua warna/ukuran lewat token).
- Saldo akun dihitung dari transaksi (tidak disimpan). Nominal = integer Rupiah. Tanggal bisnis = string lokal `YYYY-MM-DD`. Jangan pernah memakai `toISOString()` untuk tanggal (bisa bergeser ke kemarin di WIB).
- Router: History API buatan sendiri (tanpa library). Chart: SVG buatan sendiri.

## Aturan
- `node_modules`, `dist`, `.env`, data/backup tidak masuk repo.
