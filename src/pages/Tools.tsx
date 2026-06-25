import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useI18n } from '@/context/I18nContext'
import { usePersistentTab } from '@/hooks/usePersistentTab'
import { toast } from '@/components/ui'
import { readProp } from '@/lib/odrive'
import { ERROR_DEFS, decodeError, toHex } from '@/lib/odriveErrors'
import { applyProfileSettings, captureProfileSettings } from '@/lib/ffbConfig'
import { loadProfiles, saveProfiles, PROFILES_EVENT } from '@/lib/profiles'
import { buildCommandList, GROUP_LABELS, type CmdItem } from '@/lib/commandList'
import { DfuClient, type DfuLogKind } from '@/lib/dfu'
import type { GameProfile, ProfileSettings } from '@/types'

// ── Profiles ──────────────────────────────────────────────────────────────────
// Un profil capture les réglages du menu FFB + du menu Filtres, et peut les
// réappliquer sur la carte (en RAM, comme les sliders).
export function Profiles() {
  const { connected, wheelConfig, setWheelConfig, pausePolling } = useDevice()
  const { t } = useI18n()
  const [profiles, setProfiles] = useState<GameProfile[]>(loadProfiles)
  const [busy, setBusy] = useState(false)
  // Modal création/édition (Electron ne supporte pas window.prompt).
  // id null = création (capture les réglages) ; id défini = renommage.
  const [form, setForm] = useState<{ id: string | null; name: string; exe: string; iconImage?: string } | null>(null)

  // Resynchro live si un autre acteur modifie les profils (carte Dashboard, auto-switch).
  useEffect(() => {
    const onChange = () => setProfiles(loadProfiles())
    window.addEventListener(PROFILES_EVENT, onChange)
    return () => window.removeEventListener(PROFILES_EVENT, onChange)
  }, [])

  const persist = (next: GameProfile[]) => {
    setProfiles(next)
    saveProfiles(next)
  }

  // B — Capture : lit l'état FFB + filtres courant de la carte.
  const captureSettings = async (): Promise<ProfileSettings> => {
    const resume = pausePolling()
    try {
      return await captureProfileSettings(wheelConfig)
    } finally {
      resume()
    }
  }

  const openNew = () => {
    if (!connected) { toast(t('prof.connect_capture'), 'err'); return }
    setForm({ id: null, name: '', exe: '' })
  }

  const openEdit = (p: GameProfile) => setForm({ id: p.id, name: p.name, exe: p.exe || '', iconImage: p.iconImage })

  // Importer l'exe d'un jeu : remplit le nom du process + l'icône (et le nom si vide).
  const pickExe = async () => {
    if (!form) return
    const res = await window.ow?.pickGameExe()
    if (!res) return
    setForm({
      ...form,
      exe: res.name,
      iconImage: res.icon || form.iconImage,
      name: form.name.trim() || res.name.replace(/\.exe$/i, ''),
    })
  }

  // Choisir une icône depuis un fichier (.ico/png/jpg) — jeux sans icône dans l'exe.
  const pickIcon = async () => {
    if (!form) return
    const res = await window.ow?.pickIconFile()
    if (!res) return
    setForm({ ...form, iconImage: res.icon })
  }

  const submit = async () => {
    if (!form) return
    const name = form.name.trim()
    if (!name) { toast(t('prof.name_required'), 'err'); return }
    const exe = form.exe.trim()

    // Édition : renomme + exe/icône sans recapturer les réglages.
    if (form.id !== null) {
      persist(profiles.map((p) => (p.id === form.id ? { ...p, name, exe, iconImage: form.iconImage ?? p.iconImage } : p)))
      toast(t('prof.renamed'))
      setForm(null)
      return
    }

    // Création : capture les réglages actuels.
    if (!connected) { toast(t('prof.connect_capture'), 'err'); return }
    setBusy(true)
    try {
      const settings = await captureSettings()
      persist([...profiles, { id: Date.now().toString(), name, exe, icon: 'ti-device-gamepad', iconImage: form.iconImage, settings }])
      toast(t('prof.created', { name }))
      setForm(null)
    } catch (e) {
      toast(t('prof.err_capture', { msg: String(e) }), 'err')
    } finally { setBusy(false) }
  }

  // B — Met à jour un profil avec les réglages courants.
  const recapture = async (id: string) => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    setBusy(true)
    try {
      const settings = await captureSettings()
      persist(profiles.map((p) => (p.id === id ? { ...p, settings } : p)))
      toast(t('prof.updated'))
    } catch (e) {
      toast(t('common.error_detail', { msg: String(e) }), 'err')
    } finally { setBusy(false) }
  }

  // A — Applique les réglages d'un profil sur la carte (RAM).
  const load = async (p: GameProfile) => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    if (!p.settings) { toast(t('prof.no_settings'), 'err'); return }
    setBusy(true)
    try {
      await applyProfileSettings(p.settings)
      setWheelConfig(p.settings.wheel)
      persist(profiles.map((x) => ({ ...x, active: x.id === p.id })))
      toast(t('prof.applied', { name: p.name }))
    } catch (e) {
      toast(t('common.error_detail', { msg: String(e) }), 'err')
    } finally { setBusy(false) }
  }

  const remove = (id: string) => persist(profiles.filter((p) => p.id !== id))

  const summary = (p: GameProfile) =>
    p.settings
      ? t('prof.summary', { torque: p.settings.wheel.maxTorque, range: p.settings.wheel.range, fxRatio: p.settings.wheel.fxRatio })
      : t('prof.summary_none')

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('prof.title')}</div>
          <div className="page-head__sub">{t('prof.sub')}</div>
        </div>
        <button className="btn btn--primary" onClick={openNew} disabled={!connected || busy}>
          <i className="ti ti-plus" /> {t('prof.new')}
        </button>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-bookmarks" />{t('prof.title')}</div>

        {profiles.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '8px 0' }}>
            {t('prof.empty')}
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
            <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
              {p.iconImage
                ? <img src={p.iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <i className={`ti ${p.icon}`} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}{p.active && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 8 }}>● {t('prof.active')}</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {p.exe ? p.exe + ' · ' : ''}{summary(p)}
              </div>
            </div>
            <button className="btn btn--sm btn--primary" onClick={() => load(p)} disabled={!connected || busy || !p.settings}>{t('prof.load')}</button>
            <button className="btn btn--sm" onClick={() => openEdit(p)} disabled={busy} title={t('prof.rename')}>
              <i className="ti ti-pencil" />
            </button>
            <button className="btn btn--sm" onClick={() => recapture(p.id)} disabled={!connected || busy} title={t('prof.recapture')}>
              <i className="ti ti-device-floppy" />
            </button>
            <button className="btn btn--sm btn--danger" onClick={() => remove(p.id)} title={t('common.delete')}>
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
              <i className={`ti ${form.id ? 'ti-pencil' : 'ti-plus'}`} />{form.id ? t('prof.rename_title') : t('prof.new')}
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t('prof.name_label')}</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={t('prof.name_ph')}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>{t('prof.exe_label')}</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {form.iconImage && (
                  <img src={form.iconImage} alt="" style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', objectFit: 'contain', flexShrink: 0 }} />
                )}
                <input
                  value={form.exe}
                  onChange={(e) => setForm({ ...form, exe: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder={t('prof.exe_ph')}
                  style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
                />
                <button className="btn btn--sm" onClick={pickExe} disabled={busy} title={t('prof.pick_exe')}>
                  <i className="ti ti-folder-search" /> {t('prof.pick_exe')}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <button className="btn btn--sm" onClick={pickIcon} disabled={busy} title={t('prof.pick_icon')}>
                  <i className="ti ti-photo" /> {t('prof.pick_icon')}
                </button>
                {form.iconImage && (
                  <button className="btn btn--sm" onClick={() => setForm({ ...form, iconImage: undefined })} disabled={busy} title={t('prof.icon_reset')}>
                    <i className="ti ti-x" /> {t('prof.icon_reset')}
                  </button>
                )}
              </div>
            </div>
            {!form.id && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>
                {t('prof.capture_note')}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setForm(null)} disabled={busy}>{t('common.cancel')}</button>
              <button className="btn btn--primary" onClick={submit} disabled={busy}>
                <i className="ti ti-device-floppy" /> {form.id ? t('prof.save') : t('prof.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Status (Errors décodées + Actions state machine / NVM) ────────────────────
// Menu Status à onglets : Status (erreurs + actions) + Console.
export function Status() {
  const { t } = useI18n()
  const [tab, setTab] = usePersistentTab('status', ['status', 'console'] as const, 'status')
  return (
    <>
      <div className="odrive-tabs">
        <button className={`odrive-tab ${tab === 'status' ? 'active' : ''}`} onClick={() => setTab('status')}>
          {t('status.title')}
        </button>
        <button className={`odrive-tab ${tab === 'console' ? 'active' : ''}`} onClick={() => setTab('console')}>
          {t('nav.console')}
        </button>
      </div>
      {tab === 'status' ? <StatusPanel /> : <Console />}
    </>
  )
}

function StatusPanel() {
  const { connected, appendLog, pausePolling } = useDevice()
  const { t } = useI18n()
  const [errs, setErrs] = useState<Record<string, number | null>>({})
  const [busy, setBusy] = useState(false)

  // Sous-libellés traduits (la partie « state N » reste technique).
  const STATE_ACTIONS = [
    { label: 'IDLE',                       val: 1,  sub: t('status.st_idle'), cls: 'btn--primary' },
    { label: 'MOTOR_CALIBRATION',          val: 4,  sub: t('status.st_motor_cal') },
    { label: 'ENCODER_INDEX_SEARCH',       val: 6,  sub: t('status.st_enc_index') },
    { label: 'ENCODER_OFFSET_CALIBRATION', val: 7,  sub: t('status.st_enc_offset') },
    { label: 'ENCODER_DIR_FIND',           val: 10, sub: t('status.st_enc_dir') },
    { label: 'FULL_CALIBRATION',           val: 3,  sub: t('status.st_full_cal') },
    { label: 'CLOSED_LOOP_CONTROL',        val: 8,  sub: t('status.st_closed_loop') },
    { label: 'LOCKIN_SPIN',                val: 9,  sub: t('status.st_lockin') },
    { label: 'HOMING',                     val: 11, sub: t('status.st_homing') },
  ]
  const RAW_ACTIONS: { label: string; cmd: string; sub: string; cls?: string; confirm?: string }[] = [
    { label: 'Save NVM',       cmd: 'ss', sub: t('status.act_save'), cls: 'btn--primary' },
    { label: 'Erase + Reboot', cmd: 'se', sub: 'se', cls: 'btn--danger', confirm: t('status.confirm_erase') },
    { label: 'Reboot',         cmd: 'sr', sub: 'sr' },
    { label: 'Clear Errors',   cmd: 'sc', sub: 'sc' },
  ]

  const readErrors = async () => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    setBusy(true)
    const resume = pausePolling()
    try {
      const next: Record<string, number | null> = {}
      for (const d of ERROR_DEFS) {
        const raw = await readProp(d.path, 'odrv')
        next[d.path] = raw == null ? null : (parseInt(raw, 10) || 0)
      }
      setErrs(next)
    } finally {
      resume()
      setBusy(false)
    }
  }

  useEffect(() => { if (connected) readErrors() }, [connected])

  // Action : envoi direct (fire-and-forget) + écho dans la Console.
  const runAction = async (cmd: string, confirmMsg?: string) => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    if (confirmMsg && !window.confirm(confirmMsg)) return
    appendLog('tx', cmd)
    await window.ow?.send(cmd)
    toast(t('status.cmd_sent', { cmd }))
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('status.title')}</div>
          <div className="page-head__sub">{t('status.sub')}</div>
        </div>
        <div className="page-head__actions">
          <button className="btn" onClick={readErrors} disabled={!connected || busy}>
            <i className="ti ti-refresh" /> {t('status.reload_errors')}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><i className="ti ti-alert-triangle" />{t('status.errors')} <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{t('status.decoded')}</span></div>
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
                {!known ? '' : ok ? 'OK' : decodeError(v, d.bits, { extra: (hex) => t('status.err_extra', { hex }), unknown: t('status.err_unknown') })}
              </span>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head"><i className="ti ti-settings-bolt" />{t('status.actions')} <span style={{ color: 'var(--text-faint)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>(state machine / NVM)</span></div>
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

// ── Diagnostic encodeur (MT6835 / AS5047) ──────────────────────────────────────
// `sys.encraw!` → compteurs SPI ABS (ok/pty/xfr/last) ; `sys.magnet!` → AGC +
// flags de centrage de l'aimant. Commandes OpenFFBoard exec ('!'), lues en
// séquence (transport single-flight → pas de collision). Firmware sans support →
// réponses vides → bandeau « pas de réponse ».
const parseKV = (s: string | null): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!s) return out
  s.trim().split(/\s+/).forEach((p) => {
    const eq = p.indexOf('=')
    if (eq > 0) out[p.slice(0, eq)] = p.slice(eq + 1)
  })
  return out
}

function DiagRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function EncoderDiag() {
  const { connected } = useDevice()
  const { t } = useI18n()
  const [er, setEr] = useState<Record<string, string> | null>(null)
  const [mg, setMg] = useState<Record<string, string> | null>(null)
  const [rate, setRate] = useState('')
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noResp, setNoResp] = useState(false)
  const lastOk = useRef<{ n: number; t: number } | null>(null)

  const read = useCallback(async () => {
    if (!connected || !window.ow) return
    setBusy(true)
    try {
      const erKV = parseKV(await window.ow.query('sys.encraw!'))
      const mgKV = parseKV(await window.ow.query('sys.magnet!'))
      const hasEr = erKV.ok !== undefined
      const hasMg = mgKV.agc !== undefined
      setNoResp(!hasEr && !hasMg)
      if (hasEr) {
        const okN = parseInt(erKV.ok, 10)
        const now = performance.now()
        if (lastOk.current) {
          const dt = (now - lastOk.current.t) / 1000
          if (dt > 0.1) {
            const r = (okN - lastOk.current.n) / dt
            setRate(r >= 1000 ? (r / 1000).toFixed(1) + ' k/s' : Math.round(r) + '/s')
          }
        }
        lastOk.current = { n: okN, t: now }
        setEr(erKV)
      }
      if (hasMg) setMg(mgKV)
    } finally { setBusy(false) }
  }, [connected])

  // Polling live 1 Hz (comme la référence, pour ménager le canal série).
  useEffect(() => {
    if (!live || !connected) return
    read()
    const id = setInterval(read, 1000)
    return () => clearInterval(id)
  }, [live, connected, read])

  // Stoppe le live à la déconnexion.
  useEffect(() => { if (!connected) setLive(false) }, [connected])

  const ptyN = parseInt(er?.pty || '0', 10)
  const xfrN = parseInt(er?.xfr || '0', 10)
  const agcN = parseInt(mg?.agc || '0', 10)
  const agcPct = Math.min(100, Math.max(0, (agcN / 255) * 100))
  const agcColor = (agcN < 30 || agcN > 220) ? 'var(--red)' : (agcN < 60 || agcN > 192) ? '#ffca28' : '#66bb6a'
  const statusColor: Record<string, string> = {
    OK: '#66bb6a', MARGINAL: '#ffca28', MAGNET_TOO_FAR: 'var(--red)', MAGNET_TOO_CLOSE: 'var(--red)',
    CORDIC_OVERFLOW: 'var(--red)', WAITING_COMPENSATION: '#ffca28', NOT_READY: 'var(--muted)',
  }
  const magLbl = (v?: string) => v === '1' ? t('console.diag_warn_lbl') : t('console.diag_ok_lbl')
  const magCol = (v?: string) => v === '1' ? 'var(--red)' : '#66bb6a'

  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-sunken)', padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}><i className="ti ti-rotate-360" style={{ marginRight: 6 }} />{t('console.diag')}</span>
        <button className="btn btn--sm" onClick={read} disabled={!connected || busy}>
          <i className="ti ti-refresh" /> {t('console.diag_read')}
        </button>
        <button className={`btn btn--sm ${live ? 'btn--primary' : ''}`} onClick={() => setLive((v) => !v)} disabled={!connected}>
          <i className={live ? 'ti ti-player-pause' : 'ti ti-player-play'} /> {t('console.diag_live')}
        </button>
      </div>

      {noResp && (
        <div style={{ color: 'var(--text-faint)', fontSize: 12, padding: '4px 0' }}>{t('console.diag_none')}</div>
      )}

      {!noResp && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', marginBottom: 4 }}>{t('console.diag_spi')}</div>
            <DiagRow label={t('console.diag_ok')} value={er?.ok ?? '—'} />
            <DiagRow label={t('console.diag_rate')} value={rate || '—'} />
            <DiagRow label={t('console.diag_pty')} value={er?.pty ?? '—'} color={ptyN > 0 ? 'var(--red)' : undefined} />
            <DiagRow label={t('console.diag_xfr')} value={er?.xfr ?? '—'} color={xfrN > 0 ? 'var(--red)' : undefined} />
            <DiagRow label={t('console.diag_last')} value={er?.last ?? '—'} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-faint)', marginBottom: 4 }}>{t('console.diag_magnet')}</div>
            <DiagRow label={t('console.diag_agc')} value={mg ? `${agcN} / 255` : '—'} />
            <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-panel)', overflow: 'hidden', margin: '2px 0 6px' }}>
              <div style={{ height: '100%', width: `${agcPct}%`, background: agcColor, transition: 'width .2s' }} />
            </div>
            <DiagRow label={t('console.diag_status')} value={mg?.status ?? '—'} color={statusColor[mg?.status ?? ''] ?? 'var(--text)'} />
            <DiagRow label={t('console.diag_far')} value={mg ? magLbl(mg.magl) : '—'} color={mg ? magCol(mg.magl) : undefined} />
            <DiagRow label={t('console.diag_close')} value={mg ? magLbl(mg.magh) : '—'} color={mg ? magCol(mg.magh) : undefined} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Console ───────────────────────────────────────────────────────────────────
