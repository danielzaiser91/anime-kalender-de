// Baut ein kleines ZIP (deflate) aus { name: text } für die Tests von tools/zip-lesen.mjs und tools/pr-kettenlog.mjs.
import zlib from 'node:zlib'

export function baueZip(eintraege) {
  const lokale = []
  const zentrale = []
  let versatz = 0
  for (const [name, text] of Object.entries(eintraege)) {
    const n = Buffer.from(name, 'utf8')
    const roh = Buffer.from(text, 'utf8')
    const packed = zlib.deflateRawSync(roh)
    const lokal = Buffer.alloc(30)
    lokal.writeUInt32LE(0x04034b50, 0)
    lokal.writeUInt16LE(8, 8)
    lokal.writeUInt32LE(packed.length, 18)
    lokal.writeUInt32LE(roh.length, 22)
    lokal.writeUInt16LE(n.length, 26)
    const zentral = Buffer.alloc(46)
    zentral.writeUInt32LE(0x02014b50, 0)
    zentral.writeUInt16LE(8, 10)
    zentral.writeUInt32LE(packed.length, 20)
    zentral.writeUInt32LE(roh.length, 24)
    zentral.writeUInt16LE(n.length, 28)
    zentral.writeUInt32LE(versatz, 42)
    lokale.push(lokal, n, packed)
    zentrale.push(zentral, n)
    versatz += 30 + n.length + packed.length
  }
  const verzeichnis = Buffer.concat(zentrale)
  const ende = Buffer.alloc(22)
  ende.writeUInt32LE(0x06054b50, 0)
  ende.writeUInt16LE(Object.keys(eintraege).length, 10)
  ende.writeUInt32LE(verzeichnis.length, 12)
  ende.writeUInt32LE(versatz, 16)
  return Buffer.concat([...lokale, verzeichnis, ende])
}
