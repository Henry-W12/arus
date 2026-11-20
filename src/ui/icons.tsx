/*
 * Set ikon Arus — garis tipis gaya iOS (DESIGN.md §5).
 * viewBox 24, stroke 1.5 (1.75 pada ukuran ≤ 18), round cap/join, fill none.
 * Sebagian path diadaptasi dari Lucide (ISC, lihat LICENSES.md), diseragamkan ke gaya Arus.
 *
 * Bentuk yang diberi className "f" ikut terisi tipis (12%) pada varian `filled` (tab aktif).
 */
import type { ReactElement, SVGProps } from 'react'

const P = (d: string, fillable = false) => <path d={d} className={fillable ? 'f' : undefined} />
const C = (cx: number, cy: number, r: number, mode: 'stroke' | 'fill' | 'f' = 'stroke') => (
  <circle
    cx={cx}
    cy={cy}
    r={r}
    className={mode === 'f' ? 'f' : undefined}
    fill={mode === 'fill' ? 'currentColor' : undefined}
    stroke={mode === 'fill' ? 'none' : undefined}
  />
)
const R = (x: number, y: number, w: number, h: number, rx: number, fillable = false) => (
  <rect x={x} y={y} width={w} height={h} rx={rx} className={fillable ? 'f' : undefined} />
)

