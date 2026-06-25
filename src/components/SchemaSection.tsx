import { useState, useEffect, useCallback } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { readProp, writeProp } from '@/lib/odrive'
import { toast } from '@/components/ui'
import type { SchemaField as Field, SchemaSection } from '@/lib/odriveSchema'

// ── One editable field row ────────────────────────────────────────────────────
function FieldRow({ field, value, dirty, onChange }: {
  field: Field
  value: string
  dirty: boolean
  onChange: (v: string) => void
}) {
  const label = field.label || field.name

  return (
    <div className="schema-row">
      <label className="schema-row__label">
        {label}
        {field.hint && <i className="ti ti-help-circle" title={field.hint} style={{ marginLeft: 6, color: 'var(--text-faint)', cursor: 'help' }} />}
        {field.readonly && <span className="schema-ro">RO</span>}
        {dirty && <span className="schema-dirty" />}
      </label>
      {field.type === 'enum' && field.opts ? (
        <select
          className="schema-input"
          value={value}
          disabled={field.readonly}
          onChange={(e) => onChange(e.target.value)}
        >
          {Object.entries(field.opts).map(([k, name]) => (
            <option key={k} value={k}>{k} — {name}</option>
          ))}
        </select>
      ) : field.type === 'bool' ? (
        <select
          className="schema-input"
          value={value}
          disabled={field.readonly}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="0">False</option>
          <option value="1">True</option>
        </select>
      ) : (
        <input
          className="schema-input"
          type="text"
          value={value}
          disabled={field.readonly}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

// ── Full section renderer ─────────────────────────────────────────────────────
export function SchemaSectionView({ section }: { section: SchemaSection }) {
  const { connected } = useDevice()
  const [values, setValues] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const allFields = section.groups.flatMap((g) => g.fields)

  const readAll = useCallback(async () => {
    if (!connected) return
    setLoading(true)
    const next: Record<string, string> = {}
    for (const f of allFields) {
      const v = await readProp(f.path, f.protocol)
      if (v != null) {
        // For bool, normalize "True"/"False" → "1"/"0"
        if (f.type === 'bool') next[f.path] = (v === '1' || v.toLowerCase() === 'true') ? '1' : '0'
        else next[f.path] = v
      }
    }
    setValues(next)
    setDirty(new Set())
    setLoading(false)
  }, [connected, section.id]) // eslint-disable-line

  // Auto-read when the section becomes visible & connected
  useEffect(() => { readAll() }, [readAll])

  const setField = (path: string, v: string) => {
    setValues((prev) => ({ ...prev, [path]: v }))
    setDirty((prev) => new Set(prev).add(path))
  }

  const applyChanged = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    const changed = allFields.filter((f) => dirty.has(f.path) && !f.readonly)
    if (changed.length === 0) { toast('Aucune modification'); return }
    for (const f of changed) {
      await writeProp(f.path, values[f.path], f.protocol)
    }
    setDirty(new Set())
    toast(`${changed.length} champ(s) écrit(s) — n'oubliez pas de sauvegarder`)
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-head__title">{section.label}</div>
          <div className="page-head__sub">
            {loading ? 'Lecture en cours...' : `${allFields.length} paramètres`}
          </div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={readAll} disabled={!connected || loading}>
            <i className="ti ti-refresh" /> Relire
          </button>
          <button className="btn btn--primary" onClick={applyChanged} disabled={!connected || dirty.size === 0}>
            <i className="ti ti-check" /> Appliquer{dirty.size > 0 ? ` (${dirty.size})` : ''}
          </button>
        </div>
      </div>

      {!connected && (
        <div className="alert alert--warn">
          <i className="ti ti-plug-off" /> Connectez la carte pour lire et modifier ces paramètres.
        </div>
      )}

      {section.groups.map((g) => (
        <div key={g.group} className="card" style={{ marginBottom: 12 }}>
          <div className="card__head"><i className="ti ti-adjustments" />{g.group}</div>
          <div className="schema-grid">
            {g.fields.map((f) => (
              <FieldRow
                key={f.path}
                field={f}
                value={values[f.path] ?? ''}
                dirty={dirty.has(f.path)}
                onChange={(v) => setField(f.path, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
