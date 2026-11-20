import { describe, expect, it } from 'vitest';
import { makeAccount, makeCategory, makeTx } from '../test/fixtures';
import { buildCsv, csvField } from './csv';

describe('CSV (AC-BK-07)', () => {
  const tunai = makeAccount({ name: 'Tunai' });
  const bca = makeAccount({ name: 'BCA' });
  const cafe = makeCategory({ name: 'Café — Kopi' });

  it('BOM, CRLF, header, nominal bertanda, quoting RFC 4180', () => {
    const csv = buildCsv(
      [
        makeTx({ type: 'transfer', amount: 100_000, accountId: tunai.id, toAccountId: bca.id, date: '2026-11-02' }),
        makeTx({ type: 'expense', amount: 25_000, accountId: tunai.id, categoryId: cafe.id, note: 'Kopi, "susu"\nbaris 2', date: '2026-11-01' }),
        makeTx({ type: 'adjustment', amount: -12_500, accountId: tunai.id, note: 'Penyesuaian saldo', date: '2026-11-03' }),
        makeTx({ type: 'income', amount: 1_000, accountId: bca.id, categoryId: cafe.id, date: '2026-11-03' }),
      ],
      [cafe],
      [tunai, bca],
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Tanggal,Jenis,Nominal,Kategori,Akun,Akun Tujuan,Catatan');
    expect(lines[1]).toBe('2026-11-01,Pengeluaran,-25000,Café — Kopi,Tunai,,"Kopi, ""susu""\nbaris 2"');
    expect(lines[2]).toBe('2026-11-02,Transfer,-100000,,Tunai,BCA,');
    expect(lines[3]).toBe('2026-11-03,Penyesuaian,-12500,,Tunai,,Penyesuaian saldo');
    expect(lines[4]).toBe('2026-11-03,Pemasukan,1000,Café — Kopi,BCA,,');
    expect(lines[5]).toBe('');
  });

  it('csvField', () => {
    expect(csvField('a')).toBe('a');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });
});
