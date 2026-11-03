/**
 * Test der Regel „Eine Sichtung ist keine Gesamtzahl“ (02.11.2026): Beyblade X stand im Kalender als „Folge 123/≈123“ (RTL+), bei TOGGO als
 * „122/122“, im Panel als „123 von 128 Folgen auf Deutsch“ — dabei läuft die Reihe in Japan weiter. Erzeuger, Termine und Panel-Text.
 * Aufruf: npx tsx pipeline/check-folgenzahl-sichtung.ts
 */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { addDays } from '../shared/time.ts'
import { deFolgenZahlText } from '../web/src/components/detail/antwort-regeln.ts'
import { hebeAnnahmeAuf } from './lib/folgenzahl-belegt.ts'
import { pruefeInvarianten, sichtungAlsGesamtzahl } from './lib/invarianten.ts'
import { terminKopf } from './lib/og-termin.ts'
import { rtlplusWochentermine } from './lib/rtlplus-folgen.ts'
import { releasesAusTvProgramm } from './lib/tv-termine.ts'

let verletzt = 0
let gezaehlt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  gezaehlt++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const NUMMERN = [101, ...Array.from({ length: 20 }, (_, i) => 103 + i)]
const folgen = NUMMERN.map((nr, i) => ({ nr, st: nr - 100, staffel: 3, dt: `F${nr}`, ab: addDays('2026-06-05', 7 * i) }))
const beyblade = { id: 165159, titleDe: 'Beyblade X', streams: [{ platform: 'rtlplus', url: 'x', dub: true }] } as unknown as Title

const rtl = rtlplusWochentermine({ '165159': { programm: 'beyblade-x-p_9519', folgen } }, new Map([[165159, beyblade]]), [], '2026-10-26')[0]!
const rtlEvents = expandEvents(rtl)
pruefe('RTL+: der Release führt die Zahl als gesichtet', rtl.schedule.episodeCountNurGesichtet === true && rtl.schedule.episodeCount === 22, rtl.schedule)
pruefe('RTL+: bis Folge 122 ein Termin je Folge', rtlEvents.length === 21 && rtlEvents.at(-1)?.episode === 122, rtlEvents.length)
pruefe('RTL+: kein Termin trägt eine Gesamtzahl', rtlEvents.every((e) => e.episodeCount === undefined), rtlEvents.at(-1))
const belegt: Release = { ...rtl, schedule: { ...rtl.schedule, episodeCountNurGesichtet: undefined } }
pruefe('Gegenprobe: ohne den Vermerk steht die Zahl am Termin (Folge 122/122)', expandEvents(belegt).at(-1)?.episodeCount === 122)
const verpasst: Release = { ...rtl, schedule: { ...rtl.schedule, verpasst: { 122: { erwartetAm: '2026-10-30' } } } as Release['schedule'] }
pruefe('ein ausgebliebener Termin trägt ebenfalls keine Gesamtzahl', expandEvents(verpasst).some((e) => e.verpasst) && expandEvents(verpasst).filter((e) => e.verpasst).every((e) => e.episodeCount === undefined), expandEvents(verpasst).at(-1))

const titles = new Map([[158871, { id: 158871, titleDe: 'Pokémon Horizonte' } as Title]])
const s = (start: string, folge: string) => ({ titleId: 158871, titel: 'x', folge, sender: 'TOGGO', start, ende: start, gesehenAm: '2026-09-16' })
const tv = releasesAusTvProgramm([s('2026-09-15T16:05:00+02:00', 'A'), s('2026-09-16T16:05:00+02:00', 'B')], titles, [])[0]!
pruefe('TV: der Release führt die Zahl als gesichtet und angenommen', tv.schedule.episodeCountNurGesichtet === true && tv.schedule.episodeCountAssumed === true, tv.schedule)
pruefe('TV: kein Termin trägt eine Gesamtzahl', expandEvents(tv).length > 0 && expandEvents(tv).every((e) => e.episodeCount === undefined), expandEvents(tv))

