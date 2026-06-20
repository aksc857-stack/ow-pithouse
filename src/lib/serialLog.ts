// ── Bus de log série ──────────────────────────────────────────────────────────
// Les helpers readProp/writeProp (lib/odrive.ts) n'ont pas accès au contexte
// React. Ce bus laisse DeviceContext s'abonner pour afficher dans la Console les
// écritures (changements de valeur) et les lectures à la demande — SANS logger
// le polling télémétrie de fond (qui passe log:false et inonderait sinon).

export type LogType = 'tx' | 'rx' | 'info' | 'err'
type Listener = (type: LogType, text: string) => void

let listener: Listener | null = null

/** Enregistre le consommateur de log (null pour se désabonner). */
export function setSerialLogger(fn: Listener | null) {
  listener = fn
}

/** Émet une ligne de log si un consommateur est abonné. */
export function serialLog(type: LogType, text: string) {
  listener?.(type, text)
}
