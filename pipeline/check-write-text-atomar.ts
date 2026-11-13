/**
 * Zusicherung: `writeText` schreibt atomar (tmp-Datei, dann rename). Ein Abbruch vor dem rename
 * lässt die alte Datei unverändert und hinterlässt keine tmp-Datei; die Bytes entsprechen dem Text.
 * Läuft in `check:logic`.
 */
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { writeText } from './lib/util.ts'

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

const ordner = mkdtempSync(join(tmpdir(), 'write-text-atomar-'))
const keineTmp = () => readdirSync(ordner).every((n) => !n.endsWith('.tmp'))
try {
  const neu = join(ordner, 'neu', 'a.txt')
  writeText(neu, 'Zeile ä\nZwei')
  pruefe('Bytes wie der Text, Ordner wird angelegt', readFileSync(neu, 'utf8') === 'Zeile ä\nZwei')
  writeText(neu, 'anders')
  pruefe('Überschreiben ersetzt den Inhalt', readFileSync(neu, 'utf8') === 'anders')
  pruefe('Nach Erfolg bleibt keine tmp-Datei', readdirSync(dirname(neu)).every((n) => !n.endsWith('.tmp')))

  // Abbruch zwischen tmp-Schreiben und rename: rename wird durch eine werfende Attrappe ersetzt
  const abbruch = join(ordner, 'abbruch.txt')
  writeFileSync(abbruch, 'alt')
  const fs = createRequire(import.meta.url)('node:fs')
  const echt = fs.renameSync
  const gesehen: string[][] = []
  fs.renameSync = (von: string, nach: string) => {
    gesehen.push([von, nach, readFileSync(von, 'utf8')])
    throw new Error('Abbruch')
  }
  syncBuiltinESMExports()
  try {
    pruefe('Abbruch vor rename wirft', wirft(() => writeText(abbruch, 'neu')))
  } finally {
    fs.renameSync = echt
    syncBuiltinESMExports()
  }
  pruefe('Abbruch: rename sah die volle tmp-Datei im selben Ordner', gesehen.length === 1 && gesehen[0][0] !== abbruch && dirname(gesehen[0][0]) === ordner && gesehen[0][1] === abbruch && gesehen[0][2] === 'neu')
  pruefe('Abbruch: alte Datei unverändert', readFileSync(abbruch, 'utf8') === 'alt')
  pruefe('Abbruch: tmp-Datei entfernt', keineTmp())
  writeText(abbruch, 'x')
  writeText(abbruch, 'y')
  pruefe('Zwei Läufe hintereinander schreiben den Inhalt', readFileSync(abbruch, 'utf8') === 'y')

  // rename scheitert, wenn das Ziel ein nicht leerer Ordner ist: tmp ist dann schon geschrieben
  const ziel = join(ordner, 'ziel.txt')
  mkdirSync(ziel)
  writeFileSync(join(ziel, 'inhalt'), 'x')
  pruefe('Fehler beim rename wirft', wirft(() => writeText(ziel, 'neu')))
  pruefe('Fehler beim rename: tmp-Datei entfernt', keineTmp())
  pruefe('Fehler beim rename: Ziel unverändert', readFileSync(join(ziel, 'inhalt'), 'utf8') === 'x')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

if (fehler > 0) {
  console.error(`check-write-text-atomar: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-write-text-atomar: 10 Zusicherungen ok')
