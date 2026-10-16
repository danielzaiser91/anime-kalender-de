/**
 * Zusicherungen zu den drei Newsfehlern an Re:ZERO Staffel 4 (16.10.2026): Folgen-Meldung an der richtigen Staffel einer geteilten
 * Crunchyroll-Kennung, Ausfall-Vermerke auch an automatisch ergänzten Releases, Obergrenze der Datei kappt keine laufende Serie.
 * Läuft in `check:logic`. Erfundene Titel, kein Netz.
 */
import type { NewsEintrag, Release, Title } from '../shared/types.ts'
import { addDays, todayIso } from '../shared/time.ts'
import { ergaenzeVerpasstAnReleases } from './bau/verpasst-am-termin.ts'
import { verspaetungsMeldungen } from './lib/news-verspaetung.ts'
import { behalteEintrag } from './lib/news-obergrenze.ts'
import { baueNews } from './lib/news.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const heute = todayIso()
const SERIE = 'GSHARED01'
const url = `https://www.crunchyroll.com/de/series/${SERIE}/x`
const titel = (id: number, eigeneUrl?: string): Title => ({ id, franchiseId: eigeneUrl ? id : 1, slug: `t-${id}`, titleEn: `T${id}`, keywords: [], genres: [], streams: [{ platform: 'crunchyroll', url: eigeneUrl ?? url, dub: true }] }) as unknown as Title
const crRelease = (titleId: number, start: string, extra: Record<string, unknown> = {}): Release =>
  ({ slug: `r-${titleId}`, titleId, platform: 'crunchyroll', platformUrl: url, releaseType: 'weekly', sources: [url], schedule: { firstEpisodeDate: start, episodeCount: 19, ...extra } }) as unknown as Release
const folge = (nummer: number, tag: string, serieId = SERIE) => ({ serieId, serie: 'S', nummer, verfuegbarAb: `${tag}T14:00:00.000Z`, gesehenAm: tag })
const teile = (releases: Release[], folgen: ReturnType<typeof folge>[], titles = [titel(3), titel(4)]) =>
  baueNews(titles, releases, [], folgen, { zuerst: {} }).flatMap((e) => e.meldungen.filter((m) => m.art === 'folgen').map((m) => ({ ...m, teilId: m.teilId ?? e.titelId })))

