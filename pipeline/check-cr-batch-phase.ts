/**
 * Läuft die Bau-Phase `legeCrVerweiseUndTermineAn` (`bau/09-4-4-termine.ts`) wirklich, in einem leeren Wegwerf-Ordner (`AK_ROOT`), und prüft,
 * was sie an Crunchyroll-Terminen anlegt: Aoashi Staffel 2 (26.10.2026; Block, Titel und Zeitstempel wörtlich aus `data/crunchyroll-dub.json`).
 * Damit steht die Herkunftszeile, die `check-cr-batch-bestand.ts` liest, nicht nur im Round-Trip der Hilfsfunktion, sondern am Ergebnis des Baus.
 * Aufruf: npx tsx pipeline/check-cr-batch-phase.ts
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'cr-batch-phase-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
process.env.AK_ROOT = wurzel
const { legeCrVerweiseUndTermineAn } = await import('./bau/09-4-4-termine.ts')
const { batchUeberBelegt, belegteFolgen } = await import('./lib/cr-batch-wache.ts')
const { expandEvents } = await import('../shared/logic.ts')
const { istStaffelstart } = await import('../shared/tv-signale.ts')

const AO = 'https://www.crunchyroll.com/de/aoashi'
const titel = { id: 191788, titleEn: 'Aoashi Season 2', jpYear: 2026, episodes: 24, format: 'TV', streams: [{ platform: 'crunchyroll', url: AO, dub: true }] }
const folge = (nummer: number, verfuegbarAb: string) => ({ nummer, guid: `g${nummer}`, verfuegbarAb })

/** Die Phase mit einem Block („Staffel 2“, vier Folgen) und diesen deutschen Folgen; zurück kommen die angelegten Releases. */
function lauf(folgen: ReturnType<typeof folge>[], t: { id: number; streams: { url: string }[] } = titel, anisearch = {}, jetzt = Date.parse('2026-10-27T05:00:00Z'), block = 'Staffel 2', vorher: unknown[] = []) {
  const url = t.streams[0]!.url
  const serie = { url, katalog: 'de', staffeln: [{ name: block, deutsch: folgen.length, folgen: 4, deutscheFolgen: folgen }] }
  const releases = vorher as never[]
  const log = console.log
  console.log = () => undefined
  try {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[t.id, t as never]]),
      anisearch,
      belegt: 0,
      crDub: { serien: [serie] } as never,
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map([[url, [t as never]]]),
      releases,
      jetzt,
    })
  } finally {
    console.log = log
  }
  return releases as unknown as import('../shared/types.ts').Release[]
}

