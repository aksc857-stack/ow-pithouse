// Génère public/icon.ico à partir de src/assets/logo.png.
// Redimensionne en carré (cover) pour les tailles 256/48/32/16, puis packe en .ico.
const fs = require('fs')
const path = require('path')
const Jimp = require('jimp')
const pngToIco = require('png-to-ico')

const SRC = path.join(__dirname, '..', 'src', 'assets', 'logo.png')
const OUT_DIR = path.join(__dirname, '..', 'public')
const OUT = path.join(OUT_DIR, 'icon.ico')
const SIZES = [256, 48, 32, 16]

;(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const base = await Jimp.read(SRC)
  const buffers = []
  for (const s of SIZES) {
    const img = base.clone().cover(s, s)
    buffers.push(await img.getBufferAsync(Jimp.MIME_PNG))
  }
  const ico = await pngToIco(buffers)
  fs.writeFileSync(OUT, ico)
  console.log('Écrit', OUT, '(' + ico.length + ' octets, tailles ' + SIZES.join('/') + ')')
})().catch((e) => { console.error(e); process.exit(1) })