const ICONS = {
  /* ---------- Navigasi & aksi ---------- */
  list: (
    <>
      {R(3.5, 4, 17, 16, 3.5, true)}
      {C(7.75, 9, 0.95, 'fill')}
      {C(7.75, 12, 0.95, 'fill')}
      {C(7.75, 15, 0.95, 'fill')}
      {P('M10.5 9h6 M10.5 12h6 M10.5 15h4')}
    </>
  ),
  'chart-donut': (
    <>
      <path
        className="f"
        fillRule="evenodd"
        d="M12 3.25a8.75 8.75 0 1 0 0 17.5a8.75 8.75 0 1 0 0-17.5z M12 8.25a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 1 0 0-7.5z"
      />
      {P('M12 3.25v5 M14.65 14.65l3.54 3.54')}
    </>
  ),
  gauge: (
    <>
      {P('M4.6 18.4A8.75 8.75 0 1 1 19.4 18.4z', true)}
      {P('M12 13.5l3.6-3.6')}
      {C(12, 13.5, 1.1, 'fill')}
    </>
  ),
  wallet: (
    <>
      {R(3.5, 6, 17, 14, 3, true)}
      {P('M20.5 10.25h-3.6a2.25 2.25 0 0 0 0 4.5h3.6')}
      {C(16.9, 12.5, 0.9, 'fill')}
      {P('M6.5 6l9.3-2.45a1.5 1.5 0 0 1 1.9 1.45V6')}
    </>
  ),
  plus: P('M12 5v14 M5 12h14'),
  minus: P('M5 12h14'),
  search: (
    <>
      {C(11, 11, 6.75)}
      {P('M20 20l-4.2-4.2')}
    </>
  ),
  gear: (
    <>
      {P(
        'M12.22 2.75h-.44a1.85 1.85 0 0 0-1.85 1.85v.17a1.85 1.85 0 0 1-.93 1.6l-.4.23a1.85 1.85 0 0 1-1.85 0l-.14-.08a1.85 1.85 0 0 0-2.53.68l-.22.38a1.85 1.85 0 0 0 .68 2.53l.14.09a1.85 1.85 0 0 1 .93 1.6v.47a1.85 1.85 0 0 1-.93 1.61l-.14.08a1.85 1.85 0 0 0-.68 2.53l.22.38a1.85 1.85 0 0 0 2.53.68l.14-.08a1.85 1.85 0 0 1 1.85 0l.4.23a1.85 1.85 0 0 1 .93 1.6v.17a1.85 1.85 0 0 0 1.85 1.85h.44a1.85 1.85 0 0 0 1.85-1.85v-.17a1.85 1.85 0 0 1 .93-1.6l.4-.23a1.85 1.85 0 0 1 1.85 0l.14.08a1.85 1.85 0 0 0 2.53-.68l.22-.39a1.85 1.85 0 0 0-.68-2.53l-.14-.07a1.85 1.85 0 0 1-.93-1.61v-.46a1.85 1.85 0 0 1 .93-1.61l.14-.08a1.85 1.85 0 0 0 .68-2.53l-.22-.38a1.85 1.85 0 0 0-2.53-.68l-.14.08a1.85 1.85 0 0 1-1.85 0l-.4-.23a1.85 1.85 0 0 1-.93-1.6v-.17a1.85 1.85 0 0 0-1.85-1.85z',
        true,
      )}
      {C(12, 12, 2.75)}
    </>
  ),
  'chevron-left': P('M15 18l-6-6 6-6'),
  'chevron-right': P('M9 18l6-6-6-6'),
  'chevron-down': P('M6 9l6 6 6-6'),
  'chevron-up': P('M6 15l6-6 6 6'),
  x: P('M17.5 6.5l-11 11 M6.5 6.5l11 11'),
  check: P('M19.5 6.5L9.5 17l-5-5'),
  trash: (
    <>
      {P('M4 6.5h16 M9.5 6.5V4.75c0-.7.55-1.25 1.25-1.25h2.5c.7 0 1.25.55 1.25 1.25V6.5')}
      {P('M6 6.5l.85 12.2A2 2 0 0 0 8.85 20.5h6.3a2 2 0 0 0 2-1.8L18 6.5', true)}
      {P('M10 10.5v6 M14 10.5v6')}
    </>
  ),
  backspace: (
    <>
      {P('M9.3 5.5h10.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.3a2 2 0 0 1-1.52-.7L3 12l4.78-5.8A2 2 0 0 1 9.3 5.5z', true)}
      {P('M12.25 9.5l5 5 M17.25 9.5l-5 5')}
    </>
  ),
  calendar: (
    <>
      {R(3.5, 5, 17, 15.5, 3, true)}
      {P('M8 3v4 M16 3v4 M3.5 10h17')}
    </>
  ),
  note: (
    <>
      {P('M15 3.5H6.5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3V9z', true)}
      {P('M15 3.5V7a2 2 0 0 0 2 2h3.5 M7.5 13h7 M7.5 16.5h4.5')}
    </>
  ),
  repeat: P('M17 2.5l3.5 3.5-3.5 3.5 M3.5 11.5v-1A4.5 4.5 0 0 1 8 6h12.5 M7 21.5L3.5 18 7 14.5 M20.5 12.5v1A4.5 4.5 0 0 1 16 18H3.5'),
  'arrows-swap': P('M16 3.5l4 4-4 4 M20 7.5H4.5 M8 20.5l-4-4 4-4 M4 16.5h15.5'),
  scale: (
    <>
      {P('M12 3.5v17 M7.5 20.5h9 M4 7h2.5c2 0 4-.8 5.5-1.8 1.5 1 3.5 1.8 5.5 1.8H20')}
      {P('M3 15l3-7.5 3 7.5a3.6 3.6 0 0 1-6 0z M15 15l3-7.5 3 7.5a3.6 3.6 0 0 1-6 0z', true)}
    </>
  ),
  lock: (
    <>
      {R(4.5, 10.5, 15, 10, 3, true)}
      {P('M8 10.5V7.5a4 4 0 0 1 8 0v3 M12 14.5v2')}
    </>
  ),
  share: P('M12 3.5v11 M8 7.5l4-4 4 4 M8.5 10.5H7.5a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5h-1'),
  download: P('M12 3.5v11 M7.5 10L12 14.5 16.5 10 M4.5 15.5v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2.5'),
  upload: P('M12 14.5v-11 M7.5 8L12 3.5 16.5 8 M4.5 15.5v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2.5'),
  info: (
    <>
      {C(12, 12, 8.75, 'f')}
      {P('M12 16.25v-5')}
      {C(12, 8, 0.95, 'fill')}
    </>
  ),
  alert: (
    <>
      {P('M10.27 4.5L2.9 17.25a2 2 0 0 0 1.73 3h14.74a2 2 0 0 0 1.73-3L13.73 4.5a2 2 0 0 0-3.46 0z', true)}
      {P('M12 9.5v4.25')}
      {C(12, 16.75, 0.95, 'fill')}
    </>
  ),
  grip: P('M4.5 8.5h15 M4.5 12h15 M4.5 15.5h15'),
  archive: (
    <>
      {R(3, 4, 18, 4.75, 1.5, true)}
      {P('M4.75 8.75v9.25a2.5 2.5 0 0 0 2.5 2.5h9.5a2.5 2.5 0 0 0 2.5-2.5V8.75 M10 12.5h4')}
    </>
  ),
  eye: (
    <>
      {P('M2.6 12.35a1 1 0 0 1 0-.7C4.2 7.8 7.8 5 12 5s7.8 2.8 9.4 6.65a1 1 0 0 1 0 .7C19.8 16.2 16.2 19 12 19s-7.8-2.8-9.4-6.65z', true)}
      {C(12, 12, 3)}
    </>
  ),
  'eye-off': P(
    'M10.73 5.08A10.7 10.7 0 0 1 12 5c4.2 0 7.8 2.8 9.4 6.65a1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.44 2.49 M14.08 14.16a3 3 0 0 1-4.24-4.24 M17.48 17.5A10.7 10.7 0 0 1 12 19c-4.2 0-7.8-2.8-9.4-6.65a1 1 0 0 1 0-.7 10.7 10.7 0 0 1 4.45-5.14 M3 3l18 18',
  ),
  pencil: (
    <>
      {P('M16.6 3.9a2.1 2.1 0 0 1 3 3L8.4 18.1 4 19.5l1.4-4.4z', true)}
      {P('M14.5 6l3.5 3.5')}
    </>
  ),
  refresh: P('M20 11.5A8 8 0 0 0 5.6 7.2L4 9 M4 4.5V9h4.5 M4 12.5a8 8 0 0 0 14.4 4.3L20 15 M20 19.5V15h-4.5'),
  sun: (
    <>
      {C(12, 12, 4, 'f')}
      {P('M12 2.5v1.5 M12 20v1.5 M4.6 4.6l1.1 1.1 M18.3 18.3l1.1 1.1 M2.5 12H4 M20 12h1.5 M4.6 19.4l1.1-1.1 M18.3 5.7l1.1-1.1')}
    </>
  ),
  moon: P('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', true),
  star: P('M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z', true),

  /* ---------- Kategori & akun ---------- */
  utensils: P('M4 3v6a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V3 M7.5 3v18 M20 14.5V3a4.5 4.5 0 0 0-4.5 4.5V13a1.5 1.5 0 0 0 1.5 1.5H20zm0 0V21'),
  coffee: (
    <>
      {P('M4 9h12.5v6a5 5 0 0 1-5 5h-2.5a5 5 0 0 1-5-5z', true)}
      {P('M16.5 10.5h1.25a2.75 2.75 0 0 1 0 5.5H16 M8 2.75v2.5 M12 2.75v2.5')}
    </>
  ),
  car: (
    <>
      {P('M5.5 10.5l1.6-4.1A2 2 0 0 1 8.96 5.1h6.08a2 2 0 0 1 1.86 1.3l1.6 4.1')}
      {R(3.5, 10.5, 17, 7, 2.5, true)}
      {P('M6 17.5v2 M18 17.5v2')}
      {C(7.5, 14, 0.95, 'fill')}
      {C(16.5, 14, 0.95, 'fill')}
    </>
  ),
  motorbike: (
    <>
      {C(5.5, 16.5, 2.75)}
      {C(18.5, 16.5, 2.75)}
      {P('M8.25 16.5h6.1l2.4-7 M18.5 16.5L15.75 6.5H13.25 M2.75 13.5A2.5 2.5 0 0 1 5.25 11h5.5l1.5 5.5')}
    </>
  ),

  bike: (
    <>
      {C(5.5, 16.5, 3.5)}
      {C(18.5, 16.5, 3.5)}
      {C(15, 5, 1.1, 'fill')}
      {P('M12 16.5V13l-3-3 3.75-2.75L14.5 10h2.5')}
    </>
  ),
  bus: (
    <>
      {R(4.5, 3, 15, 15.5, 3, true)}
      {P('M4.5 11h15 M8 3v0 M7 18.5v2.5 M17 18.5v2.5 M10 6h4')}
      {C(8, 14.75, 0.95, 'fill')}
      {C(16, 14.75, 0.95, 'fill')}
    </>
  ),
  train: (
    <>
      {R(5.5, 3, 13, 14, 3.5, true)}
      {P('M5.5 10h13 M9 21l1.5-4 M15 21l-1.5-4 M10 6h4')}
      {C(9, 13.5, 0.95, 'fill')}
      {C(15, 13.5, 0.95, 'fill')}
    </>
  ),
  fuel: (
    <>
      {P('M4.5 20.5V5a2 2 0 0 1 2-2h5.5a2 2 0 0 1 2 2v15.5z', true)}
      {P('M3 20.5h12.5 M4.5 9.5h9.5 M14 12.5h1.5a2 2 0 0 1 2 2v2a1.75 1.75 0 0 0 3.5 0V9.3a2 2 0 0 0-.6-1.4L17.5 5')}
    </>
  ),
  basket: (
    <>
      {P('M3 10.5h18l-1.65 7.9a2.5 2.5 0 0 1-2.45 2H7.1a2.5 2.5 0 0 1-2.45-2z', true)}
      {P('M7 10.5l3.5-6.5 M17 10.5l-3.5-6.5 M9.5 14v3 M14.5 14v3')}
    </>
  ),
  receipt: (
    <>
      {P('M5 3h14v18l-2.33-1.4-2.34 1.4L12 19.6l-2.33 1.4-2.34-1.4L5 21z', true)}
      {P('M8.5 8h7 M8.5 11.5h7 M8.5 15h4')}
    </>
  ),
  bolt: P('M13.25 2.75L4.75 13.5h6.5l-1 7.75 8.5-10.75h-6.5z', true),
  droplet: P('M12 3c3.2 3.9 6.5 7.6 6.5 11.25a6.5 6.5 0 0 1-13 0C5.5 10.6 8.8 6.9 12 3z', true),
  flame: P('M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6.5-4.5-11-1.75 1.4-2.75 3.6-2.5 6-1-.6-1.9-1.6-2.3-2.7C7 8.8 5.5 11.3 5.5 14.5A6.5 6.5 0 0 0 12 21z', true),
  wifi: (
    <>
      {P('M2.5 9a14 14 0 0 1 19 0 M5.75 12.5a9.25 9.25 0 0 1 12.5 0 M9 16a4.5 4.5 0 0 1 6 0')}
      {C(12, 19.25, 1.05, 'fill')}
    </>
  ),
  phone: (
    <>
      {R(6, 2.5, 12, 19, 3, true)}
      {P('M10.5 18.5h3')}
    </>
  ),
  tv: (
    <>
      {R(2.5, 4.5, 19, 13, 3, true)}
      {P('M8 21h8 M12 17.5V21')}
    </>
  ),
  laptop: (
    <>
      {R(4.5, 5, 15, 10.5, 2, true)}
      {P('M2.5 19h19')}
    </>
  ),
  home: (
    <>
      {P('M3.5 10.2a2 2 0 0 1 .7-1.52l6.5-5.57a2 2 0 0 1 2.6 0l6.5 5.57a2 2 0 0 1 .7 1.52v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', true)}
      {P('M9.5 20.5v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.5')}
    </>
  ),
  bag: (
    <>
      {P('M5 8h14l-.95 10.7a2 2 0 0 1-2 1.8H7.95a2 2 0 0 1-2-1.8z', true)}
      {P('M9 10.5V7a3 3 0 0 1 6 0v3.5')}
    </>
  ),
  shirt: P(
    'M8.5 3.5L3.75 5.6a1 1 0 0 0-.55 1.17l1 3.6a1 1 0 0 0 1.27.68L6.5 10.7V19.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-8.8l1.03.35a1 1 0 0 0 1.27-.68l1-3.6a1 1 0 0 0-.55-1.17L15.5 3.5a3.5 3.5 0 0 1-7 0z',
    true,
  ),
  scissors: (
    <>
      {C(6.5, 6.5, 2.75)}
      {C(6.5, 17.5, 2.75)}
      {P('M20 4.5L8.6 15.4 M14.5 14.3l5.5 5.2 M8.6 8.6L12 11.8')}
    </>
  ),
  gift: (
    <>
      {R(3.5, 8, 17, 4, 1.5)}
      {P('M5 12v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12', true)}
      {P('M12 8v12.5 M12 8C11 5 9 3.5 7.5 3.75a2.1 2.1 0 0 0 0 4.25 M12 8c1-3 3-4.5 4.5-4.25a2.1 2.1 0 0 1 0 4.25')}
    </>
  ),
  angpao: (
    <>
      {R(5, 2.5, 14, 19, 2.5, true)}
      {P('M5 7.5l7 4.25 7-4.25')}
      {C(12, 11.75, 1.6)}
    </>
  ),
  film: (
    <>
      {P('M3.5 10.5h17v7.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z', true)}
      {P('M3.6 10.5L3 8.1a2 2 0 0 1 1.45-2.43l12.1-3.03a2 2 0 0 1 2.43 1.45l.37 1.48L3.6 10.5z M7.6 5l2.4 3.6 M12.7 3.6l2.4 3.7')}
    </>
  ),
  gamepad: (
    <>
      {P('M7.5 6h9a4.5 4.5 0 0 1 4.45 3.83l.9 6.05a2.75 2.75 0 0 1-4.65 2.37L15.5 16.5h-7l-1.7 1.75a2.75 2.75 0 0 1-4.65-2.37l.9-6.05A4.5 4.5 0 0 1 7.5 6z', true)}
      {P('M6.5 11.5h3.5 M8.25 9.75v3.5')}
      {C(15.5, 12.25, 0.95, 'fill')}
      {C(17.25, 10.25, 0.95, 'fill')}
    </>
  ),
  music: (
    <>
      {P('M9 17.5V5.5l11-2v12')}
      {C(6.5, 17.5, 2.5, 'f')}
      {C(17.5, 15.5, 2.5, 'f')}
    </>
  ),
  'heart-pulse': (
    <>
      {P('M12 20.5s-8.5-4.9-8.5-11A4.75 4.75 0 0 1 12 6.6a4.75 4.75 0 0 1 8.5 2.9c0 6.1-8.5 11-8.5 11z', true)}
      {P('M3.75 12.5h4l1.5-2.5 2.25 5 2-3.5 1 1h5.75')}
    </>
  ),
  pill: (
    <>
      {P('M10.6 19.9l9.3-9.3a4.6 4.6 0 0 0-6.5-6.5l-9.3 9.3a4.6 4.6 0 0 0 6.5 6.5z', true)}
      {P('M8.75 8.75l6.5 6.5')}
    </>
  ),
  users: (
    <>
      {C(9, 8, 3.5, 'f')}
      {P('M2.5 20v-.75A4.75 4.75 0 0 1 7.25 14.5h3.5a4.75 4.75 0 0 1 4.75 4.75V20 M15.5 4.6a3.5 3.5 0 0 1 0 6.8 M18 14.6a4.75 4.75 0 0 1 3.5 4.6V20')}
    </>
  ),
  'hand-heart': (
    <>
      {P('M15.5 11.5s-3.5-2.1-3.5-4.6A2 2 0 0 1 15.5 5.7 2 2 0 0 1 19 6.9c0 2.5-3.5 4.6-3.5 4.6z', true)}
      {P('M2.5 14.5l3-2.25a3 3 0 0 1 1.8-.6H11a1.75 1.75 0 0 1 0 3.5H9 M11.5 14.9l4.85-2.3a1.85 1.85 0 0 1 1.9 3.15l-4.1 3a4 4 0 0 1-2.35.75H5.5L3.5 21')}
    </>
  ),
  mosque: (
    <>
      {P('M6.5 20.5V13c0-3 2.5-4.6 5.5-6 3 1.4 5.5 3 5.5 6v7.5z', true)}
      {P('M12 7V4.25 M3.5 20.5h17 M6.5 13h11 M10.25 20.5v-2.75a1.75 1.75 0 0 1 3.5 0v2.75')}
    </>
  ),

  book: (
    <>
      {P('M12 6.75C10.5 5 8.25 4.5 3.5 4.5v14c4.75 0 7 .5 8.5 2.25 1.5-1.75 3.75-2.25 8.5-2.25v-14c-4.75 0-7 .5-8.5 2.25z', true)}
      {P('M12 6.75v14')}
    </>
  ),
  graduation: (
    <>
      {P('M12 4.5l9.5 4.5-9.5 4.5L2.5 9z', true)}
      {P('M6.5 11v4.75c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11 M21.5 9v5.5')}
    </>
  ),
  briefcase: (
    <>
      {R(3, 7, 18, 13, 3, true)}
      {P('M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7 M3 12.5h18')}
    </>
  ),
  banknote: (
    <>
      {R(2.5, 6, 19, 12, 2.5, true)}
      {C(12, 12, 2.5)}
      {C(6, 12, 0.9, 'fill')}
      {C(18, 12, 0.9, 'fill')}
    </>
  ),
  cash: (
    <>
      {R(2.5, 8, 16, 11, 2.5, true)}
      {C(10.5, 13.5, 2.25)}
      {P('M5.5 5h13a3 3 0 0 1 3 3v7.5')}
    </>
  ),
  coins: (
    <>
      {C(9, 9, 5.75, 'f')}
      {P('M17.75 10.6a5.75 5.75 0 1 1-7.15 7.15 M8.25 7.25h1v3.5')}
    </>
  ),
  'trending-up': P('M2.75 17.25l6-6 4 4 8.5-8.5 M15.5 6.75h5.75v5.75'),
  piggy: (
    <>
      {P('M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z', true)}
      {P('M2 8v1a2 2 0 0 0 2 2h1')}
      {C(15.75, 10, 0.95, 'fill')}
    </>
  ),

  plane: P(
    'M10.5 13.5L4 17.25V19l7-2v3.25l-2 1.25h6l-2-1.25V17l7 2v-1.75l-6.5-3.75V5a1.5 1.5 0 0 0-3 0z',
    true,
  ),
  paw: (
    <>
      {C(8, 6.5, 1.85, 'f')}
      {C(16, 6.5, 1.85, 'f')}
      {C(4.5, 11.25, 1.75, 'f')}
      {C(19.5, 11.25, 1.75, 'f')}
      {P('M12 11.5c-2.6 0-5.75 4.2-5.75 6.5 0 1.6 1.2 2.5 2.75 2.5 1.2 0 1.9-.6 3-.6s1.8.6 3 .6c1.55 0 2.75-.9 2.75-2.5 0-2.3-3.15-6.5-5.75-6.5z', true)}
    </>
  ),
  baby: (
    <>
      {C(12, 12.5, 8, 'f')}
      {P('M12 4.5c-1.4 0-2 .9-2 1.75s.75 1.5 1.6 1.25 M9.75 16c1.3.95 3.2.95 4.5 0')}
      {C(9, 12, 0.95, 'fill')}
      {C(15, 12, 0.95, 'fill')}
    </>
  ),
  wrench: P(
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.4-3.4a6 6 0 0 1-7.94 7.94l-6.4 6.4a2.12 2.12 0 0 1-3-3l6.4-6.4a6 6 0 0 1 7.94-7.94z',
    true,
  ),
  sparkle: P(
    'M12 3l1.95 5.35a2.5 2.5 0 0 0 1.7 1.7L21 12l-5.35 1.95a2.5 2.5 0 0 0-1.7 1.7L12 21l-1.95-5.35a2.5 2.5 0 0 0-1.7-1.7L3 12l5.35-1.95a2.5 2.5 0 0 0 1.7-1.7z',
    true,
  ),
  dumbbell: (
    <>
      {R(5, 6.5, 3, 11, 1.5, true)}
      {R(16, 6.5, 3, 11, 1.5, true)}
      {P('M8 12h8 M2.75 9.5v5 M21.25 9.5v5 M2.75 12H5 M19 12h2.25')}
    </>
  ),
  shield: (
    <>
      {P('M12 21c-4.5-1.6-7.5-4.5-7.5-9V6l7.5-3 7.5 3v6c0 4.5-3 7.4-7.5 9z', true)}
      {P('M9 12l2 2 4-4')}
    </>
  ),
  bank: (
    <>
      {P('M3.5 9.5L12 4l8.5 5.5z', true)}
      {P('M3.5 20.5h17 M5 17.5h14 M6.5 9.5v8 M10.5 9.5v8 M13.5 9.5v8 M17.5 9.5v8')}
    </>
  ),
  'smartphone-wallet': (
    <>
      {R(5.5, 2.5, 13, 19, 3, true)}
      {R(8.5, 8, 7, 5.5, 1.5)}
      {P('M15.5 10.75h-2 M10.5 18.5h3')}
    </>
  ),
  card: (
    <>
      {R(2.5, 5, 19, 14, 3, true)}
      {P('M2.5 9.75h19 M6.5 15h4')}
    </>
  ),
  dots: (
    <>
      {C(5.5, 12, 1.4, 'fill')}
      {C(12, 12, 1.4, 'fill')}
      {C(18.5, 12, 1.4, 'fill')}
    </>
  ),
} satisfies Record<string, ReactElement>

