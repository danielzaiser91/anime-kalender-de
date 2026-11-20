/**
 * Push folgt dem Kalender-Filter (Daniel, 20.11.2026: TV ausgeblendet, trotzdem Benachrichtigung zu einer TV-Wiederholung).
 * Dieselben Termine und Filter (`tools/push-filter-faelle.ts`, Soll von Hand) laufen durch den Kalender (`eventsFuerAnsichtGen`),
 * durch den Weg Filter → Wert fürs Abo → `leseTerminFilter` → `terminSichtbar` und durch den Abo-Text; Eingaben aus dem Browser
 * außerhalb der Positivliste ergeben „kein Filter“. Der Versand selbst: `tools/worker-push-filter.test.ts`.
 * Aufruf: `npm run check:logic`.
 */
import type { ReleaseEvent, Title } from '../shared/types.ts'
import { leseTerminFilter, terminFilterAlsText, terminFilterAusText, terminSichtbar, type TerminFilter } from '../shared/push-filter.ts'
import { schreibeTvAuskunft } from './bau/10-termine.ts'
import { EMPTY_FILTERS, eventsFuerAnsichtGen, type FilterState } from '../web/src/lib/filters.ts'
import { pushFilterWert } from '../web/src/lib/push-nachfuehren.ts'
import { treibe } from '../web/src/lib/search.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { EREIGNISSE, FAELLE, RELEASES, TAG, TITEL, ohne } from '../tools/push-filter-faelle.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Die Termine mit den Auskünften des Baus (`tvPremiere`), so wie der Worker sie liest. */
const events: ReleaseEvent[] = EREIGNISSE.map((e) => ({ ...e }))
const mitZweit = events.map((e) => e.zweitanbieter)
schreibeTvAuskunft(events, RELEASES, new Map<number, Title>(TITEL.map((t) => [t.id, t])))
events.forEach((e, i) => (e.zweitanbieter = mitZweit[i]))

console.log('\nTermine nach dem Bau')
pruefe('Wiederholung: tvPremiere false', events[0]!.tvPremiere === false, events[0]!.tvPremiere)
pruefe('Premiere (Handbeleg): tvPremiere true', events[1]!.tvPremiere === true, events[1]!.tvPremiere)
pruefe('Sichtung ohne Folge: keine Aussage', events[2]!.tvPremiere === undefined, events[2]!.tvPremiere)

const data = {
  titles: TITEL,
  titleById: new Map(TITEL.map((t) => [t.id, t])),
  releases: RELEASES,
  releaseBySlug: new Map(RELEASES.map((r) => [r.slug, r])),
  events,
  eventsByDate: new Map(),
  releasesByTitle: new Map(TITEL.map((t) => [t.id, RELEASES.filter((r) => r.titleId === t.id)])),
} as unknown as Dataset

/** Der Filter des Kalenders (`FilterState`) zu einem Fall — nur die Felder, die der Push kennt. */
const kalenderFilterZu = (f: TerminFilter | null): FilterState => ({
  ...EMPTY_FILTERS,
  platforms: [...(f?.platforms ?? [])] as FilterState['platforms'],
  releaseTypes: [...(f?.releaseTypes ?? [])] as FilterState['releaseTypes'],
  excluded: {
    ...EMPTY_FILTERS.excluded,
    platforms: [...(f?.excluded.platforms ?? [])] as FilterState['platforms'],
    releaseTypes: [...(f?.excluded.releaseTypes ?? [])] as FilterState['releaseTypes'],
  },
  zweitanbieterExcluded: f?.zweitanbieterExcluded ?? false,
})

const nummern = (liste: ReleaseEvent[]): string => liste.map((e) => e.titleId).sort().join()

