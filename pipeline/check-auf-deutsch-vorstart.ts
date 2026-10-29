/**
 * Der Antwort-Kasten sagt „Auf Deutsch“ erst, wenn ein belegter deutscher Termin am oder vor heute liegt (29.10.2026, Virgin Road:
 * aniSearch nannte den 11.04.2026, die Blu-ray Vol. 1 kam erst am 30.10.2026). Titel- und Release-Felder stehen wörtlich aus
 * `public/data/titles.json` und `releases.json` (Stand 29.10.2026). Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { erstausgabeNeuigkeitTitel } from '../web/src/components/detail/antwort-regeln.ts'
import { ersteDiscNochOffen } from '../web/src/lib/erste-disc.ts'
import { stufeTitelEin } from '../web/src/lib/db-relevanz.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-10-29'

const disc = (slug: string, titleId: number, name: string, datum: string): Release =>
  ({ slug, titleId, name, platform: 'disc', platformUrl: 'https://www.example.org/', releaseType: 'disc', schedule: { firstEpisodeDate: datum }, sources: [] }) as unknown as Release
const antwort = (title: unknown, releases: Release[], heute = HEUTE) =>
  berechneAntwort({ title: title as Title, releases, today: heute, jetzt: new Date(`${heute}T12:00:00Z`) }) as { art: string; datum?: string; baende?: unknown[] } | undefined

const virgin = { id: 129193, format: 'TV', episodes: 12, jpYear: 2022, jpEnd: '2022-06-18', streams: [], titleDe: 'Virgin Road: Die Henkerin und ihre Art zu leben', deErstausgabe: { von: '2026-04-11', publisher: 'AniMoon Publishing GmbH', synchro: true }, hasVoices: true }
const virginVol1 = disc('virgin-road-vol1', 129193, 'Virgin Road – Vol. 1', '2026-10-30')
const bocchi = { id: 130003, format: 'TV', episodes: 12, jpYear: 2022, jpEnd: '2022-12-25', streams: [], titleDe: 'Bocchi the Rock!', hasVoices: true }
const bocchiBaende = [
  disc('bocchi-the-rock-vol1', 130003, 'Bocchi the Rock! – Vol. 1', '2026-11-06'),
  disc('bocchi-the-rock-vol2', 130003, 'Bocchi the Rock! – Vol. 2', '2026-11-06'),
  disc('bocchi-the-rock-vol3', 130003, 'Bocchi the Rock! – Vol. 3', '2026-12-04'),
]
const goodLuck = { id: 13535, format: 'TV', episodes: 13, jpYear: 2012, jpEnd: '2012-09-27', streams: [], titleDe: 'Good Luck Girl!', hasVoices: true }
const goodLuckBaende = [
  disc('good-luck-girl-vol-1-2026-11-20', 13535, 'Good Luck Girl! – Vol. 1', '2026-11-20'),
  disc('good-luck-girl-vol-2-2027-02-05', 13535, 'Good Luck Girl! – Vol. 2', '2027-02-05'),
]
const nukitashi = { id: 174188, format: 'TV', episodes: 11, jpYear: 2025, jpEnd: '2025-09-27', streams: [], titleDe: 'Nukitashi: Welcome to Love Island!', hasVoices: true }
const nukitashiVol1 = disc('nukitashi-vol1', 174188, 'Nukitashi – Vol. 1', '2026-10-30')
const anne = { id: 184639, format: 'TV', episodes: 24, jpYear: 2025, jpEnd: '2025-09-27', streams: [], titleDe: 'Anne Shirley', deErstausgabe: { von: '2026-07-17', publisher: 'peppermint anime GmbH', synchro: true }, hasVoices: true }
const anneVol2 = disc('anne-shirley-vol2', 184639, 'Anne Shirley: Anne mit den roten Haaren – Vol. 2', '2026-11-20')
const eureka = { id: 237, format: 'TV', episodes: 50, jpYear: 2005, jpEnd: '2006-04-02', streams: [], titleDe: 'Eureka Seven', deErstausgabe: { von: '2007-03-09', bis: '2007-11-02', publisher: 'Beez Entertainment', synchro: true }, hasVoices: true }
const eurekaBox = disc('auto-237-disc', 237, 'Eureka Seven', '2027-01-28')
const yamada = { id: 154965, format: 'TV', episodes: 13, jpYear: 2023, jpEnd: '2023-06-25', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/81685150', dub: true, zugang: 'abo' }], titleDe: 'My Love Story with Yamada-kun at Lv999', deErstausgabe: { von: '2024-07-23', publisher: 'AniMoon Publishing GmbH', synchro: true }, hasVoices: true }
const yamadaVol1 = disc('my-love-story-with-yamada-kun-vol1', 154965, 'My Love Story with Yamada-kun at Lv999 – Vol. 1', '2026-11-06')

// Die Anlassfälle: erster deutscher Termin ist ein künftiger Band, der Kasten zeigt die Disc-Auskunft statt „Auf Deutsch“.
const v = antwort(virgin, [virginVol1])
pruefe('Virgin Road (aniSearch 11.04., Vol. 1 am 30.10.): keine Fertig-Antwort', v?.art === 'disc', JSON.stringify(v))
pruefe('Virgin Road: nennt den Termin von Vol. 1', v?.datum === '2026-10-30', JSON.stringify(v))
const b = antwort(bocchi, bocchiBaende)
pruefe('Bocchi (nur Sprecher, drei Bände künftig): Disc-Auskunft', b?.art === 'disc' && b.datum === '2026-11-06' && b.baende?.length === 3, JSON.stringify(b))
const tvSichtung = { slug: 'bocchi-tv', titleId: 130003, name: 'Bocchi the Rock!', platform: 'tv', platformUrl: 'https://www.example.org/', releaseType: 'weekly', automatisch: true, tvLetzteSichtung: '2026-11-01', schedule: { firstEpisodeDate: '2026-11-01', episodeCount: 1, observed: { 1: '2026-11-01' } }, sources: [] } as unknown as Release
const mitTv = antwort(bocchi, [...bocchiBaende, tvSichtung])
pruefe('Bocchi mit automatischer TV-Sichtung: der Kopf bleibt bei der Disc, nicht beim Sichtungstag', mitTv?.art === 'disc' && mitTv.datum === '2026-11-06', JSON.stringify(mitTv))
const kinoBanner = { slug: 'bocchi-kino', titleId: 130003, name: 'Bocchi the Rock!', platform: 'kino', platformUrl: 'https://www.example.org/', releaseType: 'movie', cinemaUntil: '2026-12-01', schedule: { firstEpisodeDate: '2026-11-02' }, sources: [] } as unknown as Release
const ohneSprecher = antwort({ ...bocchi, hasVoices: false }, [...bocchiBaende, kinoBanner])
pruefe('Ohne Synchro-Beleg bleibt ein Kino-Banner außerhalb des Kopfes', ohneSprecher?.art === 'disc' && ohneSprecher.datum === '2026-11-06', JSON.stringify(ohneSprecher))
pruefe('Film ohne Synchro-Beleg mit künftigen Discs: Disc-Auskunft wie bisher', antwort({ ...bocchi, format: 'MOVIE', hasVoices: false }, bocchiBaende)?.art === 'disc')
pruefe('Good Luck Girl! (nur Sprecher): Disc-Auskunft', antwort(goodLuck, goodLuckBaende)?.art === 'disc')
pruefe('Nukitashi (nur Sprecher): Disc-Auskunft', antwort(nukitashi, [nukitashiVol1])?.art === 'disc')

// Gegenfälle: hier stimmt „Auf Deutsch“.
pruefe('Anne Shirley (Vol. 1 seit 17.07., nur Vol. 2 künftig): bleibt fertig', antwort(anne, [anneVol2])?.art === 'fertig')
pruefe('Eureka Seven (TV 2007, Box-Neuauflage künftig, kein „Vol. 1“): bleibt fertig', antwort(eureka, [eurekaBox])?.art === 'fertig')
pruefe('Eureka Seven, Serie noch nicht abgeschlossen: der TV-Tag von 2007 gilt weiter', antwort({ ...eureka, jpEnd: '2027-01-01' }, [eurekaBox])?.art === 'fertig')
pruefe('Yamada-kun (Netflix-Stream mit deutscher Tonspur, Vol. 1 künftig): bleibt fertig', antwort(yamada, [yamadaVol1])?.art === 'fertig')
pruefe('Virgin Road am Erscheinungstag von Vol. 1: fertig', antwort(virgin, [virginVol1], '2026-10-30')?.art === 'fertig')
pruefe('Virgin Road einen Tag vor Vol. 1: noch Disc-Auskunft', antwort(virgin, [virginVol1], '2026-10-29')?.art === 'disc')
pruefe('Virgin Road ohne Band im Bestand (Fassung läuft nur über aniSearch): fertig', antwort(virgin, [])?.art === 'fertig')
pruefe('Film mit Sprechern und künftigem Vol. 1 behält den Film-Zweig', antwort({ ...bocchi, format: 'MOVIE' }, bocchiBaende)?.art !== 'disc')

// Die Regel selbst, Grenzfälle der Namen und Daten.
const offen = (namen: string[], datum = '2026-11-06', heute = HEUTE) => ersteDiscNochOffen(namen.map((n, i) => disc(`x${i}`, 1, n, datum)), heute)
pruefe('Vol. 1 künftig: offen', offen(['Titel – Vol. 1']))
pruefe('Vol.1 ohne Leerzeichen: offen', offen(['Titel – Vol.1']))
pruefe('Vol 1 ohne Punkt: offen', offen(['Titel – Vol 1']))
pruefe('Wort mit Endung „vol“ ist kein Band', !offen(['NirVol. 1']))
pruefe('Vol. 15 ist kein erster Band', !offen(['Titel – Vol. 15']))
pruefe('Vol. 2 allein ist kein erster Band', !offen(['Titel – Vol. 2']))
pruefe('keine Disc: nicht offen', !ersteDiscNochOffen([], HEUTE))
pruefe('Vol. 1 erschienen: nicht offen', !offen(['Titel – Vol. 1'], '2026-10-28'))
pruefe('Vol. 1 genau heute: nicht offen', !offen(['Titel – Vol. 1'], HEUTE))
pruefe('Vol. 1 künftig, aber ein Band schon erschienen: nicht offen', !ersteDiscNochOffen([disc('a', 1, 'T – Vol. 1', '2026-11-06'), disc('b', 1, 'T – Vol. 2', '2026-10-01')], HEUTE))

/* Disc ohne Datum neben künftigem Vol. 1 (eine Disc ohne Datum ist nicht „künftig“) und erschienene Nicht-Disc-Termine daneben. */
const discOhneDatum = { slug: 'o', titleId: 1, name: 'T – Box', platform: 'disc', releaseType: 'disc', sources: [] } as unknown as Release
const tvVergangen = { slug: 'tv', titleId: 1, name: 'T', platform: 'tv', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-10-01' }, sources: [] } as unknown as Release
pruefe('Disc ohne Datum neben Vol. 1 künftig: nicht offen', !ersteDiscNochOffen([disc('a', 1, 'T – Vol. 1', '2026-11-06'), discOhneDatum], HEUTE))
pruefe('erschienener TV-Termin neben künftigem Vol. 1: die Regel zählt nur Discs, offen', ersteDiscNochOffen([disc('a', 1, 'T – Vol. 1', '2026-11-06'), tvVergangen], HEUTE))

/* Zweite und dritte Anzeigestelle: Neuigkeiten-Zeile und Entdecken-Stufe folgen derselben Regel wie der Kasten. */
const neu = (t: unknown, r: Release[], heute = HEUTE) => {
  const id = (t as Title).id
  const karten = { titleById: new Map([[id, t as Title]]), releasesByTitle: new Map(r.length ? [[id, r]] : []) }
  return erstausgabeNeuigkeitTitel(karten, id, heute) !== undefined
}
const stufe = (t: unknown, r: Release[], heute = HEUTE) => stufeTitelEin(t as Title, r, heute) as { art: string; ab?: string }
pruefe('Neuigkeiten: Virgin Road (Vol. 1 am 30.10.) ohne Erstausgaben-Zeile', !neu(virgin, [virginVol1]))
pruefe('Neuigkeiten: Virgin Road am Erscheinungstag von Vol. 1 mit Zeile', neu(virgin, [virginVol1], '2026-10-30'))
pruefe('Neuigkeiten: Virgin Road ohne Band im Bestand mit Zeile', neu(virgin, []))
pruefe('Neuigkeiten: Anne Shirley (Vol. 2 künftig) mit Zeile', neu(anne, [anneVol2]))
pruefe('Neuigkeiten: Yamada-kun (Netflix-Dub, Vol. 1 künftig) mit Zeile', neu(yamada, [yamadaVol1]))
pruefe('Neuigkeiten: Virgin Road mit erschienenem TV-Termin mit Zeile', neu(virgin, [virginVol1, tvVergangen]))
const tvOhneDatum = { ...tvVergangen, schedule: {} } as unknown as Release
pruefe('Neuigkeiten: Virgin Road mit TV-Termin ohne Datum ohne Zeile', !neu(virgin, [virginVol1, tvOhneDatum]))
const virginStufe = stufe(virgin, [virginVol1])
pruefe('Entdecken: Virgin Road ist „bald“ ab Vol. 1', virginStufe.art === 'bald' && virginStufe.ab === '2026-10-30', JSON.stringify(virginStufe))
const tvHeute = { ...tvVergangen, schedule: { firstEpisodeDate: HEUTE } } as unknown as Release
pruefe('Neuigkeiten: Virgin Road mit TV-Termin genau heute mit Zeile', neu(virgin, [virginVol1, tvHeute]))
const vol2 = disc('virgin-road-vol2', 129193, 'Virgin Road – Vol. 2', '2026-11-27')
pruefe('Entdecken: mehrere Bände, „bald ab“ nennt den frühesten', stufe(virgin, [vol2, virginVol1]).ab === '2026-10-30')
const ohneSynchroMarke = { ...virgin, deErstausgabe: { von: '2026-04-11', publisher: 'AniMoon Publishing GmbH' } }
pruefe('Entdecken: Erstausgabe ohne Synchro-Marke bleibt erschienen', stufe(ohneSynchroMarke, [virginVol1]).art === 'erschienen')
const zukunftVon = stufe({ ...virgin, deErstausgabe: { von: '2026-12-01', synchro: true } }, [virginVol1])
pruefe('Entdecken: Erstausgabe selbst in der Zukunft nennt ihr eigenes Datum', zukunftVon.art === 'bald' && zukunftVon.ab === '2026-12-01', JSON.stringify(zukunftVon))
pruefe('Entdecken: Virgin Road am 30.10. ist erschienen', stufe(virgin, [virginVol1], '2026-10-30').art === 'erschienen')
pruefe('Entdecken: Anne Shirley bleibt erschienen', stufe(anne, [anneVol2]).art === 'erschienen')
pruefe('Entdecken: Yamada-kun bleibt erschienen', stufe(yamada, [yamadaVol1]).art === 'erschienen')

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zu „Auf Deutsch“ vor dem ersten deutschen Termin verletzt`)
  process.exit(1)
}
console.log('Auf Deutsch vor dem ersten deutschen Termin: Zusicherungen erfüllt (8 Anlassfälle, 8 Gegenfälle, 12 Regelfälle, 16 Folgestellen)')