export type IconName = keyof typeof ICONS

/** Semua nama ikon (untuk grid pemilih ikon kategori/akun). */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]

/** Ikon yang layak untuk kategori/akun (tanpa ikon navigasi/aksi). */
export const CATEGORY_ICON_NAMES: IconName[] = [
  'utensils', 'coffee', 'basket', 'bag', 'shirt', 'car', 'motorbike', 'bus', 'train', 'bike', 'fuel', 'plane',
  'receipt', 'bolt', 'droplet', 'flame', 'wifi', 'phone', 'tv', 'laptop', 'home', 'wrench', 'film', 'gamepad',
  'music', 'heart-pulse', 'pill', 'dumbbell', 'scissors', 'shield', 'users', 'baby', 'paw', 'hand-heart', 'mosque',
  'book', 'graduation', 'briefcase', 'gift', 'angpao', 'sparkle', 'coins', 'trending-up', 'piggy', 'banknote',
  'cash', 'bank', 'smartphone-wallet', 'card', 'dots',
]

export function isIconName(v: string): v is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, v)
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  /** px; default 24 */
  size?: number
  /** Versi "isi" (tab aktif): bentuk utama terisi 12%. */
  filled?: boolean
  strokeWidth?: number
  /** Label aksesibilitas; tanpa label ikon dianggap dekoratif. */
  label?: string
}

export function Icon({ name, size = 24, filled, strokeWidth, label, className, ...rest }: IconProps) {
  const sw = strokeWidth ?? (size <= 18 ? 1.75 : 1.5)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['ui-icon', filled && 'ui-icon--filled', className].filter(Boolean).join(' ')}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {ICONS[name]}
    </svg>
  )
}

/** Logo-mark Arus: dua garis arus sejajar (DESIGN.md §10). */
export function ArusMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25 / 0.86}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(12 12) scale(.86) translate(-12 -11.9)">
        <path d={ARUS_MARK_TOP} />
        <path d={ARUS_MARK_BOTTOM} />
      </g>
    </svg>
  )
}

// Path yang sama dipakai di public/icon.svg (ikon app).
export const ARUS_MARK_TOP = 'M2 11.2C5.6 7.4 9 7.4 12.4 9.7S18.6 11.4 22 7.6'
export const ARUS_MARK_BOTTOM = 'M6.5 16.2C9.2 13.4 11.8 13.4 14.4 15.1S19.2 16.4 22 13.4'
