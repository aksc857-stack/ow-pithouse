import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'node:path'
import { SerialManager } from './serial'

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
