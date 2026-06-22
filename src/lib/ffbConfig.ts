// ── FFB config schema — real OpenFFBoard paths & scales ───────────────────────
// Verified against the reference odrive-wheel.html tool.
//
//   axis.range        graus (90..1440)            — direct
//   axis.maxtorque    Nm                          — direct
//   axis.fxratio      0..1 multiplier             — UI shows %, scale ×100
//   axis.idlespring   0..255                       — UI shows %, scale /255
//   axis.axisdamper   0..255
//   axis.axisinertia  0..255
//   axis.axisfriction 0..255
//   axis.esgain       0..255
//   axis.esdamp       0..255
//   fx.master         0..255  (master gain)

import { readProp, writeProp, toNum } from './odrive'
import type { WheelConfig, EffectConfig, ProfileSettings } from '@/types'

export const EFFECT_DEFS: { name: string; path: string; defaultGain: number }[] = [
  { name: 'Spring',   path: 'fx.spring',   defaultGain: 25  }, // firmware default 64/255 ≈ 25%
  { name: 'Damper',   path: 'fx.damper',   defaultGain: 25  }, // firmware default 64/255 ≈ 25%
  { name: 'Friction', path: 'fx.friction', defaultGain: 100 }, // firmware default 254/255 ≈ 100%
  { name: 'Inertia',  path: 'fx.inertia',  defaultGain: 50  }, // firmware default 127/255 ≈ 50%
]

/** Lire les gains des 4 effets depuis la carte. */
export async function readEffectsConfig(current: EffectConfig[]): Promise<EffectConfig[]> {
  return Promise.all(
    EFFECT_DEFS.map(async (def, i) => {
      const raw = await readProp(def.path, 'offb')
      const gain = raw != null
        ? Math.round((toNum(raw, 0) / 255) * 100)
        : (current[i]?.gain ?? def.defaultGain)
      return { name: def.name, path: def.path, gain }
    })
  )
}

/** Écrire les gains vers la carte, puis sauvegarder en EEPROM. */
export async function writeEffectsConfig(effects: EffectConfig[]): Promise<void> {
  for (const e of effects) {
    await writeProp(e.path, Math.round((e.gain / 100) * 255), 'offb')
  }
  if (window.ow) {
    await window.ow.send('w axis0.requested_state 1')
    await new Promise((r) => setTimeout(r, 300))
    await window.ow.query('sys.save!')
  }
}

const r255 = (raw: string | null, fbUi: number) =>
  raw == null ? fbUi : Math.round((toNum(raw, 0) / 255) * 100)
const w255 = (ui: number) => Math.round((ui / 100) * 255)

/** Read all FFB wheel params from the board into a WheelConfig. */
export async function readWheelConfig(current: WheelConfig): Promise<WheelConfig> {
  const range     = await readProp('axis.range', 'offb')
  const maxtorque = await readProp('axis.maxtorque', 'offb')
  const fxratio   = await readProp('axis.fxratio', 'offb')
  const master    = await readProp('fx.master', 'offb')
  const idlespring = await readProp('axis.idlespring', 'offb')
  const damper    = await readProp('axis.axisdamper', 'offb')
  const inertia   = await readProp('axis.axisinertia', 'offb')
  const friction  = await readProp('axis.axisfriction', 'offb')
  const esgain    = await readProp('axis.esgain', 'offb')
  const esdamp    = await readProp('axis.esdamp', 'offb')
  const expo      = await readProp('axis.expo', 'offb')
  const invert    = await readProp('axis.invert', 'offb')
  const ffbinvert = await readProp('axis.ffbinvert', 'offb')

  return {
    range:      toNum(range, current.range),
    maxTorque:  toNum(maxtorque, current.maxTorque),
    fxRatio:    fxratio != null ? Math.round(toNum(fxratio, 1) * 100) : current.fxRatio,
    masterGain: master != null ? Math.round((toNum(master, 204) / 255) * 100) : current.masterGain,
    idleSpring: r255(idlespring, current.idleSpring),
    damper:     r255(damper, current.damper),
    inertia:    r255(inertia, current.inertia),
    friction:   r255(friction, current.friction),
    esGain:     r255(esgain, current.esGain),
    esDamp:     r255(esdamp, current.esDamp),
    expo:       toNum(expo, current.expo),
    invert:     invert != null ? (invert === '1' || invert.toLowerCase() === 'true') : current.invert,
    ffbInvert:  ffbinvert != null ? (ffbinvert === '1' || ffbinvert.toLowerCase() === 'true') : current.ffbInvert,
  }
}

