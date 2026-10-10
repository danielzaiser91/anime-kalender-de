/**
 * **Premiere und Premiere\* (Handbeleg `Release.premiere`)** — Bau und Prüfung (Daniel, 10.10.2026).
 *
 * Das Feld setzt ein Mensch, wenn eine Quelle ausdrücklich „erstmals/Premiere“ sagt. Hier wird es
 * nur an die Termine geschrieben und auf Widersprüche geprüft — nie abgeleitet: nicht aus
 * Abwesenheit eines früheren Termins, nicht aus „im Angebot seit“.
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'
import { log, warn } from './util.ts'

/** Fernsehen: `tvPremiere` trägt die Aussage (`istPremiere`); Streaming: nur der erste Termin des Releases. */
export function schreibePremiere(events: ReleaseEvent[], releases: Release[]): { anzahl: number; widersprueche: string[] } {
  const belegt = new Map(releases.filter((r) => r.premiere).map((r) => [r.slug, r.premiere!]))
  const gesehen = new Set<string>()
  const widersprueche: string[] = []
  let anzahl = 0
  for (const ev of events) {
    const p = belegt.get(ev.releaseSlug)
    if (!p) continue
    /* Eine belegte Wiederholung schlägt den Handbeleg: kein Zeichen, dafür eine Meldung. */
    if (p.weg === 'tv' && ev.tvPremiere === false) widersprueche.push(`"${ev.releaseSlug}" ${ev.date}: Handbeleg „Premiere“, aber die Daten belegen eine Wiederholung`)
    const erster = !gesehen.has(ev.releaseSlug)
    gesehen.add(ev.releaseSlug)
    const gilt = p.weg === 'tv' ? ev.platform === 'tv' && ev.tvPremiere === true : erster
    if (!gilt) continue
    if (p.weg === 'stream') ev.premiere = true
    if (p.vorher) ev.premiereVorher = p.vorher
    anzahl++
  }
  return { anzahl, widersprueche }
}

/** `schreibePremiere` samt Meldung im Bau-Protokoll; ein Widerspruch ist nur eine Warnung (die Wiederholung gewinnt ohnehin). */
export function schreibePremiereMitMeldung(events: ReleaseEvent[], releases: Release[]): void {
  const { anzahl, widersprueche } = schreibePremiere(events, releases)
  for (const w of widersprueche) warn(w)
  if (anzahl) log(`Premiere laut Handbeleg: ${anzahl} Termine`)
}

const ISO =/^\d{4}-\d{2}-\d{2}$/

/** Widersprüche zwischen einem Handbeleg und dem übrigen Datensatz; leer = in Ordnung. */
export function premiereFehler(releases: Release[]): string[] {
  const fehler: string[] = []
  for (const r of releases) {
    const p = r.premiere
    if (!p) continue
    const at = `"${r.slug}" premiere`
    const start = r.schedule.firstEpisodeDate
    if (p.weg !== 'tv' && p.weg !== 'stream') fehler.push(`${at}: weg „${p.weg}“ ist weder tv noch stream`)
    else if (p.weg === 'tv' ? r.platform !== 'tv' : r.platform === 'tv' || r.platform === 'kino' || r.releaseType === 'disc')
      fehler.push(`${at}: weg „${p.weg}“ passt nicht zur Plattform ${r.platform}/${r.releaseType}`)
    if (!p.quelle || !r.sources.includes(p.quelle)) fehler.push(`${at}: quelle fehlt oder steht nicht in sources`)
    if (p.vorher !== undefined && p.vorher !== 'disc' && p.vorher !== 'kino') fehler.push(`${at}: vorher „${p.vorher}“ ist weder disc noch kino`)
    if (p.vorher && !(p.vorherDatum && ISO.test(p.vorherDatum) && p.vorherDatum < start))
      fehler.push(`${at}: vorher braucht ein vorherDatum (YYYY-MM-DD) vor dem Release ${start}`)
    if (!p.vorher && p.vorherDatum) fehler.push(`${at}: vorherDatum ohne vorher`)
    const frueher = releases.find(
      (x) => x.titleId === r.titleId && x !== r && !x.widerlegt && x.releaseType !== 'disc' && x.platform !== 'kino' && x.schedule.firstEpisodeDate < start,
    )
    if (frueher) fehler.push(`${at}: "${frueher.slug}" (${frueher.schedule.firstEpisodeDate}) liegt früher — dann ist es keine Premiere`)
  }
  return fehler
}
