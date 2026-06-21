import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { PortInfo, LiveData, WheelConfig } from '@/types'
import { readProp, toNum } from '@/lib/odrive'
import { setSerialLogger } from '@/lib/serialLog'
import { readWheelConfig } from '@/lib/ffbConfig'

const DEFAULT_WHEEL: WheelConfig = {
  range: 900, maxTorque: 3.5, masterGain: 80,
  idleSpring: 30, damper: 20, inertia: 10, friction: 5,
  esGain: 80, esDamp: 40, fxRatio: 100, expo: 0, invert: false, ffbInvert: false,
}

interface DeviceContextValue {
  connected: boolean
  port: string | null
  ports: PortInfo[]
  live: LiveData
  reading: boolean
  wheelConfig: WheelConfig
  setWheelConfig: (c: WheelConfig) => void
  log: { type: 'tx' | 'rx' | 'info' | 'err'; text: string; ts: number }[]
  refreshPorts: () => Promise<void>
  connect: (port: string) => Promise<void>
  disconnect: () => Promise<void>
  sendCommand: (cmd: string) => Promise<string>
  reloadFromBoard: () => Promise<void>
  appendLog: (type: 'tx' | 'rx' | 'info' | 'err', text: string) => void
  clearLog: () => void
  /** Suspend le polling de fond ; renvoie la fonction de reprise (finally). */
  pausePolling: () => () => void
}

const DeviceContext = createContext<DeviceContextValue | null>(null)

