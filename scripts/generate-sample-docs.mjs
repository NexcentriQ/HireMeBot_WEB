// Generates small, valid sample documents for the HireMeBot student
// application-view mock:
//   public/samples/sample-resume.pdf
//   public/samples/sample-cover-letter.pdf
//   public/samples/sample-cover-letter.docx
//
// No image or office libraries are used — the PDFs are hand-rolled to the
// PDF 1.4 spec (text + Helvetica, no embedded fonts), and the DOCX is a
// hand-rolled OOXML package stored (not deflated) inside a hand-rolled ZIP.
// Keeping it dependency-free avoids pulling in any npm bloat just to ship a
// couple of placeholder files.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'public', 'samples')
mkdirSync(OUT, { recursive: true })

// ─── CRC32 (shared) ────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── PDF ───────────────────────────────────────────────────────────────────
/**
 * Build a single-page PDF with the given title (24pt) followed by body lines
 * (12pt). Returns a Buffer with correct xref offsets.
 */
function buildPdf(title, lines) {
  const objects = []

  function addObj(body) {
    objects.push(body)
    return objects.length // 1-based id
  }

  // Reserve object IDs in a known order so we can reference them.
  const catalogId = 1
  const pagesId = 2
  const pageId = 3
  const contentsId = 4
  const fontId = 5

  const stream = buildStream(title, lines)

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`
  objects[pageId - 1] =
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] ` +
    `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentsId} 0 R >>`
  objects[contentsId - 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  objects[fontId - 1] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`

  // Serialize
  const header = '%PDF-1.4\n%\xff\xff\xff\xff\n'
  const chunks = [Buffer.from(header, 'binary')]
  const offsets = []
  let cursor = chunks[0].length

  for (let i = 0; i < objects.length; i++) {
    offsets.push(cursor)
    const body = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
    const buf = Buffer.from(body, 'binary')
    chunks.push(buf)
    cursor += buf.length
  }

  const xrefOffset = cursor
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(xref + trailer, 'binary'))

  return Buffer.concat(chunks)

  function buildStream(titleText, bodyLines) {
    const escape = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    const out = ['BT', '/F1 24 Tf', '72 720 Td', `(${escape(titleText)}) Tj`, '0 -36 Td', '/F1 12 Tf']
    for (let i = 0; i < bodyLines.length; i++) {
      if (i > 0) out.push('0 -18 Td')
      out.push(`(${escape(bodyLines[i])}) Tj`)
    }
    out.push('ET')
    return out.join('\n')
  }
}

// ─── DOCX (minimal OOXML package in a stored ZIP) ──────────────────────────
function buildDocx(paragraphs) {
  const escape = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>'

  const body = paragraphs
    .map(
      (p) =>
        `<w:p><w:r><w:t xml:space="preserve">${escape(p)}</w:t></w:r></w:p>`
    )
    .join('')

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`

  const entries = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
    { name: '_rels/.rels', data: Buffer.from(rels, 'utf8') },
    { name: 'word/document.xml', data: Buffer.from(document, 'utf8') }
  ]

  // DOS time/date (2026-10-27 12:00 — arbitrary stable value)
  const dosTime = ((12 << 11) | (0 << 5) | (0 >> 1)) & 0xffff
  const dosDate = (((2026 - 1980) << 9) | (10 << 5) | 27) & 0xffff

  const localChunks = []
  const centralChunks = []
  let offset = 0

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const dataBuf = e.data
    const crc = crc32(dataBuf)

    const lfh = Buffer.alloc(30)
    lfh.writeUInt32LE(0x04034b50, 0)
    lfh.writeUInt16LE(20, 4) // version needed
    lfh.writeUInt16LE(0, 6) // flags
    lfh.writeUInt16LE(0, 8) // method: store
    lfh.writeUInt16LE(dosTime, 10)
    lfh.writeUInt16LE(dosDate, 12)
    lfh.writeUInt32LE(crc, 14)
    lfh.writeUInt32LE(dataBuf.length, 18) // compressed = raw (store)
    lfh.writeUInt32LE(dataBuf.length, 22) // uncompressed
    lfh.writeUInt16LE(nameBuf.length, 26)
    lfh.writeUInt16LE(0, 28) // extra length
    localChunks.push(lfh, nameBuf, dataBuf)

    const cfh = Buffer.alloc(46)
    cfh.writeUInt32LE(0x02014b50, 0)
    cfh.writeUInt16LE(20, 4) // version made by
    cfh.writeUInt16LE(20, 6) // version needed
    cfh.writeUInt16LE(0, 8) // flags
    cfh.writeUInt16LE(0, 10) // method
    cfh.writeUInt16LE(dosTime, 12)
    cfh.writeUInt16LE(dosDate, 14)
    cfh.writeUInt32LE(crc, 16)
    cfh.writeUInt32LE(dataBuf.length, 20)
    cfh.writeUInt32LE(dataBuf.length, 24)
    cfh.writeUInt16LE(nameBuf.length, 28)
    cfh.writeUInt16LE(0, 30) // extra
    cfh.writeUInt16LE(0, 32) // comment
    cfh.writeUInt16LE(0, 34) // disk start
    cfh.writeUInt16LE(0, 36) // internal attrs
    cfh.writeUInt32LE(0, 38) // external attrs
    cfh.writeUInt32LE(offset, 42) // local header offset
    centralChunks.push(cfh, nameBuf)

    offset += 30 + nameBuf.length + dataBuf.length
  }

  const localPart = Buffer.concat(localChunks)
  const centralPart = Buffer.concat(centralChunks)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4) // disk number
  eocd.writeUInt16LE(0, 6) // disk with CD
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)
  eocd.writeUInt16LE(0, 20) // comment length

  return Buffer.concat([localPart, centralPart, eocd])
}

