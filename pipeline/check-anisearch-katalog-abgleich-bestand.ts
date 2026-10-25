/**
 * Bestandsteil von `check-anisearch-katalog-abgleich.ts`: die geschriebene Zuordnung `data/anisearch-ids-katalog.json` gegen Handdatei und aniSearch-Brücke `data/anisearch.json` (vom Sammellauf erneuert).
 * Liest vom Sammellauf erneuerte Rohdaten und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-anisearch-katalog-abgleich.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Title } from '../shared/types.ts'
import { ergaenzeAnisearchTitel } from './bau/anisearch-titel.ts'
import { anderweitigVergeben } from './lib/anisearch-katalog-abgleich.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

if (existsSync('data/anisearch-ids-katalog.json')) {
  const datei = JSON.parse(readFileSync('data/anisearch-ids-katalog.json', 'utf8')) as Record<string, number>
  const eintraege = Object.entries(datei)
  const hand = new Set([...readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^(\d+):/gm)].map((m) => m[1]))
  pruefe('Datei: jede aniSearch-Kennung höchstens einmal', new Set(Object.values(datei)).size === eintraege.length)
  pruefe('Datei: nur AniList-Kennungen, keine eigene aniSearch-Zeile', eintraege.every(([al]) => Number(al) < 10_000_000))
  pruefe('Datei: nichts, was die Handdatei schon bindet', eintraege.every(([al]) => !hand.has(al)))
}

/* Eingehängt (11.10.2026): 66 sichere Treffer des Abgleichs und 30 von Hand gesichtete, dazu 13 geklärte Paare der Prüfliste (Merkmale Tag, Länge, Namensteil) und Fairy Tail OVA (Teilung); der Bau liest sie wie die Handdatei. */
const KATALOG_EINGEHAENGT = 110
const geprueft = JSON.parse(readFileSync('data/anisearch-katalog-kein-treffer.json', 'utf8')) as Record<string, number[]>
const gebunden = JSON.parse(readFileSync('data/anisearch-ids-katalog.json', 'utf8')) as Record<string, number>
const bruecke = JSON.parse(readFileSync('data/anisearch.json', 'utf8')) as Record<string, { anisearchId?: number }>
const handKennungen = [...readFileSync('data/anisearch-ids-hand.yaml', 'utf8').matchAll(/^\d+:\s*(\d+)/gm)].map((m) => Number(m[1]))
pruefe(`Katalog: mindestens ${KATALOG_EINGEHAENGT} Titel mit aniSearch-Kennung eingehängt`, Object.keys(gebunden).length >= KATALOG_EINGEHAENGT, String(Object.keys(gebunden).length))
const schonVergeben = anderweitigVergeben(gebunden, bruecke, handKennungen)
pruefe('Katalog: keine aniSearch-Kennung doppelt vergeben, auch nicht an Handdatei oder einen anderen Titel der Brücke', new Set(Object.values(gebunden)).size === Object.keys(gebunden).length && Object.values(gebunden).every((as) => !schonVergeben.has(as)))
pruefe('Katalog: ein gesichtetes „kein Treffer" ist nie zugleich gebunden', Object.entries(geprueft).every(([al, as]) => !as.includes(gebunden[al] ?? -1)))
pruefe('Katalog: „kein Treffer" nennt nur AniList-Titel ohne Kennung und ganze aniSearch-Kennungen', Object.entries(geprueft).every(([al, as]) => !(al in gebunden) && Number(al) < 10_000_000 && as.length > 0 && as.every(Number.isInteger)))

/* Keine Dublette: steht der AniList-Titel im Bestand, entfällt die aniSearch-Zeile mit derselben Kennung (Bau: `ergaenzeAnisearchTitel`). */
const mitAnilist = new Map<number, Title>(Object.keys(gebunden).map((al) => [Number(al), { id: Number(al), streams: [] } as unknown as Title]))
ergaenzeAnisearchTitel(mitAnilist, new Map(), new Map())
const bleibt = Object.values(gebunden).filter((as) => mitAnilist.has(10_000_000 + as))
pruefe('Katalog: keine Dublette — zu jeder eingehängten Kennung bleibt keine eigene aniSearch-Zeile neben dem AniList-Titel', bleibt.length === 0, bleibt.join(','))

if (fehler) {
  console.error(`${fehler} Fehler`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('check-anisearch-katalog-abgleich-bestand: ok')
console.log('VERSTÖSSE: 0')
