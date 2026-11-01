/**
 * Wächter: Kein Leser in `pipeline/` liest `data/anisearch.json`, `data/anisearch-mal.json` oder `data/anisearch-ids-katalog.json` roh, ohne die Streichliste
 * `data/anisearch-mal-verworfen.json` anzuwenden (Prüfer 2614 R1: drei umgestellte Leser und der Katalogabgleich waren ungedeckt). Die Ausnahmen sind Sammler und
 * Werkzeuge, die den Abruf selbst fortschreiben oder auswerten; ein Eintrag ohne Treffer ist veraltet und rot.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-rohleser.ts`
 */
import { readdirSync, readFileSync } from 'node:fs'
import { rohLeser } from './lib/anisearch-rohleser.ts'

/** Sammler und Werkzeuge: Abruf-Material, kein Bau-Ergebnis. */
const SAMMLER = new Set([
  'pipeline/extract-disc-ausgaben.ts',
  'pipeline/extract-disc-dates.ts',
  'pipeline/fetch-anisearch-artikel.ts',
  'pipeline/fetch-anisearch-eintraege.ts',
  'pipeline/fetch-anisearch-folgen.ts',
  'pipeline/fetch-anisearch-katalog-abgleich.ts',
  'pipeline/fetch-anisearch-slugs.ts',
  'pipeline/fetch-anisearch-sprecher.ts',
  'pipeline/fetch-anisearch-zuordnung.ts',
  'pipeline/fetch-anisearch.ts',
  'pipeline/fetch-crunchyroll-offene.ts',
  'pipeline/fetch-folgen-zuordnung.ts',
  'pipeline/fetch-offizielle-news.ts',
  'pipeline/fetch-rohfolgen.ts',
  'pipeline/reparse-anisearch.ts',
  'pipeline/report-dub-checks.ts',
])

const dateien = (ordner: string): string[] =>
  readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? dateien(`${ordner}/${e.name}`) : e.name.endsWith('.ts') && !/^check-|\.test\./.test(e.name) ? [`${ordner}/${e.name}`] : [],
  )

const verstoesse: string[] = []
const genutzt = new Set<string>()
for (const datei of dateien('pipeline')) {
  const zeilen = rohLeser(readFileSync(datei, 'utf8'))
  if (!zeilen.length) continue
  if (SAMMLER.has(datei)) genutzt.add(datei)
  else verstoesse.push(`${datei}:${zeilen.join(',')}`)
}
const veraltet = [...SAMMLER].filter((d) => !genutzt.has(d))
for (const v of verstoesse) console.error(`  ✖ roher Leser ohne Streichliste (ladeAnisearchAbruf/-Mal/-Katalog nehmen): ${v}`)
for (const d of veraltet) console.error(`  ✖ Ausnahme ohne Treffer, streichen: ${d}`)
console.log(`aniSearch-Rohleser: ${genutzt.size} Sammler-Ausnahmen, ${verstoesse.length} rohe Leser im Bau`)
if (verstoesse.length || veraltet.length) process.exit(1)
