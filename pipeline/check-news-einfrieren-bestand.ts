/**
 * Bestandsprüfung (20.10.2026): Jede Terminmeldung in `public/data/news.json` trägt das `weiterer`, das `data/news-historie.json`
 * für sie festhält — kein Weg darf es später neu ableiten (`lib/news-einfrieren.ts`). Fehlt der Eintrag, warnt die Prüfung nur.
 * Liest den gebauten Bestand, deshalb in `check:bestand` (`tools/check-bestand-liste.txt`).
 */
import { pathToFileURL } from 'node:url'
import { readJson } from './lib/util.ts'
import type { NewsEintrag } from '../shared/news-typen.ts'
import type { NewsHistorie } from './lib/news.ts'
import { einfrierFehler } from './lib/news-einfrieren.ts'

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const eintraege = readJson<NewsEintrag[]>('public/data/news.json', [])
  const historie = readJson<NewsHistorie>('data/news-historie.json', { zuerst: {} })
  const { fehler, luecken } = einfrierFehler(eintraege, historie)
  for (const l of luecken) console.warn(`WARNUNG: weiterer nicht festgehalten: ${l}`)
  for (const f of fehler) console.error(`FEHLER: ${f}`)
  console.log(`check-news-einfrieren-bestand: ${eintraege.length} Einträge, ${luecken.length} ohne Eintrag, ${fehler.length} Fehler`)
  process.exit(fehler.length ? 1 : 0)
}
