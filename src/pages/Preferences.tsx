import { useRef, useState } from 'react'
import { useTheme, ACCENT_PRESETS } from '@/context/ThemeContext'
import { useDevice } from '@/context/DeviceContext'
import { useNav } from '@/context/NavContext'
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

// ── Personnalisation du menu latéral ────────────────────────────────────────────
function NavCustomizer() {
  const { items, isHidden, reorder, toggleHidden, reset } = useNav()
  const dragIndex = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const onDrop = (to: number) => {
    if (dragIndex.current !== null) reorder(dragIndex.current, to)
    dragIndex.current = null
    setOverIndex(null)
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card__head">
        <i className="ti ti-menu-2" />Menu latéral
        <button className="btn btn--sm" style={{ marginLeft: 'auto' }} onClick={reset}>
          <i className="ti ti-rotate" /> Réinitialiser
        </button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 14px', lineHeight: 1.7 }}>
        Glissez pour réordonner (ou flèches), et masquez les onglets inutilisés.
        « Thème » et « Réglages » restent toujours visibles.
      </p>

      {items.map((item, i) => {
        const hidden = isHidden(item.id)
        return (
          <div
            key={item.id}
            draggable
            onDragStart={() => { dragIndex.current = i }}
            onDragOver={(e) => { e.preventDefault(); setOverIndex(i) }}
            onDragLeave={() => setOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={() => onDrop(i)}
            onDragEnd={() => { dragIndex.current = null; setOverIndex(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6,
              background: 'var(--bg-sunken)',
              border: `1px solid ${overIndex === i ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-sm)',
              opacity: hidden ? 0.45 : 1,
              cursor: 'grab',
            }}
          >
            <i className="ti ti-grip-vertical" style={{ color: 'var(--text-faint)', cursor: 'grab' }} />
            <i className={`ti ${item.icon}`} style={{ color: 'var(--accent)', width: 18, textAlign: 'center' }} />
            <span style={{ flex: 1, fontSize: 13, textDecoration: hidden ? 'line-through' : 'none' }}>{item.label}</span>

            <button className="btn btn--sm" title="Monter" disabled={i === 0}
              onClick={() => reorder(i, i - 1)}>
              <i className="ti ti-chevron-up" />
            </button>
            <button className="btn btn--sm" title="Descendre" disabled={i === items.length - 1}
              onClick={() => reorder(i, i + 1)}>
              <i className="ti ti-chevron-down" />
            </button>
            <button className="btn btn--sm" title={hidden ? 'Afficher' : 'Masquer'}
              onClick={() => toggleHidden(item.id)}>
              <i className={`ti ${hidden ? 'ti-eye-off' : 'ti-eye'}`} />
            </button>
          </div>
        )
      })}
    </div>
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

      <NavCustomizer />
    </>
  )
}
