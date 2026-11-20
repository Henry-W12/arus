/* Kategori (PRD §3.9): CRUD, urutan grid input, arsip/pulihkan. */
import { useState } from 'react'
import {
  archiveCategory,
  canDeleteCategory,
  createCategory,
  deleteCategory,
  reorderCategories,
  unarchiveCategory,
  updateCategory,
} from '../../db/repo'
import { ENTITY_ICON_IDS } from '../../db/iconIds'
import { CATEGORY_NAME_MAX, type Category, type CategoryKind, type ColorToken, type IconName } from '../../db/schema'
import { useCategories } from '../../lib/hooks'
import { BottomSheet, Button, CategoryCell, CategoryIcon, ConfirmDialog, ListGroup, ListRow, Screen, SegmentedControl, TextField, useRouter, useToast, CATEGORY_ICON_NAMES } from '../../ui'
import { ReorderList } from '../Reorder'
import { ColorGrid, GroupLabel, IconGrid, ValueRow, errorMessage, useOpenSession } from '../shared'

const ENTITY = new Set<string>(ENTITY_ICON_IDS)
/** Urutan grid pemilih: urutan tematik dari UI, lalu sisa ID entitas. */
const PICKER_ICONS: IconName[] = [
  ...(CATEGORY_ICON_NAMES.filter((i) => ENTITY.has(i)) as IconName[]),
  ...ENTITY_ICON_IDS.filter((i) => !(CATEGORY_ICON_NAMES as string[]).includes(i)),
]

export function CategoriesScreen() {
  const router = useRouter()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const all = useCategories(kind, { includeArchived: true })
  const [sorting, setSorting] = useState(false)
  const [edit, setEdit] = useState<{ open: boolean; cat: Category | null }>({ open: false, cat: null })
  const active = all?.filter((c) => c.archived === 0) ?? []
  const archived = all?.filter((c) => c.archived === 1) ?? []

  return (
    <Screen title="Kategori" back={{ label: 'Pengaturan', onBack: () => router.back('/pengaturan') }}>
      <div className="s-seg-pad">
        <SegmentedControl
          ariaLabel="Jenis kategori"
          value={kind}
          onChange={(k) => {
            setKind(k)
            setSorting(false)
          }}
          options={[
            { value: 'expense', label: 'Pengeluaran' },
            { value: 'income', label: 'Pemasukan' },
          ]}
        />
      </div>
      <GroupLabel action={active.length > 1 ? { label: sorting ? 'Selesai' : 'Urutkan', onClick: () => setSorting((s) => !s) } : undefined}>Aktif</GroupLabel>
      {sorting ? (
        <ReorderList
          items={active}
          onReorder={(ids) => void reorderCategories(ids)}
          render={(c, handle) => <ListRow leading={<CategoryIcon icon={c.icon} color={c.color} />} title={c.name} trailing={handle} />}
        />
      ) : (
        <ListGroup>
          {active.map((c) => (
            <ListRow key={c.id} leading={<CategoryIcon icon={c.icon} color={c.color} />} title={c.name} chevron onClick={() => setEdit({ open: true, cat: c })} />
          ))}
          <ValueRow title="Kategori baru" tone="accent" icon={{ name: 'plus', color: 'neutral' }} chevron={false} onClick={() => setEdit({ open: true, cat: null })} />
        </ListGroup>
      )}
      <p className="s-footnote">Urutan di sini sama dengan urutan grid di sheet input. Taruh yang paling sering dipakai di atas.</p>

      {archived.length > 0 && (
        <>
          <GroupLabel>Diarsipkan</GroupLabel>
          <ListGroup>
            {archived.map((c) => (
              <ListRow
                key={c.id}
                leading={<CategoryIcon icon={c.icon} color="neutral" />}
                title={c.name}
                trailing={<span className="ui-btn ui-btn--secondary ui-btn--sm">Pulihkan</span>}
                onClick={() => void unarchiveCategory(c.id)}
              />
            ))}
          </ListGroup>
        </>
      )}
      <CategorySheet open={edit.open} onClose={() => setEdit((e) => ({ ...e, open: false }))} cat={edit.cat} kind={kind} activeCount={active.length} />
    </Screen>
  )
}

function CategorySheet(props: { open: boolean; onClose: () => void; cat: Category | null; kind: CategoryKind; activeCount: number }) {
  const session = useOpenSession(props.open)
  return <CategorySheetInner key={session} {...props} />
}

function CategorySheetInner({ open, onClose, cat, kind, activeCount }: { open: boolean; onClose: () => void; cat: Category | null; kind: CategoryKind; activeCount: number }) {
  const toast = useToast()
  const [name, setName] = useState(cat?.name ?? '')
  const [icon, setIcon] = useState<IconName>(cat?.icon ?? 'dots')
  const [color, setColor] = useState<ColorToken>(cat?.color ?? 'c1')
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const last = !!cat && activeCount <= 1

  const save = async () => {
    setError(null)
    try {
      if (cat) await updateCategory(cat.id, { name: name.trim(), icon, color })
      else await createCategory({ kind, name: name.trim(), icon, color })
      toast.show({ message: cat ? 'Kategori disimpan' : `Kategori ${name.trim()} dibuat` })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const remove = async () => {
    if (!cat) return
    setConfirm((await canDeleteCategory(cat.id)) ? 'delete' : 'archive')
  }
  const doRemove = async () => {
    if (!cat) return
    try {
      if (confirm === 'delete') await deleteCategory(cat.id)
      else await archiveCategory(cat.id)
      toast.show({ message: confirm === 'delete' ? 'Kategori dihapus' : 'Kategori diarsipkan' })
      setConfirm(null)
      onClose()
    } catch (e) {
      setConfirm(null)
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        detent="full"
        title={cat ? 'Ubah kategori' : 'Kategori baru'}
        headerLeft={
          <button type="button" className="s-sheet-btn" onClick={onClose}>
            Batal
          </button>
        }
        headerRight={
          <button type="button" className="s-sheet-btn is-strong" disabled={!name.trim()} onClick={save}>
            Simpan
          </button>
        }
      >
        <div className="s-form">
          <div className="s-cat-preview" aria-hidden="true">
            <CategoryCell icon={icon} color={color} label={name.trim() || 'Nama kategori'} />
          </div>
          <TextField
            label="Nama"
            value={name}
            onChange={(v) => setName(v.slice(0, CATEGORY_NAME_MAX))}
            placeholder="mis. Kopi, Parkir, Arisan"
            error={error ?? undefined}
            autoComplete="off"
          />
          <p className="s-form__label">Ikon</p>
          <IconGrid icons={PICKER_ICONS} value={icon} color={color} onChange={setIcon} />
          <p className="s-form__label">Warna</p>
          <ColorGrid value={color} onChange={setColor} />
          {cat && (
            <Button variant="destructive" size="lg" block disabled={last} onClick={remove}>
              Arsipkan atau hapus
            </Button>
          )}
          {last && <p className="s-form__lead">Minimal satu kategori {kind === 'expense' ? 'pengeluaran' : 'pemasukan'} harus aktif.</p>}
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'delete' ? 'Hapus kategori?' : 'Arsipkan kategori?'}
        message={
          confirm === 'delete'
            ? 'Kategori ini belum dipakai dan akan dihapus permanen.'
            : 'Kategori ini sudah dipakai. Setelah diarsipkan, kategori hilang dari grid input tetapi tetap tampil di riwayat dan laporan.'
        }
        confirmLabel={confirm === 'delete' ? 'Hapus kategori' : 'Arsipkan'}
        onConfirm={doRemove}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
