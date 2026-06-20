import { useState, useMemo, useRef, useEffect } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { toast } from '@/components/ui'
import { readProp } from '@/lib/odrive'
import { ERROR_DEFS, decodeError, toHex } from '@/lib/odriveErrors'
import { applyProfileSettings, readEffectsConfig, readFiltersConfig, defaultFilterValues, EFFECT_DEFS } from '@/lib/ffbConfig'
import { buildCommandList, GROUP_LABELS, type CmdItem } from '@/lib/commandList'
import { DfuClient, type DfuLogKind } from '@/lib/dfu'
import type { GameProfile, ProfileSettings } from '@/types'

// ── Profiles ──────────────────────────────────────────────────────────────────
// Un profil capture les réglages du menu FFB + du menu Filtres, et peut les
// réappliquer sur la carte (en RAM, comme les sliders).
export function Profiles() {
  const { connected, wheelConfig, setWheelConfig } = useDevice()
  const [profiles, setProfiles] = useState<GameProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('ow_profiles') || '[]') } catch { return [] }
  })
  const [busy, setBusy] = useState(false)
  // Modal création/édition (Electron ne supporte pas window.prompt).
  // id null = création (capture les réglages) ; id défini = renommage.
  const [form, setForm] = useState<{ id: string | null; name: string; exe: string } | null>(null)

  const persist = (next: GameProfile[]) => {
    setProfiles(next)
    localStorage.setItem('ow_profiles', JSON.stringify(next))
  }

  // B — Capture : lit l'état FFB + filtres courant de la carte.
  const captureSettings = async (): Promise<ProfileSettings> => {
    const seed = EFFECT_DEFS.map((d) => ({ name: d.name, path: d.path, gain: d.defaultGain }))
    const eff = await readEffectsConfig(seed)
    const filters = await readFiltersConfig(defaultFilterValues())
    return {
      wheel: wheelConfig,
      effects: Object.fromEntries(eff.map((e) => [e.path, e.gain])),
      filters,
    }
  }

  const openNew = () => {
    if (!connected) { toast('Connectez la carte pour capturer les réglages', 'err'); return }
    setForm({ id: null, name: '', exe: '' })
  }

  const openEdit = (p: GameProfile) => setForm({ id: p.id, name: p.name, exe: p.exe || '' })

  const submit = async () => {
    if (!form) return
    const name = form.name.trim()
    if (!name) { toast('Donnez un nom au profil', 'err'); return }
    const exe = form.exe.trim()

    // Édition : renomme sans recapturer les réglages.
    if (form.id !== null) {
      persist(profiles.map((p) => (p.id === form.id ? { ...p, name, exe } : p)))
      toast('Profil renommé')
      setForm(null)
      return
    }

    // Création : capture les réglages actuels.
    if (!connected) { toast('Connectez la carte pour capturer les réglages', 'err'); return }
    setBusy(true)
    try {
      const settings = await captureSettings()
      persist([...profiles, { id: Date.now().toString(), name, exe, icon: 'ti-device-gamepad', settings }])
      toast(`Profil "${name}" créé avec les réglages actuels`)
      setForm(null)
    } catch (e) {
      toast('Erreur capture : ' + e, 'err')
    } finally { setBusy(false) }
  }

  // B — Met à jour un profil avec les réglages courants.
  const recapture = async (id: string) => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    setBusy(true)
    try {
      const settings = await captureSettings()
      persist(profiles.map((p) => (p.id === id ? { ...p, settings } : p)))
      toast('Profil mis à jour avec les réglages actuels')
    } catch (e) {
      toast('Erreur : ' + e, 'err')
    } finally { setBusy(false) }
  }

  // A — Applique les réglages d'un profil sur la carte (RAM).
  const load = async (p: GameProfile) => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    if (!p.settings) { toast('Ce profil n\'a pas de réglages enregistrés', 'err'); return }
    setBusy(true)
    try {
      await applyProfileSettings(p.settings)
      setWheelConfig(p.settings.wheel)
      persist(profiles.map((x) => ({ ...x, active: x.id === p.id })))
      toast(`Profil "${p.name}" appliqué — Sauvegardez (FFB) pour persister`)
    } catch (e) {
      toast('Erreur : ' + e, 'err')
    } finally { setBusy(false) }
  }

  const remove = (id: string) => persist(profiles.filter((p) => p.id !== id))

  const summary = (p: GameProfile) =>
    p.settings
      ? `couple ${p.settings.wheel.maxTorque} Nm · ${p.settings.wheel.range}° · master ${p.settings.wheel.masterGain}%`
      : 'pas de réglages enregistrés'

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Profils</div>
          <div className="page-head__sub">Capture et application des réglages FFB + Filtres</div>
        </div>
        <button className="btn btn--primary" onClick={openNew} disabled={!connected || busy}>
          <i className="ti ti-plus" /> Nouveau profil
        </button>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-bookmarks" />Profils</div>

        {profiles.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>
            Aucun profil. Réglez la carte (FFB + Filtres) puis « Nouveau profil » pour capturer l'état actuel.
          </div>
        )}

        {profiles.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
              background: 'var(--bg-sunken)',
              border: `1px solid ${p.active ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
            }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20, flexShrink: 0 }}>
              <i className={`ti ${p.icon}`} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}{p.active && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 8 }}>● actif</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {p.exe ? p.exe + ' · ' : ''}{summary(p)}
              </div>
            </div>
            <button className="btn btn--sm btn--primary" onClick={() => load(p)} disabled={!connected || busy || !p.settings}>Charger</button>
            <button className="btn btn--sm" onClick={() => openEdit(p)} disabled={busy} title="Renommer">
              <i className="ti ti-pencil" />
            </button>
            <button className="btn btn--sm" onClick={() => recapture(p.id)} disabled={!connected || busy} title="Mettre à jour avec les réglages actuels">
              <i className="ti ti-refresh" />
            </button>
            <button className="btn btn--sm btn--danger" onClick={() => remove(p.id)} title="Supprimer">
              <i className="ti ti-trash" />
            </button>
          </div>
        ))}
      </div>

      {form && (
        <div
          onClick={() => !busy && setForm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 20, boxShadow: '0 16px 40px rgba(0,0,0,.5)' }}
          >
            <div className="card__head" style={{ marginBottom: 14 }}>
              <i className={`ti ${form.id ? 'ti-pencil' : 'ti-plus'}`} />{form.id ? 'Renommer le profil' : 'Nouveau profil'}
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Nom</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="ex: iRacing — GT3"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Exécutable du jeu (optionnel)</label>
              <input
                value={form.exe}
                onChange={(e) => setForm({ ...form, exe: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="ex: iRacingSim64.exe"
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
              />
            </div>
            {!form.id && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>
                Les réglages FFB + Filtres actuels de la carte seront capturés dans ce profil.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setForm(null)} disabled={busy}>Annuler</button>
              <button className="btn btn--primary" onClick={submit} disabled={busy}>
                <i className="ti ti-device-floppy" /> {form.id ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Status (Errors décodées + Actions state machine / NVM) ────────────────────
const STATE_ACTIONS: { label: string; val: number; sub: string; cls?: string }[] = [
  { label: 'IDLE',                       val: 1,  sub: 'state 1', cls: 'btn--primary' },
  { label: 'MOTOR_CALIBRATION',          val: 4,  sub: 'state 4 · mesure R+L ~5s' },
  { label: 'ENCODER_INDEX_SEARCH',       val: 6,  sub: 'state 6 · cherche index Z' },
  { label: 'ENCODER_OFFSET_CALIBRATION', val: 7,  sub: 'state 7 · tourne moteur ~10s' },
  { label: 'ENCODER_DIR_FIND',           val: 10, sub: 'state 10' },
  { label: 'FULL_CALIBRATION',           val: 3,  sub: 'state 3 · moteur + enc' },
  { label: 'CLOSED_LOOP_CONTROL',        val: 8,  sub: 'state 8 · active le gain' },
  { label: 'LOCKIN_SPIN',                val: 9,  sub: 'state 9 · open-loop' },
  { label: 'HOMING',                     val: 11, sub: 'state 11' },
]
const RAW_ACTIONS: { label: string; cmd: string; sub: string; cls?: string; confirm?: string }[] = [
  { label: 'Save NVM',       cmd: 'ss', sub: 'ss · persiste la config', cls: 'btn--primary' },
  { label: 'Erase + Reboot', cmd: 'se', sub: 'se', cls: 'btn--danger', confirm: 'Efface la config + reboot. Confirmer ?' },
  { label: 'Reboot',         cmd: 'sr', sub: 'sr' },
  { label: 'Clear Errors',   cmd: 'sc', sub: 'sc' },
]

export function Status() {
  const { connected, appendLog } = useDevice()
  const [errs, setErrs] = useState<Record<string, number | null>>({})
  const [busy, setBusy] = useState(false)

  const readErrors = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    setBusy(true)
    try {
      const next: Record<string, number | null> = {}
      for (const d of ERROR_DEFS) {
        const raw = await readProp(d.path, 'odrv')
        next[d.path] = raw == null ? null : (parseInt(raw, 10) || 0)
      }
      setErrs(next)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (connected) readErrors() }, [connected])

  // Action : envoi direct (fire-and-forget) + écho dans la Console.
  const runAction = async (cmd: string, confirmMsg?: string) => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    if (confirmMsg && !window.confirm(confirmMsg)) return
    appendLog('tx', cmd)
    await window.ow?.send(cmd)
    toast('Commande envoyée : ' + cmd)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Status</div>
          <div className="page-head__sub">Erreurs décodées et actions machine d'état / NVM</div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={readErrors} disabled={!connected || busy}>
            <i className="ti ti-refresh" /> Relire les erreurs
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-alert-triangle" />Errors <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>(décodées)</span></div>
        {ERROR_DEFS.map((d) => {
          const v = errs[d.path]
          const known = v != null
          const hex = known ? toHex(v) : '—'
          const ok = v === 0
          return (
            <div key={d.path} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, minWidth: 200, color: 'var(--text-dim)' }}>{d.label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, minWidth: 96, color: !known ? 'var(--text-faint)' : ok ? '#86efac' : 'var(--red)' }}>{hex}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: ok ? '#86efac' : 'var(--red)' }}>
                {!known ? '' : ok ? 'OK' : decodeError(v, d.bits)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head"><i className="ti ti-settings-bolt" />Actions <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>(state machine / NVM)</span></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STATE_ACTIONS.map((a) => (
            <button key={a.val} className={`btn ${a.cls || ''}`} onClick={() => runAction(`w axis0.requested_state ${a.val}`)} disabled={!connected}
              style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '8px 12px', gap: 2 }}>
              <span style={{ fontSize: 12 }}>{a.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{a.sub}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {RAW_ACTIONS.map((a) => (
            <button key={a.cmd} className={`btn ${a.cls || ''}`} onClick={() => runAction(a.cmd, a.confirm)} disabled={!connected}
              style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '8px 12px', gap: 2 }}>
              <span style={{ fontSize: 12 }}>{a.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>{a.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Console ───────────────────────────────────────────────────────────────────
export function Console() {
  const { log, sendCommand, clearLog } = useDevice()
  const [cmd, setCmd] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allCmds = useMemo(() => buildCommandList(), [])
  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim()
    if (!q) return allCmds
    return allCmds.filter((c) => c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
  }, [filter, allCmds])

  const exec = async () => {
    if (!cmd.trim()) return
    await sendCommand(cmd.trim())
    setCmd('')
  }

  // Clic sur une commande : remplit l'input, ferme le picker, place le curseur à la fin.
  const pick = (c: CmdItem) => {
    setCmd(c.cmd)
    setPickerOpen(false)
    setFilter('')
    setTimeout(() => {
      const el = inputRef.current
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) }
    }, 0)
  }

  // Liste groupée (en-tête inséré quand le groupe change).
  const rows: JSX.Element[] = []
  let curGrp: string | null = null
  filtered.forEach((it, i) => {
    if (it.grp !== curGrp) {
      curGrp = it.grp
      rows.push(
        <div key={`grp-${it.grp}`} style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)' }}>
          {GROUP_LABELS[it.grp]}
        </div>
      )
    }
    rows.push(
      <div key={`${it.grp}-${i}`} className="cmd-pick-item" onClick={() => pick(it)}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>{it.cmd.trim()}</span>
        <span style={{ color: 'var(--text-faint)', fontSize: 11, marginLeft: 10 }}>{it.desc}</span>
      </div>
    )
  })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Console</div>
          <div className="page-head__sub">Commandes ODrive ASCII</div>
        </div>
        <div className="page-head__actions">
          <button className={`btn ${pickerOpen ? 'btn--primary' : ''}`} onClick={() => setPickerOpen((o) => !o)}>
            <i className="ti ti-list-search" /> Available commands
          </button>
          <button className="btn" onClick={clearLog} disabled={log.length === 0}>
            <i className="ti ti-trash" /> Clear
          </button>
        </div>
      </div>

      <div style={{
        background: '#080a0d', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        padding: '12px 14px', height: 320, overflowY: 'auto', fontFamily: 'var(--mono)',
        fontSize: 12, lineHeight: 1.8,
      }}>
        {log.length === 0 && <div style={{ color: 'var(--text-faint)' }}>En attente de commandes...</div>}
        {log.map((l, i) => (
          <div key={i} style={{ color: l.type === 'tx' ? 'var(--text-faint)' : l.type === 'err' ? 'var(--red)' : l.type === 'info' ? 'var(--text-faint)' : '#86efac' }}>
            {l.type === 'tx' ? '→ ' : l.type === 'rx' ? '← ' : ''}{l.text}
          </div>
        ))}
      </div>

      {pickerOpen && (
        <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-sunken)', overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              placeholder="Filtrer les commandes (path, description)…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setPickerOpen(false); inputRef.current?.focus() } }}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-panel)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {rows.length ? rows : <div style={{ padding: 12, color: 'var(--text-faint)', fontSize: 12 }}>Aucune commande trouvée</div>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          ref={inputRef}
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' }}
          placeholder="Commande ODrive ASCII..."
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && exec()}
        />
        <button className="btn btn--primary" onClick={exec}><i className="ti ti-send" /> Send</button>
      </div>
    </>
  )
}

// ── DFU Flash ─────────────────────────────────────────────────────────────────
export function Dfu() {
  const { connected, disconnect } = useDevice()
  const [client, setClient] = useState<DfuClient | null>(null)
  const [detectInfo, setDetectInfo] = useState('')
  const [fileBuf, setFileBuf] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState(0)
  const [flashing, setFlashing] = useState(false)
  const [logs, setLogs] = useState<{ msg: string; kind: DfuLogKind }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const log = (msg: string, kind: DfuLogKind = 'info') =>
    setLogs((prev) => [...prev.slice(-300), { msg, kind }])

  // Étape 1 : envoyer "sd" → la carte reboote dans le bootloader STM32.
  const enterDfu = async () => {
    if (!connected) { toast('Connectez la carte d\'abord', 'err'); return }
    log('Envoi de "sd" — la carte va redémarrer en bootloader DFU…')
    await window.ow?.odriveRebootDfu()
    try { await disconnect() } catch { /* le port disparaît de toute façon */ }
    log('Commande envoyée. Attendez ~2 s puis détectez le bootloader.', 'ok')
    toast('Reboot DFU envoyé — détectez le bootloader')
  }

  // Étape 2 : trouver le bootloader STM32 (0483:DF11) via WebUSB.
  const detect = async () => {
    if (!('usb' in navigator)) { log('WebUSB indisponible dans cet environnement.', 'err'); return }
    try {
      log('Recherche du périphérique USB 0483:DF11…')
      const c = await DfuClient.detect()
      setClient(c)
      const vid = c.device.vendorId.toString(16).padStart(4, '0')
      const pid = c.device.productId.toString(16).padStart(4, '0')
      setDetectInfo(`✓ ${c.device.productName || 'STM32 BOOTLOADER'} (VID:0x${vid} PID:0x${pid}, xfer=${c.transferSize} B)`)
      log(`Bootloader détecté (xferSize=${c.transferSize} B).`, 'ok')
    } catch (e) {
      log('Erreur détection : ' + (e as Error).message, 'err')
      log('Windows : installez le driver WinUSB sur le bootloader via Zadig (une fois).', 'err')
    }
  }

  // Étape 3 : choisir le .bin.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const buf = await f.arrayBuffer()
    setFileBuf(buf); setFileName(f.name)
    log(`Fichier sélectionné : ${f.name} (${buf.byteLength} octets)`, 'ok')
    if (buf.byteLength < 50 * 1024) log('AVERTISSEMENT : fichier < 50 KB — firmware probablement invalide.', 'err')
    if (buf.byteLength > 768 * 1024) log('AVERTISSEMENT : fichier > 768 KB — empiète sur la NVM ODrive (S10/S11).', 'err')
  }

  // Étape 4 : graver.
  const flash = async () => {
    if (!client || !fileBuf) { log('Prérequis manquants (bootloader détecté + fichier choisi).', 'err'); return }
    setFlashing(true); setProgress(0)
    try {
      await client.flash(fileBuf, log, setProgress)
      setClient(null)
      toast('Firmware flashé — EEPROM FFB préservée')
    } catch (e) {
      log('FLASH ÉCHOUÉ : ' + (e as Error).message, 'err')
      toast('Échec du flash : ' + (e as Error).message, 'err')
    } finally {
      setFlashing(false)
    }
  }

  const stepBtn = { width: '100%', marginBottom: 8 } as const

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">Flash DFU</div>
          <div className="page-head__sub">Mise à jour firmware STM32 via WebUSB (l'EEPROM FFB est préservée)</div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-flame" />Flasher depuis l'app</div>

          <button className="btn" style={stepBtn} onClick={enterDfu} disabled={!connected || flashing}>
            <i className="ti ti-refresh" /> 1. Reboot en DFU
          </button>

          <button className="btn" style={stepBtn} onClick={detect} disabled={flashing}>
            <i className="ti ti-usb" /> 2. Détecter le bootloader
          </button>
          {detectInfo && <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-2px 0 10px' }}>{detectInfo}</div>}

          <button className="btn" style={stepBtn} onClick={() => fileInputRef.current?.click()} disabled={flashing}>
            <i className="ti ti-file-upload" /> 3. Choisir le firmware (.bin)
          </button>
          <input ref={fileInputRef} type="file" accept=".bin" style={{ display: 'none' }} onChange={onFile} />
          {fileName && <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-2px 0 10px' }}>✓ {fileName}</div>}

          <button className="btn btn--primary" style={{ width: '100%' }} onClick={flash} disabled={!client || !fileBuf || flashing}>
            <i className="ti ti-flame" /> 4. Flasher le firmware
          </button>

          {(flashing || progress > 0) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.2s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{progress.toFixed(0)} %</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card__head"><i className="ti ti-terminal-2" />Premier flash (CLI)</div>
          <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, fontFamily: 'var(--mono)', fontSize: 11, color: '#86efac', marginBottom: 10 }}>
            dfu-util -d 0483:df11 -a 0 -s 0x08000000:leave -D odrive-wheel.bin
          </div>
          <div className="alert alert--warn">
            <i className="ti ti-brand-windows" />
            Windows : driver WinUSB via Zadig sur le bootloader (une seule fois)
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head"><i className="ti ti-list" />Journal</div>
        <div style={{
          background: '#080a0d', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
          padding: '10px 12px', height: 200, overflowY: 'auto', fontFamily: 'var(--mono)',
          fontSize: 12, lineHeight: 1.7,
        }}>
          {logs.length === 0 && <div style={{ color: 'var(--text-faint)' }}>En attente…</div>}
          {logs.map((l, i) => (
            <div key={i} style={{ color: l.kind === 'err' ? 'var(--red)' : l.kind === 'ok' ? '#86efac' : 'var(--text-faint)' }}>
              {l.msg}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
