# Progress

| Fase | Status | Output |
|---|---|---|
| 1. Riset kompetitor + batasan PWA iOS | ✅ | docs/RESEARCH.md, docs/IOS_PWA_NOTES.md |
| 2. PRD + desain | ✅ | docs/PRD.md, docs/DESIGN.md |
| 3a. Logika data | ✅ | src/db, src/lib, docs/API.md (144 tes vitest hijau) |
| 3b. Fondasi UI + PWA | ⏳ | src/ui, src/styles |
| 3c. Layar | ⬜ | src/screens |
| 4. QA | ⬜ | docs/QA_REPORT.md |
| 5. Perbaikan & finalisasi | ⬜ | |

## Catatan lanjutan
- Scaffold Vite+React+TS sudah dibuat, deps terpasang (dexie, vite-plugin-pwa, vitest, playwright).
- Riset selesai. Keputusan hosting: Cloudflare Pages (repo private OK). PWA tetap pilihan terbaik tanpa biaya.
- Implementasi dipecah: 3a logika data (src/db, src/lib + tes) ∥ 3b fondasi UI (src/ui, styles, PWA config, ikon) → 3c layar (src/screens). Tiap agent commit sendiri & mencatat di sini.
- 3a selesai: skema Dexie v1 + seed, repo (semua tulis + validasi + integritas), generator berulang, backup/restore atomik, CSV, PIN PBKDF2, hooks `useLiveQuery`. API untuk layar: `docs/API.md`. ID ikon: `src/db/iconIds.ts`.
- Penyimpangan kecil dari PRD: fungsi murni di `src/lib/` (bukan `src/domain/`); format tanggal pakai tabel nama hari/bulan sendiri (deterministik, bukan `Intl`); restore mempertahankan setting khusus perangkat (PIN, pinLockState, persistGranted, lastBackupAt); setting baru `pinLockState` dan `backupReminderSnoozedUntil`.
