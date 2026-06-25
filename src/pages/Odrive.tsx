import { useDevice } from '@/context/DeviceContext'
import { usePersistentTab } from '@/hooks/usePersistentTab'
import { SchemaSectionView } from '@/components/SchemaSection'
import { toast } from '@/components/ui'
import { ODRIVE_SECTIONS } from '@/lib/odriveSchema'

const ODRIVE_TAB_IDS = ODRIVE_SECTIONS.map((s) => s.id)

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

      <SchemaSectionView key={section.id} section={section} />
    </>
  )
}
