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
  // Chaîne de sérialisation : garantit qu'UNE seule commande est sur le fil à la
  // fois. Sans ça, polling de fond + lectures de page s'entrelacent et les
  // réponses se croisent (FIFO désynchronisée → valeurs erronées).
  private chain: Promise<unknown> = Promise.resolve()

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

  /** Enfile une tâche : exécutée seulement quand la précédente est terminée. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.chain.then(task, task)
    this.chain = result.catch(() => { /* ne casse pas la chaîne sur erreur */ })
    return result
  }

  /** Write-only command (no reply expected). Sérialisé. */
  send(cmd: string): Promise<{ sent: string }> {
    return this.enqueue(() => this._send(cmd))
  }

  /** Command expecting exactly one reply line. Sérialisé. */
  query(cmd: string): Promise<string | null> {
    return this.enqueue(() => this._query(cmd))
  }

  private _send(cmd: string): Promise<{ sent: string }> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) return reject('Not connected')
      this.port.write(cmd + '\n', (err) => {
        if (err) return reject(err.message)
        // Un write ODrive ne répond qu'en cas d'erreur ("invalid property"…).
        // On laisse une courte fenêtre pour que cette réponse soit consommée
        // pending VIDE (donc ignorée) avant la commande suivante.
        setTimeout(() => resolve({ sent: cmd }), 60)
      })
    })
  }

  private _query(cmd: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.port?.isOpen) return reject('Not connected')
      this.port.write(cmd + '\n', (err) => {
        if (err) return reject(err.message)
        const timeout = setTimeout(() => {
          // Une seule commande en vol : on vide pending pour qu'une réponse
          // tardive ne soit pas appariée à la commande suivante.
          this.flushPending()
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
