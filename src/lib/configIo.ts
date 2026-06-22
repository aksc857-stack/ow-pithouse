// ── Import / export de la config complète de la carte ─────────────────────────
// Port fidèle de l'import/export de l'interface web de référence (odrive-wheel.html).
//
// Format : objet JSON plat { "<path>": "<valeur brute firmware>", ... }.
// On exporte/importe la valeur BRUTE telle qu'elle circule sur le fil (readProp/
// writeProp), pas la valeur d'affichage mise à l'échelle — ainsi les fichiers
// restent interchangeables avec l'interface web d'origine et le round-trip est exact.
//
// Comme la référence : seuls les champs INSCRIPTIBLES sont exportés (les readonly
// ne peuvent pas être réécrits), et l'import écrit uniquement en RAM (pas de NVM ;
// l'utilisateur persiste ensuite manuellement via Sauvegarder).

import { readProp, writeProp } from './odrive'
import type { FieldProtocol } from './odriveSchema'
import { ODRIVE_SECTIONS } from './odriveSchema'
import { EFFECT_DEFS, FILTER_DEFS } from './ffbConfig'

export interface ExportField { path: string; protocol: FieldProtocol }

// Paths FFB / roue OpenFFBoard (tous offb, inscriptibles) — non couverts par le
// schéma ODrive. Aligné sur readWheelConfig/WHEEL_FIELD_MAP de ffbConfig.ts.
const FFB_WHEEL_PATHS = [
  'axis.range', 'axis.maxtorque', 'axis.fxratio', 'fx.master',
  'axis.idlespring', 'axis.axisdamper', 'axis.axisinertia', 'axis.axisfriction',
  'axis.esgain', 'axis.esdamp', 'axis.expo', 'axis.invert', 'axis.ffbinvert',
]

/** Liste canonique des champs exportables (inscriptibles uniquement), dédoublonnée. */
export function exportableFields(): ExportField[] {
  const out: ExportField[] = []
  // 1. Schéma ODrive (on saute les readonly).
  for (const sec of ODRIVE_SECTIONS)
    for (const grp of sec.groups)
      for (const f of grp.fields)
        if (!f.readonly) out.push({ path: f.path, protocol: f.protocol })
  // 2. FFB : roue + gains d'effets + filtres (tous offb).
  for (const p of FFB_WHEEL_PATHS) out.push({ path: p, protocol: 'offb' })
  for (const e of EFFECT_DEFS) out.push({ path: e.path, protocol: 'offb' })
  for (const d of FILTER_DEFS) {
    out.push({ path: d.freq.path, protocol: 'offb' })
    out.push({ path: d.q.path, protocol: 'offb' })
  }
  // Dédoublonne (un path pourrait apparaître dans le schéma ET la liste FFB).
  const seen = new Set<string>()
  return out.filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)))
}

export interface ExportResult { config: Record<string, string>; read: number; failed: number }

/** Lit chaque champ inscriptible depuis la carte → objet { path: valeur brute }.
 *  Lectures non loggées (log:false) pour ne pas inonder la Console (~120 champs). */
export async function exportConfig(): Promise<ExportResult> {
  const fields = exportableFields()
  const config: Record<string, string> = {}
  let read = 0
  let failed = 0
  for (const f of fields) {
    const v = await readProp(f.path, f.protocol, { log: false })
    if (v != null && v !== '') { config[f.path] = v; read++ }
    else failed++
  }
  return { config, read, failed }
}

export interface ImportResult { ok: number; fail: number; skipped: number; total: number }

/** Écrit sur la carte chaque path connu & inscriptible présent dans l'objet JSON.
 *  N'écrit qu'en RAM (pas de NVM). Les paths inconnus/readonly sont ignorés. */
export async function importConfig(obj: Record<string, unknown>): Promise<ImportResult> {
  const proto = new Map(exportableFields().map((f) => [f.path, f.protocol]))
  const entries = Object.entries(obj).filter(([p, v]) => proto.has(p) && v != null)
  const skipped = Object.keys(obj).length - entries.length
  let ok = 0
  let fail = 0
  for (const [path, value] of entries) {
    try {
      await writeProp(path, value as string | number, proto.get(path)!)
      ok++
    } catch {
      fail++
    }
  }
  return { ok, fail, skipped, total: entries.length }
}
