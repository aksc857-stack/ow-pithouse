import { useState, useEffect } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useLiveApply } from '@/hooks/useLiveApply'
import { useI18n } from '@/context/I18nContext'
import { toast } from '@/components/ui'
import { writeProp } from '@/lib/odrive'
import { applyWheelField, applyProfileSettings, captureProfileSettings } from '@/lib/ffbConfig'
import { useTorqueLimit } from '@/hooks/useTorqueLimit'
import { loadProfiles, saveProfiles, PROFILES_EVENT } from '@/lib/profiles'
import type { GameProfile } from '@/types'
import wheelImg from '@/assets/wheel.png'

const ANGLE_PRESETS = [360, 540, 720, 900, 1080]

export function Dashboard() {
  const { live, wheelConfig, setWheelConfig, connected, port, pausePolling } = useDevice()
  const { t } = useI18n()
  const liveApply = useLiveApply()
  // Limite physique de couple (hook partagé) : plafond du curseur + écrêtage + tooltip.
  const { effLimitTorque, limitTooltip } = useTorqueLimit()

  // Profils enregistrés (capturés ici ou dans le menu Profils — même localStorage).
  const [profiles, setProfiles] = useState<GameProfile[]>(loadProfiles)
  const [busy, setBusy] = useState(false)
  // Modal de création (Electron ne supporte pas window.prompt) : nom seul.
  const [form, setForm] = useState<{ name: string } | null>(null)

  // Resynchro live si un autre acteur modifie les profils (menu Profils, auto-switch).
  useEffect(() => {
    const onChange = () => setProfiles(loadProfiles())
    window.addEventListener(PROFILES_EVENT, onChange)
    return () => window.removeEventListener(PROFILES_EVENT, onChange)
  }, [])

  const persist = (next: GameProfile[]) => {
    setProfiles(next)
    saveProfiles(next)
  }

  // Application d'un profil (clic sur la carte) : RAM + marque actif + persiste.
  const applyProfile = async (id: string) => {
    const p = profiles.find((x) => x.id === id)
    if (!p || !p.settings) return
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    setBusy(true)
    try {
      await applyProfileSettings(p.settings)
      setWheelConfig(p.settings.wheel)
      persist(profiles.map((x) => ({ ...x, active: x.id === p.id })))
      toast(t('dash.profile_applied', { name: p.name }))
    } catch (e) {
      toast(t('common.error_detail', { msg: String(e) }), 'err')
    } finally { setBusy(false) }
  }

  // Création : capture les réglages FFB + Filtres courants de la carte.
  const openCreate = () => {
    if (!connected) { toast(t('prof.connect_capture'), 'err'); return }
    setForm({ name: '' })
  }

  const submitCreate = async () => {
    if (!form) return
    const name = form.name.trim()
    if (!name) { toast(t('prof.name_required'), 'err'); return }
    if (!connected) { toast(t('prof.connect_capture'), 'err'); return }
    setBusy(true)
    const resume = pausePolling()
    try {
      const settings = await captureProfileSettings(wheelConfig)
      persist([...profiles, { id: Date.now().toString(), name, icon: 'ti-device-gamepad', settings }])
      toast(t('prof.created', { name }))
      setForm(null)
    } catch (e) {
      toast(t('prof.err_capture', { msg: String(e) }), 'err')
    } finally { resume(); setBusy(false) }
  }

  // Met à jour le profil actif avec les réglages courants (capture carte + wheelConfig).
  const updateActive = async (id: string) => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    setBusy(true)
    const resume = pausePolling()
    try {
      const settings = await captureProfileSettings(wheelConfig)
      persist(profiles.map((p) => (p.id === id ? { ...p, settings } : p)))
      toast(t('prof.updated'))
    } catch (e) {
      toast(t('common.error_detail', { msg: String(e) }), 'err')
    } finally { resume(); setBusy(false) }
  }

  const summary = (p: GameProfile) =>
    p.settings
      ? t('prof.summary', { torque: p.settings.wheel.maxTorque, range: p.settings.wheel.range, fxRatio: p.settings.wheel.fxRatio })
      : t('prof.summary_none')

  const angle = wheelConfig.range
  // Curseur angle : état UI immédiat + écriture live debouncée.
  const setAngle = (v: number) => {
    setWheelConfig({ ...wheelConfig, range: v })
    if (connected) liveApply('range', () => applyWheelField('range', v))
  }

  // Curseur Couple max : appliqué en direct sur axis.maxtorque (maxTorque).
  const setMaxTorque = (v: number) => {
    setWheelConfig({ ...wheelConfig, maxTorque: v })
    if (connected) liveApply('maxTorque', () => applyWheelField('maxTorque', v))
  }

  // live.position vient de axis.curpos? (degrés HID) : zeroenc et axis.invert
  // sont déjà appliqués par le firmware. Signe inversé car la convention curpos
  // est opposée à la rotation CSS (positif = horaire).
  const hidPos = -live.position
  const halfRange = angle / 2
  const clamped = Math.max(-halfRange, Math.min(halfRange, hidPos))
  const posPct = 50 + (clamped / angle) * 100   // 0..100 across the bar

  const maxTorqueVal = wheelConfig.maxTorque

  const center = async () => {
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    await window.ow.query('axis.zeroenc!')   // remet à zéro la position HID (et donc le visuel)
    toast(t('dash.centered'))
  }

  const toggleInvert = async () => {
    const next = !wheelConfig.invert
    setWheelConfig({ ...wheelConfig, invert: next })
    if (connected) {
      await writeProp('axis.invert', next ? 1 : 0, 'offb')
      toast(next ? t('dash.axis_inverted') : t('dash.axis_normal'))
    }
  }

  const toggleFfbInvert = async () => {
    const next = !wheelConfig.ffbInvert
    setWheelConfig({ ...wheelConfig, ffbInvert: next })
    if (connected) {
      await writeProp('axis.ffbinvert', next ? 1 : 0, 'offb')
      toast(next ? t('dash.ffb_inverted') : t('dash.ffb_normal'))
    }
  }

  return (
    <>
      <div className="grid grid--2" style={{ alignItems: 'stretch' }}>
        {/* ── Left card: the wheel ── */}
        <div className="card dash-wheel-card">
          <div className="dash-card-title">{connected ? t('dash.wheel_name') : t('dash.no_wheel')}</div>

          <div className="dash-angle">{hidPos.toFixed(0)}°</div>

          <div className="dash-posbar">
            <div className="dash-posbar__track">
              <div className="dash-posbar__center" />
              <div className="dash-posbar__marker" style={{ left: `${posPct}%` }} />
            </div>
          </div>

          <div className="dash-wheel-img">
            <img
              src={wheelImg}
              alt="Volant"
              style={{ transform: `rotate(${clamped}deg)` }}
            />
          </div>

          <div className="dash-angle-section">
            <div className="dash-angle-head">
              <span>{t('dash.max_angle')}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className={`btn btn--sm ${wheelConfig.invert ? 'btn--primary' : ''}`}
                  onClick={toggleInvert}
                >
                  <i className="ti ti-arrows-left-right" /> {t('dash.invert_axis')}
                </button>
                <button
                  className={`btn btn--sm ${wheelConfig.ffbInvert ? 'btn--primary' : ''}`}
                  onClick={toggleFfbInvert}
                >
                  <i className="ti ti-refresh-dot" /> {t('dash.invert_ffb')}
                </button>
                <button className="btn btn--sm" onClick={center}>{t('dash.center')}</button>
              </div>
            </div>
            <div className="dash-slider-row">
              <span className="dash-slider-min">90</span>
              <input
                type="range" min={90} max={2700} step={10} value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value))}
              />
              <span className="dash-slider-max">2700</span>
              <div className="dash-angle-val">{angle}</div>
            </div>
            <div className="dash-presets">
              {ANGLE_PRESETS.map((p) => (
                <button
                  key={p}
                  className={`dash-preset ${angle === p ? 'active' : ''}`}
                  onClick={() => setAngle(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column : base + profils empilés ──
            Le conteneur relatif ne contribue pas à la hauteur de la ligne (calque
            absolu) → c'est le volant qui fixe la hauteur, et la liste scrolle dedans. */}
        <div style={{ position: 'relative', minHeight: 0 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card">
          <div className="dash-card-title">{t('dash.base_name')}</div>

          <div className="dash-base">
            <div className="dash-base-img">
              <i className="ti ti-engine" />
            </div>
            <div className="dash-base-controls">
              <div className="dash-control-label">
                {t('ffb.max_torque')}
                <i className="ti ti-help-circle" title={limitTooltip} style={{ marginLeft: 6, color: 'var(--text-faint)', cursor: 'help' }} />
              </div>
              <div className="dash-control-row">
                <input
                  type="range" min={0.5} max={effLimitTorque} step={0.1} value={maxTorqueVal}
                  onChange={(e) => setMaxTorque(parseFloat(e.target.value))}
                />
                <span className="dash-control-val">{maxTorqueVal.toFixed(1)} Nm</span>
              </div>
            </div>
          </div>

          <div className="dash-device-id">
            {t('dash.device_id')}: {connected ? `ODW-${port?.replace(/\D/g, '') || '000'}-XDRIVE-MINI` : '—'}
          </div>
        </div>

        {/* ── Carte Profils (liste applicable + création) ── */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="dash-card-title dash-prof-head">
            <span>{t('prof.title')}</span>
            <button className="btn btn--sm btn--primary" onClick={openCreate} disabled={!connected || busy}>
              <i className="ti ti-plus" /> {t('prof.create')}
            </button>
          </div>

          <div className="dash-prof-list">
            {profiles.length === 0 && (
              <div className="dash-prof-empty">{t('dash.prof_empty')}</div>
            )}
            {profiles.map((p) => (
              <div
                key={p.id}
                className={`dash-prof-row ${p.active ? 'active' : ''}`}
                onClick={() => !busy && applyProfile(p.id)}
                role="button"
                title={t('prof.load')}
              >
                <div className="dash-prof-icon">
                  {p.iconImage
                    ? <img src={p.iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <i className={`ti ${p.icon}`} />}
                </div>
                <div className="dash-prof-info">
                  <div className="dash-prof-name">
                    {p.name}{p.active && <span className="dash-prof-badge">● {t('prof.active')}</span>}
                  </div>
                  <div className="dash-prof-sum">{summary(p)}</div>
                </div>
                {p.active && p.settings && (
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={(e) => { e.stopPropagation(); updateActive(p.id) }}
                    disabled={busy}
                    title={t('prof.recapture')}
                  >
                    <i className="ti ti-device-floppy" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>
        </div>
      </div>

      {/* Modal création (capture des réglages courants) */}
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
              <i className="ti ti-plus" />{t('prof.new')}
            </div>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>{t('prof.name_label')}</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
                placeholder={t('prof.name_ph')}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-sunken)', color: 'var(--text)', border: '1px solid var(--border-soft)', borderRadius: 'var(--r-sm)', fontSize: 13, outline: 'none' }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 16, lineHeight: 1.6 }}>
              {t('prof.capture_note')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setForm(null)} disabled={busy}>{t('common.cancel')}</button>
              <button className="btn btn--primary" onClick={submitCreate} disabled={busy}>
                <i className="ti ti-device-floppy" /> {t('prof.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
