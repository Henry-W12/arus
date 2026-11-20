// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastOptions } from './Toast';

let api: ReturnType<typeof useToast> | null = null;
function Grab() {
  api = useToast();
  return null;
}

const toastEl = () => document.querySelector('.ui-toast');

describe('Toast (BUG-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  const show = (t: ToastOptions) => act(() => api!.show(t));

  it('di-unmount dari DOM setelah durasi + animasi keluar', () => {
    const onAction = vi.fn();
    show({ message: 'Tersimpan', action: { label: 'Urungkan', onAction } });
    expect(toastEl()).not.toBeNull();
    act(() => vi.advanceTimersByTime(5000));
    expect(toastEl()?.classList.contains('is-leaving')).toBe(true);
    act(() => vi.advanceTimersByTime(200));
    expect(toastEl()).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('dismiss manual juga meng-unmount', () => {
    show({ message: 'A', duration: Infinity });
    act(() => api!.dismiss());
    act(() => vi.advanceTimersByTime(200));
    expect(toastEl()).toBeNull();
  });

  it('aksi tidak berjalan saat toast sedang keluar', () => {
    const onAction = vi.fn();
    show({ message: 'Tersimpan', action: { label: 'Urungkan', onAction } });
    act(() => vi.advanceTimersByTime(5000));
    const btn = document.querySelector<HTMLButtonElement>('.ui-toast__action')!;
    act(() => btn.click());
    expect(onAction).not.toHaveBeenCalled();
  });

  it('toast baru saat toast lama keluar tetap tampil penuh', () => {
    show({ message: 'A' });
    act(() => vi.advanceTimersByTime(5000));
    show({ message: 'B' });
    act(() => vi.advanceTimersByTime(200));
    expect(toastEl()?.textContent).toBe('B');
    expect(toastEl()?.classList.contains('is-leaving')).toBe(false);
    act(() => vi.advanceTimersByTime(5200));
    expect(toastEl()).toBeNull();
  });
});
