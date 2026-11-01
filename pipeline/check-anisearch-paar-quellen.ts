/**
 * Zusicherung: `ladeQuellen` (Bauphase 01) reicht aniSearch-Seiten, die von Hand als falsch verworfen sind (`data/anisearch-mal-verworfen.json`), nicht an die
 * späteren Phasen weiter: Handlung, Folgenzahl und Anbieter der falschen Seite landeten sonst beim Titel (Voidoll irregular ↔ #Compass). Läuft gegen eine
 * Wegwerf-Wurzel (`AK_ROOT`); Teil von `check-anisearch-paar-widerspruch.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-paar-quellen.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'paar-quellen-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data/curated'), { recursive: true })
mkdirSync(join(wurzel, 'data/cache'), { recursive: true })
writeFileSync(join(wurzel, 'data/cache/anilist-by-id.json'), JSON.stringify({ 900001: { id: 900001 } }))
/* Drei Titel: einer mit verworfener Seite, einer mit derselben Seite bei anderem Titel (bleibt), einer mit unverdächtiger Seite. */
writeFileSync(
  join(wurzel, 'data/anisearch.json'),
  JSON.stringify({ 900001: { anisearchId: 9_000_001 }, 900002: { anisearchId: 9_000_001 }, 900003: { anisearchId: 9_000_003 } }),
)
writeFileSync(join(wurzel, 'data/anisearch-mal-verworfen.json'), JSON.stringify({ 700001: { anisearch: 9_000_001, anilist: 900001, grund: 'Probe' } }))

try {
  const { ladeQuellen } = await import('./bau/01-quellen.ts')
  const q = ladeQuellen()
  const ids = Object.keys(q.anisearch).sort()
  pruefe('verworfene Seite des einen Titels fällt weg, dieselbe Seite bei einem anderen Titel und andere Seiten bleiben', ids.join() === '900002,900003', ids)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK — 1 Fall')
