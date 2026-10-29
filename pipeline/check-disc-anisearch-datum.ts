/**
 * Zusicherungen zum Disc-Termin: **das neuere belegte Datum gewinnt** (`lib/disc-anisearch-datum.ts`, 29.10.2026).
 * Anlass: Virgin Road Vol. 1 zeigte den 30.10. (Anime2You vom 02.10.), aniSearch nannte seit dem 12.10. den 06.11.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import type { DiscIndex } from './lib/disc-ean.ts'
import { aniSearchDatumAnwenden, aniSearchGewinnt, aniSearchTermin, discTerminFehler, veroeffentlichungstage } from './lib/disc-anisearch-datum.ts'
import { verschiebungenAnwenden } from './lib/disc-verschiebungen.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const HEUTE = '2026-10-29'
const A2Y = 'https://www.anime2you.de/news/1056385/22-verschiebungen-animoon-crunchyroll-peppermint/'
const ARTIKEL = 'https://www.anisearch.de/article/198024,virgin-road-die-henkerin-und-ihre-art-zu-leben-vol-1-3-limited-edition-blu-ray-sammelschuber'
const EAN = '4260497796626'

/* Wörtlich aus `data/disc-ausgaben.json` (Schlüssel 129193) und `data/anisearch-artikel.json` (198024). */
function index(daten: { datum: string; gelesen?: string }[] = [{ datum: '2026-11-06', gelesen: '2026-10-12T05:53:59.292Z' }]): DiscIndex {
  return {
    ausgaben: {
      '129193': daten.map((d, i) => ({
        datum: d.datum,
        url: i === 0 ? ARTIKEL : `https://www.anisearch.de/article/19802${4 + i},vol-1-${i}`,
        format: 'Blu-ray',
        kurz: 'Vol. 1/3: Limited Edition + Sammelschuber',
      })),
    },
    artikel: Object.fromEntries(daten.map((d, i) => [i === 0 ? '198024' : `19802${4 + i}`, { ean: EAN, publisher: 'AniMoon Publishing GmbH', umfang: 'Einzelnes Vol.', fetchedAt: d.gelesen }])),
  }
}

function virgin(datum = '2026-10-30', quellen = [A2Y]): Release {
  return {
    slug: 'virgin-road-vol1',
    titleId: 129193,
    name: 'Virgin Road – Vol. 1',
    platform: 'disc',
    releaseType: 'disc',
    buyUrl: 'https://www.amazon.de/s?k=Virgin%20Road%20%E2%80%93%20Vol.%201%20Anime%20Blu-ray',
    schedule: { firstEpisodeDate: datum },
    year: Number(datum.slice(0, 4)),
    sources: quellen,
  } as unknown as Release
}
const tage = (pub: string) => veroeffentlichungstage([{ articleUrl: A2Y, publishedAt: pub }])
const datumNach = (r: Release, i: DiscIndex, pub = '2026-10-02'): string => {
  const liste = [r]
  aniSearchDatumAnwenden(liste, i, tage(pub), HEUTE)
  return liste[0]!.schedule.firstEpisodeDate!
}

/* Der echte Fall. */
const rs = [virgin()]
const geaendert = aniSearchDatumAnwenden(rs, index(), tage('2026-10-02'), HEUTE)
pruefe('Virgin Road Vol. 1: 30.10. wird 06.11.', rs[0]!.schedule.firstEpisodeDate === '2026-11-06' && rs[0]!.year === 2026, rs[0]!.schedule)
pruefe('gemeldet wird die Änderung mit altem und neuem Tag', geaendert.length === 1 && geaendert[0]!.von === '2026-10-30' && geaendert[0]!.nach === '2026-11-06', geaendert)
pruefe('Amazon-Link: aus der Namens- wird die EAN-Suche', rs[0]!.buyUrl === `https://www.amazon.de/s?k=${EAN}`, rs[0]!.buyUrl)
const q = rs[0]!.quellen ?? []
pruefe('Belege: Anime2You überholt, aniSearch aktuell mit neuem Tag', q.find((x) => x.url === A2Y)?.stand === 'ueberholt' && q.find((x) => x.url === ARTIKEL)?.stand === 'aktuell' && q.find((x) => x.url === ARTIKEL)?.sagt === '2026-11-06', q)
pruefe('aniSearch-Artikel steht bei den Quellen', rs[0]!.sources.includes(ARTIKEL), rs[0]!.sources)
pruefe('zweiter Lauf ändert nichts mehr', aniSearchDatumAnwenden(rs, index(), tage('2026-10-02'), HEUTE).length === 0)

