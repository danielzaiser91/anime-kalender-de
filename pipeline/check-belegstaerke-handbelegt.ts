/**
 * Zusicherung zu `ladeBelegsignale().handbelegt` gegen eine Kulisse (`AK_ROOT`) mit erfundenen Kennungen ab 900001, nie gegen die echten Dateien:
 * nur ein Handbeleg mit `dub: true` ohne `nichtImBestand` zählt. Anlass: Prüfer zu PR 1717 (21.10.2026), die Mutation `!c.nichtImBestand` → `true` überlebte.
 * Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const JA = 900001
const JA_NICHT_IM_BESTAND = 900002
const NEIN = 900003
const NEIN_NICHT_IM_BESTAND = 900004
const eintrag = (id: number, dub: boolean, rest = '') =>
  `- anilistId: ${id}\n  title: "Kulisse ${id}"\n  platform: netflix\n  dub: ${dub}\n  checkedAt: '2026-10-13'\n  note: "Kulisse."\n${rest}`

const kulisse = mkdtempSync(join(tmpdir(), 'belegstaerke-handbelegt-'))
process.env.AK_ROOT = kulisse
mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
writeFileSync(join(kulisse, 'data/synchron-forum-treffer.yaml'), '# leer\n')
writeFileSync(
  join(kulisse, 'data/dub-confirmed.yaml'),
  [
    eintrag(JA, true),
    eintrag(JA_NICHT_IM_BESTAND, true, '  nichtImBestand: true\n'),
    eintrag(NEIN, false),
    eintrag(NEIN_NICHT_IM_BESTAND, false, '  nichtImBestand: true\n'),
  ].join(''),
)

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

try {
  const { ladeBelegsignale } = await import('./lib/belegstaerke.ts')
  console.log('\nBelegstärke: Filter der Handbelege gegen die Kulisse')
  const handbelegt = ladeBelegsignale([]).handbelegt
  const gefunden = [...handbelegt]
  pruefe('Handbeleg mit dub:true zählt', handbelegt.has(JA), gefunden)
  pruefe('dub:true mit nichtImBestand zählt nicht', !handbelegt.has(JA_NICHT_IM_BESTAND), gefunden)
  pruefe('dub:false zählt nicht', !handbelegt.has(NEIN), gefunden)
  pruefe('dub:false mit nichtImBestand zählt nicht', !handbelegt.has(NEIN_NICHT_IM_BESTAND), gefunden)
  pruefe('genau ein Titel in der Kulisse', handbelegt.size === 1, gefunden)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nBelegstärke (Handbelege): alle Zusicherungen halten.')
