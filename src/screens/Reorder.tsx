/* Daftar yang bisa diurutkan dengan drag pada pegangan (grip). Dipakai akun, kategori, favorit. */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { Icon } from '../ui'
import { cx } from './shared'

export interface ReorderListProps<T extends { id: string }> {
  items: T[]
  /** Isi baris; `handle` = elemen grip yang wajib ditaruh di baris. */
  render: (item: T, handle: ReactNode) => ReactNode
  onReorder: (ids: string[]) => void
}

export function ReorderList<T extends { id: string }>({ items, render, onReorder }: ReorderListProps<T>) {
  const [order, setOrder] = useState(() => items.map((i) => i.id))
  const [drag, setDrag] = useState<{ id: string; from: number; dy: number; h: number } | null>(null)
  const start = useRef<{ y: number; pointer: number } | null>(null)

  const itemKey = items.map((i) => i.id).join(',')
  useEffect(() => {
    if (!drag) setOrder(itemKey ? itemKey.split(',') : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey])

  const byId = new Map(items.map((i) => [i.id, i]))
  const target = drag ? Math.max(0, Math.min(order.length - 1, drag.from + Math.round(drag.dy / drag.h))) : -1

  const onDown = (id: string, index: number) => (e: RPointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const row = (e.currentTarget as HTMLElement).closest('.s-reorder__item') as HTMLElement | null
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, pointer: e.pointerId }
    setDrag({ id, from: index, dy: 0, h: row?.offsetHeight ?? 60 })
  }
  const onMove = (e: RPointerEvent<HTMLSpanElement>) => {
    if (!start.current || e.pointerId !== start.current.pointer) return
    const dy = e.clientY - start.current.y
    setDrag((d) => (d ? { ...d, dy } : d))
  }
  const onUp = () => {
    if (!drag) return
    start.current = null
    const next = [...order]
    next.splice(drag.from, 1)
    next.splice(target, 0, drag.id)
    setDrag(null)
    if (next.join() !== order.join()) {
      setOrder(next)
      onReorder(next)
    }
  }
  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[index], next[j]] = [next[j], next[index]]
    setOrder(next)
    onReorder(next)
  }

  return (
    <div className="ui-group ui-group--inset s-reorder">
      {order.map((id, i) => {
        const item = byId.get(id)
        if (!item) return null
        let y = 0
        if (drag) {
          if (id === drag.id) y = drag.dy
          else if (drag.from < target && i > drag.from && i <= target) y = -drag.h
          else if (drag.from > target && i < drag.from && i >= target) y = drag.h
        }
        const handle = (
          <span
            className="s-grip"
            role="button"
            tabIndex={0}
            aria-label="Geser untuk mengubah urutan (panah atas/bawah)"
            onPointerDown={onDown(id, i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
              e.preventDefault()
              move(i, e.key === 'ArrowUp' ? -1 : 1)
            }}
          >
            <Icon name="grip" size={22} />
          </span>
        )
        return (
          <div
            key={id}
            className={cx('s-reorder__item', drag?.id === id && 'is-dragging', drag && drag.id !== id && 'is-shifting')}
            style={y ? { transform: `translateY(${y}px)` } : undefined}
          >
            {render(item, handle)}
          </div>
        )
      })}
    </div>
  )
}
