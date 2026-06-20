// ── Flash DFU (DfuSe) via WebUSB ──────────────────────────────────────────────
// Port fidèle de l'implémentation odrive-wheel.html. Grave un .bin sur le
// bootloader interne STM32 (VID:PID 0483:DF11) sans dfu-util.
//
// ⚠️ CRITIQUE : les secteurs S1+S2 (0x08004000–0x0800BFFF) contiennent l'EEPROM
// FFB émulée. On NE les efface NI ne les réécrit — sinon perte de la calibration
// et de la config FFB. S10/S11 (NVM ODrive) sont hors du .bin donc jamais touchés.

const REQ = { DETACH: 0, DNLOAD: 1, UPLOAD: 2, GETSTATUS: 3, CLRSTATUS: 4, GETSTATE: 5, ABORT: 6 }
const STATE = { dfuIDLE: 2, dfuDNBUSY: 4, dfuMANIFEST_SYNC: 6, dfuMANIFEST: 7, dfuERROR: 10 }

// Secteurs effaçables du STM32F405 (start, size).
const STM32F4_SECTORS = [
  { start: 0x08000000, size: 16 * 1024 },  // S0
  { start: 0x08004000, size: 16 * 1024 },  // S1  ⚠ FFB EE (protégé)
  { start: 0x08008000, size: 16 * 1024 },  // S2  ⚠ FFB EE (protégé)
  { start: 0x0800C000, size: 16 * 1024 },  // S3
  { start: 0x08010000, size: 64 * 1024 },  // S4
  { start: 0x08020000, size: 128 * 1024 }, // S5
  { start: 0x08040000, size: 128 * 1024 }, // S6
  { start: 0x08060000, size: 128 * 1024 }, // S7
  { start: 0x08080000, size: 128 * 1024 }, // S8
  { start: 0x080A0000, size: 128 * 1024 }, // S9
]
const PROTECTED_RANGES = [{ start: 0x08004000, end: 0x0800C000, name: 'FFB EEPROM (S1+S2)' }]

export const STM_DFU_FILTER: USBDeviceFilter = { vendorId: 0x0483, productId: 0xdf11 }

