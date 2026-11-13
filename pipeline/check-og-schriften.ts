/**
 * Zusicherungen zu `woffZuTtf()` und `pangoFamilie()` aus `lib/og-schriften.ts` an einer selbst gebauten WOFF-Datei: Kopf (Flavor,
 * Tabellenzahl, searchRange/entrySelector/rangeShift), Tabellen nach Tag sortiert (ASCII, „OS/2“ vor Kleinbuchstaben), gepackte Tabellen
 * entpackt, Prüfsummen übernommen, Versatz und Auffüllen auf 4 Byte, neue `name`-Tabelle nur mit Familie. `schriftDatei()` schreibt in
 * den Cache und bleibt ungetestet. Läuft in `check:logic`.
 */
import { deflateSync } from 'node:zlib'
import { pangoFamilie, woffZuTtf } from './lib/og-schriften.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

type Tabelle = { tag: string; daten: Buffer; pruef: number; packen: boolean }

/** Eine WOFF 1.0 aus Tabellen in gegebener Reihenfolge; gepackt wird wie im Format nur, was dadurch kürzer wird. */
function baueWoff(tabellen: Tabelle[], flavor = 0x00010000): Buffer {
  const kopf = Buffer.alloc(44 + 20 * tabellen.length)
  kopf.write('wOFF', 0, 'ascii')
  kopf.writeUInt32BE(flavor, 4)
  kopf.writeUInt16BE(tabellen.length, 12)
  const teile: Buffer[] = [kopf]
  let pos = kopf.length
  tabellen.forEach((t, i) => {
    const gepackt = deflateSync(t.daten)
    const roh = t.packen && gepackt.length < t.daten.length ? gepackt : t.daten
    const o = 44 + i * 20
    kopf.write(t.tag, o, 'ascii')
    kopf.writeUInt32BE(pos, o + 4)
    kopf.writeUInt32BE(roh.length, o + 8)
    kopf.writeUInt32BE(t.daten.length, o + 12)
    kopf.writeUInt32BE(t.pruef, o + 16)
    teile.push(roh)
    pos += roh.length
  })
  return Buffer.concat(teile)
}

/** Das Tabellenverzeichnis einer SFNT lesen und die Tabellen herausschneiden. */
function leseSfnt(s: Buffer) {
  const anzahl = s.readUInt16BE(4)
  return {
    flavor: s.readUInt32BE(0),
    anzahl,
    suchbereich: [s.readUInt16BE(6), s.readUInt16BE(8), s.readUInt16BE(10)],
    tabellen: Array.from({ length: anzahl }, (_, i) => {
      const o = 12 + i * 16
      const versatz = s.readUInt32BE(o + 8)
      const laenge = s.readUInt32BE(o + 12)
      return { tag: s.toString('ascii', o, o + 4), pruef: s.readUInt32BE(o + 4), versatz, laenge, daten: s.subarray(versatz, versatz + laenge).toString('latin1') }
    }),
  }
}

const quelle: Tabelle[] = [
  // Zu kurz zum Packen: bleibt roh, obwohl `packen` gesetzt ist (im Verzeichnis: gespeicherte Länge = entpackte Länge heißt roh).
  { tag: 'name', daten: Buffer.from('ALTER-NAME'), pruef: 0x11111111, packen: true },
  { tag: 'head', daten: Buffer.from('KOPF1234'), pruef: 0x22222222, packen: false },
  { tag: 'OS/2', daten: Buffer.from('os2'), pruef: 0x33333333, packen: false },
  { tag: 'cmap', daten: Buffer.from('ZEICHENTABELLE-GEPACKT-'.repeat(4)), pruef: 0x44444444, packen: true },
]
const ttf = woffZuTtf(baueWoff(quelle, 0x4f54544f))
const sfnt = leseSfnt(ttf)