try {
  const eine = lauf([folge(1, '2026-10-25T09:00:00Z')])
  pruefe('Aoashi S2 mit einer Folge: ein Termin, Wochenstart statt Abwurf', eine.length === 1 && eine[0]?.releaseType === 'weekly' && eine[0]?.dateMeaning === undefined, eine)
  pruefe('Aoashi S2 mit einer Folge: die Herkunft nennt 1 belegte Folge, die Werkszahl bleibt Erwartung', belegteFolgen(eine[0]?.herkunft) === 1 && eine[0]?.schedule?.episodeCount === 24, eine[0])

  const zwei = lauf([folge(1, '2026-10-25T09:00:00Z'), folge(2, '2026-10-25T09:00:00Z')])
  const z = zwei[0]
  pruefe('Aoashi S2 mit zwei Folgen am Starttag: Abwurf, aber nur die zwei belegten Folgen und kein Ende', z?.releaseType === 'batch' && z?.schedule?.episodeCount === 2 && z?.schedule?.lastEpisodeDate === undefined, z)
  pruefe('Aoashi S2 mit zwei Folgen: die Herkunft nennt 2 Folgen, die Wache meldet nichts', belegteFolgen(z?.herkunft) === 2 && batchUeberBelegt(zwei).length === 0, z?.herkunft)
  pruefe('Aoashi S2 mit zwei Folgen: der Termin ist ein einziger Tag, ohne Fortschreibung', expandEvents(z!).length === 1, expandEvents(z!).map((e) => e.date))
  /* Psyren (26.10.2026): Titel ohne Folgenzahl; Block, Zeitstempel und aniSearch-Zeile wörtlich aus data/crunchyroll-dub.json und data/anisearch.json. */
  const PS = 'https://www.crunchyroll.com/de/series/GT00371866/psyren'
  const psyren = { id: 204011, titleEn: 'PSYREN', jpYear: 2026, format: 'TV', streams: [{ platform: 'crunchyroll', url: PS, dub: true }] }
  const ersteFolge = [folge(1, '2026-10-26T14:30:00Z')]
  const geschaetzt = { 204011: { info: { episodes: 12, episodesEstimated: true } } }
  const ps = lauf(ersteFolge, psyren, geschaetzt, undefined, 'Staffel 1')
  const p = ps[0]
  pruefe('Psyren: ein Termin, wöchentlich statt Abwurf („Neu bei“ entfällt)', ps.length === 1 && p?.releaseType === 'weekly' && p?.dateMeaning === undefined, ps)
  pruefe('Psyren: aniSearch nennt 12 Folgen (geschätzt) — erwartet, als geraten gekennzeichnet, kein Ende', p?.schedule?.episodeCount === 12 && p?.schedule?.episodeCountAssumed === true && p?.schedule?.lastEpisodeDate === undefined, p?.schedule)
  pruefe('Psyren: Folge 1 am 26.10. um 15:30 Berlin belegt', p?.schedule?.firstEpisodeDate === '2026-10-26' && p?.schedule?.time === '15:30' && p?.schedule?.observed?.[1] === '2026-10-26', p?.schedule)
  const psTermine = expandEvents(p!)
  const psDaten = { releaseBySlug: new Map([[p!.slug, p!]]) }
  pruefe('Psyren: Folge 1 ist der Staffelstart, kein Katalogtermin', psTermine[0]?.episode === 1 && !psTermine[0]?.imAngebot && istStaffelstart(psTermine[0]!, psDaten), psTermine[0])
  pruefe('Psyren: die Staffel läuft weiter (zwölf Folgen, letzte am 11.01.2027) statt am 26.10. zu enden', psTermine.length === 12 && psTermine[11]?.date === '2027-01-11', psTermine.map((e) => e.date))
  const fest = lauf(ersteFolge, psyren, { 204011: { info: { episodes: 12 } } }, undefined, 'Staffel 1')[0]
  pruefe('Psyren mit fester aniSearch-Zahl: 12 ohne Vermerk „geraten“', fest?.schedule?.episodeCount === 12 && fest?.schedule?.episodeCountAssumed === undefined, fest?.schedule)
  const ohneZahl = lauf(ersteFolge, psyren, {}, undefined, 'Staffel 1')[0]
  pruefe('Psyren ohne Zahl bei aniSearch: zwölf als Erwartung, geraten', ohneZahl?.schedule?.episodeCount === 12 && ohneZahl?.schedule?.episodeCountAssumed === true, ohneZahl?.schedule)
  const drei = lauf([folge(1, '2026-10-26T14:30:00Z'), folge(2, '2026-11-02T14:30:00Z'), folge(3, '2026-11-09T14:30:00Z')], psyren, geschaetzt, Date.parse('2026-11-10T05:00:00Z'), 'Staffel 1')[0]
  pruefe('Psyren nach drei Wochen: weiter wöchentlich, 12 erwartet, Folgen 1 bis 3 belegt', drei?.releaseType === 'weekly' && drei?.schedule?.episodeCount === 12 && Object.keys(drei?.schedule?.observed ?? {}).join() === '1,2,3', drei?.schedule)
  const viele = lauf([folge(1, '2026-10-26T14:30:00Z'), folge(2, '2026-11-02T14:30:00Z')], psyren, { 204011: { info: { episodes: 1 } } }, Date.parse('2026-11-03T05:00:00Z'), 'Staffel 1')[0]
  pruefe('aniSearch-Zahl unter den belegten Folgen (1 gegen 2): die belegten gewinnen, geraten', viele?.schedule?.episodeCount === 2 && viele?.schedule?.episodeCountAssumed === true, viele?.schedule)
  const batch = lauf([folge(1, '2026-10-26T14:30:00Z'), folge(2, '2026-10-26T14:30:00Z')], psyren, geschaetzt, undefined, 'Staffel 1')[0]
  pruefe('Psyren mit zwei Folgen am Starttag bleibt Abwurf mit nur den zwei Folgen (Auslegung unverändert)', batch?.releaseType === 'batch' && batch?.schedule?.episodeCount === 2 && batch?.schedule?.episodeCountAssumed === undefined, batch?.schedule)
  /* Steht die Folge schon als Sammeltermin da (Bestand vom 27.10., „Neu bei“), ersetzt der Wochentermin ihn und bekommt dieselbe Länge. */
  const alt = { slug: 'psyren-alt', titleId: 204011, platform: 'crunchyroll', releaseType: 'batch', dateMeaning: 'available-from', schedule: { firstEpisodeDate: '2026-10-26', lastEpisodeDate: '2026-10-26', episodeCount: 1 } }
  const ersetzt = lauf(ersteFolge, psyren, geschaetzt, undefined, 'Staffel 1', [alt])
  const e = ersetzt[0]
  pruefe('Psyren als vorhandener Sammeltermin: wird wöchentlich, 12 erwartet (geraten), kein Ende, Slug bleibt', ersetzt.length === 1 && e?.slug === 'psyren-alt' && e?.releaseType === 'weekly' && e?.dateMeaning === undefined && e?.schedule.episodeCount === 12 && e?.schedule.episodeCountAssumed === true && e?.schedule.lastEpisodeDate === undefined, e)
  const spaet = lauf(ersteFolge, psyren, geschaetzt, Date.parse('2026-12-01T00:00:00Z'), 'Staffel 1')
  pruefe('Psyren mit „jetzt“ im Dezember (Folge 1 älter als 21 Tage): kein Termin — die Uhr der Phase gilt', spaet.length === 0, spaet)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