/** Écrire tous les params FFB en RAM uniquement (pas de désarmement, pas d'EEPROM). */
export async function applyWheelConfig(c: WheelConfig): Promise<void> {
  await writeProp('axis.range', c.range, 'offb')
  await writeProp('axis.maxtorque', c.maxTorque, 'offb')
  await writeProp('axis.fxratio', (c.fxRatio / 100).toFixed(2), 'offb')
  await writeProp('fx.master', w255(c.masterGain), 'offb')
  await writeProp('axis.idlespring', w255(c.idleSpring), 'offb')
  await writeProp('axis.axisdamper', w255(c.damper), 'offb')
  await writeProp('axis.axisinertia', w255(c.inertia), 'offb')
  await writeProp('axis.axisfriction', w255(c.friction), 'offb')
  await writeProp('axis.esgain', w255(c.esGain), 'offb')
  await writeProp('axis.esdamp', w255(c.esDamp), 'offb')
  await writeProp('axis.invert', c.invert ? 1 : 0, 'offb')
  await writeProp('axis.ffbinvert', c.ffbInvert ? 1 : 0, 'offb')
}

/** Écrire + désarmer moteur + persister EEPROM (bouton Appliquer). */
export async function writeWheelConfig(c: WheelConfig): Promise<void> {
  await applyWheelConfig(c)
  if (window.ow) {
    await window.ow.send('w axis0.requested_state 1')
    await new Promise((r) => setTimeout(r, 300))
    await window.ow.query('sys.save!')
  }
}

// Table key WheelConfig → path offb + conversion UI→firmware.
// Sert à l'application live d'UN seul champ (pas d'EEPROM, pas de désarmement).
const WHEEL_FIELD_MAP: Partial<Record<keyof WheelConfig, { path: string; conv: (v: never) => string | number }>> = {
  range:      { path: 'axis.range',        conv: (v: number) => v },
  maxTorque:  { path: 'axis.maxtorque',    conv: (v: number) => v },
  fxRatio:    { path: 'axis.fxratio',      conv: (v: number) => (v / 100).toFixed(2) },
  masterGain: { path: 'fx.master',         conv: (v: number) => w255(v) },
  idleSpring: { path: 'axis.idlespring',   conv: (v: number) => w255(v) },
  damper:     { path: 'axis.axisdamper',   conv: (v: number) => w255(v) },
  inertia:    { path: 'axis.axisinertia',  conv: (v: number) => w255(v) },
  friction:   { path: 'axis.axisfriction', conv: (v: number) => w255(v) },
  esGain:     { path: 'axis.esgain',       conv: (v: number) => w255(v) },
  esDamp:     { path: 'axis.esdamp',       conv: (v: number) => w255(v) },
  expo:       { path: 'axis.expo',         conv: (v: number) => v },
  invert:     { path: 'axis.invert',       conv: (v: boolean) => (v ? 1 : 0) },
  ffbInvert:  { path: 'axis.ffbinvert',    conv: (v: boolean) => (v ? 1 : 0) },
}

/** Écrire UN seul champ de WheelConfig en RAM (application live, pas d'EEPROM). */
export async function applyWheelField<K extends keyof WheelConfig>(key: K, value: WheelConfig[K]): Promise<void> {
  const f = WHEEL_FIELD_MAP[key]
  if (!f) return
  await writeProp(f.path, (f.conv as (v: WheelConfig[K]) => string | number)(value), 'offb')
}

/** Écrire un seul gain d'effet en RAM (pas d'EEPROM). */
export async function applyEffectGain(path: string, gain: number): Promise<void> {
  await writeProp(path, Math.round((gain / 100) * 255), 'offb')
}

// ── Filtres FFB (biquad lowpass par effet) ────────────────────────────────────
// fx.filter*Freq : coupure en Hz (1..500). fx.filter*Q : facteur Q ×0.01 (1..500).
// Tooltips repris fidèlement de la version odrive-wheel.html (traduits FR).
export interface FilterParam { name: string; path: string; default: number; tooltip: string }
export interface FilterDef { group: string; freq: FilterParam; q: FilterParam }

