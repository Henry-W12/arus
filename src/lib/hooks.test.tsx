// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { addTransaction, addTransfer, setBudget, setSetting } from '../db/repo';
import { ensureSeeded } from '../db/seed';
import { clearDb } from '../test/fixtures';
import { todayLocal } from './dates';
import { periodOf } from './period';
import { useBalances, useBudgetOverview, useCategories, usePeriodSummary, usePeriodTransactions, useSearch, useSettings } from './hooks';

beforeEach(async () => {
  await clearDb();
  await ensureSeeded();
});

async function ids() {
  const [tunai, bank] = await db.accounts.orderBy('sortOrder').toArray();
  const makan = (await db.categories.toArray()).find((c) => c.name === 'Makan & Minum')!;
  return { tunai, bank, makan };
}

describe('hooks', () => {
  it('useSettings & useCategories memuat data seed', async () => {
    const settings = renderHook(() => useSettings());
    const cats = renderHook(() => useCategories('expense'));
    await waitFor(() => expect(settings.result.current?.periodStartDay).toBe(1));
    await waitFor(() => expect(cats.result.current?.[0].name).toBe('Makan & Minum'));
  });

  it('useBalances & usePeriodTransactions bereaksi terhadap perubahan DB', async () => {
    const { tunai, bank, makan } = await ids();
    const today = todayLocal();
    const balances = renderHook(() => useBalances());
    const list = renderHook(() => usePeriodTransactions());
    await waitFor(() => expect(balances.result.current?.total).toBe(0));

    await act(async () => {
      await addTransaction({ type: 'expense', amount: 25_000, date: today, accountId: tunai.id, categoryId: makan.id });
      await addTransfer({ fromAccountId: tunai.id, toAccountId: bank.id, amount: 5_000, date: today });
    });
    await waitFor(() => expect(balances.result.current?.balances.get(tunai.id)).toBe(-30_000));
    expect(balances.result.current?.total).toBe(-25_000);
    await waitFor(() => expect(list.result.current?.count).toBe(2));
    expect(list.result.current?.totals.expense).toBe(25_000);
    expect(list.result.current?.groups[0].date).toBe(today);
  });

  it('usePeriodSummary, useBudgetOverview, useSearch', async () => {
    const { tunai, makan } = await ids();
    const today = todayLocal();
    const key = periodOf(today, 1).key;
    await addTransaction({ type: 'expense', amount: 850_000, date: today, accountId: tunai.id, categoryId: makan.id, note: 'Kopi' });
    await setBudget(makan.id, key, 1_000_000);

    const summary = renderHook(() => usePeriodSummary(key));
    const budget = renderHook(() => useBudgetOverview());
    const filter = { query: 'kopi' };
    const search = renderHook(() => useSearch(filter));
    await waitFor(() => expect(summary.result.current?.totals.expense).toBe(850_000));
    expect(summary.result.current?.segments).toHaveLength(1);
    expect(summary.result.current?.trend).toHaveLength(6);
    await waitFor(() => expect(budget.result.current?.lines[0]?.status).toBe('warning'));
    await waitFor(() => expect(search.result.current?.count).toBe(1));

    await act(async () => {
      await setSetting('periodStartDay', 28);
    });
    await waitFor(() => expect(budget.result.current?.period.start.slice(8)).toBe('28'));
  });
});
