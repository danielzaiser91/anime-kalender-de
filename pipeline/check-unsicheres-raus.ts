/**
 * Zusicherung: **Eine Wochenprogramm-Folge über der belegten Folgenzahl steht nicht im Kalender** (Daniel, 18.10.2026, Villainess F12).
 * Läuft in `check:logic`; erfundene Releases, kein Netz.
 */
import type { Release, Title } from '../shared/types.ts'
import { ergaenzeCrSimuldubs } from './bau/06-cr-simuldubs.ts'
import { expandEvents } from '../shared/logic.ts'
import { observedEpisodes } from './bau/titel-hilfen.ts'
import { wocheAnhaengen, type CrunchyrollEntry } from './lib/crunchyroll.ts'
import { beobachtetOhneTermin, hebeFolgenzahlAufBeobachtung } from './lib/folge-ueber-anzahl.ts'
import { ohneWocheUeberAnzahl } from './lib/woche-ueber-anzahl.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

function release(slug: string, titleId: number, extra: Partial<Release> = {}): Release {
  return {
    slug,
    titleId,
    name: slug,
    platform: 'netflix',
    releaseType: 'weekly',
    sources: ['https://example.org/q'],
    schedule: { firstEpisodeDate: '2026-10-18', time: '18:00', episodeCount: 3 },
    ...extra,
  } as Release
}

/* --- Teil 2: Wochenprogramm über der belegten Zahl --- */
function crSlot(bisGemessen: number): CrunchyrollEntry {
  const observations = Array.from({ length: bisGemessen }, (_, i) => ({ date: new Date(Date.UTC(2026, 7, 2 + 7 * i)).toISOString().slice(0, 10), episode: i + 1 }))
  return { time: '17:45', weekday: 6, dates: observations.map((o) => o.date), rawTitle: 'x', seriesId: 'GT1', observations }
}
const aufbau = (slot: CrunchyrollEntry, folge: number, datum: string) => wocheAnhaengen({ k: slot }, [{ key: 'k', seriesId: 'GT1', episode: folge, date: datum }])

const slot = crSlot(11)
pruefe('Ausgangslage: das Wochenprogramm hängt Folge 12 an, mit Herkunft', aufbau(slot, 12, '2026-10-18') === 1 && slot.observations!.at(-1)!.quelle === 'woche', slot.observations!.at(-1))
const sauber = ohneWocheUeberAnzahl(slot, { episodeCount: 11 }, 'villainess')
pruefe('Folge 12 aus dem Wochenprogramm über belegter Zahl 11 entfällt', observedEpisodes(sauber)[12] === undefined && observedEpisodes(sauber)[11] === '2026-10-11', observedEpisodes(sauber))
pruefe('… und der Eingang bleibt unverändert (keine Mutation des Bestands)', slot.observations!.length === 12)
const r = release('villainess', 188139, { platform: 'crunchyroll', schedule: { firstEpisodeDate: '2026-08-02', time: '17:45', episodeCount: 11, observed: observedEpisodes(sauber) } as Release['schedule'] })
pruefe('keine Anhebung der Folgenzahl, kein Termin 12', hebeFolgenzahlAufBeobachtung([r]).length === 0 && !expandEvents(r).some((e) => e.episode === 12) && r.schedule.episodeCount === 11)
pruefe('keine Meldung „beobachtet ohne Termin“', beobachtetOhneTermin([r], expandEvents(r)).length === 0)

