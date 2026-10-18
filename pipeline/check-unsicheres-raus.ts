/**
 * Zusicherung: **Unsicheres steht nicht im Kalender** (Daniel, 18.10.2026): kein Termin ohne belegte deutsche Synchro
 * (Beerus, `sprache` omu/offen) und keine Wochenprogramm-Folge über der belegten Folgenzahl (Villainess F12).
 * Läuft in `check:logic`; erfundene Releases, kein Netz.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { expandEvents, merkbareTermine } from '../shared/logic.ts'
import { fuegeTermineEin } from './bau/13-7-angebot-termine.ts'
import { observedEpisodes } from './bau/titel-hilfen.ts'
import { wocheAnhaengen, type CrunchyrollEntry } from './lib/crunchyroll.ts'
import { beobachtetOhneTermin, hebeFolgenzahlAufBeobachtung } from './lib/folge-ueber-anzahl.ts'
import { pruefeInvarianten } from './lib/invarianten.ts'
import { mitBelegterSynchro, termineOhneBelegteSynchro } from './lib/ohne-synchro-beleg.ts'
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


/* --- Teil 1: omu/offen --- */
const omu = release('omu-x', 900001, { sprache: 'omu' })
const offen = release('offen-y', 900002, { sprache: 'offen' })
const deutsch = release('deutsch-z', 900003)
pruefe('Ausgangslage: der Auffalter erzeugt Termine für alle drei', [omu, offen, deutsch].every((r) => expandEvents(r).length === 3))
pruefe('mitBelegterSynchro: omu fällt', !mitBelegterSynchro(expandEvents(omu)[0]!))
pruefe('mitBelegterSynchro: offen fällt', !mitBelegterSynchro(expandEvents(offen)[0]!))
pruefe('mitBelegterSynchro: ohne Kennzeichnung bleibt', mitBelegterSynchro(expandEvents(deutsch)[0]!))


const nachtrag: ReleaseEvent[] = []
const neu = fuegeTermineEin(nachtrag, [omu, deutsch, offen])
pruefe('Nachtrag (Angebot-Termine): omu/offen kommen nicht hinein', neu.length === 3 && nachtrag.length === 3 && nachtrag.every((e) => e.releaseSlug === 'deutsch-z'), nachtrag.map((e) => e.id))

const roh = [...expandEvents(omu), ...expandEvents(offen), ...expandEvents(deutsch)]
const befund = termineOhneBelegteSynchro(roh)
pruefe('Wächter: sechs Funde für sechs omu/offen-Termine, deutsche nicht', befund.length === 6 && befund.every((f) => !f.includes('deutsch-z')), befund)
pruefe('Wächter: nennt die Sprache', befund.some((f) => f.includes('„omu“')) && befund.some((f) => f.includes('„offen“')), befund)
pruefe('Wächter: sauberer Bestand bleibt still', termineOhneBelegteSynchro(expandEvents(deutsch)).length === 0)
const invarianten = pruefeInvarianten([omu, deutsch], [...expandEvents(omu), ...expandEvents(deutsch)], new Map())
pruefe('Wächter hängt an der Endkontrolle (pruefeInvarianten)', invarianten.fehler.filter((f) => f.includes('ohne belegte Synchro')).length === 3, invarianten.fehler)
pruefe('Merken/Kalenderknopf (merkbareTermine): omu und offen fehlen, deutsche bleiben', merkbareTermine(omu, '2026-10-01').length === 0 && merkbareTermine(offen, '2026-10-01').length === 0 && merkbareTermine(deutsch, '2026-10-01').length === 3)

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

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Unsicheres raus: omu/offen-Termine und Wochenprogramm-Folgen über der Zahl stehen nicht im Kalender')
