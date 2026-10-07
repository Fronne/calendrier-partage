// Dessine l'icône de l'application (une page de calendrier et deux pastilles qui se recouvrent) et l'écrit en PNG, sans dépendance.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { deflateSync } from 'node:zlib'

const BG = [79, 70, 229]
const WHITE = [255, 255, 255]
const HEADER = [244, 63, 94]
// Les deux personnes, et ce qu'elles partagent là où les pastilles se recouvrent
const ONE = [37, 99, 235]
const OTHER = [225, 29, 72]
const SHARED = [124, 58, 237]

const inRound = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

// Coordonnées dans un carré 0..1 ; le dessin reste dans la zone centrale (icônes "maskable")
function colorAt(x, y) {
  if (!inRound(x, y, 0.22, 0.24, 0.78, 0.78, 0.07)) return BG
  if (y < 0.38) return HEADER
  const inDot = (cx) => (x - cx) ** 2 + (y - 0.58) ** 2 <= 0.11 ** 2
  const one = inDot(0.425)
  const other = inDot(0.575)
  if (one && other) return SHARED
  if (one) return ONE
  if (other) return OTHER
  return WHITE
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

// `scale` < 1 rétrécit le dessin autour du centre, le fond remplissant le reste
function png(size, scale = 1) {
  const SS = 3 // suréchantillonnage pour des bords lisses
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1)
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const at = (p, s) => 0.5 + ((p + (s + 0.5) / SS) / size - 0.5) / scale
          const c = colorAt(at(px, sx), at(py, sy))
          sum[0] += c[0]
          sum[1] += c[1]
          sum[2] += c[2]
        }
      }
      for (let i = 0; i < 3; i++) raw[row + 1 + px * 3 + i] = Math.round(sum[i] / (SS * SS))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8 bits, RVB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Android : le même dessin sert d'avant-plan à l'icône (432 px = 108 dp en xxxhdpi) et d'écran de démarrage.
// L'avant-plan est rétréci pour tenir en entier dans les icônes rondes de certains téléphones.
const ANDROID = 'android/app/src/main/res/drawable-nodpi'
const files = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
  [`${ANDROID}/ic_launcher_foreground.png`, 432, 0.78],
  [`${ANDROID}/splash.png`, 512],
]
for (const [path, size, scale] of files) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, png(size, scale))
  console.log(path)
}
