import { useState, useEffect } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useLiveApply } from '@/hooks/useLiveApply'
import { useI18n } from '@/context/I18nContext'
import { Slider, toast } from '@/components/ui'
import { writeWheelConfig, applyWheelField, readEffectsConfig, applyEffectGain, EFFECT_DEFS,
  FILTER_DEFS, defaultFilterValues, readFiltersConfig, applyFilter, writeFiltersConfig, type FilterValues } from '@/lib/ffbConfig'
import type { EffectConfig, WheelConfig } from '@/types'

const DEFAULT_EFFECTS: EffectConfig[] = EFFECT_DEFS.map((d) => ({
  name: d.name, path: d.path, gain: d.defaultGain,
}))

// ── FFB Page ──────────────────────────────────────────────────────────────────
// Réglages de la roue + gains par effet (fx.*).
export function FFB() {
  const { wheelConfig, setWheelConfig, connected, reading, reloadFromBoard, pausePolling } = useDevice()
  const { t } = useI18n()
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
    const resume = pausePolling()
    try { setEffects(await readEffectsConfig(effects)) } catch { /* silencieux */ } finally { resume() }
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
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    try {
      for (const e of effects) await applyEffectGain(e.path, e.gain)
      await writeWheelConfig(wheelConfig)
      toast(t('ffb.saved'))
    } catch (e) {
      toast(t('common.error') + ' : ' + e, 'err')
    }
  }

  const reload = () => { reloadFromBoard(); reloadEffects() }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('ffb.title')}</div>
          <div className="page-head__sub">
            {reading ? t('ffb.sub_reading') : t('ffb.sub')}
          </div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={reload} disabled={!connected || reading}>
            <i className="ti ti-refresh" /> {t('common.reload')}
          </button>
          <button className="btn btn--primary" onClick={save} disabled={!connected}>
            <i className="ti ti-device-floppy" /> {t('common.save')}
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-steering-wheel" />{t('ffb.card_wheel')}</div>
          <Slider label={t('ffb.range')} value={wheelConfig.range} min={90} max={1440} step={90} unit="°" onChange={(v) => update('range', v)} />
          <Slider label={t('ffb.max_torque')} value={wheelConfig.maxTorque} min={0.5} max={12} step={0.1} format={(v) => `${v.toFixed(1)} Nm`} onChange={(v) => update('maxTorque', v)} />
          <Slider label={t('ffb.fx_ratio')} value={wheelConfig.fxRatio} min={0} max={100} unit="%" onChange={(v) => update('fxRatio', v)} />
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-wave-sine" />{t('ffb.card_game_gains')}</div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px', lineHeight: 1.6 }}>
            {t('ffb.card_game_gains_desc')}
          </p>
          {effects.map((e, i) => (
            <Slider key={e.path} label={e.name} value={e.gain} min={0} max={100} unit="%" onChange={(v) => setGain(i, v)} />
          ))}
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-wall" />{t('ffb.card_added')}</div>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-4px 0 12px', lineHeight: 1.6 }}>
            {t('ffb.card_added_desc')}
          </p>
          <Slider label={t('ffb.master_gain')} value={wheelConfig.masterGain} min={0} max={100} unit="%" onChange={(v) => update('masterGain', v)} />
          <Slider label={t('ffb.centering')} value={wheelConfig.idleSpring} min={0} max={100} unit="%" onChange={(v) => update('idleSpring', v)} />
          <Slider label={t('ffb.damper')} value={wheelConfig.damper} min={0} max={100} unit="%" onChange={(v) => update('damper', v)} />
          <Slider label={t('ffb.inertia')} value={wheelConfig.inertia} min={0} max={100} unit="%" onChange={(v) => update('inertia', v)} />
          <Slider label={t('ffb.friction')} value={wheelConfig.friction} min={0} max={100} unit="%" onChange={(v) => update('friction', v)} />
        </div>
        <div className="card">
          <div className="card__head"><i className="ti ti-arrow-bar-to-right" />{t('ffb.card_endstop')}</div>
          <Slider label={t('ffb.es_spring')} value={wheelConfig.esGain} min={0} max={100} unit="%" onChange={(v) => update('esGain', v)} />
          <Slider label={t('ffb.es_damper')} value={wheelConfig.esDamp} min={0} max={100} unit="%" onChange={(v) => update('esDamp', v)} />
        </div>
      </div>
    </>
  )
}

// ── Filters Page ────────────────────────────────────────────────────────────────
// Filtres biquad lowpass par effet (fx.filter*) — incorporé depuis odrive-wheel.html.
export function Filters() {
  const { connected, pausePolling } = useDevice()
  const { t } = useI18n()
  const liveApply = useLiveApply()
  const [values, setValues] = useState<FilterValues>(defaultFilterValues)
  const [loading, setLoading] = useState(false)

  const reload = async () => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    setLoading(true)
    const resume = pausePolling()
    try {
      setValues(await readFiltersConfig(values))
    } catch (e) {
      toast(t('common.error') + ' : ' + e, 'err')
    } finally {
      resume()
      setLoading(false)
    }
  }

  useEffect(() => { if (connected) reload() }, [connected])

  // État UI immédiat + écriture live debouncée (RAM).
  const setVal = (path: string, v: number) => {
    setValues((prev) => ({ ...prev, [path]: v }))
    if (connected) liveApply(path, () => applyFilter(path, v))
  }

  const save = async () => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    try {
      await writeFiltersConfig(values)
      toast(t('filters.saved'))
    } catch (e) {
      toast(t('common.error') + ' : ' + e, 'err')
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('filters.title')}</div>
          <div className="page-head__sub">
            {loading ? t('filters.sub_reading') : t('filters.sub')}
          </div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={reload} disabled={!connected || loading}>
            <i className="ti ti-refresh" /> {t('common.reload')}
          </button>
          <button className="btn btn--primary" onClick={save} disabled={!connected}>
            <i className="ti ti-device-floppy" /> {t('common.save')}
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        {FILTER_DEFS.map((d) => (
          <div key={d.group} className="card">
            <div className="card__head"><i className="ti ti-filter" />{d.group}</div>
            <Slider
              label={t('filters.freq')} hint={d.freq.tooltip}
              value={values[d.freq.path]} min={1} max={500} unit=" Hz"
              onChange={(v) => setVal(d.freq.path, v)}
            />
            <Slider
              label={t('filters.q')} hint={d.q.tooltip}
              value={values[d.q.path]} min={1} max={500} format={(v) => (v / 100).toFixed(2)}
              onChange={(v) => setVal(d.q.path, v)}
            />
          </div>
        ))}
      </div>
    </>
  )
}