const EMPTY_LIVE: LiveData = {
  torque: 0, vbus: 48, iq: 0, position: 0,
  velocity: 0, ibrake: 0, temperature: 38, simulated: true,
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [port, setPort] = useState<string | null>(null)
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [live, setLive] = useState<LiveData>(EMPTY_LIVE)
  const [reading, setReading] = useState(false)
  const [wheelConfig, setWheelConfig] = useState<WheelConfig>(DEFAULT_WHEEL)
  const [log, setLog] = useState<DeviceContextValue['log']>([])
  const t0 = useRef(Date.now())
  const connectedRef = useRef(false)
  const autoConnectingRef = useRef(false)
  // Compteur de pause du polling : >0 = une page lit, le polling de fond attend
  // (réduit la latence des « Relire »). Compteur pour gérer les lectures imbriquées.
  const pollPauseRef = useRef(0)

  const appendLog = useCallback((type: 'tx' | 'rx' | 'info' | 'err', text: string) => {
    setLog((prev) => [...prev.slice(-200), { type, text, ts: Date.now() }])
  }, [])

  const clearLog = useCallback(() => setLog([]), [])

  // Suspend le polling de fond le temps d'une lecture de page. Renvoie la fonction
  // de reprise (à appeler dans un finally).
  const pausePolling = useCallback(() => {
    pollPauseRef.current++
    let released = false
    return () => { if (!released) { released = true; pollPauseRef.current = Math.max(0, pollPauseRef.current - 1) } }
  }, [])

  // Identify the ODrive-Wheel board among the available ports.
  // Primary: friendlyName/manufacturer contains "ODrive-Wheel" (the CDC name).
  // Fallback: STM32 vendor id 0483 (the MKS XDrive Mini bootloader/CDC VID).
  const findBoardPort = useCallback((list: PortInfo[]): PortInfo | null => {
    const eq = (a: string | null, b: string) => (a ?? '').toLowerCase() === b.toLowerCase()
    // Primary: exact VID:PID of the ODrive-Wheel CDC (pid.codes 1209:0D40).
    const byId = list.find((p) => eq(p.vendorId, '1209') && eq(p.productId, '0d40'))
    if (byId) return byId
    // Secondary: name match if a future firmware exposes it.
    const re = /odrive[\s-]?wheel/i
    const byName = list.find((p) =>
      re.test(p.busDescription ?? '') ||
      re.test(p.friendlyName ?? '') ||
      re.test(p.manufacturer ?? '') ||
      re.test(p.pnpId ?? '')
    )
    if (byName) return byName
    // Last resort: VID only (covers PID changes across firmware versions).
    return list.find((p) => eq(p.vendorId, '1209')) ?? null
  }, [])

  const refreshPorts = useCallback(async () => {
    if (!window.ow) return
    try {
      const list = await window.ow.listPorts()
      setPorts(list)

      // Auto-connect: if enabled, not connected, and the board is present.
      const autoEnabled = localStorage.getItem('ow_autoconnect') !== 'off'
      if (autoEnabled && !connectedRef.current && !autoConnectingRef.current) {
        const board = findBoardPort(list)
        if (board) {
          autoConnectingRef.current = true
          appendLog('info', `Auto-connexion à ${board.friendlyName || board.path}`)
          try {
            await window.ow.connect(board.path)
          } catch (e) {
            appendLog('err', `Auto-connexion échouée : ${e}`)
          } finally {
            // Allow retry on next scan if it failed
            setTimeout(() => { autoConnectingRef.current = false }, 2000)
          }
        }
      }
    } catch (e) {
      console.error('[device] listPorts failed:', e)
    }
  }, [appendLog, findBoardPort])

  // Read everything the board exposes into the UI (called on connect).
  const reloadFromBoard = useCallback(async () => {
    if (!window.ow || !connectedRef.current) return
    setReading(true)
    appendLog('info', '--- Lecture des réglages de la carte ---')
    try {
      const wc = await readWheelConfig(DEFAULT_WHEEL)
      setWheelConfig(wc)
      appendLog('rx', `range=${wc.range} maxtorque=${wc.maxTorque} master=${wc.masterGain}%`)
    } catch (e) {
      appendLog('err', 'Lecture échouée : ' + e)
    } finally {
      setReading(false)
    }
  }, [appendLog])

  const connect = useCallback(async (p: string) => {
    if (!window.ow) return
    try {
      await window.ow.connect(p)
      appendLog('info', `Connecté à ${p}`)
    } catch (e) {
      appendLog('err', `Connexion échouée : ${e}`)
    }
  }, [appendLog])

  const disconnect = useCallback(async () => {
    if (!window.ow) return
    await window.ow.disconnect()
  }, [])

  const sendCommand = useCallback(async (cmd: string): Promise<string> => {
    appendLog('tx', cmd)
    if (!window.ow || !connectedRef.current) {
      appendLog('info', '(non connecté — simulé)')
      return 'ok'
    }
    try {
      const res = await window.ow.query(cmd)
      appendLog('rx', res ?? '(timeout)')
      return res ?? ''
    } catch (e) {
      appendLog('err', String(e))
      throw e
    }
  }, [appendLog])

  // IPC listeners
  useEffect(() => {
    if (!window.ow) return
    const offConn = window.ow.onConnected(({ port: p }) => {
      connectedRef.current = true
      setConnected(true)
      setPort(p)
      // Auto-read after a short delay so the serial link settles first.
      setTimeout(() => { reloadFromBoard() }, 250)
    })
    const offDisc = window.ow.onDisconnected(() => {
      connectedRef.current = false
      setConnected(false)
      setPort(null)
    })
    const offErr = window.ow.onError((msg) => appendLog('err', msg))
    // La Console affiche les écritures + lectures à la demande émises par
    // readProp/writeProp (le polling de fond passe log:false, voir plus bas).
    setSerialLogger((type, text) => appendLog(type, text))
    refreshPorts()
    const interval = setInterval(refreshPorts, 3000)
    return () => { offConn(); offDisc(); offErr(); setSerialLogger(null); clearInterval(interval) }
  }, [appendLog, refreshPorts, reloadFromBoard])

  // Live polling — sequential, slow, ODrive protocol for live signals.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (cancelled) return
      if (connectedRef.current && !reading && pollPauseRef.current === 0 && window.ow) {
        // Polling de fond : log:false pour ne pas inonder la Console.
        const vb = await readProp('vbus_voltage', 'odrv', { log: false })
        const iq = await readProp('axis0.motor.current_control.Iq_measured', 'odrv', { log: false })
        // Position HID en degrés (OpenFFBoard) : respecte zeroenc + axis.invert,
        // donc le visuel du volant est toujours aligné avec le jeu / joy.cpl.
        const pos = await readProp('axis.curpos', 'offb', { log: false })
        const vel = await readProp('axis0.encoder.vel_estimate', 'odrv', { log: false })
        if (!cancelled) {
          const iqNum = toNum(iq, 0)
          setLive({
            torque: iqNum * 0.087,
            vbus: toNum(vb, 48),
            iq: iqNum,
            position: toNum(pos, 0),
            velocity: toNum(vel, 0),
            ibrake: 0, temperature: 42, simulated: false,
          })
        }
        timer = setTimeout(poll, 120)
      } else if (!connectedRef.current) {
        const t = (Date.now() - t0.current) / 1000
        const torque = 1.2 + Math.sin(t * 1.25) * 0.9 + (Math.random() - 0.5) * 0.25
        setLive({
          torque, vbus: 47.8 + (Math.random() - 0.5) * 0.5, iq: torque / 0.087,
          position: Math.sin(t * 0.5) * 180, velocity: Math.cos(t * 0.5) * 1.5,
          ibrake: Math.max(0, -torque / 2), temperature: 40 + Math.sin(t * 0.05) * 4,
          simulated: true,
        })
        timer = setTimeout(poll, 80)
      } else {
        // connected but reading config — wait
        timer = setTimeout(poll, 200)
      }
    }
    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [reading])

  return (
    <DeviceContext.Provider value={{
      connected, port, ports, live, reading, wheelConfig, setWheelConfig, log,
      refreshPorts, connect, disconnect, sendCommand, reloadFromBoard, appendLog, clearLog, pausePolling,
    }}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  const ctx = useContext(DeviceContext)
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider')
  return ctx
}