export type DfuLogKind = 'info' | 'ok' | 'err'
export type DfuLog = (msg: string, kind?: DfuLogKind) => void

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class DfuClient {
  device: USBDevice
  iface = 0
  transferSize = 1024

  constructor(device: USBDevice) { this.device = device }

  /** Demande le bootloader STM32 (0483:DF11) via WebUSB et l'ouvre. */
  static async detect(): Promise<DfuClient> {
    const dev = await navigator.usb.requestDevice({ filters: [STM_DFU_FILTER] })
    await dev.open()
    if (dev.configuration === null) await dev.selectConfiguration(1)
    await dev.claimInterface(0)   // iface 0 alt 0 = flash interne @ 0x08000000
    try { await dev.selectAlternateInterface(0, 0) } catch { /* déjà actif */ }

    const client = new DfuClient(dev)
    // Lit wTransferSize du descripteur fonctionnel DFU (type 0x21), best effort.
    try {
      const cfg = await dev.controlTransferIn(
        { requestType: 'standard', recipient: 'device', request: 0x06, value: 0x0200, index: 0 }, 256)
      if (cfg.data) {
        const view = cfg.data
        let off = view.getUint8(0)
        while (off < view.byteLength) {
          const len = view.getUint8(off)
          const type = view.getUint8(off + 1)
          if (type === 0x21 && len >= 9) { client.transferSize = view.getUint16(off + 5, true); break }
          off += len
          if (len === 0) break
        }
      }
    } catch { /* garde 1024 par défaut */ }
    return client
  }

  // ── Primitives DfuSe ────────────────────────────────────────────────────────
  private async ctrlOut(request: number, value: number, data: BufferSource) {
    const r = await this.device.controlTransferOut(
      { requestType: 'class', recipient: 'interface', request, value, index: this.iface }, data)
    if (r.status !== 'ok') throw new Error('USB OUT status=' + r.status)
  }
  private async ctrlIn(request: number, value: number, length: number) {
    const r = await this.device.controlTransferIn(
      { requestType: 'class', recipient: 'interface', request, value, index: this.iface }, length)
    if (r.status !== 'ok' || !r.data) throw new Error('USB IN status=' + r.status)
    return new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength)
  }
  private async getStatus() {
    const d = await this.ctrlIn(REQ.GETSTATUS, 0, 6)
    return { bStatus: d[0], bwPollTimeout: d[1] | (d[2] << 8) | (d[3] << 16), bState: d[4] }
  }
  private clearStatus() { return this.ctrlOut(REQ.CLRSTATUS, 0, new ArrayBuffer(0)) }
  private abort() { return this.ctrlOut(REQ.ABORT, 0, new ArrayBuffer(0)) }

  private async pollUntilIdle(target: number, timeoutMs = 30000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const st = await this.getStatus()
      if (st.bStatus !== 0) throw new Error('DFU status=0x' + st.bStatus.toString(16) + ' state=' + st.bState)
      if (st.bState === target) return st
      await delay(Math.max(st.bwPollTimeout, 5))
    }
    throw new Error('Timeout en attente de state=' + target)
  }

  // Commande spéciale DfuSe : DNLOAD wBlockNum=0 avec data = [cmd, ...payload]
  private async seCommand(cmd: number, payload: Uint8Array) {
    const buf = new Uint8Array(1 + payload.length)
    buf[0] = cmd; buf.set(payload, 1)
    await this.ctrlOut(REQ.DNLOAD, 0, buf)
    let st = await this.getStatus()
    if (st.bState === STATE.dfuDNBUSY) { await delay(Math.max(st.bwPollTimeout, 5)); st = await this.getStatus() }
    if (st.bStatus !== 0) throw new Error('DfuSe cmd 0x' + cmd.toString(16) + ' échec status=0x' + st.bStatus.toString(16))
  }
  private addrPayload(addr: number) {
    return new Uint8Array([addr & 0xff, (addr >> 8) & 0xff, (addr >> 16) & 0xff, (addr >> 24) & 0xff])
  }
  private setAddress(addr: number) { return this.seCommand(0x21, this.addrPayload(addr)) }
  private erasePage(addr: number) { return this.seCommand(0x41, this.addrPayload(addr)) }

  async close() { try { await this.device.close() } catch { /* déjà fermé */ } }

  // ── Séquence haut-niveau ──────────────────────────────────────────────────
  async flash(fileBuf: ArrayBuffer, log: DfuLog, onProgress: (pct: number) => void): Promise<void> {
    const fw = new Uint8Array(fileBuf)
    const baseAddr = 0x08000000
    const total = fw.byteLength

    // 0. S'assurer d'être en dfuIDLE.
    log('Vérification de l\'état du bootloader…')
    let st = await this.getStatus()
    if (st.bState === STATE.dfuERROR) { await this.clearStatus(); st = await this.getStatus() }
    if (st.bState !== STATE.dfuIDLE) { try { await this.abort() } catch { /* */ } st = await this.getStatus() }
    log('État initial OK (state=' + st.bState + ')', 'ok')

    const inProtected = (addr: number) => PROTECTED_RANGES.some((r) => addr >= r.start && addr < r.end)

    // 1. Secteurs à effacer (zones protégées sautées).
    const endAddr = baseAddr + total
    const sectorsAll = STM32F4_SECTORS.filter((s) => s.start < endAddr && s.start + s.size > baseAddr)
    const toErase = sectorsAll.filter((s) => !inProtected(s.start))
    const skipped = sectorsAll.filter((s) => inProtected(s.start))
    if (skipped.length) log('Saut de ' + skipped.length + ' secteur(s) protégé(s) — FFB EEPROM préservée', 'ok')

    log('Effacement de ' + toErase.length + ' secteur(s) (couvre ' + (total / 1024).toFixed(1) + ' KB)…')
    onProgress(2)
    for (let i = 0; i < toErase.length; i++) {
      const s = toErase[i]
      log('  Erase S' + STM32F4_SECTORS.indexOf(s) + ' @ 0x' + s.start.toString(16))
      await this.erasePage(s.start)
      onProgress(2 + (i + 1) * 18 / toErase.length)
    }
    log('Effacement terminé.', 'ok')

    // 2. Download par chunks, en sautant les zones protégées.
    const xfer = this.transferSize
    const totalChunks = Math.ceil(total / xfer)
    log('Écriture de ' + total + ' octets en ' + totalChunks + ' chunks de ' + xfer + ' B…')

    let curBase = -1, blockOffset = 0, written = 0, skippedC = 0
    const setAddrIdle = async (addr: number) => {
      await this.setAddress(addr)
      try { await this.abort() } catch { /* */ }
      await this.pollUntilIdle(STATE.dfuIDLE, 5000)
    }

    for (let i = 0; i < totalChunks; i++) {
      const start = i * xfer
      const end = Math.min(start + xfer, total)
      const chunkAddr = baseAddr + start
      const chunkEnd = baseAddr + end

      // Saut si le chunk est entièrement dans une zone protégée.
      if (PROTECTED_RANGES.some((r) => chunkAddr >= r.start && chunkEnd <= r.end)) {
        skippedC++; curBase = -1; continue
      }
      // Ré-émettre SET_ADDRESS quand on rentre dans une zone écrivable après un saut.
      if (curBase === -1) { await setAddrIdle(chunkAddr); curBase = chunkAddr; blockOffset = 0 }

      await this.ctrlOut(REQ.DNLOAD, 2 + blockOffset, fw.subarray(start, end))
      let cs = await this.getStatus()
      while (cs.bState === STATE.dfuDNBUSY) { await delay(Math.max(cs.bwPollTimeout, 1)); cs = await this.getStatus() }
      if (cs.bStatus !== 0) throw new Error('Download chunk ' + i + ' status=0x' + cs.bStatus.toString(16))
      blockOffset++; written++
      if (i % 16 === 0 || i === totalChunks - 1) onProgress(20 + 75 * (i + 1) / totalChunks)
    }
    log('Écriture terminée — ' + written + ' chunks écrits, ' + skippedC + ' sautés (zone protégée).', 'ok')

    // 3. Manifest : DNLOAD de longueur nulle = fin de transfert.
    log('Manifest (finalisation)…')
    await this.ctrlOut(REQ.DNLOAD, 0, new ArrayBuffer(0))
    onProgress(98)
    try {
      let ms = await this.getStatus()
      while (ms.bState === STATE.dfuMANIFEST || ms.bState === STATE.dfuMANIFEST_SYNC) {
        await delay(Math.max(ms.bwPollTimeout, 5)); ms = await this.getStatus()
      }
    } catch { log('Manifest terminé (bootloader déconnecté — normal).') }

    await this.close()
    onProgress(100)
    log('Firmware écrit avec succès. La carte redémarre sur le nouveau firmware.', 'ok')
    log('Reconnecte la carte une fois le boot terminé.')
  }
}
