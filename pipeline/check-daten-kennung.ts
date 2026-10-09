import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { datenKennung } from '../tools/daten-kennung.ts'

/** Zusicherung: Jede Änderung an den Datendateien, auch ohne neues generatedAt, ändert die Kennung. */
const ordner = mkdtempSync(join(tmpdir(), 'kennung-'))
const schreibe = (name: string, inhalt: string) => writeFileSync(join(ordner, name), inhalt)
schreibe('meta.json', '{"generatedAt":"2026-10-09T10:00:00Z"}')
schreibe('events.json', '[]')
const vorher = datenKennung(ordner)
const fehler: string[] = []
if (datenKennung(ordner) !== vorher) fehler.push('Kennung nicht deterministisch')
schreibe('meta.json', '{"generatedAt":"2026-10-09T10:00:00Z","patchnotesStand":"x"}')
if (datenKennung(ordner) === vorher) fehler.push('Handänderung an meta.json ohne neues generatedAt ändert die Kennung nicht')
if (fehler.length) {
  console.error('✖ Daten-Kennung:', fehler.join('; '))
  process.exit(1)
}
console.log('  ✓ Daten-Kennung: deterministisch und von jeder Dateiänderung abhängig')
