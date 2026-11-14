/**
 * Zusicherungen zu `web/src/lib/suchhinweis-namen.ts`: der Name eines gesetzten Filters, wie der Suchhinweis ihn zeigt
 * (Liste, Ausschluss, Schalter, Vertrauen; Plattform- und Genre-Namen). Läuft in `check:logic`.
 */
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import type { Einheit } from '../web/src/lib/suchhinweis-filter.ts'
import { einheitName } from '../web/src/lib/suchhinweis-namen.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const einheit = (art: Einheit['art'], feld: string) => ({ id: `${art}:${feld}`, art, feld, entferne: (f: FilterState) => f }) as unknown as Einheit
const genre = (g: string) => `G:${g}`
const f = {
  ...EMPTY_FILTERS,
  years: [2003, 2004],
  platforms: ['crunchyroll', 'gibtsnicht'],
  genres: ['Action'],
  land: ['JP'],
  excluded: { ...EMPTY_FILTERS.excluded, genres: ['Horror'], platforms: ['netflix'], keywords: ['Isekai'] },
} as unknown as FilterState

pruefe('Jahr', einheitName(einheit('liste', 'years'), f, genre), 'Jahr 2003, 2004')
pruefe('Plattform mit Anzeigenamen, Unbekanntes roh', einheitName(einheit('liste', 'platforms'), f, genre), 'Plattform Crunchyroll, gibtsnicht')
pruefe('Genre über die Übersetzung', einheitName(einheit('liste', 'genres'), f, genre), 'Genre G:Action')
pruefe('Herkunft', einheitName(einheit('liste', 'land'), f, genre), 'Herkunft JP')
pruefe('Ausschluss liest die ausgeschlossenen Werte', einheitName(einheit('ausschluss', 'genres'), f, genre), 'ohne Genre G:Horror')
pruefe('Ausschluss Plattform', einheitName(einheit('ausschluss', 'platforms'), f, genre), 'ohne Plattform Netflix')
pruefe('Ausschluss Schlagwort', einheitName(einheit('ausschluss', 'keywords'), f, genre), 'ohne Schlagwort Isekai')
pruefe('leere Liste', einheitName(einheit('liste', 'fsk'), f, genre), 'FSK ')
pruefe('unbekanntes Feld: Feldname', einheitName(einheit('liste', 'neu'), { ...f, neu: ['x'] } as unknown as FilterState, genre), 'neu x')
pruefe('Schalter', einheitName(einheit('schalter', 'confirmedOnly'), f, genre), 'nur bestätigte Termine')
pruefe('Schalter Ausschluss', einheitName(einheit('schalter', 'zweitanbieterExcluded'), f, genre), 'ohne Zweitanbieter')
pruefe('unbekannter Schalter: Feldname', einheitName(einheit('schalter', 'neuOnly'), f, genre), 'neuOnly')
pruefe('Vertrauen', einheitName(einheit('vertrauen', 'minConfidence'), f, genre), 'Mindest-Vertrauen')

if (fehler) process.exit(1)
console.log('check-suchhinweis-namen: ok')
