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
