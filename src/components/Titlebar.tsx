import { useDevice } from '@/context/DeviceContext'

export function Titlebar() {
  const { connected, port } = useDevice()

  return (
    <div className="titlebar">
      <div className="titlebar__logo">
        <div className="titlebar__logo-mark">OW</div>
        Odrive Wheel <span className="titlebar__logo-sub">Pit House</span>
      </div>

      <div className="titlebar__device">
        <div className={`titlebar__device-dot ${connected ? 'on' : ''}`} />
        <div>
          <div className="titlebar__device-name">
            {connected ? 'MKS XDrive Mini' : 'Aucun périphérique'}
          </div>
          <div className="titlebar__device-sub">
            {connected ? `Connecté · ${port} · FW v1.0.0` : 'Déconnecté'}
          </div>
        </div>
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
