/**
 * Zusicherung zu `check-anisearch-rohleser.ts` und zur Streichliste (Prüfer 2614 R1, A1–A3): (1) der Syntaxbaum-Leser `rohLeser` meldet rohe Leser der drei
 * Zuordnungsdateien und lässt gefilterte durch; (2) der Katalogabgleich ordnet ein verworfenes MAL-Paar nicht zu, `anisearchKatalogPaare()` und
 * `baueFesteKennungen` binden keine verworfene Seite. Läuft gegen eine Wegwerf-Wurzel (`AK_ROOT`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-paar-katalog.ts`
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rohLeser } from './lib/anisearch-rohleser.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lesen = (datei: string, kopf = 'const x = (): unknown => '): number[] => rohLeser(`${kopf}readJson('${datei}', {})`)
for (const d of ['anisearch', 'anisearch-mal', 'anisearch-ids-katalog']) {
  pruefe(`Scanner: roher Leser von ${d}.json wird gemeldet`, lesen(`data/${d}.json`).join() === '1')
}
pruefe('Scanner: Vorlagen-Zeichenkette ohne Platzhalter wird gemeldet', rohLeser('const x = readJson(`data/anisearch.json`, {})').join() === '1')
pruefe('Scanner: andere Datei bleibt frei', lesen(['data', 'anisearch-folgen.json'].join('/')).length === 0)
pruefe('Scanner: Kommentar zählt nicht', rohLeser('// data/anisearch.json\nconst y = 1').length === 0)
pruefe('Scanner: unmittelbar umhüllt von ohneVerworfeneSeiten bleibt frei', rohLeser("const x = ohneVerworfeneSeiten(readJson('data/anisearch.json', {}), v)").length === 0)
pruefe('Scanner: Funktion, die ladeVerworfene aufruft, bleibt frei', rohLeser("function f() { const v = ladeVerworfene(); return readJson('data/anisearch-mal.json', {}) }").length === 0)
pruefe('Scanner: Filter in einer anderen Funktion schützt nicht', rohLeser("function a() { ladeVerworfene() }\nfunction b() { return readJson('data/anisearch.json', {}) }").join() === '2')
pruefe('Scanner: Filter auf Dateiebene schützt keinen Leser in einer Funktion', rohLeser("ladeVerworfene()\nconst b = () => readJson('data/anisearch.json', {})").join() === '2')

const wurzel = mkdtempSync(join(tmpdir(), 'paar-katalog-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data/curated'), { recursive: true })
mkdirSync(join(wurzel, 'data/cache'), { recursive: true })
/* Das verworfene Paar steht in Brücke und Katalog; das unverdächtige Paar daneben bleibt. */
writeFileSync(join(wurzel, 'data/anisearch-mal.json'), JSON.stringify({ 700001: 9_000_001, 700002: 9_000_002 }))
writeFileSync(join(wurzel, 'data/anisearch-ids-katalog.json'), JSON.stringify({ 900001: 9_000_001, 900002: 9_000_002 }))
writeFileSync(join(wurzel, 'data/anisearch-mal-verworfen.json'), JSON.stringify({ 700001: { anisearch: 9_000_001, anilist: 900001, grund: 'Probe' } }))
writeFileSync(join(wurzel, 'data/anisearch-ids-hand.yaml'), '')
writeFileSync(join(wurzel, 'data/kino-ankuendigungen.yaml'), '[]\n')

try {
  const { malZuAnisearch } = await import('./fetch-anisearch-katalog-abgleich.ts')
  const mal = [...malZuAnisearch({})]
  pruefe('Katalogabgleich (malZuAnisearch): das verworfene MAL-Paar wird nicht zugeordnet, das andere bleibt', JSON.stringify(mal) === '[[700002,[9000002]]]', mal)

  const { anisearchKatalogPaare } = await import('./lib/anisearch-katalog-ids.ts')
  const paare = anisearchKatalogPaare()
  pruefe('Katalogpaare (anisearchKatalogPaare): die verworfene Seite des Titels fehlt, das andere Paar bleibt', JSON.stringify(paare) === '[[900002,9000002]]', paare)

  const { baueFesteKennungen } = await import('./bau/anisearch-kennung.ts')
  const fest = [...baueFesteKennungen()]
  pruefe('Feste Kennungen (baueFesteKennungen): keine Bindung über den Katalog an die verworfene Seite', JSON.stringify(fest) === '[[900002,9000002]]', fest)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nOK — ${faelle} Fälle`)
