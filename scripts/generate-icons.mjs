// Generates minimal valid PWA icon PNGs (solid blue square with a white
// briefcase glyph) without pulling in any image library. Uses the Node
// built-in `zlib` to deflate IDAT chunks and CRC32 for chunk integrity.

import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const outDir = resolve(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const PRIMARY = [0x25, 0x63, 0xeb] // #2563eb
const WHITE = [0xff, 0xff, 0xff]

// CRC32 implementation (per PNG spec)
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([length, typeBuf, data, crcBuf])
}

function makePng(size, pixelFn) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowSize = size * 3 + 1
  const raw = Buffer.alloc(rowSize * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelFn(x, y, size)
      const off = y * rowSize + 1 + x * 3
      raw[off] = r
      raw[off + 1] = g
      raw[off + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// Draws a solid primary square with a stylized white briefcase in the middle.
function iconPixel(x, y, size) {
  // normalized coordinates 0..1
  const u = x / size
  const v = y / size

  // rounded corners mask
  const r = 0.14
  const insideCorners =
    (u > r && u < 1 - r) ||
    (v > r && v < 1 - r) ||
    ((u - r) ** 2 + (v - r) ** 2 < r * r) ||
    ((u - (1 - r)) ** 2 + (v - r) ** 2 < r * r) ||
    ((u - r) ** 2 + (v - (1 - r)) ** 2 < r * r) ||
    ((u - (1 - r)) ** 2 + (v - (1 - r)) ** 2 < r * r)
  if (!insideCorners) return WHITE

  // Briefcase body rectangle
  const bodyLeft = 0.22
  const bodyRight = 0.78
  const bodyTop = 0.42
  const bodyBottom = 0.78
  const handleTop = 0.32
  const handleBottom = 0.44
  const handleLeft = 0.4
  const handleRight = 0.6
  const strokeW = 0.045

  const insideBody = u > bodyLeft && u < bodyRight && v > bodyTop && v < bodyBottom
  const onBodyBorder =
    insideBody &&
    (Math.abs(u - bodyLeft) < strokeW ||
      Math.abs(u - bodyRight) < strokeW ||
      Math.abs(v - bodyTop) < strokeW ||
      Math.abs(v - bodyBottom) < strokeW)
  const insideHandle =
    u > handleLeft && u < handleRight && v > handleTop && v < handleBottom
  const onHandleBorder =
    insideHandle &&
    (Math.abs(u - handleLeft) < strokeW ||
      Math.abs(u - handleRight) < strokeW ||
      Math.abs(v - handleTop) < strokeW)

  if (onBodyBorder || onHandleBorder) return WHITE
  if (insideBody) {
    // small circle on body
    const cx = 0.5
    const cy = 0.6
    const d2 = (u - cx) ** 2 + (v - cy) ** 2
    if (d2 < 0.015) return WHITE
  }
  return PRIMARY
}

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 512, name: 'icon-512-maskable.png' }
]

for (const s of sizes) {
  const png = makePng(s.size, iconPixel)
  const outPath = resolve(outDir, s.name)
  writeFileSync(outPath, png)
  const hash = createHash('sha256').update(png).digest('hex').slice(0, 8)
  console.log(`wrote ${outPath} (${png.length} bytes, sha256=${hash})`)
}

// Apple touch icon = same as 192 size
writeFileSync(
  resolve(__dirname, '..', 'public', 'apple-touch-icon.png'),
  makePng(180, iconPixel)
)
console.log('wrote apple-touch-icon.png')
