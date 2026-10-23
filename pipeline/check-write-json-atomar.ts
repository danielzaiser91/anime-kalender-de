/**
 * Zusicherung: `writeJson` schreibt atomar (tmp-Datei, dann rename). Ein Fehler vor oder beim rename
 * lässt die alte Datei unverändert und hinterlässt keine tmp-Datei; die Bytes entsprechen dem alten Format.
 * Läuft in `check:logic`.
 */
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeJson } from './lib/util.ts'

let fehler = 0
function pruefe(name: string, ok: boolean): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`)
}

function wirft(f: () => void): boolean {
  try {
    f()
  } catch {
    return true
  }
  return false
}

const ordner = mkdtempSync(join(tmpdir(), 'write-json-atomar-'))
try {
  const daten = { a: [1, 2], b: 'ä' }
  const kompakt = join(ordner, 'neu', 'kompakt.json')
  writeJson(kompakt, daten)
  pruefe('Bytes kompakt wie JSON.stringify, ohne Zeilenumbruch am Ende', readFileSync(kompakt, 'utf8') === '{"a":[1,2],"b":"ä"}')
  const schoen = join(ordner, 'schoen.json')
  writeJson(schoen, daten, true)
  pruefe('Bytes pretty wie JSON.stringify(…, null, 2)', readFileSync(schoen, 'utf8') === JSON.stringify(daten, null, 2))
  writeJson(schoen, { c: 1 }, true)
  pruefe('Überschreiben ersetzt den Inhalt', readFileSync(schoen, 'utf8') === JSON.stringify({ c: 1 }, null, 2))
  pruefe('Nach Erfolg bleibt keine tmp-Datei', readdirSync(ordner).every((n) => !n.endsWith('.tmp')))

  const alt = join(ordner, 'alt.json')
  writeFileSync(alt, '{"alt":1}')
  const zirkel: Record<string, unknown> = {}
  zirkel.selbst = zirkel
  pruefe('Nicht serialisierbar wirft', wirft(() => writeJson(alt, zirkel)))
  pruefe('Fehler vor dem Schreiben: alte Datei unverändert', readFileSync(alt, 'utf8') === '{"alt":1}')
  pruefe('Fehler vor dem Schreiben: keine tmp-Datei', readdirSync(ordner).every((n) => !n.endsWith('.tmp')))

  // Abbruch zwischen tmp-Schreiben und rename: rename wird durch eine werfende Attrappe ersetzt
  const abbruch = join(ordner, 'abbruch.json')
  writeFileSync(abbruch, '{"alt":2}')
  const fs = createRequire(import.meta.url)('node:fs')
  const echt = fs.renameSync
  const gesehen: string[][] = []
  fs.renameSync = (von: string, nach: string) => {
    gesehen.push([von, nach, readFileSync(von, 'utf8')])
    throw new Error('Abbruch')
  }
  syncBuiltinESMExports()
  try {
    pruefe('Abbruch vor rename wirft', wirft(() => writeJson(abbruch, daten)))
  } finally {
    fs.renameSync = echt
    syncBuiltinESMExports()
  }
  pruefe('Abbruch: rename sah eine volle tmp-Datei im selben Ordner', gesehen.length === 1 && gesehen[0][0] !== abbruch && dirname(gesehen[0][0]) === ordner && gesehen[0][1] === abbruch && gesehen[0][2] === JSON.stringify(daten))
  pruefe('Abbruch: alte Datei unverändert', readFileSync(abbruch, 'utf8') === '{"alt":2}')
  pruefe('Abbruch: tmp-Datei entfernt', readdirSync(ordner).every((n) => !n.endsWith('.tmp')))
  writeJson(abbruch, daten)
  writeJson(abbruch, daten)
  pruefe('Zwei Läufe hintereinander schreiben den Inhalt', readFileSync(abbruch, 'utf8') === JSON.stringify(daten))

  // rename scheitert, wenn das Ziel ein nicht leerer Ordner ist: tmp ist dann schon geschrieben
  const ziel = join(ordner, 'ziel.json')
  mkdirSync(ziel)
  writeFileSync(join(ziel, 'inhalt'), 'x')
  pruefe('Fehler beim rename wirft', wirft(() => writeJson(ziel, daten)))
  pruefe('Fehler beim rename: tmp-Datei entfernt', readdirSync(ordner).every((n) => !n.endsWith('.tmp')))
  pruefe('Fehler beim rename: Ziel unverändert', readFileSync(join(ziel, 'inhalt'), 'utf8') === 'x')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler > 0) {
  console.error(`check-write-json-atomar: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-write-json-atomar: 15 Zusicherungen ok')
