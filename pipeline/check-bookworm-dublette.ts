/**
 * Zusicherung: Ascendance of a Bookworm Staffel 5 steht nur einmal da (PR 856/861, Daniel 11.10.2026). Die aniSearch-Zeile 22017 (Titel 10022017)
 * ist in den AniList-Titel 217712 aufgegangen; ihre öffentliche Kennung 26256 leitet auf die des AniList-Titels (17943) um, sonst läuft
 * `/#/datenbank?t=26256` ins Leere. Hier läuft die Regel auf einer Kulisse im Temp-Ordner (Zeilen in der Form von `data/kennungen.json`);
 * dieselbe Prüfung gegen die echten Dateien und der gebaute Bestand: `check-bookworm-dublette-bestand.ts` (`check:bestand`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-bookworm-dublette.ts`
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruefeBookwormKennung } from './lib/bookworm-pruefung.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nBookworm Staffel 5: eine Zeile, alte Kennung leitet um (Kulisse):')
const wurzel = mkdtempSync(join(tmpdir(), 'bookworm-'))
try {
  const zeilen = [[17942, 217711, 22016], [17943, 217712, 22017], [22017, 10_013_822, 0], [26255, 10_022_016, 22016, 17942], [26256, 10_022_017, 22017, 17943]]
  writeFileSync(join(wurzel, 'kennungen.json'), JSON.stringify({ titel: zeilen }))
  writeFileSync(join(wurzel, 'hand.yaml'), '# Kopf\n216000: 22000\n217712: 22017\n218000: 22030\n')
  pruefeBookwormKennung(pruefe, join(wurzel, 'kennungen.json'), join(wurzel, 'hand.yaml'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
