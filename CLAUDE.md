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
- UI: komponen di `src/ui` (impor dari `./ui`, props di `docs/API.md`), CSS biasa berkelas `.ui-*` di `src/styles/` (tanpa Tailwind; hex hanya di `tokens.css`). Verifikasi visual: `npm run dev` → `/_gallery?theme=light|dark`, screenshot Playwright WebKit 390×844 @3x ke `docs/screens/`.

## Lapisan data
- Fungsi murni di `src/lib/`, Dexie + semua tulis di `src/db/` (`repo.ts`). Layar memakai hooks `src/lib/hooks.ts`; referensi API di `docs/API.md`.
- Tes: `npm test` (vitest, `vitest.config.ts`, TZ dipaksa Asia/Jakarta, fake-indexeddb). Tes penjaga melarang `toISOString()` di `src/`.
- Jebakan: tool Write/heredoc mengubah escape unicode (backslash-u) jadi karakter asli. Setelah menulis NBSP/U+2212/BOM di kode, cek dengan grep dan perbaiki lewat skrip (`String.fromCharCode(92)`).

## Layar (fase 3c)
- `src/screens/` (+ `settings/`), gaya `src/styles/screens.css` (prefiks `.s-`/`.tx-`), helper bersama `screens/shared.tsx`, state lintas layar `screens/store.ts`. Sheet input = `?sheet=add|tx` (dirender di `App.tsx`).
- Screenshot layar: `npm run dev` lalu `node scripts/screens.mjs [light|dark|all] [filter]` → `docs/screens/app-*.png`. Data demo `scripts/demo-seed.ts` hanya untuk skrip (dimuat via dev server).
- Nav/tab bar sengaja opak (`var(--bg)`): di WebKit Windows backdrop-filter tidak bekerja dan teks di belakang tembus terbaca.

## Aturan
- `node_modules`, `dist`, `.env`, data/backup tidak masuk repo.