/* 1. Zwei Staffeln, eine Kennung: Staffel 3 (Titel zuerst) hat kein Crunchyroll-Release, Staffel 4 läuft. */
const gestern = addDays(heute, -1)
const s4 = crRelease(4, addDays(heute, -30))
const m1 = teile([s4], [folge(14, gestern)])
pruefe('Folge von Staffel 4 hängt an Staffel 4, nicht am ersten Titel der Kennung', m1.length === 1 && m1[0]!.teilId === 4, m1.map((m) => m.teilId))
pruefe('die Meldung bleibt, was sie war: Tag, Folgennummer', m1[0]?.von === 14 && m1[0]?.bis === 14)
const m2 = teile([crRelease(3, addDays(heute, -300), { episodeCount: 16 }), s4], [folge(14, addDays(heute, -100))], [titel(3), titel(4)])
pruefe('alte Folge vor dem Start von Staffel 4 bleibt bei Staffel 3', m2.length === 1 && m2[0]!.teilId === 3, m2.map((m) => m.teilId))
const m3 = teile([crRelease(3, addDays(heute, -300), { episodeCount: 16 }), crRelease(4, addDays(heute, -30), { firstEpisodeNumber: 17, episodeCount: 12 })], [folge(40, gestern)])
pruefe('Folge 40 passt in keinen Bereich: erster Titel bleibt (bisheriges Verhalten)', m3.length === 1 && m3[0]!.teilId === 3, m3.map((m) => m.teilId))
const m4 = teile([crRelease(3, addDays(heute, -300), { firstEpisodeNumber: 1, episodeCount: 16 }), crRelease(4, addDays(heute, -30), { firstEpisodeNumber: 17, episodeCount: 12 })], [folge(18, gestern)])
pruefe('geteilte Zählung: Folge 18 gehört in den Bereich 17–28 von Staffel 4', m4.length === 1 && m4[0]!.teilId === 4, m4.map((m) => m.teilId))
const untere = teile([crRelease(4, addDays(heute, -30), { firstEpisodeNumber: 17, episodeCount: 12 })], [folge(5, gestern)])
pruefe('Folge 5 liegt unter dem Bereich 17–28 von Staffel 4: kein Treffer, erster Titel', untere.length === 1 && untere[0]!.teilId === 3, untere.map((m) => m.teilId))
const bisher = teile([crRelease(3, addDays(heute, -300), { episodeCount: 16 }), s4], [folge(14, gestern)])
pruefe('beide Staffeln decken Folge 14 ab: die jüngste gewinnt', bisher.length === 1 && bisher[0]!.teilId === 4, bisher.map((m) => m.teilId))
const anderer = (id: number, plattform: string, adresse: string) => ({ ...crRelease(id, addDays(heute, -10)), platform: plattform, platformUrl: adresse }) as Release
pruefe('ein jüngeres Release von Staffel 3 bei Amazon oder unter anderer Kennung zählt nicht', teile([s4, anderer(3, 'primevideo', url), anderer(3, 'crunchyroll', 'https://www.crunchyroll.com/de/series/GANDERE/x')], [folge(14, gestern)])[0]?.teilId === 4)
const obere = teile([crRelease(3, addDays(heute, -300), { episodeCount: 16 })], [folge(40, gestern)], [titel(4), titel(3)])
pruefe('Folge 40 liegt über Staffel 3 (16 Folgen): kein Treffer, erster Titel', obere.length === 1 && obere[0]!.teilId === 4, obere.map((m) => m.teilId))
pruefe('ein einziger Titel an der Kennung: wie bisher', teile([], [folge(1, gestern)], [titel(9)])[0]?.teilId === 9)

/* 2. Ausfall-Vermerke an einem Release, das nach Phase 05 entstand. */
const vermerk = (episode: number, erwartetAm: string, extra: Record<string, unknown> = {}) => ({ slug: 'r-4', episode, erwartetAm: `${erwartetAm}T14:00:00.000Z`, bemerktAm: `${erwartetAm}T20:00:00.000Z`, ...extra })
const auto = crRelease(4, '2026-04-08')
const anzahl = ergaenzeVerpasstAnReleases([auto], [vermerk(14, '2026-09-16', { erschienenAm: '2026-10-14T14:00:00.000Z' }), vermerk(3, '2026-04-01'), { ...vermerk(14, '2026-09-16'), slug: 'anderer' }])
pruefe('Vermerk des Slugs hängt am Release, Vermerk vor dem Start und fremder Slug nicht', anzahl === 1 && Object.keys(auto.schedule!.verpasst ?? {}).join() === '14', auto.schedule!.verpasst)
const arten = verspaetungsMeldungen(auto).map((m) => m.art).sort().join()
pruefe('daraus entstehen „verspätet“ und „nachgereicht“', arten === 'nachgereicht,verspaetet', arten)
const kuratiert = crRelease(4, '2026-04-08', { verpasst: { 14: { erwartetAm: '2026-09-16T14:00:00.000Z' } } })
ergaenzeVerpasstAnReleases([kuratiert], [vermerk(15, '2026-09-23')])
pruefe('Release mit eigenen Vermerken bleibt unverändert', Object.keys(kuratiert.schedule!.verpasst ?? {}).join() === '14')
pruefe('ohne Vermerk bleibt das Feld leer', ergaenzeVerpasstAnReleases([crRelease(5, '2026-04-08')], []) === 0)
pruefe('Release ohne Sendeplan wird übergangen', ergaenzeVerpasstAnReleases([{ slug: 'r-4' } as unknown as Release], [vermerk(14, '2026-09-16')]) === 0)