pruefe('Flavor übernommen', sfnt.flavor, 0x4f54544f)
pruefe('Tabellenzahl', sfnt.anzahl, 4)
pruefe('searchRange/entrySelector/rangeShift bei 4 Tabellen', sfnt.suchbereich, [64, 2, 0])
pruefe('Reihenfolge nach Tag (ASCII)', sfnt.tabellen.map((t) => t.tag), ['OS/2', 'cmap', 'head', 'name'])
pruefe('Prüfsummen bleiben beim Tag', sfnt.tabellen.map((t) => t.pruef.toString(16)), ['33333333', '44444444', '22222222', '11111111'])
pruefe('Inhalte entpackt', sfnt.tabellen.map((t) => t.daten), ['os2', 'ZEICHENTABELLE-GEPACKT-'.repeat(4), 'KOPF1234', 'ALTER-NAME'])
pruefe('Länge ohne Auffüllung', sfnt.tabellen.map((t) => t.laenge), [3, 92, 8, 10])
pruefe('erste Tabelle direkt nach dem Verzeichnis', sfnt.tabellen[0]!.versatz, 12 + 16 * 4)
pruefe('Versätze auf 4 Byte ausgerichtet', sfnt.tabellen.map((t) => t.versatz % 4), [0, 0, 0, 0])
pruefe('Versätze lückenlos', sfnt.tabellen.map((t) => t.versatz), [76, 80, 172, 180])
pruefe('Gesamtlänge mit Auffüllung der letzten Tabelle', ttf.length, 180 + 12)
pruefe('Auffüllung mit Nullen', [...ttf.subarray(79, 80), ...ttf.subarray(190, 192)], [0, 0, 0])

// Tabellenzahl, die keine Zweierpotenz ist: searchRange aus der nächstkleineren Potenz.
const drei = leseSfnt(woffZuTtf(baueWoff(quelle.slice(1))))
pruefe('searchRange/entrySelector/rangeShift bei 3 Tabellen', drei.suchbereich, [32, 1, 16])
pruefe('Flavor TrueType', drei.flavor, 0x00010000)
const eine = leseSfnt(woffZuTtf(baueWoff([quelle[1]!])))
pruefe('searchRange/entrySelector/rangeShift bei 1 Tabelle', eine.suchbereich, [16, 0, 0])

// Mit Familie wird die name-Tabelle ersetzt: Format 0, vier Einträge (Familie, Stil, voller und PostScript-Name), Windows/Unicode/en-US, UTF-16BE.
const neu = leseSfnt(woffZuTtf(baueWoff(quelle), 'AKfett')).tabellen.find((t) => t.tag === 'name')!
const n = Buffer.from(neu.daten, 'latin1')
const eintraege = Array.from({ length: n.readUInt16BE(2) }, (_, i) => {
  const o = 6 + i * 12
  const start = n.readUInt16BE(4) + n.readUInt16BE(o + 10)
  return [n.readUInt16BE(o), n.readUInt16BE(o + 2), n.readUInt16BE(o + 4), n.readUInt16BE(o + 6), Buffer.from(n.subarray(start, start + n.readUInt16BE(o + 8))).swap16().toString('utf16le')]
})
pruefe('name: Format 0', n.readUInt16BE(0), 0)
pruefe('name: Speicherbeginn nach den Einträgen', n.readUInt16BE(4), 6 + 12 * 4)
pruefe('name: Einträge', eintraege, [
  [3, 1, 0x409, 1, 'AKfett'],
  [3, 1, 0x409, 2, 'Regular'],
  [3, 1, 0x409, 4, 'AKfett'],
  [3, 1, 0x409, 6, 'AKfett'],
])
pruefe('name: Länge', neu.laenge, 54 + 2 * ('AKfett'.length * 3 + 'Regular'.length))
pruefe('Familie lässt andere Tabellen stehen', leseSfnt(woffZuTtf(baueWoff(quelle), 'AKfett')).tabellen.filter((t) => t.tag !== 'name').map((t) => t.daten), ['os2', 'ZEICHENTABELLE-GEPACKT-'.repeat(4), 'KOPF1234'])
pruefe('leerer Familienname ersetzt nichts', leseSfnt(woffZuTtf(baueWoff(quelle), '')).tabellen.find((t) => t.tag === 'name')!.daten, 'ALTER-NAME')

// Keine WOFF 1.0: Fehler statt stiller Ausgabe (WOFF2 beginnt mit „wOF2“).
const wirft = (b: Buffer) => {
  try {
    woffZuTtf(b)
    return 'kein Fehler'
  } catch (e) {
    return (e as Error).message
  }
}
pruefe('WOFF2 abgelehnt', wirft(Buffer.from('wOF2\0\0\0\0\0\0\0\0\0\0')), 'keine WOFF-1.0-Datei')
pruefe('TTF abgelehnt', wirft(ttf), 'keine WOFF-1.0-Datei')

pruefe('pangoFamilie', [pangoFamilie('fett'), pangoFamilie('halbfett'), pangoFamilie('titel')], ['AKfett', 'AKhalbfett', 'AKtitel'])

if (fehler) {
  console.error(`check-og-schriften: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-og-schriften: ok')
