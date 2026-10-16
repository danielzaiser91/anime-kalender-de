/**
 * Zusicherung: **Eine beobachtete Folge über der Folgenzahl wird ein Termin** (16.10.2026,
 * „Though I Am an Inept Villainess": Folge 12 am 18.10. 17:45 im Wochenprogramm, `episodeCount` 11 von AniList).
 * Läuft in `check:logic`; erfundene Releases, kein Netz.
 */
import type { Release, ReleaseEvent } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'
import { istStaffelfinale } from '../shared/tv-signale.ts'
import { beobachtetOhneTermin, hebeFolgenzahlAufBeobachtung } from './lib/folge-ueber-anzahl.ts'
import { pruefeErgebnis } from './lib/pruefung.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

/** Wochenprogramm: Folgen ab `ab` (Standard 1) bis `bis` jeden Sonntag ab 2026-08-02, Zahl laut AniList `zahl`. */
function crSerie(zahl: number, bis: number, extra: Partial<Release['schedule']> = {}, ab = 1): Release {
  const observed: Record<number, string> = {}
  for (let i = ab; i <= bis; i++) observed[i] = new Date(Date.UTC(2026, 7, 2 + 7 * (i - ab))).toISOString().slice(0, 10)
  return {
    slug: 'villainess',
    titleId: 188139,
    name: 'Though I Am an Inept Villainess',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    sources: ['https://www.crunchyroll.com/de/simulcastcalendar'],
    schedule: { firstEpisodeDate: observed[ab]!, time: '17:45', episodeCount: zahl, observed, ...extra },
  } as Release
}

const mitFinale = (e: ReleaseEvent, r: Release): boolean => istStaffelfinale(e, { releaseBySlug: new Map([[r.slug, r]]) })

/* Fall: Folge 12 angekündigt, AniList nennt 11. */
{
  const r = crSerie(11, 12)
  const vorher = expandEvents(r)
  pruefe('Ausgangslage: Folge 12 hat ohne Anhebung keinen Termin', !vorher.some((e) => e.episode === 12), vorher.length)
  pruefe('Ausgangslage: Prüfung meldet die fehlende Folge 12', beobachtetOhneTermin([r], vorher).length === 1, beobachtetOhneTermin([r], vorher))

  const betroffen = hebeFolgenzahlAufBeobachtung([r])
  const events = expandEvents(r)
  const f12 = events.find((e) => e.episode === 12)
  pruefe('Slug wird gemeldet', betroffen.join() === 'villainess', betroffen)
  pruefe('Folge 12 ist ein Termin am 18.10.', f12?.date === '2026-10-18', f12)
  pruefe('… mit der Uhrzeit des Releases (keine neue)', f12?.time === '17:45', f12)
  pruefe('Folgenzahl 12, als angenommen gekennzeichnet', r.schedule.episodeCount === 12 && r.schedule.episodeCountAssumed === true, r.schedule)
  pruefe('Termin trägt die Kennzeichnung', events.every((e) => e.episodeCountAssumed === true), events.at(-1))
  pruefe('Folge 11 ist kein Finale mehr', !mitFinale(events.find((e) => e.episode === 11)!, r))
  pruefe('Folge 12 ist auch keins (Zahl nur angenommen)', !mitFinale(f12!, r))
  pruefe('Prüfung ist danach still', beobachtetOhneTermin([r], events).length === 0)
  pruefe('pruefeErgebnis meldet nichts davon', !pruefeErgebnis([r], events, new Map(), '2026-10-15').fehler.some((f) => /ohne Termin/.test(f)))
  pruefe('pruefeErgebnis meldet die fehlende Folge 12 im alten Zustand', pruefeErgebnis([crSerie(11, 12)], vorher, new Map(), '2026-10-15').fehler.some((f) => /Folge 12 .* ohne Termin/.test(f)))
}

/* Gegenprobe: Reicht die Zahl, bleibt alles, wie es ist — auch das Finale. */
{
  const r = crSerie(12, 12)
  pruefe('keine Anhebung, wenn die Zahl reicht', hebeFolgenzahlAufBeobachtung([r]).length === 0 && r.schedule.episodeCountAssumed === undefined, r.schedule)
  const events = expandEvents(r)
  pruefe('Folge 12/12 bleibt Finale', mitFinale(events.find((e) => e.episode === 12)!, r))
}

/* Geteilter Start: Release ab Folge 6, zwei Folgen laut Zahl (6–7), beobachtet bis 8. */
{
  const r = crSerie(2, 8, { firstEpisodeNumber: 6 }, 6)
  hebeFolgenzahlAufBeobachtung([r])
  const nummern = expandEvents(r).map((e) => e.episode)
  pruefe('geteilter Start: Zahl 3 (Folgen 6–8)', r.schedule.episodeCount === 3 && nummern.join() === '6,7,8', { z: r.schedule.episodeCount, nummern })
}

/* Eine angehobene Zahl verliert ihre aniSearch-Herkunft. */
{
  const r = crSerie(11, 12, { episodeCountSource: 'anisearch' })
  hebeFolgenzahlAufBeobachtung([r])
  pruefe('Herkunft „anisearch“ entfällt', r.schedule.episodeCountSource === undefined, r.schedule)
}

/* Nur wöchentliche Releases: Ein Komplettabwurf bleibt unberührt. */
{
  const r = { ...crSerie(11, 12), releaseType: 'batch' } as Release
  pruefe('Batch wird nicht angefasst', hebeFolgenzahlAufBeobachtung([r]).length === 0 && r.schedule.episodeCount === 11)
}

