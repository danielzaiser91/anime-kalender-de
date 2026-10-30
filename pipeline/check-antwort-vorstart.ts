/**
 * Zusicherungen zum Antwort-Kasten vor dem ersten deutschen Termin (Daniel, 29.10.2026, Variante A): Überschrift ist der Satz
 * „Vol. 1 (Folgen 1–4) erscheint am …“ bzw. „Die erste Folge mit deutscher Synchro erscheint voraussichtlich am …“; die Zählzeile „0 von N
 * Folgen erschienen“ samt Balken entfällt. Ein laufender Titel bleibt unverändert. Gerendert wird der echte Kasten, die Uhr steht fest.
 * Läuft in `check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Release, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { AntwortKastenMitMarke } from '../web/src/components/detail/kasten-marke.tsx'
import { bandFolgen, bandName, discSatz, streamSatz } from '../web/src/components/detail/antwort-vorstart.ts'
import { translate } from '../web/src/lib/i18n.tsx'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} ${info}`)
}

const HEUTE = '2026-10-30'
const JETZT = new Date('2026-10-30T12:00:00Z')

const SHOP = 'https://shop.example.org/vorstart-vol-1'
const watchLinks = [
  {
    name: 'Händler',
    url: SHOP,
    kind: 'buy',
    zugang: 'kauf',
    dubRanges: [{ from: 1, to: 4, dub: true }],
  },
]
const titel = (extra: object = {}): Title =>
  ({
    id: 900001,
    format: 'TV',
    episodes: 12,
    titleDe: 'Vorstarttest',
    ...extra,
  }) as unknown as Title

function disc(datum: string, name: string): Release {
  return {
    slug: `vorstart-${datum}`,
    titleId: 900001,
    name,
    platform: 'disc',
    platformUrl: 'https://shop.example.org/suche',
    buyUrl: SHOP,
    releaseType: 'disc',
    schedule: { firstEpisodeDate: datum, lastEpisodeDate: datum },
    sources: [],
  } as unknown as Release
}

/** Folge 1 am `start`, wöchentlich; `schedule.estimated` heißt: das Datum ist fortgeschrieben, nicht belegt. */
function wochentakt(start: string, schedule: object = { estimated: true }): Release {
  return {
    slug: 'vorstart-stream',
    titleId: 900001,
    name: 'Vorstarttest',
    platform: 'netflix',
    platformUrl: 'https://www.netflix.com/title/1',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: start, lastEpisodeDate: '2027-02-01', episodeCount: 12, ...schedule },
    sources: [],
  } as unknown as Release
}

function kasten(t: Title, releases: Release[], ohneSprachbeleg?: boolean): string {
  const antwort = berechneAntwort({ title: t, releases, today: HEUTE, jetzt: JETZT })
  return renderToStaticMarkup(createElement(AntwortKastenMitMarke, { antwort, title: t, t: translate, today: HEUTE, releases, ohneSprachbeleg } as never))
}
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

console.log('\nBandname und Folgenbereich:')
pruefe('„Vorstarttest – Vol. 1“ gibt „Vol. 1“', bandName('Vorstarttest – Vol. 1') === 'Vol. 1')
pruefe('„Vol.2“ bleibt, wie die Quelle es schreibt', bandName('Vorstarttest: Vol.2') === 'Vol.2')
pruefe('„Limited Edition“ ist kein Band', bandName('Vorstarttest – Limited Edition') === undefined)
pruefe('Gesamtausgabe ohne Zusatz: kein Band', bandName('Vorstarttest') === undefined)
pruefe('Band mitten im Namen („Vol. 1 Limited Edition“) zählt nicht', bandName('Vorstarttest – Vol. 1 Limited Edition') === undefined)
const zweiHaendler = [
  { ...watchLinks[0], dubRanges: [{ from: 3, to: 4, dub: true }] },
  { ...watchLinks[0], dubRanges: [{ from: 1, to: 2, dub: true }, { from: 5, to: 6, dub: true }] },
]
pruefe('mehrere Bereiche: kleinstes von, größtes bis (1–6)', JSON.stringify(bandFolgen(disc('2026-11-06', 'Vorstarttest – Vol. 1'), titel({ watchLinks: zweiHaendler }))) === '{"von":1,"bis":6}')
const vol1 = disc('2026-11-06', 'Vorstarttest – Vol. 1')
pruefe('Händler mit gleicher Adresse und Spanne: 1–4', JSON.stringify(bandFolgen(vol1, titel({ watchLinks }))) === '{"von":1,"bis":4}')
pruefe('Händler mit anderer Adresse: keine Spanne', bandFolgen(vol1, titel({ watchLinks: [{ ...watchLinks[0], url: 'https://shop.example.org/anderer' }] })) === undefined)
pruefe('Händler ohne Spanne: keine Spanne', bandFolgen(vol1, titel({ watchLinks: [{ ...watchLinks[0], dubRanges: undefined }] })) === undefined)
pruefe('Spanne aus der Telekom-Annahme zählt nicht', bandFolgen(vol1, titel({ watchLinks: [{ ...watchLinks[0], dubAbgeleitet: 'telekom-annahme' }] })) === undefined)
pruefe('Spanne „nicht deutsch“ zählt nicht', bandFolgen(vol1, titel({ watchLinks: [{ ...watchLinks[0], dubRanges: [{ from: 1, to: 4, dub: false }] }] })) === undefined)
pruefe('Streamweg mit gleicher Adresse zählt nicht (nur Kaufweg)', bandFolgen(vol1, titel({ watchLinks: [{ ...watchLinks[0], kind: 'stream' }] })) === undefined)