// ─── Resume content ────────────────────────────────────────────────────────
const resumePdf = buildPdf('HireMeBot Sample Resume', [
  'John Doe',
  'Software Engineer',
  'john.doe@example.com  |  +1 713 555 1234',
  '',
  'Experience',
  '  Recent Project — Student, HireMeBot sample content, 2026',
  '    - Built a mobile-first PWA for job application tracking.',
  '    - Delivered 820 applications in October 2026.',
  '',
  'Education',
  '  B.S. Computer Science, Sample University, 2026',
  '',
  'Skills',
  '  Java 21, Spring Boot, React, TypeScript, AWS Lambda, DynamoDB',
  '',
  'This is a HireMeBot sample document. Replace with the real resume.'
])

const coverLetterPdf = buildPdf('HireMeBot Sample Cover Letter', [
  'Dear Hiring Manager,',
  '',
  'I am writing to apply for the role at your company. This is a',
  'placeholder cover letter used by HireMeBot while the real backend',
  'document delivery is wired up.',
  '',
  'Thank you for your consideration.',
  '',
  'Sincerely,',
  'John Doe'
])

const coverLetterDocx = buildDocx([
  'HireMeBot Sample Cover Letter (DOCX)',
  '',
  'Dear Hiring Manager,',
  'I am writing to apply for the role at your company. This is a placeholder',
  'cover letter used by HireMeBot while the real backend document delivery is',
  'wired up.',
  '',
  'Sincerely,',
  'John Doe'
])

writeFileSync(resolve(OUT, 'sample-resume.pdf'), resumePdf)
writeFileSync(resolve(OUT, 'sample-cover-letter.pdf'), coverLetterPdf)
writeFileSync(resolve(OUT, 'sample-cover-letter.docx'), coverLetterDocx)

console.log(
  `wrote ${OUT}:\n  sample-resume.pdf (${resumePdf.length} B)\n  sample-cover-letter.pdf (${coverLetterPdf.length} B)\n  sample-cover-letter.docx (${coverLetterDocx.length} B)`
)
