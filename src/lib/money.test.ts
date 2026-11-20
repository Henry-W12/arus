import { describe, expect, it } from 'vitest';
import { applyKeypad, formatIDR, formatIDRShort, formatPercent, parseAmountText, type KeypadKey } from './money';

const press = (keys: KeypadKey[], start = 0) => keys.reduce((v, k) => applyKeypad(v, k).value, start);

describe('format Rupiah', () => {
  it('penuh dengan NBSP & minus U+2212 (AC-IN-08)', () => {
    expect(formatIDR(1_250_000)).toBe('Rp\u00A01.250.000');
    expect(formatIDR(-25_000)).toBe('\u2212Rp\u00A025.000');
    expect(formatIDR(25_000, 'always')).toBe('+Rp\u00A025.000');
    expect(formatIDR(-25_000, 'none')).toBe('Rp\u00A025.000');
    expect(formatIDR(0, 'always')).toBe('Rp\u00A00');
    expect(formatIDR(999_999_999_999)).toBe('Rp\u00A0999.999.999.999');
  });

  it('sama dengan Intl id-ID', () => {
    for (const n of [0, 7, 950, 1000, 12_345, 1_250_000, 987_654_321_012]) {
      expect(formatIDR(n)).toBe(`Rp\u00A0${new Intl.NumberFormat('id-ID').format(n)}`);
    }
  });

  it('singkat, dipotong bukan dibulatkan', () => {
    expect(formatIDRShort(950)).toBe('950');
    expect(formatIDRShort(1_000)).toBe('1rb');
    expect(formatIDRShort(1_500)).toBe('1,5rb');
    expect(formatIDRShort(25_000)).toBe('25rb');
    expect(formatIDRShort(999_999)).toBe('999,9rb');
    expect(formatIDRShort(999_000)).toBe('999rb');
    expect(formatIDRShort(1_250_000)).toBe('1,2jt');
    expect(formatIDRShort(1_299_999)).toBe('1,2jt');
    expect(formatIDRShort(12_000_000)).toBe('12jt');
    expect(formatIDRShort(999_999_999)).toBe('999,9jt');
    expect(formatIDRShort(1_250_000_000)).toBe('1,2M');
    expect(formatIDRShort(999_999_999_999)).toBe('999,9M');
    expect(formatIDRShort(25_000, { withRp: true })).toBe('Rp\u00A025rb');
    expect(formatIDRShort(-25_000)).toBe('\u221225rb');
  });

  it('persen', () => {
    expect(formatPercent(0.6667)).toBe('67%');
    expect(formatPercent(0.004)).toBe('<1%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1.12)).toBe('112%');
  });
});

describe('parseAmountText', () => {
  it.each([
    ['25rb', 25_000],
    ['25k', 25_000],
    ['25K', 25_000],
    ['25.000', 25_000],
    ['1,2jt', 1_200_000],
    ['1.2jt', 1_200_000],
    ['1,25jt', 1_250_000],
    ['1.500.000', 1_500_000],
    ['Rp 50.000', 50_000],
    ['2m', 2_000_000_000],
    ['750', 750],
  ])('%s → %d', (text, value) => {
    expect(parseAmountText(text)).toBe(value);
  });

  it.each(['kopi', '', 'rb', '1,5', '1.2.3jt', '12,34', '1,2345rb', '9999999999999'])('"%s" → null', (text) => {
    expect(parseAmountText(text)).toBeNull();
  });
});

describe('keypad', () => {
  it('AC-IN-02 2,5,000 → 25.000', () => {
    expect(press(['2', '5', '000'])).toBe(25_000);
  });

  it('AC-IN-07 0/000 saat 0 diabaikan', () => {
    expect(press(['0', '000', '0'])).toBe(0);
    expect(applyKeypad(0, '000').rejected).toBe(false);
  });

  it('AC-IN-05 maks 12 digit; 000 pada 10 digit hanya menambah 2', () => {
    const twelve = 123_456_789_012;
    expect(applyKeypad(twelve, '5')).toEqual({ value: twelve, rejected: true });
    expect(applyKeypad(1_234_567_890, '000')).toEqual({ value: 123_456_789_000, rejected: false });
    expect(applyKeypad(twelve, '000').rejected).toBe(true);
  });

  it('backspace & clear (AC-IN-06)', () => {
    expect(applyKeypad(25_000, 'backspace').value).toBe(2_500);
    expect(applyKeypad(5, 'backspace').value).toBe(0);
    expect(applyKeypad(0, 'backspace').value).toBe(0);
    expect(applyKeypad(25_000, 'clear').value).toBe(0);
  });
});
