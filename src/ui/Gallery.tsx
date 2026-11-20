/*
 * /_gallery — halaman verifikasi visual komponen (hanya dev).
 * Query: ?theme=light|dark  ?open=input|auto|confirm|toast|update
 */
import { useEffect, useState, type ReactNode } from 'react'
import { AmountDisplay, Keypad } from './Keypad'
import { AmountText } from './AmountText'
import { BottomSheet } from './BottomSheet'
import { Button, Chip, IconButton } from './Button'
import { CategoryCell } from './CategoryCell'
import { ConfirmDialog } from './ConfirmDialog'
import { DonutChart } from './DonutChart'
import { EmptyState } from './EmptyState'
import { ArusMark, CATEGORY_ICON_NAMES, Icon, ICON_NAMES, type IconName } from './icons'
import { CategoryIcon, ListGroup, ListRow, SectionHeader, type CategoryColor } from './ListRow'
import { ProgressBar } from './ProgressBar'
import { Screen } from './Screen'
import { SegmentedControl } from './SegmentedControl'
import { Switch } from './Switch'
import { TabBar } from './TabBar'
import { TextField } from './TextField'
import { useToast } from './Toast'
import { applyTheme, type ThemePref } from './theme'
import './gallery.css'

const CATS: { icon: IconName; color: CategoryColor; label: string }[] = [
  { icon: 'utensils', color: 1, label: 'Makan & Minum' },
  { icon: 'car', color: 2, label: 'Transportasi' },
  { icon: 'basket', color: 3, label: 'Belanja Harian' },
  { icon: 'bolt', color: 4, label: 'Tagihan & Utilitas' },
  { icon: 'home', color: 5, label: 'Tempat Tinggal' },
  { icon: 'bag', color: 6, label: 'Belanja' },
  { icon: 'film', color: 7, label: 'Hiburan & Langganan' },
  { icon: 'heart-pulse', color: 8, label: 'Kesehatan' },
  { icon: 'users', color: 9, label: 'Keluarga & Sosial' },
  { icon: 'hand-heart', color: 10, label: 'Sedekah & Zakat' },
  { icon: 'book', color: 11, label: 'Pendidikan' },
  { icon: 'dots', color: 12, label: 'Lainnya' },
]

const DONUT = [
  { id: 'makan', value: 1_840_000, color: 'var(--c1)', label: 'Makan & Minum' },
  { id: 'transport', value: 920_000, color: 'var(--c2)', label: 'Transportasi' },
  { id: 'tagihan', value: 640_000, color: 'var(--c4)', label: 'Tagihan' },
  { id: 'belanja', value: 410_000, color: 'var(--c6)', label: 'Belanja' },
  { id: 'hiburan', value: 220_000, color: 'var(--c7)', label: 'Hiburan' },
  { id: 'sedekah', value: 150_000, color: 'var(--c10)', label: 'Sedekah' },
  { id: 'lain', value: 60_000, color: 'var(--ink-3)', label: 'Lainnya' },
]

function Block({ title, children, pad = true }: { title: string; children: ReactNode; pad?: boolean }) {
  return (
    <section className="gal-block">
      <SectionHeader title={title} />
      <div className={pad ? 'gal-pad' : undefined}>{children}</div>
    </section>
  )
}

