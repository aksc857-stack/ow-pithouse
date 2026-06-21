import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { SerialManager } from './serial'

const execFileAsync = promisify(execFile)

process.env.APP_ROOT = path.join(__dirname, '..')
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let serial: SerialManager

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0e1014',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  serial = new SerialManager(win)

  // ── WebUSB pour le flash DFU ────────────────────────────────────────────────
  // Sans ces handlers, navigator.usb.requestDevice() dans le renderer ne renvoie
  // jamais de device. On n'autorise QUE le bootloader STM32 (VID:PID 0483:DF11).
  const STM_DFU = { vendorId: 0x0483, productId: 0xdf11 }
  win.webContents.session.on('select-usb-device', (event, details, callback) => {
    event.preventDefault()
    const dev = details.deviceList.find(
      (d) => d.vendorId === STM_DFU.vendorId && d.productId === STM_DFU.productId
    )
    callback(dev?.deviceId)
  })
  win.webContents.session.setDevicePermissionHandler((details) =>
    details.deviceType === 'usb' &&
    details.device.vendorId === STM_DFU.vendorId &&
    details.device.productId === STM_DFU.productId
  )

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('closed', () => {
    win = null
    serial?.close()
    overlayWin?.close()
  })

  Menu.setApplicationMenu(null)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
ipcMain.on('win:close', () => win?.close())

// ── Serial ────────────────────────────────────────────────────────────────────
ipcMain.handle('serial:list', () => serial.list())
ipcMain.handle('serial:connect', (_e, port: string, baud?: number) => serial.connect(port, baud))
ipcMain.handle('serial:disconnect', () => serial.disconnect())
ipcMain.handle('serial:send', (_e, cmd: string) => serial.send(cmd))
ipcMain.handle('serial:query', (_e, cmd: string) => serial.query(cmd))

// ── ODrive shortcuts ──────────────────────────────────────────────────────────
ipcMain.handle('odrive:read', (_e, p: string) => serial.query(`r ${p}`))
ipcMain.handle('odrive:write', (_e, p: string, v: string | number) => serial.send(`w ${p} ${v}`))
ipcMain.handle('odrive:save', () => serial.send('save_configuration()'))
ipcMain.handle('odrive:erase', () => serial.send('erase_configuration()'))
ipcMain.handle('odrive:reboot', () => serial.send('reboot()'))
ipcMain.handle('odrive:rebootDfu', () => serial.send('sd'))

// ── Overlay window ────────────────────────────────────────────────────────────
ipcMain.on('overlay:open', () => {
  if (overlayWin) { overlayWin.show(); return }
  overlayWin = new BrowserWindow({
    width: 260, height: 190,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })
  if (VITE_DEV_SERVER_URL) {
    overlayWin.loadURL(`${VITE_DEV_SERVER_URL}#/overlay`)
  } else {
    overlayWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'overlay' })
  }
  overlayWin.on('closed', () => { overlayWin = null })
})

ipcMain.on('overlay:close', () => overlayWin?.close())

// ── Profils / auto-switch ──────────────────────────────────────────────────────
// Sélection de l'exécutable d'un jeu + extraction de son icône (PNG data URL).
ipcMain.handle('app:pickGameExe', async () => {
  if (!win) return null
  const res = await dialog.showOpenDialog(win, {
    title: "Choisir l'exécutable du jeu",
    properties: ['openFile'],
    filters: [{ name: 'Exécutable', extensions: ['exe'] }],
  })
  if (res.canceled || !res.filePaths[0]) return null
  const p = res.filePaths[0]
  let icon = ''
  try {
    const img = await app.getFileIcon(p, { size: 'large' })   // NativeImage natif Electron
    if (!img.isEmpty()) icon = img.toDataURL()
  } catch { /* pas d'icône extractible : on renvoie une chaîne vide */ }
  return { path: p, name: path.basename(p), icon }
})

// Liste des exécutables en cours (noms en minuscules) pour l'auto-switch.
ipcMain.handle('app:listProcesses', async () => {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'], {
      windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    })
    const names = new Set<string>()
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(/^"([^"]+)"/)   // 1re colonne CSV = nom de l'image
      if (m) names.add(m[1].toLowerCase())
    }
    return [...names]
  } catch {
    return []
  }
})
