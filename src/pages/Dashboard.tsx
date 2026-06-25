import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useLiveApply } from '@/hooks/useLiveApply'
import { useI18n } from '@/context/I18nContext'
import { toast } from '@/components/ui'
import { writeProp } from '@/lib/odrive'
import { applyWheelField, applyProfileSettings, captureProfileSettings } from '@/lib/ffbConfig'
import { useTorqueLimit } from '@/hooks/useTorqueLimit'
import { loadProfiles, saveProfiles, PROFILES_EVENT } from '@/lib/profiles'
import {
  loadPedals, savePedals, snapshotAxes, readAxis,
  PEDAL_KEYS, type PedalKey, type PedalsState, type AxisSample,
} from '@/lib/pedals'
import type { GameProfile } from '@/types'
import wheelImg from '@/assets/wheel.png'
import pedalImg from '@/assets/pedal.png'

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

  // Resynchro live si un autre acteur modifie les profils (menu Profils, auto-switch).
  useEffect(() => {
    const onChange = () => setProfiles(loadProfiles())
    window.addEventListener(PROFILES_EVENT, onChange)
    return () => window.removeEventListener(PROFILES_EVENT, onChange)
  }, [])

  // ── Pédales (lecture seule via Gamepad API) ──
  // Bindings mémorisés (axe ↔ pédale) + axes masqués, persistés en localStorage.
  const [ped, setPed] = useState<PedalsState>(loadPedals)
  // Valeurs live 0..100 (ou null si non lié / indisponible).
  const [pedalVals, setPedalVals] = useState<Record<PedalKey, number | null>>({ throttle: null, brake: null, clutch: null })
  // Pédale en cours de liaison (« Lier » cliqué → on attend un mouvement d'axe).
  const [binding, setBinding] = useState<PedalKey | null>(null)
  // Référence des axes au moment du clic « Lier » (détection par delta).
  const bindBaseline = useRef<AxisSample[]>([])

  const persistPed = (next: PedalsState) => { setPed(next); savePedals(next) }

  const startBind = (key: PedalKey) => {
    bindBaseline.current = snapshotAxes()
    setBinding((cur) => (cur === key ? null : key))   // re-clic = annuler
  }
  const toggleHide = (key: PedalKey) => {
    const hidden = ped.hidden.includes(key)
      ? ped.hidden.filter((k) => k !== key)
      : [...ped.hidden, key]
    persistPed({ ...ped, hidden })
  }

  // Boucle de lecture des axes + détection du binding (~60 ms).
  useEffect(() => {
    const id = setInterval(() => {
      setPedalVals({
        throttle: readAxis(ped.bindings.throttle),
        brake: readAxis(ped.bindings.brake),
        clutch: readAxis(ped.bindings.clutch),
      })
      if (binding) {
        // Cherche l'axe dont la valeur a le plus bougé depuis le clic « Lier ».
        let best: { gamepad: number; axis: number } | null = null
        let bestDelta = 0.35   // seuil pour ignorer le bruit / dérive
        for (const cur of snapshotAxes()) {
          const base = bindBaseline.current.find((b) => b.gamepad === cur.gamepad && b.axis === cur.axis)
          const delta = base ? Math.abs(cur.value - base.value) : 0
          if (delta > bestDelta) { bestDelta = delta; best = { gamepad: cur.gamepad, axis: cur.axis } }
        }
        if (best) {
          persistPed({ ...ped, bindings: { ...ped.bindings, [binding]: best } })
          toast(t('ped.bound', { name: t(`dash.${binding}`) }))
          setBinding(null)
        }
      }
    }, 60)
    return () => clearInterval(id)
  }, [ped, binding, t])

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

  // live.position vient de axis.curpos? (degrés HID) : zeroenc ET axis.invert
  // sont appliqués par le firmware (curpos suit l'invert depuis le fix MT6835).
  // Donc curpos = la position vue par le jeu → on l'utilise telle quelle, sans
  // négation, sinon le visuel tournerait à l'envers du HID (rotate positif =
  // horaire = volant à droite, cohérent avec curpos positif).
  const hidPos = live.position
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
      <div className="grid dash-grid" style={{ alignItems: 'stretch' }}>
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
                  style={{ '--fill': `${effLimitTorque > 0.5 ? ((maxTorqueVal - 0.5) / (effLimitTorque - 0.5)) * 100 : 0}%` } as CSSProperties}
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

        {/* ── Carte Pédales (lecture seule Gamepad API : lier / masquer) ── */}
        <div className="card dash-pedals-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="dash-card-title">{t('dash.pedals')}</div>

          <div className="dash-pedals">
            <div className="dash-pedals-img">
              <img src={pedalImg} alt={t('dash.pedals')} />
            </div>
            <div className="dash-pedals-axes">
              {PEDAL_KEYS.map((key) => {
                const label = t(`dash.${key}`)
                const hidden = ped.hidden.includes(key)
                const val = pedalVals[key]

                // Axe masqué : ligne compacte, barré, œil-fermé pour réafficher.
                if (hidden) {
                  return (
                    <div key={key} className="dash-pedal dash-pedal--hidden">
                      <span className="dash-pedal-label dash-pedal-label--off">{label}</span>
                      <button className="dash-pedal-eye" onClick={() => toggleHide(key)} title={t('ped.show')}>
                        <i className="ti ti-eye-off" />
                      </button>
                    </div>
                  )
                }

                return (
                  <div key={key} className="dash-pedal">
                    <div className="dash-pedal-head">
                      <span className="dash-pedal-label">{label}</span>
                      <span className="dash-pedal-val">{val == null ? t('ped.unbound') : `${val}%`}</span>
                    </div>
                    <div className="dash-pedal-row">
                      <button
                        className={`btn btn--sm dash-pedal-bind ${binding === key ? 'btn--primary' : ''}`}
                        onClick={() => startBind(key)}
                        title={t('ped.bind')}
                      >
                        {binding === key ? t('ped.binding') : t('ped.bind')}
                      </button>
                      <div className="dash-pedal-track">
                        <div className="dash-pedal-fill" style={{ width: `${val ?? 0}%` }} />
                      </div>
                      <button className="dash-pedal-eye" onClick={() => toggleHide(key)} title={t('ped.hide')}>
                        <i className="ti ti-eye" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        </div>
        </div>

        {/* ── Colonne 3 : Profils à la verticale (façon Moza Game Launcher) ── */}
        <div style={{ position: 'relative', minHeight: 0 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="card dash-prof-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="dash-card-title dash-prof-head">
            <span>{t('prof.title')}</span>
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
                title={p.name}
              >
                <div className="dash-prof-icon">
                  {p.iconImage
                    ? <img src={p.iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <i className={`ti ${p.icon}`} />}
                </div>
                {p.active && p.settings && (
                  <button
                    className="btn btn--sm btn--primary dash-prof-save"
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
    </>
  )
}
