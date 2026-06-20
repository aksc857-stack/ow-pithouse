export interface PortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
  vendorId: string | null
  productId: string | null
  friendlyName: string | null
  pnpId: string | null
}

export interface OwApi {
  minimize: () => void
  maximize: () => void
  close: () => void

  listPorts: () => Promise<PortInfo[]>
  connect: (port: string, baud?: number) => Promise<{ success: boolean; port: string }>
  disconnect: () => Promise<{ success: boolean }>
  send: (cmd: string) => Promise<{ sent: string }>
  query: (cmd: string) => Promise<string | null>

  odriveRead: (p: string) => Promise<string>
  odriveWrite: (p: string, v: string | number) => Promise<{ sent: string }>
  odriveSave: () => Promise<{ sent: string }>
  odriveErase: () => Promise<{ sent: string }>
  odriveReboot: () => Promise<{ sent: string }>
  odriveRebootDfu: () => Promise<{ sent: string }>

  openOverlay: () => void
  closeOverlay: () => void

  onSerialData: (cb: (line: string) => void) => () => void
  onConnected: (cb: (data: { port: string }) => void) => () => void
  onDisconnected: (cb: () => void) => () => void
  onError: (cb: (msg: string) => void) => () => void
}

declare global {
  interface Window {
    ow: OwApi
  }
}

// ── Domain types ──────────────────────────────────────────────────────────────
export interface WheelConfig {
  range: number          // degrees
  maxTorque: number      // Nm
  masterGain: number     // %
  idleSpring: number     // %
  damper: number         // %
  inertia: number        // %
  friction: number       // %
  esGain: number         // end-stop spring %
  esDamp: number         // end-stop damper %
  fxRatio: number        // %
  expo: number           // %
  invert: boolean        // HID axis position invert
}

export interface MotorConfig {
  currentLim: number
  polePairs: number
  torqueConstant: number
  overvoltageTrip: number
  brakeResistance: number
  encoderCpr: number
}

export interface EffectConfig {
  name: string
  cmd: string
  enabled: boolean
  gain: number
}

export interface GameProfile {
  id: string
  name: string
  exe: string
  icon: string
  config: Partial<WheelConfig>
  active?: boolean
}

export interface LiveData {
  torque: number
  vbus: number
  iq: number
  position: number
  velocity: number
  ibrake: number
  temperature: number
  simulated: boolean
}

export type PageId =
  | 'dashboard' | 'odrive' | 'ffb' | 'effects'
  | 'profiles' | 'monitor' | 'console' | 'dfu'
  | 'themes' | 'settings'
