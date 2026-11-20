import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('larangan tanggal UTC (PRD §5.7)', () => {
  it('memindai file sumber', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10);
  });

  it('tidak ada pemanggilan toISOString() atau new Date("YYYY-MM-DD") di src', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /\.toISOString\s*\(/.test(text) || /new Date\(\s*['"`]\d{4}-\d{2}-\d{2}['"`]\s*\)/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});

describe('aturan transaksi terjadwal di satu tempat (PRD §5.1, BUG-01)', () => {
  it('perbandingan tanggal dengan "today" hanya di lib/effective.ts', () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.endsWith('/effective.ts'))
      .filter(([, text]) => /\.date\s*[<>]=?\s*(today|asOf)\b/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