/* Ein widerlegter Termin hat keinen Sendeplan und braucht keinen Termin; eine Beobachtung ohne Datum zählt nicht. */
{
  const widerlegt = { ...crSerie(11, 12), widerlegt: { am: '2026-10-01', grund: 'Test', gemeldet: false } } as Release
  pruefe('widerlegt: keine Meldung', beobachtetOhneTermin([widerlegt], []).length === 0, beobachtetOhneTermin([widerlegt], []))
  const ohneDatum = crSerie(11, 11)
  ohneDatum.schedule.observed![12] = ''
  pruefe('Beobachtung ohne Datum: weder Anhebung noch Meldung', hebeFolgenzahlAufBeobachtung([ohneDatum]).length === 0 && beobachtetOhneTermin([ohneDatum], expandEvents(ohneDatum)).length === 0)
}

/* Ohne Folgenzahl rechnet der Plan mit einer Folge; die Beobachtungen geben die Zahl vor (nicht zwölf). */
{
  const r = crSerie(11, 3)
  delete r.schedule.episodeCount
  hebeFolgenzahlAufBeobachtung([r])
  pruefe('ohne Zahl: Anhebung auf die höchste Beobachtung', r.schedule.episodeCount === 3 && r.schedule.episodeCountAssumed === true, r.schedule)
}

/* Geteilter Start, Beobachtung innerhalb der Spanne (6–10, beobachtet bis 8): nichts anheben. */
{
  const r = crSerie(5, 8, { firstEpisodeNumber: 6 }, 6)
  pruefe('geteilter Start innerhalb der Spanne: keine Anhebung', hebeFolgenzahlAufBeobachtung([r]).length === 0 && r.schedule.episodeCount === 5, r.schedule)
  pruefe('… und keine Meldung', beobachtetOhneTermin([r], expandEvents(r)).length === 0)
}

/* Der Termin muss zum selben Release gehören, und ein Batch wird nicht geprüft. */
{
  const a = crSerie(11, 12)
  const b = { ...crSerie(11, 12), slug: 'anderes' } as Release
  const nurB = expandEvents((hebeFolgenzahlAufBeobachtung([b]), b))
  pruefe('Termin eines anderen Releases deckt Folge 12 nicht', beobachtetOhneTermin([a], nurB).some((f) => /Folge 12 /.test(f)), beobachtetOhneTermin([a], nurB))
  const mitTermin = expandEvents((hebeFolgenzahlAufBeobachtung([b]), b)).map((e) => ({ ...e, releaseSlug: a.slug }))
  pruefe('Folge über der Zahl, aber mit Termin im Datensatz: keine Meldung', beobachtetOhneTermin([a], mitTermin).length === 0, beobachtetOhneTermin([a], mitTermin))
  const batch = { ...crSerie(11, 12), releaseType: 'batch' } as Release
  pruefe('Batch: keine Meldung', beobachtetOhneTermin([batch], []).length === 0, beobachtetOhneTermin([batch], []))
}

/* Belegtes Ende schlägt die Beobachtung: 11 Folgen, Ende am Tag von F11, F12 danach — Zahl bleibt, Fehler statt Anhebung. */
{
  const r = crSerie(11, 12, { episodeCountSource: 'anisearch' })
  r.schedule.lastEpisodeDate = r.schedule.observed![11]
  const betroffen = hebeFolgenzahlAufBeobachtung([r])
  const events = expandEvents(r)
  pruefe('belegtes Ende: keine Anhebung', betroffen.length === 0 && r.schedule.episodeCount === 11 && r.schedule.episodeCountAssumed === undefined, r.schedule)
  pruefe('belegtes Ende: Herkunft bleibt', r.schedule.episodeCountSource === 'anisearch', r.schedule)
  pruefe('belegtes Ende: Folge 11 bleibt Finale', mitFinale(events.find((e) => e.episode === 11)!, r))
  pruefe('belegtes Ende: Widerspruch wird als Fehler gemeldet', beobachtetOhneTermin([r], events).length === 1, beobachtetOhneTermin([r], events))
  const amEndeTag = crSerie(11, 12)
  amEndeTag.schedule.lastEpisodeDate = amEndeTag.schedule.observed![12]
  pruefe('Ende am Tag der höchsten Beobachtung: Anhebung wie sonst', hebeFolgenzahlAufBeobachtung([amEndeTag]).length === 1)
}

/* Beobachtungen unterhalb von firstEpisodeNumber (Nummer einer anderen Staffel) sind kein fehlender Termin. */
{
  const r = crSerie(5, 8, { firstEpisodeNumber: 6 }, 6)
  r.schedule.observed![3] = '2026-07-19'
  pruefe('Nummer unter dem Start: keine Meldung', beobachtetOhneTermin([r], expandEvents(r)).length === 0, beobachtetOhneTermin([r], expandEvents(r)))
}

/* Die Prüfung vergleicht nicht gegen die angehobene Zahl: Fehlt der Termin trotz Anhebung, meldet sie ihn. */
{
  const r = crSerie(11, 12)
  hebeFolgenzahlAufBeobachtung([r])
  const ohne12 = expandEvents(r).filter((e) => e.episode !== 12)
  pruefe('angehobene Zahl, Termin fehlt: Meldung', beobachtetOhneTermin([r], ohne12).length === 1, beobachtetOhneTermin([r], ohne12))
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-folge-ueber-anzahl: ok')