export const FILTER_DEFS: FilterDef[] = [
  {
    group: 'Constant Force',
    freq: { name: 'Fréquence', path: 'fx.filterCfFreq', default: 500, tooltip: 'Coupure du filtre passe-bas (biquad) du Constant Force, en Hz. 1–500. Défaut 500 (laisse quasiment tout passer).' },
    q:    { name: 'Q',         path: 'fx.filterCfQ',    default: 70,  tooltip: 'Facteur Q du biquad CF (×0.01). Défaut 70 ≈ Butterworth.' },
  },
  {
    group: 'Friction',
    freq: { name: 'Fréquence', path: 'fx.filterFrFreq', default: 50, tooltip: 'Coupure du filtre Friction. Défaut 50.' },
    q:    { name: 'Q',         path: 'fx.filterFrQ',    default: 20, tooltip: 'Q du filtre Friction. Défaut 20.' },
  },
  {
    group: 'Damper',
    freq: { name: 'Fréquence', path: 'fx.filterDaFreq', default: 30, tooltip: 'Coupure du filtre Damper. Défaut 30.' },
    q:    { name: 'Q',         path: 'fx.filterDaQ',    default: 40, tooltip: 'Q du filtre Damper. Défaut 40.' },
  },
  {
    group: 'Inertia',
    freq: { name: 'Fréquence', path: 'fx.filterInFreq', default: 15, tooltip: 'Coupure du filtre Inertia. Défaut 15 (agressif, le signal d\'accélération est bruité).' },
    q:    { name: 'Q',         path: 'fx.filterInQ',    default: 20, tooltip: 'Q du filtre Inertia. Défaut 20.' },
  },
]

export type FilterValues = Record<string, number>

/** Valeurs par défaut firmware (avant lecture de la carte). */
export function defaultFilterValues(): FilterValues {
  const v: FilterValues = {}
  for (const d of FILTER_DEFS) { v[d.freq.path] = d.freq.default; v[d.q.path] = d.q.default }
  return v
}

/** Lire tous les filtres depuis la carte. */
export async function readFiltersConfig(current: FilterValues): Promise<FilterValues> {
  const out: FilterValues = { ...current }
  for (const d of FILTER_DEFS) {
    for (const p of [d.freq, d.q]) {
      const raw = await readProp(p.path, 'offb')
      out[p.path] = raw != null ? toNum(raw, current[p.path] ?? p.default) : (current[p.path] ?? p.default)
    }
  }
  return out
}

/** Écrire un seul filtre en RAM (application live, pas d'EEPROM). */
export async function applyFilter(path: string, value: number): Promise<void> {
  await writeProp(path, Math.round(value), 'offb')
}

/** Capturer l'état FFB + filtres courant de la carte dans un ProfileSettings.
 *  Tout est relu depuis la carte (roue incl. invert/ffbInvert, effets, filtres) ;
 *  le WheelConfig passé sert de repli si une lecture échoue. L'appelant gère la pause du polling. */
export async function captureProfileSettings(wheel: WheelConfig): Promise<ProfileSettings> {
  const freshWheel = await readWheelConfig(wheel)
  const seed = EFFECT_DEFS.map((d) => ({ name: d.name, path: d.path, gain: d.defaultGain }))
  const eff = await readEffectsConfig(seed)
  const filters = await readFiltersConfig(defaultFilterValues())
  return {
    wheel: freshWheel,
    effects: Object.fromEntries(eff.map((e) => [e.path, e.gain])),
    filters,
  }
}

/** Appliquer un profil (roue + gains effets + filtres) sur la carte, en RAM. */
export async function applyProfileSettings(s: ProfileSettings): Promise<void> {
  await applyWheelConfig(s.wheel)
  for (const [path, gain] of Object.entries(s.effects)) await applyEffectGain(path, gain)
  for (const [path, val] of Object.entries(s.filters)) await applyFilter(path, val)
}

/** Écrire tous les filtres + désarmer + persister EEPROM (bouton Sauvegarder). */
export async function writeFiltersConfig(values: FilterValues): Promise<void> {
  for (const d of FILTER_DEFS) {
    await applyFilter(d.freq.path, values[d.freq.path])
    await applyFilter(d.q.path, values[d.q.path])
  }
  if (window.ow) {
    await window.ow.send('w axis0.requested_state 1')
    await new Promise((r) => setTimeout(r, 300))
    await window.ow.query('sys.save!')
  }
}
