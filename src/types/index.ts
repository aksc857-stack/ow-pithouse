export interface PortInfo {
  path: string
  manufacturer: string | null
  serialNumber: string | null
  vendorId: string | null
  productId: string | null
  friendlyName: string | null
  pnpId: string | null
  busDescription: string | null
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

  // Profils / auto-switch
  pickGameExe: () => Promise<{ path: string; name: string; icon: string } | null>
  pickIconFile: () => Promise<{ path: string; name: string; icon: string } | null>
  listProcesses: () => Promise<string[]>   // noms d'exécutables en cours (minuscules)

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
  invert: boolean        // axis.invert — inverse la position HID
  ffbInvert: boolean     // axis.ffbinvert — inverse le couple FFB
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
  path: string   // fx.spring | fx.damper | fx.friction | fx.inertia
  gain: number   // 0..100 UI — firmware 0..255
}

// Réglages capturés dans un profil : uniquement le menu FFB + le menu Filtres.
export interface ProfileSettings {
  wheel: WheelConfig                 // roue, effets permanents, end-stop, gains
  effects: Record<string, number>    // fx.spring|damper|friction|inertia → gain % (0..100)
  filters: Record<string, number>    // fx.filter*Freq / fx.filter*Q → valeur brute
}

export interface GameProfile {
  id: string
  name: string
  exe?: string
  icon: string             // classe Tabler de repli (ti-*)
  iconImage?: string       // icône importée depuis l'.exe (data URL PNG)
  settings?: ProfileSettings
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
  | 'dashboard' | 'odrive' | 'ffb' | 'filters'
  | 'profiles' | 'status'
  | 'themes' | 'settings'