/* 3. Obergrenze: eine laufende Serie verliert ihre Vorgeschichte nicht, Altes darf fallen. */
const bleibt = (e: NewsEintrag, platz = 401): boolean => behalteEintrag(e, platz, heute, 400)
const eintrag = (am: string, art: string): NewsEintrag => ({ am, titelId: 1, titel: 'X', slug: 'x', meldungen: [{ art }] }) as unknown as NewsEintrag
pruefe('Folgen-Meldung vor 56 Tagen bleibt', bleibt(eintrag(addDays(heute, -56), 'folgen')))
pruefe('Folgen-Meldung vor 57 Tagen darf fallen (spätestens dann sichtbar gekappt)', !bleibt(eintrag(addDays(heute, -57), 'folgen')))
pruefe('Verspätung und Nachreichung vor 40 Tagen bleiben', bleibt(eintrag(addDays(heute, -40), 'verspaetet')) && bleibt(eintrag(addDays(heute, -40), 'nachgereicht')))
pruefe('eine Ankündigung vor 40 Tagen fällt wie bisher', !bleibt(eintrag(addDays(heute, -40), 'angekuendigt')))
pruefe('eine offizielle Meldung bleibt immer', bleibt(eintrag(addDays(heute, -300), 'offiziell')))
const tag0 = addDays(heute, 1)
const eigene = (i: number) => `https://www.crunchyroll.com/de/series/GV${i}/x`
const viele = Array.from({ length: 405 }, (_, i) => titel(1000 + i, eigene(i)))
const dazu = viele.map((t, i) => ({ titleId: t.id, slug: `a-${t.id}`, platform: 'crunchyroll', releaseType: 'series', schedule: { firstEpisodeDate: tag0 }, sources: [eigene(i)] }) as unknown as Release)
const voll = baueNews([...viele, titel(3), titel(4)], [...dazu, s4], [], [folge(12, addDays(heute, -37)), folge(11, addDays(heute, -100))], { zuerst: {} })
pruefe('Bau mit über 400 Einträgen: die Folgen-Meldung von vor 37 Tagen steht noch drin', voll.length > 400 && voll.some((e) => e.am === addDays(heute, -37) && e.meldungen.some((m) => m.art === 'folgen')), voll.length)
pruefe('Bau mit über 400 Einträgen: die Folgen-Meldung von vor 100 Tagen fällt weg', !voll.some((e) => e.am === addDays(heute, -100) && e.meldungen.some((m) => m.art === 'folgen')))
pruefe('Platz 440 ist die harte Grenze: 439 bleibt, 440 fällt, eine offizielle Meldung bleibt auch dort', bleibt(eintrag(heute, 'folgen'), 439) && !bleibt(eintrag(heute, 'folgen'), 440) && bleibt(eintrag(heute, 'offiziell'), 900))
const mitFolge = viele.map((_, i) => folge(1, addDays(heute, -10), `GV${i}`))
const hart = baueNews([...viele, titel(3), titel(4)], [...dazu, s4], [], mitFolge, { zuerst: {} })
pruefe('Bau mit über 800 Einträgen (405 Ankündigungen, 405 Folgen): über 400 (Ausnahme wirkt), nie über 440', hart.length > 400 && hart.length <= 440, hart.length)

/* 4. Berliner Tag: 23:30 UTC ist 00:30 oder 01:30 Berlin, also schon der nächste Tag — Staffel 4 startet an diesem Berliner Tag. */
const utcTag = addDays(heute, -5)
const nachts = teile([crRelease(3, addDays(heute, -300), { episodeCount: 16 }), crRelease(4, addDays(utcTag, 1))], [{ ...folge(1, utcTag), verfuegbarAb: `${utcTag}T23:30:00.000Z` }])
pruefe('Folge um 00:30 Berlin am Starttag von Staffel 4 gehört zu Staffel 4 (UTC-Tag wäre der Vortag)', nachts.length === 1 && nachts[0]!.teilId === 4, nachts.map((m) => m.teilId))

if (fehler) {
  console.error(`check-news-staffel-zuordnung: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-news-staffel-zuordnung: alles grün')