console.log('\nDisc vor dem ersten Band:')
const mitSpanne = text(kasten(titel({ watchLinks }), [vol1]))
pruefe('Überschrift: „Vol. 1 (Folgen 1–4) erscheint am 06.11.2026“', mitSpanne.includes('Vol. 1 (Folgen 1–4) erscheint am 06.11.2026'), mitSpanne.slice(0, 300))
pruefe('keine Nebenzeile „Kaufausgabe — erscheint an einem Tag komplett“', !mitSpanne.includes('Kaufausgabe'), mitSpanne.slice(0, 300))
const ohneSpanne = text(kasten(titel(), [vol1]))
pruefe('ohne Händlerbeleg nur „Vol. 1 erscheint am 06.11.2026“', ohneSpanne.includes('Vol. 1 erscheint am 06.11.2026') && !ohneSpanne.includes('Folgen'), ohneSpanne.slice(0, 300))
const gesamt = text(kasten(titel(), [disc('2026-11-06', 'Vorstarttest')]))
pruefe('Gesamtausgabe ohne Bandname: „Die Disc erscheint am 06.11.2026“', gesamt.includes('Die Disc erscheint am 06.11.2026'), gesamt.slice(0, 300))
const zweiOffen = text(kasten(titel({ watchLinks }), [vol1, disc('2026-12-04', 'Vorstarttest – Vol. 2')]))
pruefe('zwei offene Bände: der erste steht in der Überschrift', zweiOffen.includes('Vol. 1 (Folgen 1–4) erscheint am 06.11.2026') && !zweiOffen.includes('Vol. 2 am'), zweiOffen.slice(0, 300))
const kurzName = text(kasten(titel({ titleDe: 'Ganz anderer Titel: Mit langem Zusatz', watchLinks }), [vol1]))
pruefe('Terminname kürzer als der Titel (Virgin Road): „Vol. 1“ steht trotzdem', kurzName.includes('Vol. 1 (Folgen 1–4) erscheint am 06.11.2026'), kurzName.slice(0, 300))
const bandRaus = text(kasten(titel(), [disc('2026-10-02', 'Vorstarttest – Vol. 1'), disc('2026-12-04', 'Vorstarttest – Vol. 2')]))
pruefe('Band 1 schon im Handel: bleibt „Vol. 1 seit … · Vol. 2 am …“', bandRaus.includes('Vol. 1 seit 02.10.2026 · Vol. 2 am 04.12.2026') && !bandRaus.includes('erscheint am'), bandRaus.slice(0, 300))