export default function Gallery() {
  const toast = useToast()
  const params = new URLSearchParams(location.search)
  const [theme, setTheme] = useState<ThemePref>((params.get('theme') as ThemePref) || 'system')
  const [sheet, setSheet] = useState<null | 'input' | 'auto'>(null)
  const [confirm, setConfirm] = useState(false)
  const [mode, setMode] = useState<'expense' | 'income' | 'transfer'>('expense')
  const [amount, setAmount] = useState(25000)
  const [shake, setShake] = useState(0)
  const [cat, setCat] = useState<number | null>(null)
  const [period, setPeriod] = useState<'exp' | 'inc'>('exp')
  const [q, setQ] = useState('')
  const [note, setNote] = useState('Kopi susu gula aren')
  const [sw1, setSw1] = useState(true)
  const [sw2, setSw2] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [hl, setHl] = useState(0)

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    const open = params.get('open')
    if (open === 'input') setSheet('input')
    if (open === 'auto') setSheet('auto')
    if (open === 'confirm') setConfirm(true)
    if (open === 'toast') showUndo()
    if (open === 'update')
      toast.show({ id: 'sw-update', message: 'Versi baru tersedia', action: { label: 'Muat ulang', onAction: () => {} }, duration: Infinity })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showUndo = () =>
    toast.show({
      message: 'Tersimpan · Makan & Minum −Rp 25.000',
      action: { label: 'Urungkan', onAction: () => toast.show({ message: 'Dibatalkan' }) },
    })

  const selSeg = DONUT.find((d) => d.id === sel)
  const total = DONUT.reduce((a, b) => a + b.value, 0)

  return (
    <>
      <Screen
        title="Komponen"
        actions={
          <>
            <IconButton icon="search" label="Cari" />
            <IconButton icon="gear" label="Pengaturan" />
          </>
        }
      >
        <div className="gal-pad gal-top">
          <SegmentedControl
            ariaLabel="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: 'Sistem' },
              { value: 'light', label: 'Terang' },
              { value: 'dark', label: 'Gelap' },
            ]}
          />
        </div>

        {/* Header saldo */}
        <div className="gal-balance">
          <p className="t-footnote ink-2">Total saldo</p>
          <AmountText value={12_480_500} kind="balance" size="amount-l" />
          <p className="t-footnote ink-2 num gal-balance__line">
            Bulan ini: <AmountText value={3_240_000} kind="expense" size="inherit" /> keluar ·{' '}
            <AmountText value={8_500_000} kind="income" size="inherit" /> masuk
          </p>
          <div className="gal-period" aria-hidden="true">
            <span style={{ width: '64%' }} />
          </div>
        </div>

        <section>
        <SectionHeader title="Hari ini" trailing={<AmountText value={-87_000} size="inherit" />} sticky />
        <ListGroup>
          <ListRow
            leading={<CategoryIcon icon="coffee" color={1} />}
            title="Kopi susu gula aren"
            subtitle="Makan & Minum · Tunai"
            trailing={<AmountText value={25_000} kind="expense" />}
            onClick={() => {}}
            onDelete={() => toast.show({ message: 'Dihapus', action: { label: 'Urungkan', onAction: () => {} } })}
            highlight={hl > 0}
            key={`hl-${hl}`}
          />
          <ListRow
            leading={<CategoryIcon icon="motorbike" color={2} />}
            title="Transportasi"
            subtitle="GoPay"
            trailing={<AmountText value={18_500} kind="expense" />}
            onClick={() => {}}
            onDelete={() => {}}
          />
          <ListRow
            leading={<CategoryIcon icon="wifi" color={4} />}
            title="Internet rumah"
            subtitle="Tagihan & Utilitas · BCA"
            subtitleIcon="repeat"
            trailing={<AmountText value={43_500} kind="expense" />}
            onClick={() => {}}
          />
        </ListGroup>
        </section>
        <section>
        <SectionHeader title="Kemarin" trailing={<AmountText value={8_380_000} kind="income" size="inherit" />} sticky />
        <ListGroup>
          <ListRow
            leading={<CategoryIcon icon="briefcase" color={10} />}
            title="Gaji"
            subtitle="BCA"
            trailing={<AmountText value={8_500_000} kind="income" />}
            onClick={() => {}}
          />
          <ListRow
            leading={<CategoryIcon icon="arrows-swap" color="neutral" />}
            title="BCA → Tunai"
            subtitle="Transfer"
            trailing={<AmountText value={500_000} kind="transfer" />}
            onClick={() => {}}
          />
          <ListRow
            leading={<CategoryIcon icon="utensils" color={1} />}
            title="Makan siang"
            subtitle="Makan & Minum · Tunai"
            trailing={<AmountText value={120_000} kind="expense" />}
            trailingSub="Saldo Rp 1.240.000"
            onClick={() => {}}
          />
        </ListGroup>
        </section>

        <Block title="Akun">
          <ListGroup inset={false} className="gal-flush">
            <ListRow leading={<CategoryIcon icon="cash" color={3} />} title="Tunai" subtitle="Tunai" trailing={<AmountText value={1_240_000} kind="balance" />} chevron onClick={() => {}} />
            <ListRow leading={<CategoryIcon icon="bank" color={2} />} title="BCA" subtitle="Rekening Bank" trailing={<AmountText value={10_850_500} kind="balance" />} chevron onClick={() => {}} />
            <ListRow leading={<CategoryIcon icon="card" color={6} />} title="Kartu kredit" subtitle="Kartu Kredit" trailing={<AmountText value={-1_610_000} kind="balance" />} chevron onClick={() => {}} />
            <ListRow title="Hitung ke total saldo" trailing={<Switch checked={sw1} onChange={setSw1} ariaLabel="Hitung ke total saldo" />} />
          </ListGroup>
        </Block>

        <Block title="Ringkasan">
          <div className="gal-card">
            <SegmentedControl
              ariaLabel="Jenis"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'exp', label: 'Pengeluaran' },
                { value: 'inc', label: 'Pemasukan' },
              ]}
            />
            <div className="gal-center">
              <DonutChart
                segments={DONUT}
                selectedId={sel}
                onSelect={setSel}
                ariaLabel="Pengeluaran November: Makan 43%, Transportasi 22%, Tagihan 15%"
                centerValue={<AmountText value={selSeg ? selSeg.value : total} size="inherit" short={false} />}
                centerLabel={selSeg ? `${selSeg.label} · ${Math.round((selSeg.value / total) * 100)}%` : 'Pengeluaran'}
              />
            </div>
            <div className="gal-donut-empty">
              <DonutChart segments={[]} size={96} ariaLabel="Belum ada data" />
              <p className="t-subhead ink-2">Ring kosong saat periode tanpa data.</p>
            </div>
          </div>
        </Block>

        <Block title="Anggaran">
          <div className="gal-card">
            <p className="t-footnote ink-2">Sisa</p>
            <p className="gal-budget-head">
              <AmountText value={1_760_000} size="title" />
              <span className="t-subhead ink-2 num"> dari Rp 5.000.000</span>
            </p>
            <ProgressBar value={3_240_000} max={5_000_000} today={0.64} thickness={6} ariaLabel="Total anggaran" />
            <p className="t-footnote ink-2 num gal-mt8">≈ Rp 117.000/hari untuk 15 hari lagi</p>
          </div>
          <ListGroup inset={false} className="gal-flush gal-mt12">
            {[
              { icon: 'utensils' as const, c: 1 as const, name: 'Makan & Minum', v: 640_000, m: 1_500_000 },
              { icon: 'car' as const, c: 2 as const, name: 'Transportasi', v: 690_000, m: 800_000 },
              { icon: 'bag' as const, c: 6 as const, name: 'Belanja', v: 620_000, m: 500_000 },
            ].map((b) => {
              const over = b.v > b.m
              return (
                <div key={b.name} className="gal-budget-row">
                  <CategoryIcon icon={b.icon} color={b.c} />
                  <div className="gal-budget-main">
                    <div className="gal-budget-top">
                      <span className="t-body">{b.name}</span>
                      <span className="t-subhead ink-2 num">
                        {b.v.toLocaleString('id-ID')} / {b.m.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <ProgressBar value={b.v} max={b.m} today={0.64} />
                    <span className={`t-footnote num ${over ? 'gal-neg' : 'ink-2'}`}>
                      {over ? `Lebih Rp ${(b.v - b.m).toLocaleString('id-ID')}` : `Sisa Rp ${(b.m - b.v).toLocaleString('id-ID')}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </ListGroup>
        </Block>

        <Block title="Tombol & chip">
          <div className="gal-stack">
            <Button size="lg" block>
              Simpan
            </Button>
            <div className="gal-row">
              <Button variant="secondary">Buat backup</Button>
              <Button variant="neutral">Pulihkan</Button>
              <Button variant="plain">Atur</Button>
            </div>
            <div className="gal-row">
              <Button variant="destructive" icon="trash">
                Hapus
              </Button>
              <Button disabled>Nonaktif</Button>
            </div>
            <div className="gal-row">
              <Chip icon="cash" menu>
                Tunai
              </Chip>
              <Chip icon="calendar" menu>
                Hari ini
              </Chip>
              <Chip icon="note">Catatan</Chip>
              <Chip active menu>
                Bulan ini
              </Chip>
            </div>
          </div>
        </Block>

        <Block title="Field & switch">
          <div className="gal-stack">
            <TextField value={q} onChange={setQ} icon="search" clearable placeholder="Cari catatan, kategori, akun, nominal" type="search" />
            <TextField value={note} onChange={setNote} label="Catatan" clearable />
            <TextField value="Tunai" onChange={() => {}} label="Nama akun" error="Nama sudah dipakai" />
            <div className="gal-card gal-card--tight">
              <Switch label="Buka langsung ke input" checked={sw1} onChange={setSw1} />
              <Switch label="Kunci PIN" checked={sw2} onChange={setSw2} />
            </div>
          </div>
        </Block>

        <Block title="Overlay">
          <div className="gal-row">
            <Button variant="neutral" onClick={() => setSheet('input')}>
              Sheet input
            </Button>
            <Button variant="neutral" onClick={() => setSheet('auto')}>
              Sheet auto
            </Button>
            <Button variant="neutral" onClick={() => setConfirm(true)}>
              Konfirmasi
            </Button>
            <Button variant="neutral" onClick={showUndo}>
              Toast
            </Button>
            <Button variant="neutral" onClick={() => setHl((h) => h + 1)}>
              Sorot baris
            </Button>
          </div>
        </Block>

        <Block title="State kosong" pad={false}>
          <EmptyState
            icon="list"
            title="Belum ada transaksi"
            description="Tap + untuk mencatat yang pertama. Biasanya cukup 4 tap."
            action={{ label: 'Catat transaksi', onClick: () => setSheet('input') }}
          />
        </Block>

        <Block title={`Ikon kategori (${CATEGORY_ICON_NAMES.length})`}>
          <div className="gal-icons">
            {CATEGORY_ICON_NAMES.map((n, i) => (
              <div key={n} className="gal-icon">
                <CategoryIcon icon={n} color={((i % 12) + 1) as CategoryColor} />
                <span className="gal-icon__name">{n}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Ikon UI">
          <div className="gal-icons gal-icons--ui">
            {ICON_NAMES.filter((n) => !CATEGORY_ICON_NAMES.includes(n)).map((n) => (
              <div key={n} className="gal-icon">
                <Icon name={n} size={24} />
                <span className="gal-icon__name">{n}</span>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Identitas">
          <div className="gal-brand">
            <div className="gal-appicon">
              <ArusMark size={40} />
            </div>
            <div>
              <p className="gal-wordmark">Arus</p>
              <p className="t-footnote ink-2">Semua data hanya ada di perangkat ini</p>
            </div>
          </div>
        </Block>
      </Screen>

      <TabBar hidden={sheet !== null} onAdd={() => setSheet('input')} active="transactions" />

      <BottomSheet
        open={sheet === 'input'}
        onClose={() => setSheet(null)}
        detent="full"
        ariaLabel="Catat transaksi"
        headerLeft={
          <Button variant="plain" onClick={() => setSheet(null)}>
            Batal
          </Button>
        }
        headerCenter={
          <SegmentedControl
            ariaLabel="Jenis transaksi"
            value={mode}
            onChange={setMode}
            block={false}
            options={[
              { value: 'expense', label: 'Keluar' },
              { value: 'income', label: 'Masuk' },
              { value: 'transfer', label: 'Transfer' },
            ]}
          />
        }
        footer={
          <Keypad
            value={amount}
            onChange={setAmount}
            onReject={() => setShake((s) => s + 1)}
            captureKeyboard={sheet === 'input'}
            onEscape={() => setSheet(null)}
            submit={cat !== null ? { disabled: amount === 0, onSubmit: () => { setSheet(null); showUndo() } } : undefined}
          />
        }
      >
        <div className="gal-input">
          <AmountDisplay value={amount} mode={mode} shakeKey={shake} />
          <div className="gal-context">
            <Chip icon="cash" menu>
              Tunai
            </Chip>
            <Chip icon="calendar" menu>
              Hari ini
            </Chip>
            <Chip icon="plus">Catatan</Chip>
          </div>
          <div className="ui-cat-grid">
            {CATS.map((c, i) => (
              <CategoryCell key={c.label} {...c} selected={cat === i} recent={i === 0} onClick={() => setCat(cat === i ? null : i)} />
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'auto'} onClose={() => setSheet(null)} title="Pilih akun">
        <ListGroup inset={false}>
          <ListRow leading={<CategoryIcon icon="cash" color={3} />} title="Tunai" trailing={<AmountText value={1_240_000} kind="balance" />} onClick={() => setSheet(null)} />
          <ListRow leading={<CategoryIcon icon="bank" color={2} />} title="BCA" trailing={<AmountText value={10_850_500} kind="balance" />} onClick={() => setSheet(null)} />
          <ListRow leading={<CategoryIcon icon="smartphone-wallet" color={8} />} title="GoPay" trailing={<AmountText value={390_000} kind="balance" />} onClick={() => setSheet(null)} />
          <ListRow leading={<CategoryIcon icon="card" color={6} />} title="Kartu kredit" trailing={<AmountText value={-1_610_000} kind="balance" />} onClick={() => setSheet(null)} />
        </ListGroup>
      </BottomSheet>

      <ConfirmDialog
        open={confirm}
        title="Buang perubahan?"
        message="Perubahan pada transaksi ini belum disimpan."
        confirmLabel="Buang perubahan"
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
