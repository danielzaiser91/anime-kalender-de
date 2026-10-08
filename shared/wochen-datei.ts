import type { Release, ReleaseEvent, Title } from './types.ts'
import { addDays, startOfWeek } from './time.ts'

/**
 * **Wochen-Datei: der Start der Wochenansicht** (Ladegewicht, `docs/wissen/datensatz.md`).
 *
 * Die Wochenansicht braucht beim Erstaufruf nur die Termine einer Woche samt Release und Titel. `woche.json` führt genau
 * die und ersetzt beim Start `titles-core.json` + `releases.json` + `events.json`; die vollständigen Dateien kommen danach
 * im Hintergrund. Jeder Eintrag steht **unverändert** auch in den vollen Dateien (`pruefeWochenDatei`).
 */
export interface WochenDatei {
  /** Montag und Sonntag der Woche, für die der Bau gelaufen ist (Europe/Berlin). */
  von: string
  bis: string
  titles: Title[]
  releases: Release[]
  events: ReleaseEvent[]
}

/**
 * Ob die Wochen-Datei für diese Ansicht reicht: Anker und Tag des Besuchs liegen in ihrer Woche. Liegt „heute" außerhalb,
 * fehlen Folgen, die inzwischen erschienen sind (`neuesteErschienen`).
 */
export function wocheDeckt(woche: Pick<WochenDatei, 'von' | 'bis'>, anker: string, heute: string): boolean {
  return anker >= woche.von && anker <= woche.bis && heute >= woche.von && heute <= woche.bis
}

/** Ob ein Termin zu `neuesteErschienen` (web/src/lib/gesehen.ts) zählen kann. */
const zaehltAlsErschienen = (e: ReleaseEvent): boolean => Boolean(e.episode) && !e.sichtung && e.platform !== 'tv'

/**
 * Schneidet die Wochen-Datei aus den vollen Dateien. Mitgenommen wird, was die Wochenansicht außer den Terminen selbst liest:
 * alle Releases der gezeigten Titel (`istPremiere` zählt über sie) und je Titel die letzte schon erschienene Folge vor der Woche
 * (`neuesteErschienen`). Die Reihenfolge der vollen Dateien bleibt erhalten.
 */
export function baueWochenDatei(heute: string, titles: Title[], releases: Release[], events: ReleaseEvent[]): WochenDatei {
  const von = startOfWeek(heute)
  const bis = addDays(von, 6)
  const imFenster = events.filter((e) => e.date >= von && e.date <= bis)
  const titelIds = new Set(imFenster.map((e) => e.titleId))

  const davor = new Map<number, ReleaseEvent>()
  for (const e of events) {
    if (e.date >= von || !titelIds.has(e.titleId) || !zaehltAlsErschienen(e)) continue
    const bisher = davor.get(e.titleId)
    if (!bisher || e.episode! > bisher.episode!) davor.set(e.titleId, e)
  }
  const mitgenommen = new Set<ReleaseEvent>([...imFenster, ...davor.values()])
  const eventsSchnitt = events.filter((e) => mitgenommen.has(e))
  const releaseSlugs = new Set(eventsSchnitt.map((e) => e.releaseSlug))
  return {
    von,
    bis,
    titles: titles.filter((t) => titelIds.has(t.id)),
    releases: releases.filter((r) => titelIds.has(r.titleId) || releaseSlugs.has(r.slug)),
    events: eventsSchnitt,
  }
}

/**
 * Widersprüche zwischen Wochen-Datei und vollen Dateien (leer = in Ordnung). Geprüft wird jeder Eintrag auf Gleichheit
 * (Termin, Release, Titel), dazu, dass jeder Termin der Woche in der Datei steht und jeder Termin Release und Titel dabeihat.
 */
export function pruefeWochenDatei(w: WochenDatei, titles: Title[], releases: Release[], events: ReleaseEvent[]): string[] {
  const fehler: string[] = []
  const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const titelNach = new Map(titles.map((t) => [t.id, t]))
  const releaseNach = new Map(releases.map((r) => [r.slug, r]))
  const eventNach = new Map(events.map((e) => [e.id, e]))
  for (const e of w.events) if (!gleich(e, eventNach.get(e.id))) fehler.push(`Wochen-Datei: Termin ${e.id} weicht von events.json ab oder fehlt dort`)
  for (const r of w.releases) if (!gleich(r, releaseNach.get(r.slug))) fehler.push(`Wochen-Datei: Release ${r.slug} weicht von releases.json ab oder fehlt dort`)
  for (const t of w.titles) if (!gleich(t, titelNach.get(t.id))) fehler.push(`Wochen-Datei: Titel ${t.id} weicht von titles-core.json ab oder fehlt dort`)

  const imWochenRelease = new Set(w.releases.map((r) => r.slug))
  const imWochenTitel = new Set(w.titles.map((t) => t.id))
  const imWochenTermin = new Set(w.events.map((e) => e.id))
  for (const e of events) {
    if (e.date >= w.von && e.date <= w.bis && !imWochenTermin.has(e.id)) fehler.push(`Wochen-Datei: Termin ${e.id} (${e.date}) fehlt`)
  }
  for (const e of w.events) {
    if (!imWochenRelease.has(e.releaseSlug)) fehler.push(`Wochen-Datei: Release ${e.releaseSlug} zu Termin ${e.id} fehlt`)
    if (!imWochenTitel.has(e.titleId)) fehler.push(`Wochen-Datei: Titel ${e.titleId} zu Termin ${e.id} fehlt`)
  }
  return fehler.slice(0, 20)
}
