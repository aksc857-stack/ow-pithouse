import { useState } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { Slider, Toggle, toast } from '@/components/ui'
import { writeWheelConfig } from '@/lib/ffbConfig'
import type { EffectConfig, WheelConfig } from '@/types'

// ── FFB Page ──────────────────────────────────────────────────────────────────
export function FFB() {
  const { wheelConfig, setWheelConfig, connected, reading, reloadFromBoard } = useDevice()

  const update = <K extends keyof WheelConfig>(key: K, value: WheelConfig[K]) => {
    setWheelConfig({ ...wheelConfig, [key]: value })
  }

  const apply = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    try {
      await writeWheelConfig(wheelConfig)
      toast('Réglages FFB appliqués et sauvegardés')
    } catch (e) {
      toast('Erreur : ' + e, 'err')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Force Feedback</div>
          <div className="page-head__sub">
            {reading ? 'Lecture des réglages de la carte...' : 'Réglages de la roue et effets permanents'}
          </div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={reloadFromBoard} disabled={!connected || reading}>
            <i className="ti ti-refresh" /> Relire
          </button>
          <button className="btn btn--primary" onClick={apply}>
            <i className="ti ti-device-floppy" /> Appliquer
          </button>
        </div>
      </div>

      <div className="alert alert--warn">
        <i className="ti ti-alert-triangle" />
        Mode TORQUE actif — pos_gain / vel_gain sont inactifs en FFB
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-steering-wheel" />Roue</div>
          <Slider label="Rotation max" value={wheelConfig.range} min={90} max={1440} step={90} unit="°" onChange={(v) => update('range', v)} />
          <Slider label="Couple max" value={wheelConfig.maxTorque} min={0.5} max={12} step={0.1} format={(v) => `${v.toFixed(1)} Nm`} onChange={(v) => update('maxTorque', v)} />
          <Slider label="Gain master" value={wheelConfig.masterGain} min={0} max={100} unit="%" onChange={(v) => update('masterGain', v)} />
          <Slider label="Fx ratio" value={wheelConfig.fxRatio} min={0} max={100} unit="%" onChange={(v) => update('fxRatio', v)} />
          <Slider label="Expo" value={wheelConfig.expo} min={0} max={100} unit="%" onChange={(v) => update('expo', v)} />
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-wall" />Effets permanents</div>
          <Slider label="Centrage (spring)" value={wheelConfig.idleSpring} min={0} max={100} unit="%" onChange={(v) => update('idleSpring', v)} />
          <Slider label="Damper" value={wheelConfig.damper} min={0} max={100} unit="%" onChange={(v) => update('damper', v)} />
          <Slider label="Inertia" value={wheelConfig.inertia} min={0} max={100} unit="%" onChange={(v) => update('inertia', v)} />
          <Slider label="Friction" value={wheelConfig.friction} min={0} max={100} unit="%" onChange={(v) => update('friction', v)} />
          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0 14px', paddingTop: 14 }}>
            <div className="card__head" style={{ marginBottom: 12 }}><i className="ti ti-wall" />End-stop</div>
            <Slider label="Spring (esgain)" value={wheelConfig.esGain} min={0} max={100} unit="%" onChange={(v) => update('esGain', v)} />
            <Slider label="Damper (esdamp)" value={wheelConfig.esDamp} min={0} max={100} unit="%" onChange={(v) => update('esDamp', v)} />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Effects Page ──────────────────────────────────────────────────────────────
const DEFAULT_EFFECTS: EffectConfig[] = [
  { name: 'Constant Force', cmd: 'cf',       enabled: true,  gain: 80 },
  { name: 'Spring',         cmd: 'spring',   enabled: true,  gain: 100 },
  { name: 'Damper',         cmd: 'damper',   enabled: true,  gain: 90 },
  { name: 'Friction',       cmd: 'friction', enabled: true,  gain: 70 },
  { name: 'Inertia',        cmd: 'inertia',  enabled: true,  gain: 60 },
  { name: 'Sine',           cmd: 'sine',     enabled: false, gain: 90 },
  { name: 'Triangle',       cmd: 'triangle', enabled: false, gain: 90 },
  { name: 'Square',         cmd: 'square',   enabled: false, gain: 90 },
  { name: 'Ramp',           cmd: 'ramp',     enabled: false, gain: 90 },
]

export function Effects() {
  const [effects, setEffects] = useState<EffectConfig[]>(() => {
    try { return JSON.parse(localStorage.getItem('ow_effects') || '') } catch { return DEFAULT_EFFECTS }
  })

  const save = (next: EffectConfig[]) => {
    setEffects(next)
    localStorage.setItem('ow_effects', JSON.stringify(next))
  }

  const toggle = (i: number) => save(effects.map((e, idx) => idx === i ? { ...e, enabled: !e.enabled } : e))
  const setGain = (i: number, gain: number) => save(effects.map((e, idx) => idx === i ? { ...e, gain } : e))

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Effets FFB</div>
          <div className="page-head__sub">Activation et gain par type d'effet</div>
        </div>
      </div>

      <div className="grid grid--3">
        {effects.map((e, i) => (
          <div key={e.cmd} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{e.name}</span>
              <Toggle on={e.enabled} onToggle={() => toggle(i)} />
            </div>
            <Slider label="Gain" value={e.gain} min={0} max={100} unit="%" onChange={(v) => setGain(i, v)} />
          </div>
        ))}
      </div>
    </>
  )
}
