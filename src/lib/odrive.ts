// ── ODrive + OpenFFBoard protocol layer ──────────────────────────────────────
// The board speaks TWO protocols on the same serial link:
//   • odrv  — ODrive ASCII:  read "r <path>" → "48.2"   write "w <path> <v>"
//   • offb  — OpenFFBoard:    read "<path>?" → "[path?|VAL]"  write "<path>=<v>"
// FFB wheel/effects/filters params are all `offb`. Motor/encoder/vbus are `odrv`.

export type Protocol = 'odrv' | 'offb'

/** Extract the value out of an OpenFFBoard reply: "[axis.range?|900]" → "900" */
export function extractOffbValue(reply: string | null): string | null {
  if (!reply) return null
  const m = reply.match(/^\[[^|]+\|([\s\S]*)\]$/)
  return m ? m[1] : reply
}

/** Read a property using the correct protocol. Returns null on timeout/error. */
export async function readProp(path: string, protocol: Protocol = 'odrv'): Promise<string | null> {
  if (!window.ow) return null
  try {
    if (protocol === 'offb') {
      const reply = await window.ow.query(`${path}?`)
      return extractOffbValue(reply)
    }
    const reply = await window.ow.query(`r ${path}`)
    // ODrive returns "invalid property" for unknown paths
    if (reply && /invalid/i.test(reply)) return null
    return reply
  } catch {
    return null
  }
}

/** Write a property using the correct protocol. */
export async function writeProp(path: string, value: string | number, protocol: Protocol = 'odrv'): Promise<void> {
  if (!window.ow) return
  if (protocol === 'offb') {
    await window.ow.query(`${path}=${value}`)   // offb echoes a reply, consume it
  } else {
    await window.ow.send(`w ${path} ${value}`)
  }
}

export function toNum(v: string | null, fallback: number): number {
  if (v == null) return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

// ── Scale helpers ─────────────────────────────────────────────────────────────
// OpenFFBoard axis effects are 0..255; the UI shows 0..100%.
export const pct255ToUi = (raw: string | null, fb: number) => Math.round((toNum(raw, (fb / 100) * 255) / 255) * 100)
export const uiToPct255 = (ui: number) => Math.round((ui / 100) * 255)
