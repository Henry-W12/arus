/* Pengaturan (PRD §3.7). */
import { useState } from 'react'
import { setSetting } from '../../db/repo'
import type { TextScale, ThemeSetting } from '../../db/schema'
import { useAccounts, useCategories, useRecurringRules, useSettings, useTemplates } from '../../lib/hooks'
import { describeLastBackup } from '../../lib/storage'
import { BottomSheet, CategoryIcon, ListGroup, ListRow, Screen, SegmentedControl, Switch, checkForUpdate, useRouter, useToast } from '../../ui'
import { AccountPickerSheet, GroupLabel, ValueRow, cx } from '../shared'

export function SettingsScreen() {
  const router = useRouter()
  const toast = useToast()
  const settings = useSettings()
  const accounts = useAccounts()
  const cats = useCategories()
  const templates = useTemplates()
  const rules = useRecurringRules()
  const [sheet, setSheet] = useState<'account' | 'period' | null>(null)
  const [checking, setChecking] = useState(false)
  if (!settings || !accounts) return <Screen title="Pengaturan" back={{ label: 'Akun', onBack: () => router.back('/akun') }}>{null}</Screen>

  const defaultName =
    settings.defaultAccount === 'last' ? 'Terakhir dipakai' : (accounts.find((a) => a.id === settings.defaultAccount)?.name ?? 'Terakhir dipakai')
  const go = (to: string) => () => router.navigate(to)

  return (
    <Screen title="Pengaturan" back={{ label: 'Akun', onBack: () => router.back('/akun') }}>
      <GroupLabel>Tampilan</GroupLabel>
      <div className="s-card s-setting">
        <p className="s-setting__label">Tema</p>
        <SegmentedControl<ThemeSetting>
          ariaLabel="Tema"
          value={settings.theme}
          onChange={(v) => void setSetting('theme', v)}
          options={[
            { value: 'system', label: 'Sistem' },
            { value: 'light', label: 'Terang' },
            { value: 'dark', label: 'Gelap' },
          ]}
        />
        <p className="s-setting__label">Ukuran teks</p>
        <SegmentedControl<string>
          ariaLabel="Ukuran teks"
          value={String(settings.textScale)}
          onChange={(v) => void setSetting('textScale', Number(v) as TextScale)}
          options={[
            { value: '1', label: 'Standar' },
            { value: '1.12', label: 'Besar' },
            { value: '1.24', label: 'Lebih besar' },
          ]}
        />
        <p className="s-setting__preview">Kopi susu gula aren · Rp 25.000</p>
      </div>

      <GroupLabel>Pencatatan</GroupLabel>
      <ListGroup>
        <ValueRow title="Akun default" value={defaultName} onClick={() => setSheet('account')} />
        <ListRow title="Buka langsung ke input" trailing={<Switch ariaLabel="Buka langsung ke input" checked={settings.openToAdd} onChange={(v) => void setSetting('openToAdd', v)} />} />
        <ValueRow title="Awal periode bulanan" value={`Tanggal ${settings.periodStartDay}`} onClick={() => setSheet('period')} />
      </ListGroup>
      <p className="s-footnote">Saat app dibuka, sheet input langsung tampil agar mencatat cukup 4 tap.</p>

      <GroupLabel>Kelola</GroupLabel>
      <ListGroup>
        <ValueRow icon={{ name: 'basket', color: 'c3' }} title="Kategori" value={cats ? String(cats.length) : ''} onClick={go('/pengaturan/kategori')} />
        <ValueRow icon={{ name: 'star', color: 'c4' }} title="Favorit" value={templates ? `${templates.length} dari 12` : ''} onClick={go('/pengaturan/favorit')} />
        <ValueRow
          icon={{ name: 'repeat', color: 'c2' }}
          title="Transaksi berulang"
          value={rules ? `${rules.filter((r) => r.active).length} aktif` : ''}
          onClick={go('/pengaturan/berulang')}
        />
      </ListGroup>

      <GroupLabel>Data & keamanan</GroupLabel>
      <ListGroup>
        <ValueRow
          icon={{ name: 'download', color: 'c8' }}
          title="Data & Backup"
          value={<span className={cx(settings.lastBackupAt === null && 'is-warning-text')}>{describeLastBackup(settings.lastBackupAt)}</span>}
          onClick={go('/pengaturan/data')}
        />
        <ValueRow icon={{ name: 'lock', color: 'c12' }} title="Kunci PIN" value={settings.pin ? 'Aktif' : 'Mati'} onClick={go('/pengaturan/keamanan')} />
      </ListGroup>

      <GroupLabel>Tentang</GroupLabel>
      <ListGroup>
        <ListRow leading={<CategoryIcon icon="info" color="neutral" />} title="Arus" subtitle={`Versi ${__APP_VERSION__} (${__APP_BUILD__})`} />
        <ValueRow
          title={checking ? 'Memeriksa…' : 'Periksa pembaruan'}
          tone="accent"
          chevron={false}
          onClick={async () => {
            setChecking(true)
            try {
              const found = await checkForUpdate()
              toast.show({ message: found ? 'Versi baru siap dipasang' : 'Arus sudah versi terbaru' })
            } catch {
              toast.show({ message: 'Tidak bisa memeriksa saat ini', tone: 'error' })
            } finally {
              setChecking(false)
            }
          }}
        />
      </ListGroup>
      <p className="s-footnote">Semua data hanya ada di perangkat ini. Tidak ada akun, server, atau pelacakan. Buat backup berkala agar data aman jika iPhone hilang.</p>

      <AccountPickerSheet
        open={sheet === 'account'}
        onClose={() => setSheet(null)}
        title="Akun default"
        allowNone="Terakhir dipakai"
        value={settings.defaultAccount === 'last' ? null : settings.defaultAccount}
        onSelect={(id) => {
          void setSetting('defaultAccount', id ?? 'last')
          setSheet(null)
        }}
      />
      <BottomSheet open={sheet === 'period'} onClose={() => setSheet(null)} title="Awal periode bulanan" detent="auto">
        <div className="s-form">
          <p className="s-form__lead">
            Cocok untuk tanggal gajian. Jika gaji masuk tanggal 25, periode November = 25 Okt – 24 Nov. Hanya tanggal 1–28 agar setiap bulan punya hari mulai yang pasti.
          </p>
          <div className="s-daygrid" role="radiogroup" aria-label="Tanggal mulai">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={d === settings.periodStartDay}
                className={cx('s-date__day num', d === settings.periodStartDay && 'is-selected')}
                onClick={() => {
                  void setSetting('periodStartDay', d)
                  setSheet(null)
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </Screen>
  )
}
