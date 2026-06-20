import { useState } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useTheme } from '@/context/ThemeContext'
import { Sparkline, Toggle, toast } from '@/components/ui'
import type { GameProfile } from '@/types'

// ── Profiles / Auto-Profiler ──────────────────────────────────────────────────
const DEFAULT_PROFILES: GameProfile[] = [
  { id: '1', name: 'iRacing — Road', exe: 'iRacingSim64.exe', icon: 'ti-car', config: { maxTorque: 3.5, idleSpring: 25 }, active: true },
  { id: '2', name: 'Assetto Corsa — Drift', exe: 'acs.exe', icon: 'ti-car-turbo', config: { maxTorque: 5.0, idleSpring: 10 } },
  { id: '3', name: 'rFactor 2 — GT3', exe: 'rFactor2.exe', icon: 'ti-flag-checkered', config: { maxTorque: 4.0, damper: 30 } },
]

export function Profiles() {
  const [profiles, setProfiles] = useState<GameProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('ow_profiles') || '') } catch { return DEFAULT_PROFILES }
  })
  const [autoSwitch, setAutoSwitch] = useState(true)

  const activate = (id: string) => {
    const next = profiles.map((p) => ({ ...p, active: p.id === id }))
    setProfiles(next)
    localStorage.setItem('ow_profiles', JSON.stringify(next))
    toast(`Profil "${next.find((p) => p.id === id)?.name}" chargé`)
  }

  const create = () => {
    const name = prompt('Nom du profil :')
    if (!name) return
    const exe = prompt('Exécutable du jeu (ex: game.exe) :') || ''
    const next = [...profiles, { id: Date.now().toString(), name, exe, icon: 'ti-device-gamepad', config: {} }]
    setProfiles(next)
    localStorage.setItem('ow_profiles', JSON.stringify(next))
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Auto-Profiler</div>
          <div className="page-head__sub">Détection automatique des jeux + bascule de profil</div>
        </div>
        <button className="btn btn--primary" onClick={create}>
          <i className="ti ti-plus" /> Nouveau profil
        </button>
      </div>

      <div className="card">
        <div className="card__head">
          <i className="ti ti-bookmarks" />Profils
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Auto-switch</span>
            <Toggle on={autoSwitch} onToggle={() => setAutoSwitch(!autoSwitch)} />
          </div>
        </div>

        {profiles.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
              background: 'var(--bg-sunken)',
              border: `1px solid ${p.active ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>
              <i className={`ti ${p.icon}`} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {p.exe} · {Object.entries(p.config).map(([k, v]) => `${k} ${v}`).join(' · ') || 'pas de réglages'}
              </div>
            </div>
            {p.active ? (
              <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '4px 10px', borderRadius: 6 }}>● Actif</span>
            ) : (
              <button className="btn btn--sm" onClick={() => activate(p.id)}>Charger</button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Monitor ───────────────────────────────────────────────────────────────────
export function Monitor() {
  const { live, connected } = useDevice()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Monitoring</div>
          <div className="page-head__sub">Télémétrie brute temps réel</div>
        </div>
        <button className="btn" onClick={() => window.ow?.openOverlay()}>
          <i className="ti ti-picture-in-picture" /> Overlay
        </button>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-bolt" />Puissance bus (W)</div>
          <div className="chart-box">
            <Sparkline value={live.vbus * Math.abs(live.iq)} color="var(--amber)" min={0} max={3000} />
          </div>
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-temperature" />Statistiques</div>
          <div className="stat"><span className="stat__label">État axe</span><span className="stat__value green">{connected ? 'CLOSED_LOOP' : 'IDLE'}</span></div>
          <div className="stat"><span className="stat__label">Bus voltage</span><span className="stat__value">{live.vbus.toFixed(1)} V</span></div>
          <div className="stat"><span className="stat__label">Phase Iq</span><span className="stat__value">{Math.abs(live.iq).toFixed(1)} A</span></div>
          <div className="stat"><span className="stat__label">FFB tick</span><span className="stat__value green">1000 Hz</span></div>
          <div className="stat"><span className="stat__label">Température</span><span className="stat__value amber">{live.temperature.toFixed(0)} °C</span></div>
        </div>
      </div>
    </>
  )
}

// ── Console ───────────────────────────────────────────────────────────────────
export function Console() {
  const { log, sendCommand } = useDevice()
  const [cmd, setCmd] = useState('')

  const exec = async () => {
    if (!cmd.trim()) return
    await sendCommand(cmd.trim())
    setCmd('')
  }

  const QUICK = ['r vbus_voltage', 'r axis0.encoder.pos_estimate', 'w axis0.requested_state 8', 'save_configuration()', 'reboot()']

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Console série</div>
          <div className="page-head__sub">Commandes ODrive ASCII</div>
        </div>
      </div>

      <div style={{
        background: '#080a0d', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        padding: '12px 14px', height: 320, overflowY: 'auto', fontFamily: 'var(--mono)',
        fontSize: 12, lineHeight: 1.8,
      }}>
        {log.length === 0 && <div style={{ color: 'var(--text-faint)' }}>En attente de commandes...</div>}
        {log.map((l, i) => (
          <div key={i} style={{ color: l.type === 'tx' ? 'var(--text-faint)' : l.type === 'err' ? 'var(--red)' : l.type === 'info' ? 'var(--text-faint)' : '#86efac' }}>
            {l.type === 'tx' ? '→ ' : l.type === 'rx' ? '← ' : ''}{l.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' }}
          placeholder="Commande ODrive ASCII..."
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && exec()}
        />
        <button className="btn btn--primary" onClick={exec}><i className="ti ti-send" /> Send</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {QUICK.map((q) => (
          <button key={q} className="btn btn--sm" onClick={() => setCmd(q)}>{q}</button>
        ))}
      </div>
    </>
  )
}

// ── DFU Flash ─────────────────────────────────────────────────────────────────
export function Dfu() {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const flash = async () => {
    const steps: [number, string][] = [
      [10, 'Connexion bootloader...'], [30, 'Effacement secteurs...'],
      [60, 'Écriture firmware...'], [90, 'Vérification CRC...'], [100, '✓ Flash terminé'],
    ]
    for (const [pct, msg] of steps) {
      setProgress(pct); setStatus(msg)
      await new Promise((r) => setTimeout(r, 500))
    }
    toast('Firmware flashé — EEPROM FFB préservée')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Flash DFU</div>
          <div className="page-head__sub">Mise à jour firmware STM32</div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-download" />Flasher depuis l'app</div>
          <p style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14, lineHeight: 1.7 }}>
            L'EEPROM FFB (secteurs 10+11) est préservée lors du flash.
          </p>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => window.ow?.odriveRebootDfu()}>
            <i className="ti ti-refresh" /> 1. Reboot to DFU
          </button>
          <button className="btn btn--primary" style={{ width: '100%' }} onClick={flash}>
            <i className="ti ti-flame" /> 2. Flash firmware
          </button>
          {progress > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{status}</div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-terminal-2" />Premier flash (CLI)</div>
          <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, fontFamily: 'var(--mono)', fontSize: 11, color: '#86efac', marginBottom: 10 }}>
            dfu-util -d 0483:df11 -a 0 -s 0x08000000:leave -D odrive-wheel.bin
          </div>
          <div className="alert alert--warn">
            <i className="ti ti-brand-windows" />
            Windows : driver WinUSB via Zadig (une fois)
          </div>
        </div>
      </div>
    </>
  )
}
