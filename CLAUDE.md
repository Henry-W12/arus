# Money Tracker (PWA untuk iOS)

Aplikasi pencatat keuangan pribadi, dipasang di iPhone lewat Safari → "Add to Home Screen". Tanpa biaya Apple Developer.

## Status & melanjutkan pekerjaan
- Progres terkini ada di `docs/PROGRESS.md`. **Selalu baca file itu dulu** saat melanjutkan sesi; perbarui tiap fase selesai.
- Alur: Riset (`docs/RESEARCH.md`) → PRD (`docs/PRD.md`) → Implementasi → QA (`docs/QA_REPORT.md`) → perbaikan → selesai.

## Keputusan
- PWA (bukan native): gratis, offline, data lokal di perangkat (IndexedDB), backup/restore JSON.
- Stack: Vite + React + TypeScript, Dexie (IndexedDB), vite-plugin-pwa. Tanpa backend.
- Hosting: Cloudflare Pages, project `arus` → https://arus-9wy.pages.dev. Deploy: `npm run build` lalu `npx wrangler pages deploy dist --project-name arus --branch main --commit-dirty=true` (langkah di `docs/DEPLOY.md`). Catatan teknis iOS di `docs/IOS_PWA_NOTES.md` (ekspor pakai `navigator.share({files})`, safe-area, font input ≥16px).

- Nama app: **Arus**. Spesifikasi produk di `docs/PRD.md` (acceptance criteria AC-* untuk QA), visual di `docs/DESIGN.md` (semua warna/ukuran lewat token).
- Transaksi Terjadwal (`date > hari ini`) tidak dihitung di saldo/ringkasan/tren/anggaran/total Cari sampai tanggalnya; satu-satunya implementasi: `src/lib/effective.ts` (tes penjaga melarang `.date <=/> today` di tempat lain).
- Saldo akun dihitung dari transaksi (tidak disimpan). Nominal = integer Rupiah. Tanggal bisnis = string lokal `YYYY-MM-DD`. Jangan pernah memakai `toISOString()` untuk tanggal (bisa bergeser ke kemarin di WIB).
- Router: History API buatan sendiri (tanpa library). Chart: SVG buatan sendiri.
- UI: komponen di `src/ui` (impor dari `./ui`, props di `docs/API.md`), CSS biasa berkelas `.ui-*` di `src/styles/` (tanpa Tailwind; hex hanya di `tokens.css`). Verifikasi visual: `npm run dev` → `/_gallery?theme=light|dark`, screenshot Playwright WebKit 390×844 @3x ke `docs/screens/`.

## Lapisan data
- Fungsi murni di `src/lib/`, Dexie + semua tulis di `src/db/` (`repo.ts`). Layar memakai hooks `src/lib/hooks.ts`; referensi API di `docs/API.md`.
- Tes: `npm test` (vitest, `vitest.config.ts`, TZ dipaksa Asia/Jakarta, fake-indexeddb). Tes penjaga melarang `toISOString()` di `src/`.
- Jebakan: tool Write/heredoc mengubah escape unicode (backslash-u) jadi karakter asli. Setelah menulis NBSP/U+2212/BOM di kode, cek dengan grep dan perbaiki lewat skrip (`String.fromCharCode(92)`).

## Layar (fase 3c)
- `src/screens/` (+ `settings/`), gaya `src/styles/screens.css` (prefiks `.s-`/`.tx-`), helper bersama `screens/shared.tsx`, state lintas layar `screens/store.ts`. Sheet input = `?sheet=add|tx` (dirender di `App.tsx`).
- Screenshot layar: `npm run dev` lalu `node scripts/screens.mjs [light|dark|all] [filter]` → `docs/screens/app-*.png`. Data demo `scripts/demo-seed.ts` hanya untuk skrip (dimuat via dev server).
- Nav/tab bar sengaja opak (`var(--bg)`): di WebKit Windows backdrop-filter tidak bekerja dan teks di belakang tembus terbaca.

## E2E (fase 4)
- `npm run e2e` (Playwright, build produksi + `vite preview` :4173). Project `iphone` (WebKit 390×844), `iphone-se` (`small.spec`), `chromium-offline` (WebKit Playwright di Windows tidak menjalankan SW).
- Project `perf` (`e2e/perf.spec.ts`, AC-IN-01) bergantung pada semua project lain → berjalan terakhir & sendirian; ukuran waktu jangan ditaruh di spec biasa.
- WebKit Playwright di Windows: tiap put IndexedDB ±15 ms (400 baris ≈ 6 dtk) — artefak lingkungan, bukan app. Generator berulang dijalankan setelah UI tampil (`initDatabase(…, { runGenerator: false })`), jadi tes membaca hasilnya dengan `expect.poll`.
- Target sentuh 44 px: kontrol pendek diperluas lewat `::after` (`.ui-chip`, `.ui-seg__item`, `.ui-btn--sm/pill`); wadah scroll di sekitarnya perlu padding agar tidak terpotong. Teks informatif minimal `ink-2` (`ink-3` hanya tersier).
- Data uji ditulis langsung ke IndexedDB lewat `e2e/helpers.ts` (`boot`, `seedTx`, `putRows`) lalu reload; jam dipalsukan `page.clock` (default 20 Nov 2026 10:00 WIB). Tes yang gagal karena bug diberi ID `BUG-xx` dari `docs/QA_REPORT.md`.

## Aturan
- Repo **publik**: https://github.com/Henry-W12/arus (pengecualian dari default private). Sebelum push, pastikan tidak ada data pribadi, rahasia, atau data keuangan asli (data demo/screenshot harus fiktif).
- `node_modules`, `dist`, `.env`, data/backup tidak masuk repo.
