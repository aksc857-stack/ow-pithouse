import { useState, useEffect } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useLiveApply } from '@/hooks/useLiveApply'
import { Slider, toast } from '@/components/ui'
import { writeWheelConfig, applyWheelField, readEffectsConfig, applyEffectGain, EFFECT_DEFS } from '@/lib/ffbConfig'
import type { EffectConfig, WheelConfig } from '@/types'

const DEFAULT_EFFECTS: EffectConfig[] = EFFECT_DEFS.map((d) => ({
  name: d.name, path: d.path, gain: d.defaultGain,
}))

// ── FFB Page ──────────────────────────────────────────────────────────────────
// Réglages de la roue + gains par effet (fx.*).
export function FFB() {
  const { wheelConfig, setWheelConfig, connected, reading, reloadFromBoard } = useDevice()
  const liveApply = useLiveApply()
  const [effects, setEffects] = useState<EffectConfig[]>(DEFAULT_EFFECTS)

  // Champ roue : état UI immédiat + écriture live debouncée (RAM).
  const update = <K extends keyof WheelConfig>(key: K, value: WheelConfig[K]) => {
    setWheelConfig({ ...wheelConfig, [key]: value })
    if (connected) liveApply(key, () => applyWheelField(key, value))
  }

  // Lecture des gains par effet à la connexion.
  const reloadEffects = async () => {
    if (!connected) return
    try { setEffects(await readEffectsConfig(effects)) } catch { /* silencieux */ }
  }
  useEffect(() => { if (connected) reloadEffects() }, [connected])

  // Gain d'effet : état UI immédiat + écriture live debouncée (RAM).
  const setGain = (i: number, gain: number) => {
    const effect = effects[i]
    setEffects(effects.map((e, idx) => idx === i ? { ...e, gain } : e))
    if (connected) liveApply(effect.path, () => applyEffectGain(effect.path, gain))
  }

  // Persiste en EEPROM : pousse les gains effets en RAM, puis writeWheelConfig
  // (applique les champs roue + désarme + sys.save! qui persiste TOUT l'offb).
  const save = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    try {
      for (const e of effects) await applyEffectGain(e.path, e.gain)
      await writeWheelConfig(wheelConfig)
      toast('Réglages FFB sauvegardés en EEPROM')
    } catch (e) {
      toast('Erreur : ' + e, 'err')
    }
  }

  const reload = () => { reloadFromBoard(); reloadEffects() }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Force Feedback</div>
          <div className="page-head__sub">
            {reading ? 'Lecture des réglages de la carte...' : 'Roue + gain des effets du jeu — appliqués en direct'}
          </div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={reload} disabled={!connected || reading}>
            <i className="ti ti-refresh" /> Relire
          </button>
          <button className="btn btn--primary" onClick={save} disabled={!connected}>
            <i className="ti ti-device-floppy" /> Sauvegarder
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-steering-wheel" />Roue</div>
          <Slider label="Rotation max" value={wheelConfig.range} min={90} max={1440} step={90} unit="°" onChange={(v) => update('range', v)} />
          <Slider label="Couple max" value={wheelConfig.maxTorque} min={0.5} max={12} step={0.1} format={(v) => `${v.toFixed(1)} Nm`} onChange={(v) => update('maxTorque', v)} />
          <Slider label="Gain master" value={wheelConfig.masterGain} min={0} max={100} unit="%" onChange={(v) => update('masterGain', v)} />
          <Slider label="Fx ratio" value={wheelConfig.fxRatio} min={0} max={100} unit="%" onChange={(v) => update('fxRatio', v)} />
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-wave-sine" />Gain des effets du jeu</div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px', lineHeight: 1.6 }}>
            Ajuste l'intensité des effets envoyés par le jeu (multiplicateur).
          </p>
          {effects.map((e, i) => (
            <Slider key={e.path} label={e.name} value={e.gain} min={0} max={100} unit="%" onChange={(v) => setGain(i, v)} />
          ))}
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-wall" />Effets ajoutés en permanence</div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px', lineHeight: 1.6 }}>
            Toujours actifs, s'ajoutent au FFB du jeu (indépendants du jeu).
          </p>
          <Slider label="Centrage (spring)" value={wheelConfig.idleSpring} min={0} max={100} unit="%" onChange={(v) => update('idleSpring', v)} />
          <Slider label="Damper" value={wheelConfig.damper} min={0} max={100} unit="%" onChange={(v) => update('damper', v)} />
          <Slider label="Inertia" value={wheelConfig.inertia} min={0} max={100} unit="%" onChange={(v) => update('inertia', v)} />
          <Slider label="Friction" value={wheelConfig.friction} min={0} max={100} unit="%" onChange={(v) => update('friction', v)} />
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-arrow-bar-to-right" />End-stop</div>
          <Slider label="Spring (esgain)" value={wheelConfig.esGain} min={0} max={100} unit="%" onChange={(v) => update('esGain', v)} />
          <Slider label="Damper (esdamp)" value={wheelConfig.esDamp} min={0} max={100} unit="%" onChange={(v) => update('esDamp', v)} />
        </div>
      </div>
    </>
  )
}
