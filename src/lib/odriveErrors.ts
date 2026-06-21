// ── Décodage des registres d'erreur ODrive ────────────────────────────────────
// Bitmaps repris de odrive-wheel.html (couverture des bits les plus courants).

const ERR_ODRIVE: Record<number, string> = {
  0x00000001: 'CONTROL_ITERATION_MISSED',
  0x00000002: 'DC_BUS_UNDER_VOLTAGE',
  0x00000004: 'DC_BUS_OVER_VOLTAGE',
  0x00000008: 'DC_BUS_OVER_REGEN_CURRENT',
  0x00000010: 'DC_BUS_OVER_CURRENT',
  0x00000020: 'BRAKE_DEADTIME_VIOLATION',
  0x00000040: 'BRAKE_DUTY_CYCLE_NAN',
  0x00000080: 'INVALID_BRAKE_RESISTANCE',
}
const ERR_AXIS: Record<number, string> = {
  0x00000001: 'INVALID_STATE',
  0x00000040: 'MOTOR_FAILED',
  0x00000080: 'SENSORLESS_ESTIMATOR_FAILED',
  0x00000100: 'ENCODER_FAILED',
  0x00000200: 'CONTROLLER_FAILED',
  0x00000800: 'WATCHDOG_TIMER_EXPIRED',
  0x00001000: 'MIN_ENDSTOP_PRESSED',
  0x00002000: 'MAX_ENDSTOP_PRESSED',
  0x00004000: 'ESTOP_REQUESTED',
  0x00020000: 'HOMING_WITHOUT_ENDSTOP',
  0x00040000: 'OVER_TEMP',
  0x00080000: 'UNKNOWN_POSITION',
}
const ERR_MOTOR: Record<number, string> = {
  0x00000001: 'PHASE_RESISTANCE_OUT_OF_RANGE',
  0x00000002: 'PHASE_INDUCTANCE_OUT_OF_RANGE',
  0x00000008: 'DRV_FAULT',
  0x00000010: 'CONTROL_DEADLINE_MISSED',
  0x00000080: 'MODULATION_MAGNITUDE',
  0x00000400: 'CURRENT_SENSE_SATURATION',
  0x00001000: 'CURRENT_LIMIT_VIOLATION',
  0x00010000: 'MODULATION_IS_NAN',
  0x00020000: 'MOTOR_THERMISTOR_OVER_TEMP',
  0x00040000: 'FET_THERMISTOR_OVER_TEMP',
  0x00080000: 'TIMER_UPDATE_MISSED',
  0x00100000: 'CURRENT_MEASUREMENT_UNAVAILABLE',
  0x00200000: 'CONTROLLER_FAILED',
  0x00400000: 'I_BUS_OUT_OF_RANGE',
  0x00800000: 'BRAKE_RESISTOR_DISARMED',
  0x01000000: 'SYSTEM_LEVEL',
  0x02000000: 'BAD_TIMING',
  0x04000000: 'UNKNOWN_PHASE_ESTIMATE',
  0x08000000: 'UNKNOWN_PHASE_VEL',
  0x10000000: 'UNKNOWN_TORQUE',
  0x20000000: 'UNKNOWN_CURRENT_COMMAND',
  0x40000000: 'UNKNOWN_CURRENT_MEASUREMENT',
  0x80000000: 'UNKNOWN_VBUS_VOLTAGE',
}
const ERR_ENCODER: Record<number, string> = {
  0x00000001: 'UNSTABLE_GAIN',
  0x00000002: 'CPR_POLEPAIRS_MISMATCH',
  0x00000004: 'NO_RESPONSE',
  0x00000008: 'UNSUPPORTED_ENCODER_MODE',
  0x00000010: 'ILLEGAL_HALL_STATE',
  0x00000020: 'INDEX_NOT_FOUND_YET',
  0x00000040: 'ABS_SPI_TIMEOUT',
  0x00000080: 'ABS_SPI_COM_FAIL',
  0x00000100: 'ABS_SPI_NOT_READY',
  0x00000200: 'HALL_NOT_CALIBRATED_YET',
}
const ERR_CTRL: Record<number, string> = {
  0x00000001: 'OVERSPEED',
  0x00000002: 'INVALID_INPUT_MODE',
  0x00000004: 'UNSTABLE_GAIN',
  0x00000008: 'INVALID_MIRROR_AXIS',
  0x00000010: 'INVALID_LOAD_ENCODER',
  0x00000020: 'INVALID_ESTIMATE',
  0x00000040: 'INVALID_CIRCULAR_RANGE',
  0x00000080: 'SPINOUT_DETECTED',
}

export interface ErrorDef { label: string; path: string; bits: Record<number, string> }

export const ERROR_DEFS: ErrorDef[] = [
  { label: 'odrv.error',             path: 'error',                  bits: ERR_ODRIVE },
  { label: 'axis0.error',            path: 'axis0.error',            bits: ERR_AXIS },
  { label: 'axis0.motor.error',      path: 'axis0.motor.error',      bits: ERR_MOTOR },
  { label: 'axis0.encoder.error',    path: 'axis0.encoder.error',    bits: ERR_ENCODER },
  { label: 'axis0.controller.error', path: 'axis0.controller.error', bits: ERR_CTRL },
]

/** "0x00000000" sur 8 chiffres. */
export function toHex(value: number): string {
  return '0x' + (value >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

/** Libellés UI traduisibles pour les bits non reconnus (noms de bits = constantes firmware, non traduites). */
export interface DecodeLabels {
  /** Bits supplémentaires hors couverture, ex. "(+bits 0x...)". */
  extra: (hex: string) => string
  /** Valeur non nulle mais aucun bit connu, ex. "(bits inconnus)". */
  unknown: string
}

/** Décode un registre d'erreur en liste de bits nommés. */
export function decodeError(value: number, bits: Record<number, string>, labels?: DecodeLabels): string {
  if (!value) return 'OK'
  const out: string[] = []
  let known = 0
  for (const [mask, name] of Object.entries(bits)) {
    const m = Number(mask)
    known |= m
    if (value & m) out.push(name)
  }
  const unkn = value & ~known
  if (unkn) out.push(labels ? labels.extra(toHex(unkn)) : '(+bits ' + toHex(unkn) + ')')
  return out.join(' | ') || labels?.unknown || '(bits inconnus)'
}
