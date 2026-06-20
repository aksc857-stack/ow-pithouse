import { useState, useCallback } from 'react'
import type { WheelConfig, MotorConfig } from '@/types'

const DEFAULT_WHEEL: WheelConfig = {
  range: 900, maxTorque: 3.5, masterGain: 80,
  idleSpring: 30, damper: 20, inertia: 10, friction: 5,
  esGain: 80, esDamp: 40, fxRatio: 100, expo: 0, invert: false,
}

const DEFAULT_MOTOR: MotorConfig = {
  currentLim: 20, polePairs: 7, torqueConstant: 0.087,
  overvoltageTrip: 56, brakeResistance: 2, encoderCpr: 8192,
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch { return fallback }
}

export function useWheelConfig() {
  const [config, setConfig] = useState<WheelConfig>(() => load('ow_wheel', DEFAULT_WHEEL))

  const update = useCallback(<K extends keyof WheelConfig>(key: K, value: WheelConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('ow_wheel', JSON.stringify(next))
      return next
    })
  }, [])

  const setAll = useCallback((c: Partial<WheelConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...c }
      localStorage.setItem('ow_wheel', JSON.stringify(next))
      return next
    })
  }, [])

  return { config, update, setAll }
}

export function useMotorConfig() {
  const [config, setConfig] = useState<MotorConfig>(() => load('ow_motor', DEFAULT_MOTOR))

  const update = useCallback(<K extends keyof MotorConfig>(key: K, value: MotorConfig[K]) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('ow_motor', JSON.stringify(next))
      return next
    })
  }, [])

  return { config, update }
}
