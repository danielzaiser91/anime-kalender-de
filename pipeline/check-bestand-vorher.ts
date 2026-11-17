/**
 * Zusicherungen zu `pipeline/lib/bestand-vorher.ts` an einer Kulisse (`AK_ROOT`, Temp-Ordner — nie der echte Bestand): vor dem Merken
 * leer, danach Haupt- und Schalter-Datei hintereinander (auch als Objekt nach Kennung), fehlende Datei leer; spätere Änderungen der
 * Datei ändern den gemerkten Stand erst beim nächsten Merken. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const kulisse = mkdtempSync(join(tmpdir(), 'bestand-vorher-'))
process.env.AK_ROOT = kulisse
const daten = join(kulisse, 'public/data')
mkdirSync(daten, { recursive: true })

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

try {
  const { bestandVorher, merkeBestandVorher } = await import('./lib/bestand-vorher.ts')
  const ids = () => bestandVorher().map((t) => t.id)

  writeFileSync(join(daten, 'titles.json'), JSON.stringify([{ id: 1 }, { id: 2 }]))
  pruefe('vor dem Merken leer (Prüfskripte)', ids(), [])

  merkeBestandVorher()
  pruefe('ohne Schalter-Datei: nur Hauptbestand', ids(), [1, 2])

  writeFileSync(join(daten, 'ohne-synchro.json'), JSON.stringify({ '9': { id: 9 }, '8': { id: 8 } }))
  pruefe('Datei geändert, nicht neu gemerkt: alter Stand', ids(), [1, 2])

  merkeBestandVorher()
  pruefe('Haupt vor Schalter, Objekt nach Kennung als Liste', ids(), [1, 2, 8, 9])

  rmSync(join(daten, 'titles.json'))
  merkeBestandVorher()
  pruefe('fehlender Hauptbestand: nur Schalter-Datei', ids(), [8, 9])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-bestand-vorher: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-bestand-vorher: alle Zusicherungen grün')
