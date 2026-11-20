/* Favorit / template (PRD §3.10). */
import { useState } from 'react'
import { createTemplate, deleteTemplate, reorderTemplates, updateTemplate } from '../../db/repo'
import { MAX_TEMPLATES, TEMPLATE_LABEL_MAX, type CategoryKind, type ID, type Template } from '../../db/schema'
import { useAccounts, useCategories, useLookup, useTemplates } from '../../lib/hooks'
import { formatIDR } from '../../lib/money'
import { AmountText, BottomSheet, Button, CategoryIcon, EmptyState, Icon, ListGroup, ListRow, Screen, SegmentedControl, TextField, useRouter, useToast } from '../../ui'
import { ReorderList } from '../Reorder'
import { AccountPickerSheet, AmountSheet, CategoryPickerSheet, GroupLabel, ValueRow, errorMessage, useOpenSession } from '../shared'

export function FavoritesScreen() {
  const router = useRouter()
  const templates = useTemplates()
  const lookup = useLookup()
  const [sorting, setSorting] = useState(false)
  const [edit, setEdit] = useState<{ open: boolean; t: Template | null }>({ open: false, t: null })
  const full = (templates?.length ?? 0) >= MAX_TEMPLATES

  const sub = (t: Template) => {
    const cat = lookup?.categories.get(t.categoryId)?.name ?? ''
    const acc = t.accountId ? lookup?.accounts.get(t.accountId)?.name : undefined
    return acc ? `${cat} · ${acc}` : cat
  }

  return (
    <Screen title="Favorit" back={{ label: 'Pengaturan', onBack: () => router.back('/pengaturan') }}>
      {templates && lookup && (
        <>
          {templates.length === 0 ? (
            <EmptyState
              icon="star"
              title="Belum ada favorit"
              description="Simpan transaksi yang sering berulang, seperti Kopi 25rb, untuk dicatat dengan 1 tap."
              action={{ label: 'Tambah favorit', onClick: () => setEdit({ open: true, t: null }) }}
            />
          ) : (
            <>
              <GroupLabel action={templates.length > 1 ? { label: sorting ? 'Selesai' : 'Urutkan', onClick: () => setSorting((s) => !s) } : undefined}>
                {templates.length} dari {MAX_TEMPLATES}
              </GroupLabel>
              {sorting ? (
                <ReorderList
                  items={templates}
                  onReorder={(ids) => void reorderTemplates(ids)}
                  render={(t, handle) => {
                    const c = lookup.categories.get(t.categoryId)
                    return <ListRow leading={<CategoryIcon icon={c?.icon ?? 'star'} color={c?.color ?? 'c12'} />} title={t.label} subtitle={sub(t)} trailing={handle} />
                  }}
                />
              ) : (
                <ListGroup>
                  {templates.map((t) => {
                    const c = lookup.categories.get(t.categoryId)
                    return (
                      <ListRow
                        key={t.id}
                        leading={<CategoryIcon icon={c?.icon ?? 'star'} color={c?.color ?? 'c12'} />}
                        title={t.label}
                        subtitle={sub(t)}
                        trailing={<AmountText value={t.amount} kind={t.type} />}
                        onClick={() => setEdit({ open: true, t })}
                      />
                    )
                  })}
                  <ValueRow
                    title={full ? `Maksimal ${MAX_TEMPLATES} favorit` : 'Favorit baru'}
                    tone={full ? undefined : 'accent'}
                    icon={{ name: 'plus', color: 'neutral' }}
                    chevron={false}
                    onClick={full ? undefined : () => setEdit({ open: true, t: null })}
                  />
                </ListGroup>
              )}
              <p className="s-footnote">Tap favorit di sheet input untuk langsung menyimpan. Tekan lama untuk mengisi form dan mengubah nominal dulu.</p>
            </>
          )}
        </>
      )}
      <TemplateSheet open={edit.open} onClose={() => setEdit((e) => ({ ...e, open: false }))} template={edit.t} />
    </Screen>
  )
}

function TemplateSheet(props: { open: boolean; onClose: () => void; template: Template | null }) {
  const session = useOpenSession(props.open)
  return <TemplateSheetInner key={session} {...props} />
}