const gemessen = crSlot(12)
pruefe('Gemessene Folge 12 (kein Wochenprogramm) bleibt und hebt weiter an', observedEpisodes(ohneWocheUeberAnzahl(gemessen, { episodeCount: 11 }, 'x'))[12] !== undefined)
const angenommen = crSlot(11)
aufbau(angenommen, 12, '2026-10-18')
pruefe('Zahl nur angenommen: Folge 12 bleibt', observedEpisodes(ohneWocheUeberAnzahl(angenommen, { episodeCount: 11, episodeCountAssumed: true }, 'x'))[12] !== undefined)
pruefe('Zahl unbekannt: Folge 12 bleibt', observedEpisodes(ohneWocheUeberAnzahl(angenommen, {}, 'x'))[12] !== undefined)
const innerhalb = crSlot(10)
aufbau(innerhalb, 11, '2026-10-11')
pruefe('Wochenprogramm-Folge innerhalb der Zahl bleibt', observedEpisodes(ohneWocheUeberAnzahl(innerhalb, { episodeCount: 11 }, 'x'))[11] !== undefined)
const grenze = crSlot(11)
aufbau(grenze, 13, '2026-10-25')
pruefe('Folge 13 entfällt auch, Zahl 12 belegt lässt 12 zu', observedEpisodes(ohneWocheUeberAnzahl(grenze, { episodeCount: 12 }, 'x'))[13] === undefined && observedEpisodes(ohneWocheUeberAnzahl(grenze, { episodeCount: 13 }, 'x'))[13] !== undefined)
const fortsetzung: CrunchyrollEntry = { ...crSlot(0), observations: [{ date: '2026-09-27', episode: 13 }, { date: '2026-10-04', episode: 14 }, { date: '2026-10-11', episode: 15, quelle: 'woche' }] }
pruefe('Zählung beginnt nicht bei 1 (Fortsetzung): nichts wird verworfen', ohneWocheUeberAnzahl(fortsetzung, { episodeCount: 12 }, 'x') === fortsetzung)

const ab13 = crSlot(14)
aufbau(ab13, 15, '2026-11-08')
pruefe('A4: Folgen 13–24 (firstEpisodeNumber 13, Zahl 12): Wochenprogramm-Folge 15 bleibt', observedEpisodes(ohneWocheUeberAnzahl(ab13, { episodeCount: 12, firstEpisodeNumber: 13 }, 'x'))[15] !== undefined)
pruefe('A4: … Folge 15 entfällt ohne firstEpisodeNumber (Zahl 12 ab 1 reicht bis 12)', observedEpisodes(ohneWocheUeberAnzahl(ab13, { episodeCount: 12 }, 'x'))[15] === undefined)
const ab13Zu = crSlot(14)
aufbau(ab13Zu, 25, '2026-11-08')
pruefe('A4: … Folge 25 liegt über der letzten (24) und entfällt', observedEpisodes(ohneWocheUeberAnzahl(ab13Zu, { episodeCount: 12, firstEpisodeNumber: 13 }, 'x'))[25] === undefined)
const nurWoche: CrunchyrollEntry = { ...crSlot(0), observations: [{ date: '2026-08-02', episode: 1, quelle: 'woche' }, { date: '2026-10-18', episode: 12, quelle: 'woche' }] }
pruefe('A4/M13: Folge 1 nur aus dem Wochenprogramm belegt die Zählung ab 1 nicht — nichts wird verworfen', ohneWocheUeberAnzahl(nurWoche, { episodeCount: 11 }, 'x') === nurWoche)

/* A3: der Auto-Pfad (06) kappt wie der kuratierte. */
const autoBeob = crSlot(11)
aufbau(autoBeob, 12, '2026-10-18')
const autoSlot = { ...autoBeob, earliest: autoBeob.observations![0], seriesUrl: 'https://example.org/serie/GT1' } as unknown as CrunchyrollEntry
const autoTitel = { id: 900030, episodes: 11, jpYear: 2026, streams: [], titleEn: 'Auto Titel' } as unknown as Title
function autoBau(): Release {
  const releases: Release[] = []
  ergaenzeCrSimuldubs({ crunchyroll: { german: { k: autoSlot } } as never, usedCrKeys: new Set(), titleForCalendarName: () => autoTitel, titleFromSeries: () => autoTitel, titelAusKatalog: () => undefined, seenSlugs: new Set(), releases, anisearchEpisodes: () => ({ count: 11, estimated: false }), crKalenderBis: '2026-10-25', unverified: [] })
  return releases[0]!
}
const auto = autoBau()
pruefe('A3: Auto-Pfad übernimmt Wochenprogramm-Folge 12 über belegter Zahl 11 nicht', auto.schedule.observed?.[12] === undefined && auto.schedule.observed?.[11] === '2026-10-11', auto.schedule.observed)
pruefe('A3: … Zahl bleibt 11, kein Termin 12', hebeFolgenzahlAufBeobachtung([auto]).length === 0 && auto.schedule.episodeCount === 11 && !expandEvents(auto).some((e) => e.episode === 12))

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Unsicheres raus: Wochenprogramm-Folgen über der Zahl stehen nicht im Kalender')