console.log('\nStream vor der ersten Folge:')
const geschaetzt = text(kasten(titel(), [wochentakt('2026-11-06')]))
pruefe('geschätztes Datum: „… erscheint voraussichtlich am 06.11.2026“', geschaetzt.includes('Die erste Folge mit deutscher Synchro erscheint voraussichtlich am 06.11.2026'), geschaetzt.slice(0, 300))
pruefe('keine Nebenzeile mit Takt („Wöchentlich“, „letzte Folge“)', !/Wöchentlich|letzte Folge/.test(geschaetzt), geschaetzt.slice(0, 300))
pruefe('„0 von 12 Folgen erschienen“ entfällt', !/0\s+von/.test(geschaetzt), geschaetzt.slice(0, 300))
const rohHtml = kasten(titel(), [wochentakt('2026-11-06')])
pruefe('kein leerer Balken (h-1.5 … rounded-full)', !rohHtml.includes('h-1.5'), '')
const belegt = text(kasten(titel(), [wochentakt('2026-11-06', { observed: { 1: '2026-11-06' } })]))
pruefe('belegtes Datum: ohne „voraussichtlich“', belegt.includes('Die erste Folge mit deutscher Synchro erscheint am 06.11.2026') && !belegt.includes('voraussichtlich am 06.11.2026'), belegt.slice(0, 300))
const ohneBeleg = text(kasten(titel(), [wochentakt('2026-11-06')], true))
pruefe('ohne Sprachbeleg entfällt „mit deutscher Synchro“', ohneBeleg.includes('Die erste Folge erscheint') && !ohneBeleg.includes('Synchro erscheint'), ohneBeleg.slice(0, 300))

console.log('\nWo der Satz nicht gilt (Antwort „läuft“ unmittelbar):')
type Laeuft = Parameters<typeof streamSatz>[0]
const nummer1 = { date: '2026-11-06', episode: 1, estimated: false }
const laeuft = (extra: object = {}, haupt: object = {}): Laeuft => ({ art: 'laeuft', haupt: { ...nummer1, ...haupt }, rest: 12, raus: 0, ...extra }) as unknown as Laeuft
pruefe('Grundfall: Folge 1, nichts erschienen', streamSatz(laeuft(), false) === 'Die erste Folge mit deutscher Synchro erscheint am 06.11.2026')
pruefe('ohne Folgennummer (Fernsehen): Satz bleibt', streamSatz(laeuft({}, { episode: undefined }), false) !== undefined)
pruefe('schon eine Folge erschienen: kein Satz', streamSatz(laeuft({ raus: 1 }), false) === undefined)
pruefe('Folge 3 ist die nächste, 0 erschienen (Einstieg mittendrin): kein Satz', streamSatz(laeuft({}, { episode: 3 }), false) === undefined)
pruefe('TV-Sichtung: kein Satz', streamSatz(laeuft({ sichtung: true }), false) === undefined)
pruefe('offenes Ende: kein Satz', streamSatz(laeuft({ offenesEnde: true }), false) === undefined)
pruefe('auf Ersatztermin verschoben: kein Satz', streamSatz(laeuft({ verschobenVon: '2026-10-30' }), false) === undefined)
pruefe('Termin ausgeblieben: kein Satz', streamSatz(laeuft({}, { verpasst: { gesehenAm: '2026-11-07' } }), false) === undefined)
pruefe('Termin nachgeholt (erschienenAm): Satz bleibt', streamSatz(laeuft({}, { verpasst: { erschienenAm: '2026-11-08' } }), false) !== undefined)
pruefe('geschätzt: „voraussichtlich“', streamSatz(laeuft({}, { estimated: true }), false)?.includes('erscheint voraussichtlich am 06.11.2026') === true)
const discAntwort = (extra: object): Parameters<typeof discSatz>[0] => ({ art: 'disc', datum: '2026-11-06', ...extra }) as never
pruefe('Disc, Folgen nur eine: „Folge 3“', discSatz(discAntwort({ vol: 'Vol. 3', folgen: { von: 3, bis: 3 } })) === 'Vol. 3 (Folge 3) erscheint am 06.11.2026')
pruefe('Disc, Band 2 schon erschienen und Band 1 nicht: kein Satz', discSatz(discAntwort({ vol: 'Vol. 1', baende: [{ datum: '2026-11-06', raus: false }, { datum: '2026-10-01', raus: true }] })) === undefined)

console.log('\nLaufender Titel bleibt unverändert:')
const lauf = text(kasten(titel(), [wochentakt('2026-10-16')]))
pruefe('Folge 3 ist die nächste, 2 sind erschienen: Zählzeile bleibt', /2\s+von\s+12/.test(lauf) && !lauf.includes('erscheint voraussichtlich am'), lauf.slice(0, 300))
pruefe('Antwort ist „läuft“ mit raus 2', (() => { const a = berechneAntwort({ title: titel(), releases: [wochentakt('2026-10-16')], today: HEUTE, jetzt: JETZT }); return a?.art === 'laeuft' && a.raus === 2 })())

if (fehler) process.exit(1)
console.log('check-antwort-vorstart: ok')
