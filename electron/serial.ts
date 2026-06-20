import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import type { BrowserWindow } from 'electron'

interface Pending {
  resolve: (value: string | null) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * Mirrors the reference tool's transport:
 *  - one writer, one read loop, line-delimited
 *  - FIFO `pendingReplies` matching replies to requests
 *  - RESYNC GUARD: on a timeout, flush ALL pending + the read buffer so the
 *    late firmware reply can't desync every subsequent command.
 */
export class SerialManager {
  private win: BrowserWindow
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private pending: Pending[] = []

  constructor(win: BrowserWindow) {
    this.win = win
  }

  async list() {
    try {
      const ports = await SerialPort.list()
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer ?? null,
        serialNumber: p.serialNumber ?? null,
        vendorId: p.vendorId ?? null,
        productId: p.productId ?? null,
        friendlyName: (p as { friendlyName?: string }).friendlyName ?? null,
        pnpId: p.pnpId ?? null,
        busDescription: null,
      }))
    } catch (err) {
      console.error('[serial] list() failed:', err)
      this.emit('serial:error', `Impossible de lister les ports : ${(err as Error).message}`)
      return []
    }
  }

  connect(portPath: string, baudRate = 115200): Promise<{ success: boolean; port: string }> {
    return new Promise((resolve, reject) => {
      if (this.port?.isOpen) this.port.close()
      this.flushPending()

      this.port = new SerialPort(
        { path: portPath, baudRate, dataBits: 8, stopBits: 1, parity: 'none' },
        (err) => { if (err) reject(err.message) }
      )

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }))

      this.port.on('open', () => {
        this.emit('serial:connected', { port: portPath })
        resolve({ success: true, port: portPath })
      })

      // Read loop: each line resolves the oldest pending request (FIFO).
      this.parser.on('data', (raw: string) => {
        const line = raw.replace(/\r$/, '').trim()
        if (!line.length) return
        this.emit('serial:data', line)
        const p = this.pending.shift()
        if (p) { clearTimeout(p.timeout); p.resolve(line) }
      })

      this.port.on('error', (err) => {
        this.emit('serial:error', err.message)
        reject(err.message)
      })

      this.port.on('close', () => {
        this.emit('serial:disconnected', null)
        this.port = null
        this.parser = null
        this.flushPending()
      })
    })
  }

  disconnect(): Promise<{ success: boolean }> {
    return new Promise((resolve) => {
      if (!this.port?.isOpen) return resolve({ success: true })
      this.port.close(() => resolve({ success: true }))
    })
  }

  /** Write-only command (no reply expected). */
  send(cmd: string): Promise<{ sent: string }> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) return reject('Not connected')
      this.port.write(cmd + '\n', (err) => {
        if (err) reject(err.message)
        else resolve({ sent: cmd })
      })
    })
  }

  /** Command expecting exactly one reply line. */
  query(cmd: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) return reject('Not connected')
      this.port.write(cmd + '\n', (err) => {
        if (err) return reject(err.message)
        const timeout = setTimeout(() => {
          // RESYNC GUARD — abort every in-flight request and discard buffered
          // input so a late reply can't desync the whole queue.
          const queuedBefore = this.pending.length
          this.pending.forEach((p) => { clearTimeout(p.timeout); try { p.resolve(null) } catch { /* */ } })
          this.pending = []
          if (queuedBefore > 1) {
            console.warn(`[serial] timeout — flushed ${queuedBefore - 1} in-flight cmds to resync`)
          }
          resolve(null)
        }, 2000)
        this.pending.push({ resolve, timeout })
      })
    })
  }

  close() {
    if (this.port?.isOpen) this.port.close()
  }

  private flushPending() {
    this.pending.forEach((p) => { clearTimeout(p.timeout); try { p.resolve(null) } catch { /* */ } })
    this.pending = []
  }

  private emit(channel: string, data: unknown) {
    if (!this.win.isDestroyed()) this.win.webContents.send(channel, data)
  }
}