console.log('\nKalender und Push zeigen dieselben Termine')
for (const fall of FAELLE) {
  const soll = [...fall.sichtbar].sort().join()
  const filter = kalenderFilterZu(fall.filter)
  const tvAus = fall.filter?.tvAus === true
  const kalender = treibe(eventsFuerAnsichtGen(data, filter, TAG, new Set(), tvAus)).liste
  pruefe(`Kalender: ${fall.name}`, nummern(kalender) === soll, nummern(kalender))
  const wert = pushFilterWert(filter, tvAus)
  const gelesen = leseTerminFilter(wert)
  pruefe(`Wert fürs Abo: ${fall.name}`, nummern(events.filter((e) => terminSichtbar(e, gelesen))) === soll, wert)
  const text = gelesen ? terminFilterAlsText(gelesen) : ''
  pruefe(`Text in der Spalte: ${fall.name}`, nummern(events.filter((e) => terminSichtbar(e, terminFilterAusText(text)))) === soll, text)
}
pruefe('kein Filter ergibt keinen Wert', pushFilterWert(EMPTY_FILTERS, false) === null)
pruefe('nur TV aus ergibt einen Wert', pushFilterWert(EMPTY_FILTERS, true) !== null)

console.log('\nEingaben aus dem Browser: Positivliste, sonst kein Filter')
const gut = { xReleaseTypes: ['disc'] }
pruefe('Kontrolle: gültiger Wert wird gelesen', leseTerminFilter(gut)?.excluded.releaseTypes.join() === 'disc')
const kaputt: [string, unknown][] = [
  ['keine Angabe', undefined],
  ['null', null],
  ['Zahl', 5],
  ['Zeichenkette', 'tvAus'],
  ['Liste mit Zahl in `platforms`', { platforms: [1], xPlatforms: ['a'] }],
  ['Liste mit Zahl in `releaseTypes`', { releaseTypes: [1], xPlatforms: ['a'] }],
  ['Liste mit Zahl in `xReleaseTypes`', { xReleaseTypes: [1], xPlatforms: ['a'] }],
  ['Liste statt Objekt', [gut]],
  ['leeres Objekt', {}],
  ['nur Unbekanntes', { evil: true }],
  ['Liste mit Zahl', { xPlatforms: [1] }],
  ['Großbuchstaben im Namen', { xPlatforms: ['Netflix'] }],
  ['Punkt im Namen (Trenner im Text)', { xPlatforms: ['a.b'] }],
  ['Name zu lang (31 Zeichen)', { xPlatforms: ['a'.repeat(31)] }],
  ['21 Einträge', { xPlatforms: Array.from({ length: 21 }, (_, i) => `p${i}`) }],
  ['Liste als Zeichenkette', { xPlatforms: 'netflix' }],
  ['ein Fehler in einer Liste verwirft alles', { tvAus: true, xPlatforms: [1] }],
]
for (const [name, roh] of kaputt) pruefe(`${name} → kein Filter`, leseTerminFilter(roh) === null, leseTerminFilter(roh))
pruefe('Schalter nur mit echtem true (Zeichenkette zählt nicht)', leseTerminFilter({ tvAus: 'true' }) === null)
pruefe('20 Einträge gehen noch', leseTerminFilter({ xPlatforms: Array.from({ length: 20 }, (_, i) => `p${i}`) }) !== null)
pruefe('Text: Müll → kein Filter', terminFilterAusText('%%%') === null && terminFilterAusText('') === null && terminFilterAusText('tvAus=2') === null)
pruefe('Text: Kontrolle tvAus=1', terminFilterAusText('tvAus=1')?.tvAus === true)
pruefe('Text: unbekannter Schlüssel zählt nicht', terminFilterAusText('x=1') === null)
pruefe('ohne() ist kein Filter', leseTerminFilter({ ...ohne() }) === null)

console.log(verletzt ? `\nPush-Filter: ${verletzt} Prüfung(en) fehlgeschlagen.` : '\nPush-Filter: Kalender, Wert, Text und Eingabe-Liste halten.')
process.exit(verletzt ? 1 : 0)
