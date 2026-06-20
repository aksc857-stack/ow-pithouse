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
import type { WheelConfig } from '@/types'

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
  }
}

/** Write all FFB wheel params to the board, then save FFB EEPROM. */
export async function writeWheelConfig(c: WheelConfig): Promise<void> {
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
  // Disarm motor first (safe during flash erase), then persist FFB EEPROM.
  if (window.ow) {
    await window.ow.send('w axis0.requested_state 1')
    await new Promise((r) => setTimeout(r, 300))
    await window.ow.query('sys.save!')   // OpenFFBoard EEPROM, returns "OK"
  }
}
