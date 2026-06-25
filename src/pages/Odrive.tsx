import { useState, useEffect, useCallback } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { usePersistentTab } from '@/hooks/usePersistentTab'
import { SchemaSectionView } from '@/components/SchemaSection'
import { toast } from '@/components/ui'
import { readProp, writeProp } from '@/lib/odrive'
import { ODRIVE_SECTIONS } from '@/lib/odriveSchema'

const ODRIVE_TAB_IDS = ODRIVE_SECTIONS.map((s) => s.id)

// Barre « zéro virtuel » de l'onglet Encoder (hors SCHEMA car commande exec
// OpenFFBoard). Le zéro HID se capture via le bouton « Center » du Dashboard
// (ou un GPIO physique) → le firmware stocke l'offset dans `axis.zeroofs`
// (en degrés). Cette carte se contente d'AFFICHER cet offset et de l'annuler
// (« Reset zero » → `axis.zeroofs=0`). Générique : vaut pour tous les encodeurs
// (ABZ / AS5047 / MT6835) car c'est un offset de la couche FFB/HID.
function EncoderZeroBar() {
  const { connected } = useDevice()
  const [offset, setOffset] = useState<number | null>(null)  // null = inconnu / firmware sans support
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!connected) { setOffset(null); return }
    const raw = await readProp('axis.zeroofs', 'offb', { log: false })
    const v = raw != null ? parseFloat(raw) : NaN
    setOffset(Number.isFinite(v) ? v : null)
  }, [connected])

  useEffect(() => { refresh() }, [refresh])

  const resetZero = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    if (!window.confirm('Remettre zeroOffset à 0 ? Le centre logique revient à la référence d\'origine de l\'encodeur (pulse Z, ou position au boot). Sauvegardez ensuite pour persister.')) return
    setBusy(true)
    try {
      await writeProp('axis.zeroofs', 0, 'offb')
      toast('zeroOffset remis à 0')
      await refresh()
    } finally { setBusy(false) }
  }

  const hasOffset = offset != null && Math.abs(offset) >= 0.005

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card__head"><i className="ti ti-target" />Zéro virtuel (HID)</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: '4px 2px' }}>
        <span style={{ fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 13, color: 'var(--muted)', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4 }}>
          zeroOffset : <b style={{ color: hasOffset ? 'var(--ok, #34d399)' : 'var(--muted)' }}>
            {offset == null ? '—' : `${offset.toFixed(2)}°`}
          </b>
        </span>
        <button className="btn" onClick={resetZero} disabled={!connected || busy || !hasOffset}>
          <i className="ti ti-rotate" /> Reset zero
        </button>
        <button className="btn btn--sm" onClick={refresh} disabled={!connected || busy}>
          <i className="ti ti-refresh" /> Relire
        </button>
      </div>
      <div style={{ color: 'var(--text-faint)', fontSize: 12, lineHeight: 1.5, marginTop: 8 }}>
        Offset de zéro appliqué <b>au niveau HID</b> (ce que le jeu voit), capturé via le bouton <b>« Center »</b> du Dashboard (ou un GPIO physique). « Reset zero » l'annule. N'agit pas sur le centre mécanique ODrive. Valable pour tous les encodeurs (ABZ / AS5047 / MT6835).
      </div>
    </div>
  )
}

export function Odrive() {
  const { connected, sendCommand } = useDevice()
  const [active, setActive] = usePersistentTab('odrive', ODRIVE_TAB_IDS, ODRIVE_SECTIONS[0].id)
  const section = ODRIVE_SECTIONS.find((s) => s.id === active)!

  const saveNvm = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    // Disarm then persist ODrive NVM (ss reboots the board)
    await sendCommand('w axis0.requested_state 1')
    await new Promise((r) => setTimeout(r, 300))
    await sendCommand('ss')
    toast('Sauvegarde ODrive NVM — la carte redémarre')
  }

  return (
    <>
      <div className="odrive-tabs">
        {ODRIVE_SECTIONS.map((s) => (
          <button
            key={s.id}
            className={`odrive-tab ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary btn--sm" onClick={saveNvm} disabled={!connected}>
          <i className="ti ti-device-floppy" /> Save NVM (ss)
        </button>
      </div>

      {section.id === 'encoder' && <EncoderZeroBar />}
      <SchemaSectionView key={section.id} section={section} />
    </>
  )
}
