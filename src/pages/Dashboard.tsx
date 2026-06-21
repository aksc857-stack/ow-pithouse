import { useState } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useLiveApply } from '@/hooks/useLiveApply'
import { useI18n } from '@/context/I18nContext'
import { Toggle, toast } from '@/components/ui'
import { writeProp } from '@/lib/odrive'
import { applyWheelField, applyProfileSettings } from '@/lib/ffbConfig'
import type { GameProfile } from '@/types'
import wheelImg from '@/assets/wheel.png'

const ANGLE_PRESETS = [360, 540, 720, 900, 1080]

export function Dashboard() {
  const { live, wheelConfig, setWheelConfig, connected, port } = useDevice()
  const { t } = useI18n()
  const [workMode, setWorkMode] = useState(true)
  const liveApply = useLiveApply()

  // Profils enregistrés (capturés dans le menu Profils).
  const [profiles] = useState<GameProfile[]>(() => {
    try { return JSON.parse(localStorage.getItem('ow_profiles') || '[]') } catch { return [] }
  })
  const [profileId, setProfileId] = useState(() => profiles.find((p) => p.active)?.id || '')

  const applyProfile = async (id: string) => {
    setProfileId(id)
    const p = profiles.find((x) => x.id === id)
    if (!p || !p.settings) return
    if (!connected) { toast(t('common.connect_first'), 'err'); return }
    try {
      await applyProfileSettings(p.settings)
      setWheelConfig(p.settings.wheel)
      toast(t('dash.profile_applied', { name: p.name }))
    } catch (e) {
      toast(t('common.error') + ' : ' + e, 'err')
    }
  }

  const angle = wheelConfig.range
  // Curseur angle : état UI immédiat + écriture live debouncée.
  const setAngle = (v: number) => {
    setWheelConfig({ ...wheelConfig, range: v })
    if (connected) liveApply('range', () => applyWheelField('range', v))
  }

  // Curseur intensité FFB (masterGain) : appliqué en direct sur fx.master.
  const setMasterGain = (v: number) => {
    setWheelConfig({ ...wheelConfig, masterGain: v })
    if (connected) liveApply('masterGain', () => applyWheelField('masterGain', v))
  }

  // live.position vient de axis.curpos? (degrés HID) : zeroenc et axis.invert
  // sont déjà appliqués par le firmware. Signe inversé car la convention curpos
  // est opposée à la rotation CSS (positif = horaire).
  const hidPos = -live.position
  const halfRange = angle / 2
  const clamped = Math.max(-halfRange, Math.min(halfRange, hidPos))
  const posPct = 50 + (clamped / angle) * 100   // 0..100 across the bar

  const ffbIntensity = wheelConfig.masterGain
  const torqueNm = Math.abs(live.torque)
  const torquePct = Math.min(100, (torqueNm / wheelConfig.maxTorque) * 100)

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
      {/* Sélecteur de profil */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <select className="dash-profile-select" value={profileId} onChange={(e) => applyProfile(e.target.value)} disabled={!connected || profiles.length === 0}>
          <option value="">{profiles.length ? t('dash.pick_profile') : t('dash.no_profile')}</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid--2" style={{ alignItems: 'start' }}>
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

        {/* ── Right card: the base ── */}
        <div className="card">
          <div className="dash-card-title">{t('dash.base_name')}</div>

          <div className="dash-base">
            <div className="dash-base-img">
              <i className="ti ti-engine" />
            </div>
            <div className="dash-base-controls">
              <div className="dash-control-label">{t('dash.ffb_intensity')}</div>
              <div className="dash-control-row">
                <input
                  type="range" min={0} max={100} value={ffbIntensity}
                  onChange={(e) => setMasterGain(parseInt(e.target.value))}
                />
                <span className="dash-control-val">{ffbIntensity} %</span>
              </div>

              <div className="dash-control-label" style={{ marginTop: 16 }}>{t('dash.output_torque')}</div>
              <div className="dash-control-row">
                <div className="dash-torque-track">
                  <div className="dash-torque-fill" style={{ width: `${torquePct}%` }} />
                </div>
                <span className="dash-control-val">{torquePct.toFixed(0)} %</span>
              </div>
              <div className="dash-torque-nm">{torqueNm.toFixed(2)} Nm</div>

              <div className="dash-workmode">
                <Toggle on={workMode} onToggle={() => setWorkMode(!workMode)} />
                <span>{t('dash.work_mode')}</span>
              </div>
            </div>
          </div>

          <div className="dash-device-id">
            {t('dash.device_id')}: {connected ? `ODW-${port?.replace(/\D/g, '') || '000'}-XDRIVE-MINI` : '—'}
          </div>
        </div>
      </div>
    </>
  )
}
