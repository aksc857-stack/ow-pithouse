import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),

  // Serial
  listPorts: () => ipcRenderer.invoke('serial:list'),
  connect: (port: string, baud?: number) => ipcRenderer.invoke('serial:connect', port, baud),
  disconnect: () => ipcRenderer.invoke('serial:disconnect'),
  send: (cmd: string) => ipcRenderer.invoke('serial:send', cmd),
  query: (cmd: string) => ipcRenderer.invoke('serial:query', cmd),

  // ODrive
  odriveRead: (p: string) => ipcRenderer.invoke('odrive:read', p),
  odriveWrite: (p: string, v: string | number) => ipcRenderer.invoke('odrive:write', p, v),
  odriveSave: () => ipcRenderer.invoke('odrive:save'),
  odriveErase: () => ipcRenderer.invoke('odrive:erase'),
  odriveReboot: () => ipcRenderer.invoke('odrive:reboot'),
  odriveRebootDfu: () => ipcRenderer.invoke('odrive:rebootDfu'),

  // Overlay
  openOverlay: () => ipcRenderer.send('overlay:open'),
  closeOverlay: () => ipcRenderer.send('overlay:close'),

  // Profils / auto-switch
  pickGameExe: () => ipcRenderer.invoke('app:pickGameExe'),
  listProcesses: () => ipcRenderer.invoke('app:listProcesses'),

  // Events
  onSerialData: (cb: (line: string) => void) => {
    const handler = (_e: unknown, line: string) => cb(line)
    ipcRenderer.on('serial:data', handler)
    return () => ipcRenderer.removeListener('serial:data', handler)
  },
  onConnected: (cb: (data: { port: string }) => void) => {
    const handler = (_e: unknown, d: { port: string }) => cb(d)
    ipcRenderer.on('serial:connected', handler)
    return () => ipcRenderer.removeListener('serial:connected', handler)
  },
  onDisconnected: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('serial:disconnected', handler)
    return () => ipcRenderer.removeListener('serial:disconnected', handler)
  },
  onError: (cb: (msg: string) => void) => {
    const handler = (_e: unknown, m: string) => cb(m)
    ipcRenderer.on('serial:error', handler)
    return () => ipcRenderer.removeListener('serial:error', handler)
  },
}

contextBridge.exposeInMainWorld('ow', api)

export type OwApi = typeof api
