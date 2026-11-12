/**
 * Bestandsprüfung zur Quote der Folgentitel aus der TMDB-Containerstaffel, aufgerufen von `check-folgentitel-sprache-bestand.ts` (Tor `check:bestand`):
 * je Titel, dessen Folgentitel aus „TMDB-Staffel" stammen, eine Zeile mit Titeln/Folgen; eine `⚠ WARNUNG`, wenn weniger als die Hälfte der Folgen einen
 * Titel hat oder ein Titel doppelt vorkommt. Nur Warnung (Exit 0): die Zuordnung ist belegt über Name und Folgenzahl, ein Verdacht ist kein kaputter Eingang.
 * Fehler nur bei fehlender `titles.json`. Logik und Rückgabewerte: `folgentitel-staffel-quote.ts`. Test: `check-folgentitel-staffel-quote.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Title } from '../../shared/types.ts'
import type { TmdbEintrag } from '../bau/folgentitel-tmdb.ts'
import type { FolgenDatei } from './folgentitel-luecke.ts'
import { quoteGruende, staffelQuote, type StaffelQuote } from './folgentitel-staffel-quote.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

/** Die Titel mit Herkunft „TMDB-Staffel" samt Quote; `datei` liefert die gebaute Folgendatei eines Titels (oder undefined). */
export function staffelQuoten(titel: readonly Title[], tmdb: Record<string, TmdbEintrag>, datei: (id: number) => FolgenDatei | undefined): [Title, StaffelQuote][] {
  const treffer: [Title, StaffelQuote][] = []
  for (const t of titel) {
    const q = staffelQuote(t, tmdb[String(t.franchiseId)], datei(t.id))
    if (q) treffer.push([t, q])
  }
  return treffer
}

/** Ausgabezeilen: je Titel eine ✓-Zeile oder eine Warnzeile, am Ende die Summe. */
export function quoteZeilen(treffer: readonly [Title, StaffelQuote][]): string[] {
  const zeilen = treffer.map(([t, q]) => {
    const gruende = quoteGruende(q)
    const kopf = `Folgentitel TMDB-Staffel: ${t.id} (${t.titleDe}): ${q.titel} von ${q.folgen} Folgen mit Titel`
    return gruende.length ? `  ⚠ WARNUNG ${kopf}, ${gruende.join('; ')}` : `  ✓ ${kopf}`
  })
  zeilen.push(`  Folgentitel TMDB-Staffel: ${treffer.length} Titel, ${treffer.filter(([, q]) => quoteGruende(q).length).length} mit Warnung`)
  return zeilen
}

/** Gibt die Zahl der Fehler zurück (0 oder 1); Warnungen zählen nicht. */
export function pruefeStaffelQuote(wurzel: string): number {
  const pfad = join(wurzel, 'public', 'data', 'titles.json')
  if (!existsSync(pfad)) {
    console.error('FEHLER: public/data/titles.json fehlt — die Staffel-Quote misst nichts')
    return 1
  }
  const tmdb = lies<Record<string, TmdbEintrag>>(join(wurzel, 'data', 'tmdb-folgen.json'))
  const dateiPfad = (id: number): string => join(wurzel, 'public', 'data', 'folgen', `${id}.json`)
  const datei = (id: number): FolgenDatei | undefined => (existsSync(dateiPfad(id)) ? lies<FolgenDatei>(dateiPfad(id)) : undefined)
  const treffer = staffelQuoten(lies<Title[]>(pfad), tmdb, datei)
  for (const zeile of quoteZeilen(treffer)) console.log(zeile)
  if (!treffer.length) console.log('  ⚠ WARNUNG Folgentitel TMDB-Staffel: 0 Titel, die Prüfung misst nichts')
  return 0
}
