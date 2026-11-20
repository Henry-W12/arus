/* Tab Akun (PRD §3.6). */
import { useState } from 'react'
import { reorderAccounts } from '../db/repo'
import type { Account } from '../db/schema'
import { useBalances } from '../lib/hooks'
import { AmountText, CategoryIcon, Icon, IconButton, ListGroup, ListRow, Screen, useRouter, useSheet } from '../ui'
import { AccountSheet } from './AccountSheet'
import { ReorderList } from './Reorder'
import { GroupLabel, accountTypeLabel } from './shared'

export function AccountsScreen() {
  const { navigate } = useRouter()
  const sheet = useSheet()
  const bal = useBalances()
  const [sorting, setSorting] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const active = bal?.accounts.filter((a) => a.archived === 0) ?? []
  const archived = bal?.accounts.filter((a) => a.archived === 1) ?? []
  const sub = (a: Account) => accountTypeLabel(a.type) + (a.includeInTotal ? '' : ' · tidak dihitung')

  return (
    <Screen
      title="Akun"
      actions={
        <>
          <IconButton icon="gear" label="Pengaturan" onClick={() => navigate('/pengaturan')} />
          <IconButton icon="plus" label="Akun baru" onClick={() => setNewOpen(true)} />
        </>
      }
    >
      {bal && (
        <>
          <div className="s-hero s-hero--static">
            <span className="s-hero__label">Total saldo</span>
            <AmountText value={bal.total} kind="balance" size="amount-l" className="s-hero__value" />
            <span className="s-hero__line">
              {active.length} akun aktif
              {active.some((a) => !a.includeInTotal) && ' · sebagian tidak dihitung'}
            </span>
            <div className="s-hero__actions">
              <button
                type="button"
                className="ui-btn ui-btn--secondary ui-btn--pill"
                disabled={active.length < 2}
                onClick={() => sheet.open('add', { mode: 'transfer' })}
              >
                <Icon name="arrows-swap" size={17} /> Transfer
              </button>
            </div>
          </div>

          <GroupLabel action={active.length > 1 ? { label: sorting ? 'Selesai' : 'Urutkan', onClick: () => setSorting((s) => !s) } : undefined}>
            Akun aktif
          </GroupLabel>
          {sorting ? (
            <ReorderList
              items={active}
              onReorder={(ids) => void reorderAccounts([...ids, ...archived.map((a) => a.id)])}
              render={(a, handle) => (
                <ListRow leading={<CategoryIcon icon={a.icon} color={a.color} />} title={a.name} subtitle={sub(a)} trailing={handle} />
              )}
            />
          ) : (
            <ListGroup className="s-accounts">
              {active.map((a) => (
                <ListRow
                  key={a.id}
                  leading={<CategoryIcon icon={a.icon} color={a.color} />}
                  title={a.name}
                  subtitle={sub(a)}
                  trailing={<AmountText value={bal.balances.get(a.id) ?? 0} kind="balance" />}
                  chevron
                  onClick={() => navigate(`/akun/${a.id}`)}
                />
              ))}
            </ListGroup>
          )}

          {archived.length > 0 && (
            <>
              <GroupLabel action={{ label: showArchived ? 'Sembunyikan' : 'Tampilkan', onClick: () => setShowArchived((s) => !s) }}>
                Diarsipkan ({archived.length})
              </GroupLabel>
              {showArchived && (
                <ListGroup>
                  {archived.map((a) => (
                    <ListRow
                      key={a.id}
                      leading={<CategoryIcon icon={a.icon} color="neutral" />}
                      title={a.name}
                      subtitle={accountTypeLabel(a.type)}
                      trailing={<AmountText value={bal.balances.get(a.id) ?? 0} kind="balance" muted />}
                      chevron
                      onClick={() => navigate(`/akun/${a.id}`)}
                    />
                  ))}
                </ListGroup>
              )}
            </>
          )}
          <p className="s-footnote">Saldo dihitung dari saldo awal dan semua transaksi. Selisih dengan saldo nyata? Buka akun lalu Sesuaikan saldo.</p>
        </>
      )}
      <AccountSheet open={newOpen} onClose={() => setNewOpen(false)} account={null} activeCount={active.length} />
    </Screen>
  )
}
