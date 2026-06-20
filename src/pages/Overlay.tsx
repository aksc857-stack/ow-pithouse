import { useDevice } from '@/context/DeviceContext'
import { useTheme } from '@/context/ThemeContext'

export function Overlay() {
  const { live } = useDevice()
  const { accent } = useTheme()
  const clip = Math.abs(live.torque) > 7

  return (
    <div style={{
      background: 'rgba(8,10,13,0.82)', color: 'var(--text)',
      fontFamily: 'var(--mono)', fontSize: 12, height: '100vh',
      borderRadius: 10, border: `1px solid ${accent}66`,
      padding: '10px 14px', WebkitAppRegion: 'drag', userSelect: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: accent, fontWeight: 700, fontSize: 10, letterSpacing: 0.5 }}>OW LIVE</span>
        <span style={{ cursor: 'pointer', color: 'var(--text-faint)', WebkitAppRegion: 'no-drag' }} onClick={() => window.ow?.closeOverlay()}>✕</span>
      </div>
      <Row label="Torque" value={`${Math.abs(live.torque).toFixed(2)} Nm`} color="var(--red)" />
      <div style={{ height: 3, background: '#1e2230', borderRadius: 2, margin: '4px 0', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.abs(live.torque) / 8 * 100)}%`, background: accent, transition: 'width 0.1s' }} />
      </div>
      <Row label="Vbus" value={`${live.vbus.toFixed(1)} V`} color={accent} />
      <Row label="Iq" value={`${Math.abs(live.iq).toFixed(1)} A`} color="var(--amber)" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: 'var(--text-faint)' }}>FFB Clip</span>
        <span style={{ color: clip ? 'var(--red)' : accent }}>{clip ? '● CLIP' : '● OK'}</span>
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </div>
  )
}
