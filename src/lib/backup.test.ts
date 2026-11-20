import { describe, expect, it } from 'vitest';
import { makeAccount, makeCategory, makeTx } from '../test/fixtures';
import { buildBackup, parseBackup, serializeBackup, type BackupData } from './backup';

function sample(): BackupData {
  const tunai = makeAccount({ name: 'Tunai' });
  const bca = makeAccount({ name: 'BCA' });
  const makan = makeCategory({ name: 'Makan' });
  const gaji = makeCategory({ name: 'Gaji', kind: 'income' });
  return {
    accounts: [tunai, bca],
    categories: [makan, gaji],
    transactions: [
      makeTx({ type: 'expense', amount: 25_000, accountId: tunai.id, categoryId: makan.id }),
      makeTx({ type: 'transfer', amount: 5_000, accountId: tunai.id, toAccountId: bca.id }),
    ],
    budgets: [],
    recurring: [],
    templates: [],
    settings: [
      { key: 'periodStartDay', value: 25 },
      { key: 'pin', value: { hash: 'h', salt: 's', iterations: 1 } },
      { key: 'lastBackupAt', value: 123 },
    ],
  };
}

const text = (data: BackupData) => serializeBackup(buildBackup(data, new Date(2026, 10, 20, 8, 15)));

describe('backup JSON', () => {
  it('format & AC-BK-10 tanpa PIN / setting perangkat', () => {
    const b = buildBackup(sample(), new Date(2026, 10, 20, 8, 15));
    expect(b).toMatchObject({ app: 'arus', format: 1, schemaVersion: 1, exportedAt: '2026-11-20T08:15:00.000+07:00' });
    expect(b.data.settings.map((s) => s.key)).toEqual(['periodStartDay']);
    expect(b.counts.transactions).toBe(2);
    expect(serializeBackup(b)).not.toContain('"pin"');
  });

  it('round-trip parse valid', () => {
    const data = sample();
    const res = parseBackup(text(data));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.backup.data.transactions).toEqual(data.transactions);
  });

  it('AC-BK-03 file rusak / bukan Arus', () => {
    expect(parseBackup('{bukan json')).toMatchObject({ ok: false, reason: 'json' });
    expect(parseBackup('{"app":"lain"}')).toMatchObject({ ok: false, reason: 'not-arus' });
    expect(parseBackup('[]')).toMatchObject({ ok: false, reason: 'not-arus' });
  });

  it('AC-BK-06 schemaVersion lebih baru ditolak', () => {
    const raw = JSON.parse(text(sample()));
    raw.schemaVersion = 99;
    const res = parseBackup(JSON.stringify(raw));
    expect(res).toMatchObject({ ok: false, reason: 'too-new' });
    if (!res.ok) expect(res.message).toContain('Perbarui app dulu');
  });

  it('referensi tidak valid dihitung & dilaporkan spesifik', () => {
    const data = sample();
    data.transactions.push(
      makeTx({ type: 'expense', amount: 1, accountId: 'x1', categoryId: data.categories[0].id }),
      makeTx({ type: 'expense', amount: 1, accountId: 'x2', categoryId: data.categories[0].id }),
      makeTx({ type: 'expense', amount: 1, accountId: 'x3', categoryId: data.categories[0].id }),
      makeTx({ type: 'expense', amount: 1, accountId: data.accounts[0].id, categoryId: data.categories[1].id }),
    );
    const res = parseBackup(text(data));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('3 transaksi merujuk akun yang tidak ada');
      expect(res.message).toContain('1 transaksi memakai kategori dengan jenis yang salah');
    }
  });

  it('record tidak valid: amount desimal, tanggal salah, transfer ke akun sama, id ganda', () => {
    const data = sample();
    const acc = data.accounts[0].id;
    const cat = data.categories[0].id;
    data.transactions.push(
      makeTx({ type: 'expense', amount: 1.5, accountId: acc, categoryId: cat }),
      makeTx({ type: 'expense', amount: 10, accountId: acc, categoryId: cat, date: '2026-02-30' }),
      makeTx({ type: 'transfer', amount: 10, accountId: acc, toAccountId: acc }),
      { ...data.transactions[0] },
    );
    const res = parseBackup(text(data));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toEqual(
        expect.arrayContaining([
          '1 transaksi tidak valid (nominal tidak valid)',
          '1 transaksi tidak valid (tanggal tidak valid)',
          '1 transaksi tidak valid (akun asal dan tujuan sama)',
          '1 transaksi memiliki id ganda',
        ]),
      );
    }
  });

  it('PIN di file backup diabaikan saat parse', () => {
    const raw = JSON.parse(text(sample()));
    raw.data.settings.push({ key: 'pin', value: { hash: 'evil', salt: 'x', iterations: 1 } });
    const res = parseBackup(JSON.stringify(raw));
    expect(res.ok && res.backup.data.settings.some((s) => s.key === 'pin')).toBe(false);
  });
});
