import { useState } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useI18n } from '@/context/I18nContext'
import logo from '@/assets/logo.png'

export function Titlebar() {
  const { connected, port, ports, connect, disconnect, refreshPorts } = useDevice()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState('')

  // Ouvre/ferme le menu de connexion ; rafraîchit la liste des ports à l'ouverture.
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) refreshPorts()
  }

  const portLabel = (p: typeof ports[number]) => {
    const isBoard = (p.vendorId ?? '').toLowerCase() === '1209'
    if (isBoard) return `ODrive-Wheel — ${p.path}`
    return p.friendlyName || `${p.path}${p.manufacturer ? ` — ${p.manufacturer}` : ''}`
  }

  const doConnect = async () => { if (sel) { await connect(sel); setOpen(false) } }
  const doDisconnect = async () => { await disconnect(); setOpen(false) }

  return (
    <div className="titlebar">
      <div className="titlebar__logo">
        <img className="titlebar__logo-mark" src={logo} alt="OW Pithouse" />
        <span><span className="titlebar__logo-ow">OW</span><span className="titlebar__logo-sub">-Pithouse</span></span>
      </div>

      <div className="titlebar__device-wrap">
        <button className={`titlebar__device ${open ? 'open' : ''}`} onClick={toggle} title={t('set.conn')}>
          <div className={`titlebar__device-dot ${connected ? 'on' : ''}`} />
          <div className="titlebar__device-text">
            <div className="titlebar__device-name">
              {connected ? 'MKS XDrive Mini' : t('title.no_device')}
            </div>
            <div className="titlebar__device-sub">
              {connected ? `${t('title.connected')} · ${port} · FW v1.0.0` : t('title.disconnected')}
            </div>
          </div>
          <i className="ti ti-chevron-down titlebar__device-caret" />
        </button>

        {open && (
          <>
            <div className="titlebar__conn-overlay" onClick={() => setOpen(false)} />
            <div className="titlebar__conn">
              {connected ? (
                <>
                  <div className="titlebar__conn-row">
                    <span className="titlebar__conn-label">{t('set.com_port')}</span>
                    <span className="titlebar__conn-cur">{port}</span>
                  </div>
                  <button className="btn btn--danger" style={{ width: '100%' }} onClick={doDisconnect}>
                    <i className="ti ti-plug-off" /> {t('set.disconnect')}
                  </button>
                </>
              ) : (
                <>
                  <select
                    className="titlebar__conn-select"
                    value={sel}
                    onChange={(e) => setSel(e.target.value)}
                  >
                    <option value="">{ports.length ? t('set.choose_port') : t('set.no_ports')}</option>
                    {ports.map((p) => (
                      <option key={p.path} value={p.path}>{portLabel(p)}</option>
                    ))}
                  </select>
                  <button className="btn btn--primary" style={{ width: '100%' }} onClick={doConnect} disabled={!sel}>
                    <i className="ti ti-plug" /> {t('set.connect')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="titlebar__spacer" />

      <button className="titlebar__btn" onClick={() => window.ow?.minimize()} aria-label="Réduire">
        <i className="ti ti-minus" />
      </button>
      <button className="titlebar__btn" onClick={() => window.ow?.maximize()} aria-label="Agrandir">
        <i className="ti ti-square" />
      </button>
      <button className="titlebar__btn close" onClick={() => window.ow?.close()} aria-label="Fermer">
        <i className="ti ti-x" />
      </button>
    </div>
  )
}