function TemplateSheetInner({ open, onClose, template }: { open: boolean; onClose: () => void; template: Template | null }) {
  const toast = useToast()
  const lookup = useLookup()
  const accounts = useAccounts()
  const [type, setType] = useState<CategoryKind>(template?.type ?? 'expense')
  const cats = useCategories(type)
  const [label, setLabel] = useState(template?.label ?? '')
  const [amount, setAmount] = useState(template?.amount ?? 0)
  const [categoryId, setCategoryId] = useState<ID | null>(template?.categoryId ?? null)
  const [accountId, setAccountId] = useState<ID | null>(template?.accountId ?? null)
  const [note, setNote] = useState(template?.note ?? '')
  const [sub, setSub] = useState<'amount' | 'cat' | 'acc' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cat = categoryId ? lookup?.categories.get(categoryId) : undefined
  const valid = label.trim() && amount > 0 && categoryId

  const save = async () => {
    if (!valid || !categoryId) return
    setError(null)
    const data = { label: label.trim(), type, amount, categoryId, accountId: accountId ?? undefined, note: note.trim() || undefined }
    try {
      if (template) await updateTemplate(template.id, data)
      else await createTemplate(data)
      toast.show({ message: template ? 'Favorit disimpan' : 'Favorit ditambahkan' })
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        detent="full"
        title={template ? 'Ubah favorit' : 'Favorit baru'}
        headerLeft={
          <button type="button" className="s-sheet-btn" onClick={onClose}>
            Batal
          </button>
        }
        headerRight={
          <button type="button" className="s-sheet-btn is-strong" disabled={!valid} onClick={save}>
            Simpan
          </button>
        }
      >
        <div className="s-form">
          <SegmentedControl
            ariaLabel="Jenis"
            value={type}
            onChange={(t) => {
              setType(t)
              setCategoryId(null)
            }}
            options={[
              { value: 'expense', label: 'Keluar' },
              { value: 'income', label: 'Masuk' },
            ]}
          />
          <TextField label="Label" value={label} onChange={(v) => setLabel(v.slice(0, TEMPLATE_LABEL_MAX))} placeholder="mis. Kopi" error={error ?? undefined} autoComplete="off" />
          <p className="s-form__label">Nominal</p>
          <button type="button" className="s-picker" onClick={() => setSub('amount')}>
            <span className={amount ? 's-picker__value num' : 's-picker__value is-placeholder'}>{amount ? formatIDR(amount) : 'Atur nominal'}</span>
            <Icon name="chevron-right" size={17} />
          </button>
          <p className="s-form__label">Kategori</p>
          <button type="button" className="s-picker" onClick={() => setSub('cat')}>
            {cat && <CategoryIcon icon={cat.icon} color={cat.color} />}
            <span className={cat ? 's-picker__value' : 's-picker__value is-placeholder'}>{cat?.name ?? 'Pilih kategori'}</span>
            <Icon name="chevron-right" size={17} />
          </button>
          <p className="s-form__label">Akun</p>
          <button type="button" className="s-picker" onClick={() => setSub('acc')}>
            <span className="s-picker__value">{(accountId && accounts?.find((a) => a.id === accountId)?.name) || 'Akun default saat dipakai'}</span>
            <Icon name="chevron-right" size={17} />
          </button>
          <TextField label="Catatan (opsional)" value={note} onChange={(v) => setNote(v.slice(0, 120))} placeholder="Ikut tersimpan di transaksi" autoComplete="off" />
          {template && (
            <Button
              variant="destructive"
              size="lg"
              block
              onClick={async () => {
                await deleteTemplate(template.id)
                toast.show({ message: 'Favorit dihapus' })
                onClose()
              }}
            >
              Hapus favorit
            </Button>
          )}
        </div>
      </BottomSheet>
      <AmountSheet
        open={sub === 'amount'}
        onClose={() => setSub(null)}
        title="Nominal"
        initial={amount}
        onSave={(v) => {
          setAmount(v)
          setSub(null)
        }}
      />
      <CategoryPickerSheet
        open={sub === 'cat'}
        onClose={() => setSub(null)}
        categories={cats ?? []}
        value={categoryId}
        onSelect={(id) => {
          setCategoryId(id)
          if (!label.trim()) setLabel(lookup?.categories.get(id)?.name.slice(0, TEMPLATE_LABEL_MAX) ?? '')
          setSub(null)
        }}
      />
      <AccountPickerSheet
        open={sub === 'acc'}
        onClose={() => setSub(null)}
        allowNone="Akun default saat dipakai"
        value={accountId}
        onSelect={(id) => {
          setAccountId(id)
          setSub(null)
        }}
      />
    </>
  )
}
