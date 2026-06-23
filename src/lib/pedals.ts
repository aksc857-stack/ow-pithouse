// ── Pédales : lecture seule (Gamepad API) + bindings mémorisés ─────────────────
// Les pédales — qu'elles soient un pédalier USB séparé OU branchées sur les GPIO
// du board (exposés en axes HID) — apparaissent comme des axes de manette.
// On LIT uniquement (aucune écriture firmware, pas de contrôle/calibration) et on
// MÉMORISE quel axe correspond à quelle pédale (localStorage).

export type PedalKey = 'throttle' | 'brake' | 'clutch'
export const PEDAL_KEYS: readonly PedalKey[] = ['throttle', 'brake', 'clutch']

export interface PedalBinding {
  gamepad: number   // index de la manette (navigator.getGamepads)
  axis: number      // index de l'axe sur cette manette
}

export interface PedalsState {
  bindings: Partial<Record<PedalKey, PedalBinding>>
  hidden: PedalKey[]   // axes masqués (non utilisés)
}

const KEY = 'ow_pedals'

export function loadPedals(): PedalsState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { bindings: {}, hidden: [], ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { bindings: {}, hidden: [] }
}

export function savePedals(s: PedalsState): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

// Liste plate de tous les axes disponibles (pour la détection de binding).
export interface AxisSample { gamepad: number; axis: number; value: number }
export function snapshotAxes(): AxisSample[] {
  const out: AxisSample[] = []
  const pads = navigator.getGamepads?.() ?? []
  for (let g = 0; g < pads.length; g++) {
    const pad = pads[g]
    if (!pad) continue
    pad.axes.forEach((value, axis) => out.push({ gamepad: g, axis, value }))
  }
  return out
}

// Vrai si au moins une manette/pédalier est connecté.
export function hasGamepad(): boolean {
  return (navigator.getGamepads?.() ?? []).some(Boolean)
}

// Lit la valeur 0..100 d'un axe lié (axe -1..1 → 0..100). null si indisponible.
export function readAxis(b: PedalBinding | undefined): number | null {
  if (!b) return null
  const pad = navigator.getGamepads?.()[b.gamepad]
  const v = pad?.axes[b.axis]
  if (v == null) return null
  return Math.round(((v + 1) / 2) * 100)
}