export function Console() {
  const { log, sendCommand, clearLog } = useDevice()
  const { t } = useI18n()
  const [cmd, setCmd] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [diagOpen, setDiagOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allCmds = useMemo(() => buildCommandList(t), [t])
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
          {t(GROUP_LABELS[it.grp])}
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
          <div className="page-head__title">{t('nav.console')}</div>
          <div className="page-head__sub">{t('console.sub')}</div>
        </div>
        <div className="page-head__actions">
          <button className={`btn ${diagOpen ? 'btn--primary' : ''}`} onClick={() => setDiagOpen((o) => !o)}>
            <i className="ti ti-rotate-360" /> {t('console.diag')}
          </button>
          <button className={`btn ${pickerOpen ? 'btn--primary' : ''}`} onClick={() => setPickerOpen((o) => !o)}>
            <i className="ti ti-list-search" /> {t('console.available')}
          </button>
          <button className="btn" onClick={clearLog} disabled={log.length === 0}>
            <i className="ti ti-trash" /> {t('console.clear')}
          </button>
        </div>
      </div>

      {diagOpen && <EncoderDiag />}

      <div style={{
        background: '#080a0d', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        padding: '12px 14px', height: 320, overflowY: 'auto', fontFamily: 'var(--mono)',
        fontSize: 12, lineHeight: 1.8, marginTop: 10,
      }}>
        {log.length === 0 && <div style={{ color: 'var(--text-faint)' }}>{t('console.waiting')}</div>}
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
              placeholder={t('console.filter_ph')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setPickerOpen(false); inputRef.current?.focus() } }}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-panel)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
            />
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
            {rows.length ? rows : <div style={{ padding: 12, color: 'var(--text-faint)', fontSize: 12 }}>{t('console.none')}</div>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          ref={inputRef}
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--mono)', fontSize: 13, outline: 'none' }}
          placeholder={t('console.input_ph')}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && exec()}
        />
        <button className="btn btn--primary" onClick={exec}><i className="ti ti-send" /> {t('console.send')}</button>
      </div>
    </>
  )
}