/* Grenzen der Regel. */
const T = (gelesen: string): ReturnType<typeof aniSearchTermin> => aniSearchTermin(virgin(), index([{ datum: '2026-11-06', gelesen }]))
pruefe('aniSearch am selben Tag gelesen wie die Meldung erschien: Meldung bleibt', datumNach(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-02T05:00:00Z' }])) === '2026-10-30')
pruefe('aniSearch einen Tag später gelesen: aniSearch gewinnt', datumNach(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-03T05:00:00Z' }])) === '2026-11-06')
pruefe('aniSearch vor der Meldung gelesen: Meldung bleibt', datumNach(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-01T05:00:00Z' }])) === '2026-10-30')
pruefe('Meldung später als die aniSearch-Lesung (Kreislauf, Meldung 20.10.): Meldung bleibt', datumNach(virgin('2026-11-13'), index(), '2026-10-20') === '2026-11-13')
pruefe('Quelle ohne bekanntes Veröffentlichungsdatum: bleibt', datumNach(virgin('2026-10-30', ['https://x.example/a']), index()) === '2026-10-30')
pruefe('Platzhalter 31.12.: bleibt', datumNach(virgin(), index([{ datum: '2026-12-31', gelesen: '2026-10-12T05:00:00Z' }])) === '2026-10-30')
pruefe('aniSearch-Tag schon vorbei, unser Tag steht bevor: bleibt', datumNach(virgin(), index([{ datum: '2026-10-23', gelesen: '2026-10-12T05:00:00Z' }])) === '2026-10-30')
pruefe('aniSearch-Tag heute, unserer morgen: bleibt', datumNach(virgin(), index([{ datum: HEUTE, gelesen: '2026-10-12T05:00:00Z' }])) === '2026-10-30')
pruefe('zwei verschiedene Tage für dieselbe Nummer (DVD/Blu-ray): bleibt', datumNach(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-12T05:00:00Z' }, { datum: '2026-11-20', gelesen: '2026-10-12T05:00:00Z' }])) === '2026-10-30')
pruefe('zwei Ausgaben mit demselben Tag: gilt', datumNach(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-12T05:00:00Z' }, { datum: '2026-11-06', gelesen: '2026-10-13T05:00:00Z' }])) === '2026-11-06')
pruefe('Lesetag fehlt: bleibt', datumNach(virgin(), index([{ datum: '2026-11-06' }])) === '2026-10-30')
pruefe('älteste Lesung zählt, wenn mehrere Ausgaben denselben Tag nennen', aniSearchTermin(virgin(), index([{ datum: '2026-11-06', gelesen: '2026-10-12T05:00:00Z' }, { datum: '2026-11-06', gelesen: '2026-10-13T05:00:00Z' }]))?.gelesen === '2026-10-12')
pruefe('Lesetag wird als Datum gekürzt', T('2026-10-12T05:53:59.292Z')?.gelesen === '2026-10-12', T('2026-10-12T05:53:59.292Z'))
const vol2 = { ...virgin(), name: 'Virgin Road – Vol. 2' } as Release
pruefe('andere Nummer: keine Ausgabe, bleibt', aniSearchTermin(vol2, index()) === undefined)
const kino = { ...virgin(), releaseType: 'weekly' } as Release
pruefe('Release, das keine Disc ist: bleibt', datumNach(kino, index()) === '2026-10-30')
pruefe('ohne Nummer im Namen: keine Zuordnung', aniSearchTermin({ ...virgin(), name: 'Virgin Road' }, index()) === undefined)
pruefe('Release ohne Tag: keine Regel', !aniSearchGewinnt({ ...virgin(), schedule: {} } as Release, aniSearchTermin(virgin(), index())!, tage('2026-10-02'), HEUTE))

const ZWEITE = 'https://www.anime2you.de/news/1033082/disc-neuheiten-august-2026/'
const zweiQuellen = veroeffentlichungstage([{ articleUrl: A2Y, publishedAt: '2026-10-20' }, { articleUrl: ZWEITE, publishedAt: '2026-07-25' }])
const mehrere = [virgin('2026-10-30', [ZWEITE, A2Y])]
aniSearchDatumAnwenden(mehrere, index(), zweiQuellen, HEUTE)
pruefe('mehrere Quellen: die jüngste Meldung (20.10.) zählt, nicht die erste in der Liste (25.07.)', mehrere[0]!.schedule.firstEpisodeDate === '2026-10-30', mehrere[0]!.schedule)
const jahr = [virgin('2026-12-30')]
aniSearchDatumAnwenden(jahr, index([{ datum: '2027-01-15', gelesen: '2026-10-12T05:00:00Z' }]), tage('2026-10-02'), HEUTE)
pruefe('Jahreswechsel: das Jahr des Releases folgt dem neuen Tag', jahr[0]!.schedule.firstEpisodeDate === '2027-01-15' && jahr[0]!.year === 2027, jahr[0])
const box = { ...virgin(), name: 'Virgin Road – Box 1' } as Release
pruefe('Box 1 ist nicht Vol. 1', aniSearchTermin(box, index()) === undefined)

/* Kreislauf: Meldung → Bau → aniSearch → neuere Meldung → Bau. */
const spaeter = [{ articleUrl: A2Y, publishedAt: '2026-10-02', verschiebungen: [] as { titel: string; alt: string; neu: string }[] }, {
  articleUrl: 'https://www.anime2you.de/news/1070000/neue-verschiebung/',
  publishedAt: '2026-10-20',
  verschiebungen: [{ titel: 'Virgin Road – Vol. 1 (Limited Edition mit Sammelschuber)', alt: '2026-11-06', neu: '2026-11-13' }],
}]
const kreis = [virgin()]
aniSearchDatumAnwenden(kreis, index(), veroeffentlichungstage(spaeter), HEUTE)
pruefe('Kreislauf, Stufe 1: aniSearch setzt den 06.11.', kreis[0]!.schedule.firstEpisodeDate === '2026-11-06')
verschiebungenAnwenden(kreis, spaeter, HEUTE, new Map())
pruefe('Kreislauf, Stufe 2: die neuere Meldung (20.10.) setzt den 13.11.', kreis[0]!.schedule.firstEpisodeDate === '2026-11-13', kreis[0]!.schedule)
aniSearchDatumAnwenden(kreis, index(), veroeffentlichungstage(spaeter), HEUTE)
pruefe('Kreislauf, Stufe 3: die ältere aniSearch-Lesung überstimmt sie nicht', kreis[0]!.schedule.firstEpisodeDate === '2026-11-13', kreis[0]!.schedule)

/* Wächter am kaputten Stand (so lief es live) und am reparierten. */
const kaputt = discTerminFehler([virgin()], HEUTE, { index: index(), veroeffentlicht: tage('2026-10-02') })
pruefe('Wächter: der kaputte Stand (30.10. gegen aniSearch 06.11.) ist rot', kaputt.length === 1 && kaputt[0]!.includes('Virgin Road – Vol. 1') && kaputt[0]!.includes('2026-11-06'), kaputt)
pruefe('Wächter: der reparierte Stand ist grün', discTerminFehler(rs, HEUTE, { index: index(), veroeffentlicht: tage('2026-10-02') }).length === 0)
pruefe('Wächter: kein Disc-Release, keine Prüfung (und kein Lesen von Dateien)', discTerminFehler([kino], HEUTE).length === 0)
/* Kennung 900001 kennt nur die übergebene Kulisse, nicht die echten Dateien: Ohne weitergereichte Quellen bliebe der Fehler aus. */
const fremd = { ...index(), ausgaben: { '900001': index().ausgaben['129193']! } }
const ergebnis = pruefeErgebnis([{ ...virgin(), titleId: 900001 }], [], new Map(), HEUTE, { index: fremd, veroeffentlicht: tage('2026-10-02') })
pruefe('Verdrahtung: `pruefeErgebnis` meldet den kaputten Stand als Fehler', ergebnis.fehler.some((f) => f.includes('aniSearch nennt 2026-11-06')), ergebnis.fehler)
const gut = pruefeErgebnis(rs, [], new Map(), HEUTE, { index: index(), veroeffentlicht: tage('2026-10-02') })
pruefe('Verdrahtung: `pruefeErgebnis` ist am reparierten Stand ohne Disc-Fehler', !gut.fehler.some((f) => f.includes('aniSearch nennt')), gut.fehler)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nDisc-Termin, neueres Datum gewinnt: alle Zusicherungen erfüllt')
