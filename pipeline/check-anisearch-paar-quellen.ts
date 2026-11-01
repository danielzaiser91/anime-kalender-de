/**
 * Zusicherung: `ladeQuellen` (Bauphase 01) reicht aniSearch-Seiten, die von Hand als falsch verworfen sind (`data/anisearch-mal-verworfen.json`), nicht an die
 * späteren Phasen weiter: Handlung, Folgenzahl und Anbieter der falschen Seite landeten sonst beim Titel (Voidoll irregular ↔ #Compass). Läuft gegen eine
 * Wegwerf-Wurzel (`AK_ROOT`); Teil von `check-anisearch-paar-widerspruch.ts`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-paar-quellen.ts`
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
writeFileSync(join(wurzel, 'data/kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data/anisearch-mal-verworfen.json'), JSON.stringify({ 700001: { anisearch: 9_000_001, anilist: 900001, grund: 'Probe' } }))

try {
  const { ladeQuellen } = await import('./bau/01-quellen.ts')
  const q = ladeQuellen()
  const ids = Object.keys(q.anisearch).sort()
  pruefe('verworfene Seite des einen Titels fällt weg, dieselbe Seite bei einem anderen Titel und andere Seiten bleiben', ids.join() === '900002,900003', ids)

  /* Die übrigen Leser von `anisearch.json` im Bau: jeder sieht dieselbe Zuordnung ohne die verworfene Seite. */
  const { traegerJeSeite } = await import('./bau/anisearch-titel.ts')
  pruefe('Titelzuordnung (anisearch-titel): die Seite hat nur noch den einen Träger', JSON.stringify(traegerJeSeite().get(9_000_001)) === '[900002]', [...traegerJeSeite()])

  writeFileSync(
    join(wurzel, 'data/anisearch.json'),
    JSON.stringify({
      900001: { anisearchId: 9_000_001, info: { synonyms: ['Probe Staffel 2'], runtimeMinutes: 24 } },
      900002: { anisearchId: 9_000_001, info: { synonyms: ['Probe Staffel 3'], runtimeMinutes: 25 } },
    }),
  )
  const { staffelQuellenAusAnisearch } = await import('./bau/staffel-quelle.ts')
  const staffeln = [...staffelQuellenAusAnisearch()]
  pruefe('Staffelnummer (staffel-quelle): der Titel mit verworfener Seite bekommt keine, der andere seine', JSON.stringify(staffeln) === '[[900002,3]]', staffeln)

  const { mitLaufzeit } = await import('./lib/anisearch-felder.ts')
  const ohneLaufzeit = (id: number): { id: number; runtimeMin?: number } => ({ id })
  const laufzeiten = [mitLaufzeit(ohneLaufzeit(900_001)).runtimeMin, mitLaufzeit(ohneLaufzeit(900_002)).runtimeMin]
  pruefe('Laufzeit (anisearch-felder): die verworfene Seite liefert keine, die andere ihre', JSON.stringify(laufzeiten) === '[null,25]', laufzeiten)
  const { anisearchFelderAnwenden } = await import('./lib/anisearch-felder.ts')
  const titelKarten = new Map<number, { id: number; runtimeMin?: number }>([900_001, 900_002].map((id) => [id, { id }] as const))
  const meldung = anisearchFelderAnwenden(titelKarten as never)
  pruefe('Laufzeit in der Titelkarte (anisearch-felder): nur der Titel ohne Streichung bekommt sie', meldung.endsWith('1 mit Laufzeit aus aniSearch') && titelKarten.get(900_001)?.runtimeMin === undefined, meldung)

  writeFileSync(join(wurzel, 'data/anisearch-ids-hand.yaml'), '')
  const { anisearchBruecke } = await import('./lib/anisearch-katalog-ids.ts')
  const bruecke = [...anisearchBruecke()]
  pruefe('Brücke Titel → Seite (anisearch-katalog-ids): die verworfene Seite fehlt, die andere bleibt', JSON.stringify(bruecke) === '[["900002","9000001"]]', bruecke)

  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  writeFileSync(join(wurzel, 'data/folgen-hinweise.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data/anisearch-folgen.json'), JSON.stringify({ 9000001: { folgen: [{ nr: 1, de: 'Eins' }, { nr: 2, de: 'Zwei' }] } }))
  const { schreibeFolgenDateien } = await import('./bau/folgen-dateien.ts')
  const titelZeile = (id: number) => ({ id, episodes: 2, format: 'TV', streams: [] }) as never
  schreibeFolgenDateien([titelZeile(900_001), titelZeile(900_002)], [])
  const index = JSON.parse(readFileSync(join(wurzel, 'public/data/folgen/index.json'), 'utf8')) as number[]
  pruefe('Folgenlisten (folgen-dateien): die Seite zählt nur für den Titel ohne Streichung, der bekommt seine Liste', index.join() === '900002', index)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK — 8 Fälle')