// ── DFU Flash ─────────────────────────────────────────────────────────────────
export function Dfu() {
  const { connected, disconnect } = useDevice()
  const { t } = useI18n()
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
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    log(t('dfu.log_send_sd'))
    await window.ow?.odriveRebootDfu()
    try { await disconnect(false) } catch { /* le port disparaît de toute façon */ }
    log(t('dfu.log_sent'), 'ok')
    toast(t('dfu.toast_reboot'))
  }

  // Étape 2 : trouver le bootloader STM32 (0483:DF11) via WebUSB.
  const detect = async () => {
    if (!('usb' in navigator)) { log(t('dfu.log_no_webusb'), 'err'); return }
    try {
      log(t('dfu.log_searching'))
      const c = await DfuClient.detect()
      setClient(c)
      const vid = c.device.vendorId.toString(16).padStart(4, '0')
      const pid = c.device.productId.toString(16).padStart(4, '0')
      setDetectInfo(`✓ ${c.device.productName || 'STM32 BOOTLOADER'} (VID:0x${vid} PID:0x${pid}, xfer=${c.transferSize} B)`)
      log(t('dfu.log_detected', { size: c.transferSize }), 'ok')
    } catch (e) {
      log(t('dfu.log_err_detect', { msg: (e as Error).message }), 'err')
      log(t('dfu.log_winusb'), 'err')
    }
  }

  // Étape 3 : choisir le .bin.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const buf = await f.arrayBuffer()
    setFileBuf(buf); setFileName(f.name)
    log(t('dfu.log_file', { name: f.name, bytes: buf.byteLength }), 'ok')
    if (buf.byteLength < 50 * 1024) log(t('dfu.warn_small'), 'err')
    if (buf.byteLength > 768 * 1024) log(t('dfu.warn_large'), 'err')
  }

  // Étape 4 : graver.
  const flash = async () => {
    if (!client || !fileBuf) { log(t('dfu.log_prereq'), 'err'); return }
    setFlashing(true); setProgress(0)
    try {
      await client.flash(fileBuf, log, setProgress)
      setClient(null)
      toast(t('dfu.toast_flashed'))
    } catch (e) {
      log(t('dfu.log_flash_fail', { msg: (e as Error).message }), 'err')
      toast(t('dfu.toast_flash_fail', { msg: (e as Error).message }), 'err')
    } finally {
      setFlashing(false)
    }
  }

  const stepBtn = { width: '100%', marginBottom: 8 } as const

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-head__title">{t('dfu.title')}</div>
          <div className="page-head__sub">{t('dfu.sub')}</div>
        </div>
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__head"><i className="ti ti-flame" />{t('dfu.from_app')}</div>

          <button className="btn" style={stepBtn} onClick={enterDfu} disabled={!connected || flashing}>
            <i className="ti ti-refresh" /> {t('dfu.step1')}
          </button>

          <button className="btn" style={stepBtn} onClick={detect} disabled={flashing}>
            <i className="ti ti-usb" /> {t('dfu.step2')}
          </button>
          {detectInfo && <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-2px 0 10px' }}>{detectInfo}</div>}

          <button className="btn" style={stepBtn} onClick={() => fileInputRef.current?.click()} disabled={flashing}>
            <i className="ti ti-file-upload" /> {t('dfu.step3')}
          </button>
          <input ref={fileInputRef} type="file" accept=".bin" style={{ display: 'none' }} onChange={onFile} />
          {fileName && <div style={{ fontSize: 11, color: 'var(--text-faint)', margin: '-2px 0 10px' }}>✓ {fileName}</div>}

          <button className="btn btn--primary" style={{ width: '100%' }} onClick={flash} disabled={!client || !fileBuf || flashing}>
            <i className="ti ti-flame" /> {t('dfu.step4')}
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
          <div className="card__head"><i className="ti ti-terminal-2" />{t('dfu.first_flash')}</div>
          <div style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, fontFamily: 'var(--mono)', fontSize: 11, color: '#86efac', marginBottom: 10 }}>
            dfu-util -d 0483:df11 -a 0 -s 0x08000000:leave -D odrive-wheel.bin
          </div>
          <div className="alert alert--warn">
            <i className="ti ti-brand-windows" />
            {t('dfu.zadig')}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__head"><i className="ti ti-list" />{t('dfu.journal')}</div>
        <div style={{
          background: '#080a0d', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
          padding: '10px 12px', height: 200, overflowY: 'auto', fontFamily: 'var(--mono)',
          fontSize: 12, lineHeight: 1.7,
        }}>
          {logs.length === 0 && <div style={{ color: 'var(--text-faint)' }}>{t('dfu.waiting')}</div>}
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
