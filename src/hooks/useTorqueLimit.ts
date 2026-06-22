import { useState, useEffect } from 'react'
import { useDevice } from '@/context/DeviceContext'
import { useI18n } from '@/context/I18nContext'
import { readProp, toNum } from '@/lib/odrive'
import { applyWheelField } from '@/lib/ffbConfig'
import { toast } from '@/components/ui'

// Plafond absolu de l'UI (au-delà : non pertinent pour ces volants).
export const HARD_MAX_TORQUE = 12

/** Limite physique de couple lue sur la carte + écrêtage de sécurité.
 *
 *  Limite physique = current_lim × torque_constant, plafonnée par torque_lim
 *  (cap du controller) s'il est actif. Le couple max (axis.maxtorque) ne doit
 *  JAMAIS dépasser cette limite : s'il la dépasse (limite abaissée, profil/import
 *  trop haut…), on l'écrête immédiatement en RAM + toast.
 *
 *  Mutualisé entre l'onglet FFB et le Dashboard (même curseur Couple max). */
export function useTorqueLimit() {
  const { connected, pausePolling, wheelConfig, setWheelConfig } = useDevice()
  const { t } = useI18n()
  const [limits, setLimits] = useState<{ currentLim: number; torqueConstant: number; torqueLim: number } | null>(null)

  const reloadLimits = async () => {
    if (!connected) return
    const resume = pausePolling()
    try {
      const currentLim     = toNum(await readProp('axis0.motor.config.current_lim', 'odrv'), NaN)
      const torqueConstant = toNum(await readProp('axis0.motor.config.torque_constant', 'odrv'), NaN)
      const torqueLim      = toNum(await readProp('axis0.motor.config.torque_lim', 'odrv'), NaN)
      setLimits({ currentLim, torqueConstant, torqueLim })
    } catch { /* silencieux */ } finally { resume() }
  }
  useEffect(() => { if (connected) reloadLimits() }, [connected])  // eslint-disable-line react-hooks/exhaustive-deps

  const physicalMax = limits ? limits.currentLim * limits.torqueConstant : NaN
  const tLimActive = !!limits && isFinite(limits.torqueLim) && limits.torqueLim > 0 && limits.torqueLim < physicalMax
  const effectiveMax = tLimActive ? limits!.torqueLim : physicalMax
  const hasLimit = isFinite(effectiveMax) && effectiveMax > 0
  // Plafond effectif (arrondi 0.1, borné [0.5, HARD_MAX]) pour le curseur ET l'écrêtage.
  const effLimitTorque = hasLimit
    ? Math.max(0.5, Math.min(HARD_MAX_TORQUE, Math.floor(effectiveMax * 10) / 10))
    : HARD_MAX_TORQUE

  // Sécurité : écrête le couple max dès qu'il dépasse la limite physique.
  useEffect(() => {
    if (connected && hasLimit && wheelConfig.maxTorque > effLimitTorque + 0.01) {
      setWheelConfig({ ...wheelConfig, maxTorque: effLimitTorque })
      applyWheelField('maxTorque', effLimitTorque)
      toast(t('ffb.torque_clamped', { max: effLimitTorque.toFixed(1) }))
    }
  }, [connected, hasLimit, effLimitTorque, wheelConfig.maxTorque])  // eslint-disable-line react-hooks/exhaustive-deps

  // Tooltip : formule de la limite physique + max effectif.
  const limitTooltip = hasLimit
    ? `${t('ffb.limit_physical')}: ${limits!.currentLim.toFixed(2)} A × ${limits!.torqueConstant.toFixed(3)} Nm/A = ${physicalMax.toFixed(2)} Nm`
      + (tLimActive ? ` · torque_lim: ${limits!.torqueLim.toFixed(2)} Nm` : '')
      + `\n${t('ffb.limit_effective')}: ${effectiveMax.toFixed(2)} Nm`
    : t('ffb.limit_load_hint')

  return { effLimitTorque, hasLimit, limitTooltip, reloadLimits }
}