/* Panel: dieselbe Aussage, ohne Nenner aus der Listenlänge. */
const T = (k: string, v?: Record<string, string | number>) => `${k}:${JSON.stringify(v)}`
pruefe('Panel mit gesichtetem Release: „123 Folgen auf Deutsch“ ohne „von“', deFolgenZahlText([128, 123], [rtl], T) === 'detail.dubKopf:{"n":123}', deFolgenZahlText([128, 123], [rtl], T))
const echtBelegt: Release = { ...rtl, schedule: { ...rtl.schedule, episodeCountAssumed: undefined, episodeCountNurGesichtet: undefined } }
pruefe('Panel mit belegter Zahl: „123 von 128“ bleibt', deFolgenZahlText([128, 123], [echtBelegt], T) === 'antwort.teilweiseZahl:{"raus":123,"gesamt":128}')
pruefe('Panel mit nur angenommener Zahl: „123 Folgen auf Deutsch“ ohne „von“', deFolgenZahlText([128, 123], [belegt], T) === 'detail.dubKopf:{"n":123}')
pruefe('Panel ohne jeden Release: „123 Folgen auf Deutsch“ ohne „von“', deFolgenZahlText([14, 3], [], T) === 'detail.dubKopf:{"n":3}')
pruefe('Panel, ein Anbieter belegt, einer gesichtet: „von 128“ steht', deFolgenZahlText([128, 123], [rtl, echtBelegt], T) === 'antwort.teilweiseZahl:{"raus":123,"gesamt":128}')

/* Wächter DD-24 über die gebauten Releases und Termine. */
const mitTv = [rtl, tv]
const alleTermine = mitTv.flatMap((r) => expandEvents(r))
pruefe('DD-24: Erzeuger-Ausgabe (RTL+ und TV) besteht den Wächter', sichtungAlsGesamtzahl(mitTv, alleTermine).length === 0, sichtungAlsGesamtzahl(mitTv, alleTermine))
const ohneFlagRtl: Release = { ...rtl, schedule: { ...rtl.schedule, episodeCountNurGesichtet: undefined } }
pruefe('DD-24: RTL+-Sichtung mit Annahme, aber ohne Vermerk wird gemeldet', sichtungAlsGesamtzahl([ohneFlagRtl], []).length === 1)
const ohneFlagTv: Release = { ...tv, schedule: { ...tv.schedule, episodeCountNurGesichtet: undefined } }
pruefe('DD-24: TV-Sichtung mit Annahme, aber ohne Vermerk wird gemeldet', sichtungAlsGesamtzahl([ohneFlagTv], []).length === 1)
pruefe('DD-24: ein Termin eines gesichteten Releases mit Gesamtzahl wird gemeldet', sichtungAlsGesamtzahl([rtl], [{ ...rtlEvents[0]!, episodeCount: 123 }]).length === 1)
pruefe('DD-24: ein fremder Release (Crunchyroll) mit Annahme und Termin-Gesamtzahl bleibt unberührt', sichtungAlsGesamtzahl([{ ...rtl, slug: 'cr-x', schedule: { ...rtl.schedule, episodeCountNurGesichtet: undefined } }], [{ ...rtlEvents[0]!, releaseSlug: 'cr-x', episodeCount: 12 }]).length === 0)

/* Verdrahtung: der Bau-Aufruf der Invarianten meldet den Fall, und das Vorschaubild nennt keinen Nenner. */
const bauFehler = pruefeInvarianten([ohneFlagRtl], [], new Map([[165159, beyblade]])).fehler
pruefe('DD-24 im Bau (pruefeInvarianten): der Fall ohne Vermerk steht unter den Fehlern', bauFehler.some((f) => f.includes('episodeCountNurGesichtet')), bauFehler)
const kopf = terminKopf(rtl, rtlEvents, '2026-10-20')
pruefe('Vorschaubild (terminKopf) nennt „Folge 122“ ohne „von“', kopf?.folge === 'Folge 122' && !kopf.folge.includes('von'), kopf)
pruefe('Gegenprobe Vorschaubild: ohne den Vermerk steht „von ≈22“', terminKopf(belegt, expandEvents(belegt), '2026-10-20')?.folge === 'Folge 122 von ≈22', terminKopf(belegt, expandEvents(belegt), '2026-10-20'))

/* Belegt ein anderer Release die Gesamtzahl, entfällt mit der Annahme auch der Vermerk. */
const belegterRelease = { slug: 'belegt', titleId: 165159, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-01-01', episodeCount: 22, observed: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i + 1, addDays('2026-01-01', 7 * i)])) } } as unknown as Release
const sicht: Release = { ...rtl, schedule: { ...rtl.schedule, firstEpisodeNumber: 1, episodeCount: 22 } }
const urteile = hebeAnnahmeAuf([belegterRelease, sicht])
pruefe('Gesamtzahl von anderem Release belegt: Annahme und Vermerk entfallen', urteile[0]?.aufgehoben === true && sicht.schedule.episodeCountAssumed === undefined && sicht.schedule.episodeCountNurGesichtet === undefined, sicht.schedule)

if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-folgenzahl-sichtung: ${gezaehlt} Zusicherungen erfüllt (RTL+, TV, Panel, DD-24, Aufhebung)`)
