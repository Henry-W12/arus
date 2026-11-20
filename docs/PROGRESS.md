# Progress

| Fase | Status | Output |
|---|---|---|
| 1. Riset kompetitor + batasan PWA iOS | ✅ | docs/RESEARCH.md, docs/IOS_PWA_NOTES.md |
| 2. PRD + desain | ✅ | docs/PRD.md, docs/DESIGN.md |
| 3a. Logika data | ✅ | src/db, src/lib, docs/API.md (144 tes vitest hijau) |
| 3b. Fondasi UI + PWA | ✅ | src/ui, src/styles, public/ (ikon, _headers), vite.config.ts, docs/screens |
| 3c. Layar | ⏳ berjalan — semua layar v1 sudah ada (Transaksi, input/edit, Cari, Ringkasan, Anggaran, Akun + detail, Pengaturan + Kategori/Favorit/Berulang/Data/Keamanan, kunci PIN, onboarding); sisa: poles visual dark mode & QA screenshot | src/screens |
| 4. QA | ⬜ | docs/QA_REPORT.md |
| 5. Perbaikan & finalisasi | ⬜ | |

## Catatan lanjutan
- Scaffold Vite+React+TS sudah dibuat, deps terpasang (dexie, vite-plugin-pwa, vitest, playwright).
- Riset selesai. Keputusan hosting: Cloudflare Pages (repo private OK). PWA tetap pilihan terbaik tanpa biaya.
- Implementasi dipecah: 3a logika data (src/db, src/lib + tes) ∥ 3b fondasi UI (src/ui, styles, PWA config, ikon) → 3c layar (src/screens). Tiap agent commit sendiri & mencatat di sini.
- 3a selesai: skema Dexie v1 + seed, repo (semua tulis + validasi + integritas), generator berulang, backup/restore atomik, CSV, PIN PBKDF2, hooks `useLiveQuery`. API untuk layar: `docs/API.md`. ID ikon: `src/db/iconIds.ts`.
- Penyimpangan kecil dari PRD: fungsi murni di `src/lib/` (bukan `src/domain/`); format tanggal pakai tabel nama hari/bulan sendiri (deterministik, bukan `Intl`); restore mempertahankan setting khusus perangkat (PIN, pinLockState, persistGranted, lastBackupAt); setting baru `pinLockState` dan `backupReminderSnoozedUntil`.
- 3b selesai: token/reset/komponen CSS (`.ui-*`, tanpa Tailwind), 50+ ikon SVG, Keypad, BottomSheet (drag, fokus trap, visualViewport), TabBar+FAB, Screen/NavBar, ListRow (swipe hapus), Toast+Undo, Donut, ProgressBar, router History API, UpdatePrompt (SW prompt). Props: `docs/API.md` § Komponen UI. Galeri dev `/_gallery`.
- Catatan 3b → 3c: header hari sticky harus dibungkus `<section>` per hari; toast diletakkan di atas FAB (bukan 12 px di atas tab bar) agar tidak menutupi FAB; backdrop-blur tidak tampil di WebKit Windows (screenshot) tapi berjalan di iOS. Ikon tambahan konteks Indonesia (motorbike, droplet, mosque, dst.) belum ada di `ENTITY_ICON_IDS`.

## Catatan 3c (layar)
- Struktur: `src/screens/` (+ `settings/`), gaya `src/styles/screens.css` (prefiks `.s-`, `.tx-`), state lintas layar `screens/store.ts`, komponen bersama `screens/shared.tsx`. Komponen UI baru: `ActionSheet`.
- Screenshot: `npm run dev` lalu `node scripts/screens.mjs [light|dark|all] [filter]` → `docs/screens/app-*.png`. Data demo `scripts/demo-seed.ts` (dimuat lewat dev server, tidak ikut bundle app).
- Perbaikan fondasi: latar nav/tab bar/header sticky **opak** `var(--bg)` + hairline (menyimpang dari DESIGN 82% + blur) — di WebKit Windows teks di belakang tetap terbaca bahkan pada 94–97%; nominal sheet input mengisi ruang sisa sehingga grid kategori menempel ke keypad; 10 ikon konteks Indonesia masuk `ENTITY_ICON_IDS`, ikon `motorbike` digambar ulang (skuter); `/_gallery` hanya di dev.
- Onboarding: satu layar sambutan saat DB baru di-seed (tidak disimpan sebagai setting), lalu langsung ke sheet input.
- Penyimpangan kecil dari PRD: navigator periode Ringkasan/Anggaran ada di bawah Large Title (bukan di nav bar); filter Nominal di Cari memakai field teks (25rb, 1,2jt) bukan keypad; daftar transaksi dimuat bertahap dari semua transaksi (bukan per periode); tap baris anggaran membuka sheet (dengan tautan "Lihat transaksi"); Transfer di sheet input memakai dua baris pilihan akun Dari/Ke (tanpa chip akun); urutan ulang lewat drag pegangan (keyboard: panah atas/bawah).
