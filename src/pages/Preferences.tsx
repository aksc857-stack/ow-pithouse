import { useState } from 'react'
import { useTheme, ACCENT_PRESETS } from '@/context/ThemeContext'
import { useDevice } from '@/context/DeviceContext'
import { Toggle } from '@/components/ui'

// ── Themes ────────────────────────────────────────────────────────────────────
export function Themes() {
  const { accent, setAccent } = useTheme()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Thème</div>
          <div className="page-head__sub">Personnalisez la couleur d'accent</div>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-palette" />Couleur d'accent</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setAccent(p.value)}
              aria-label={p.name}
              style={{
                width: 40, height: 40, borderRadius: 'var(--r-md)',
                background: p.value, cursor: 'pointer',
                border: accent === p.value ? '2px solid var(--text)' : '2px solid transparent',
              }}
            />
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.7 }}>
          L'accent s'applique aux boutons, jauges, sliders et indicateurs actifs.
        </p>
      </div>
    </>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function Settings() {
  const { ports, connected, port, connect, disconnect } = useDevice()
  const [selectedPort, setSelectedPort] = useState('')
  const [autoConnect, setAutoConnect] = useState(() => localStorage.getItem('ow_autoconnect') !== 'off')
  const [startup, setStartup] = useState(true)
  const [autoProfile, setAutoProfile] = useState(true)
  const [minimizeTray, setMinimizeTray] = useState(false)

  const toggleAutoConnect = () => {
    const next = !autoConnect
    setAutoConnect(next)
    localStorage.setItem('ow_autoconnect', next ? 'on' : 'off')
  }

  const portLabel = (p: typeof ports[number]) => {
    const isBoard = (p.vendorId ?? '').toLowerCase() === '1209'
    if (isBoard) return `ODrive-Wheel — ${p.path}`
    return p.friendlyName || `${p.path}${p.manufacturer ? ` — ${p.manufacturer}` : ''}`
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Réglages</div>
          <div className="page-head__sub">Connexion et préférences</div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-plug" />Connexion série</div>

          <div className="stat" style={{ marginBottom: 12 }}>
            <div>
              <span className="stat__label">Connexion automatique</span>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
                Détecte « ODrive-Wheel CDC » quel que soit le port COM
              </div>
            </div>
            <Toggle on={autoConnect} onToggle={toggleAutoConnect} />
          </div>

          <div className="field">
            <label>Port COM {autoConnect && '(manuel — auto activé)'}</label>
            <select value={connected ? port || '' : selectedPort} onChange={(e) => setSelectedPort(e.target.value)} disabled={connected}>
              <option value="">Choisir un port...</option>
              {ports.map((p) => (
                <option key={p.path} value={p.path}>{portLabel(p)}</option>
              ))}
            </select>
          </div>
          {connected ? (
            <button className="btn btn--danger" style={{ width: '100%' }} onClick={disconnect}>
              <i className="ti ti-plug-off" /> Déconnecter
            </button>
          ) : (
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={() => selectedPort && connect(selectedPort)} disabled={!selectedPort}>
              <i className="ti ti-plug" /> Connecter
            </button>
          )}
        </div>

        <div className="card">
          <div className="card__head"><i className="ti ti-settings" />Préférences</div>
          <div className="stat">
            <span className="stat__label">Lancer au démarrage Windows</span>
            <Toggle on={startup} onToggle={() => setStartup(!startup)} />
          </div>
          <div className="stat">
            <span className="stat__label">Auto-switch profils (détection jeux)</span>
            <Toggle on={autoProfile} onToggle={() => setAutoProfile(!autoProfile)} />
          </div>
          <div className="stat">
            <span className="stat__label">Minimiser dans la zone de notification</span>
            <Toggle on={minimizeTray} onToggle={() => setMinimizeTray(!minimizeTray)} />
          </div>
        </div>
      </div>
    </>
  )
}
