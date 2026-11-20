/**
 * Daftar ID ikon yang dipakai data & UI (DESIGN.md §5).
 * Data hanya menyimpan string ID; komponen `<Icon name>` di UI memetakan ID → SVG.
 * Setiap ID di bawah WAJIB punya glyph di UI.
 */

/** Ikon antarmuka (tab bar, nav bar, aksi). Tidak disimpan di DB. */
export const UI_ICON_IDS = [
  'list',
  'chart-donut',
  'gauge',
  'wallet',
  'plus',
  'search',
  'gear',
  'chevron-left',
  'chevron-right',
  'chevron-down',
  'x',
  'check',
  'trash',
  'backspace',
  'calendar',
  'note',
  'repeat',
  'arrows-swap',
  'scale',
  'lock',
  'share',
  'download',
  'upload',
  'info',
  'alert',
  'grip',
  'archive',
  'eye-off',
] as const;

/** Ikon yang bisa dipilih untuk kategori & akun (disimpan di `icon`). */
export const ENTITY_ICON_IDS = [
  'utensils',
  'coffee',
  'car',
  'bike',
  'bus',
  'fuel',
  'basket',
  'receipt',
  'bolt',
  'wifi',
  'phone',
  'home',
  'bag',
  'shirt',
  'gift',
  'film',
  'gamepad',
  'music',
  'heart-pulse',
  'pill',
  'users',
  'hand-heart',
  'book',
  'graduation',
  'briefcase',
  'banknote',
  'coins',
  'trending-up',
  'piggy',
  'plane',
  'paw',
  'baby',
  'wrench',
  'sparkle',
  'dumbbell',
  'cash',
  'bank',
  'smartphone-wallet',
  'card',
  'dots',
  // Konteks Indonesia (fase 3c)
  'motorbike',
  'train',
  'droplet',
  'flame',
  'tv',
  'laptop',
  'scissors',
  'shield',
  'angpao',
  'mosque',
] as const;

/** Subset yang ditawarkan di grid ikon sheet akun (12 ikon). */
export const ACCOUNT_ICON_IDS = [
  'cash',
  'bank',
  'smartphone-wallet',
  'card',
  'wallet',
  'piggy',
  'banknote',
  'coins',
  'trending-up',
  'briefcase',
  'home',
  'dots',
] as const;

export type UiIconId = (typeof UI_ICON_IDS)[number];
export type EntityIconId = (typeof ENTITY_ICON_IDS)[number];
/** Semua ID yang boleh muncul di field `icon` (akun boleh memakai `wallet`). */
export type IconName = EntityIconId | 'wallet';

const ICON_SET: ReadonlySet<string> = new Set<string>([...ENTITY_ICON_IDS, 'wallet']);

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && ICON_SET.has(value);
}

export const COLOR_TOKENS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

const COLOR_SET: ReadonlySet<string> = new Set<string>(COLOR_TOKENS);

export function isColorToken(value: unknown): value is ColorToken {
  return typeof value === 'string' && COLOR_SET.has(value);
}
