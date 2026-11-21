/**
 * Minimaler ZIP-Leser (nur Node-Bordmittel, Workflows ohne `npm ci`) für das Log-Archiv eines Actions-Laufs
 * (`GET actions/runs/{id}/logs`): Zentralverzeichnis lesen, Einträge deflate-entpacken. Kein ZIP64, keine Verschlüsselung;
 * alles Unerwartete wirft, der Aufrufer fällt dann auf den Einzelabruf zurück.
 */
import zlib from 'node:zlib'

const EOCD = 0x06054b50
const ZENTRAL = 0x02014b50
const LOKAL = 0x04034b50

/** Alle Einträge eines ZIP als Map Name -> Buffer (Ordnereinträge entfallen). */
export function leseZip(puffer) {
  let ende = -1
  for (let i = puffer.length - 22; i >= Math.max(0, puffer.length - 22 - 0xffff); i--) {
    if (puffer.readUInt32LE(i) === EOCD) {
      ende = i
      break
    }
  }
  if (ende < 0) throw new Error('ZIP: Ende des Zentralverzeichnisses nicht gefunden')
  const anzahl = puffer.readUInt16LE(ende + 10)
  let pos = puffer.readUInt32LE(ende + 16)
  const aus = new Map()
  for (let n = 0; n < anzahl; n++) {
    if (puffer.readUInt32LE(pos) !== ZENTRAL) throw new Error('ZIP: Zentralverzeichnis beschädigt')
    const art = puffer.readUInt16LE(pos + 10)
    const gross = puffer.readUInt32LE(pos + 24)
    const nameLaenge = puffer.readUInt16LE(pos + 28)
    const extraLaenge = puffer.readUInt16LE(pos + 30)
    const kommentarLaenge = puffer.readUInt16LE(pos + 32)
    const lokal = puffer.readUInt32LE(pos + 42)
    const name = puffer.toString('utf8', pos + 46, pos + 46 + nameLaenge)
    const klein = puffer.readUInt32LE(pos + 20)
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge
    if (name.endsWith('/')) continue
    if (puffer.readUInt32LE(lokal) !== LOKAL) throw new Error(`ZIP: lokaler Kopf von ${name} beschädigt`)
    const start = lokal + 30 + puffer.readUInt16LE(lokal + 26) + puffer.readUInt16LE(lokal + 28)
    const roh = puffer.subarray(start, start + klein)
    if (art !== 0 && art !== 8) throw new Error(`ZIP: Verfahren ${art} bei ${name} nicht unterstützt`)
    const inhalt = art === 8 ? zlib.inflateRawSync(roh) : roh
    if (inhalt.length !== gross) throw new Error(`ZIP: Größe von ${name} stimmt nicht`)
    aus.set(name, inhalt)
  }
  return aus
}
