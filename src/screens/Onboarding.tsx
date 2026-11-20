/* Sambutan pertama kali (setelah seed). Satu layar, lalu langsung ke sheet input. */
import { ArusMark, Button, Icon, type IconName } from '../ui'

const POINTS: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'bolt', title: 'Empat tap per transaksi', desc: 'Ketik nominal, tap kategori. Tersimpan.' },
  { icon: 'scale', title: 'Saldo yang bisa diaudit', desc: 'Dihitung dari transaksi, bukan angka yang diketik ulang.' },
  { icon: 'lock', title: 'Data tetap di iPhone ini', desc: 'Tanpa akun, tanpa server. Backup ke Files kapan saja.' },
]

export function Onboarding({ onDone }: { onDone: () => void }) {
  return (
    <div className="s-onboard" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="s-onboard__inner">
        <div className="s-onboard__brand">
          <span className="s-onboard__tile">
            <ArusMark size={44} />
          </span>
          <h1 id="onboard-title" className="s-onboard__name">
            Arus
          </h1>
          <p className="s-onboard__tag">Catatan keuangan yang lebih cepat daripada membayar.</p>
        </div>
        <ul className="s-onboard__points">
          {POINTS.map((p) => (
            <li key={p.title} className="s-onboard__point">
              <span className="s-onboard__icon">
                <Icon name={p.icon} size={22} />
              </span>
              <span>
                <span className="s-onboard__ptitle">{p.title}</span>
                <span className="s-onboard__pdesc">{p.desc}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="s-onboard__foot">
        <Button size="lg" block onClick={onDone}>
          Mulai mencatat
        </Button>
        <p className="s-onboard__note">Akun Tunai, Rekening Bank, dan E-Wallet sudah disiapkan. Ubah kapan saja di tab Akun.</p>
      </div>
    </div>
  )
}
