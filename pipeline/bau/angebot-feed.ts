import { DIENSTE, type MotnDaten } from '../lib/motn.ts'

type Meldung = { art?: 'new' | 'removed'; imdbId?: string; dienst?: string; am?: string; deutsch?: boolean }
export type MotnChanges = { gesehen?: Record<string, Meldung> }

/**
 * Tagesfeed `data/motn-changes.json` in den Monatsbestand einrechnen: Eine
 * „new"-Meldung mit deutscher Tonspur setzt `seit` für den Anbieter, wenn
 * `motn.json` die Serie schon kennt und dort für den Anbieter noch kein `seit`
 * steht. Ein belegtes `seit` bleibt, eine spätere „removed"-Meldung des
 * Anbieters sperrt, ohne API-Anfrage. Gibt eine Kopie zurück.
 */
export function mitFeedSeit(motn: MotnDaten, changes: MotnChanges): MotnDaten {
  const meldungen = Object.values(changes.gesehen ?? {})
  const entfernt = (m: Meldung): boolean =>
    meldungen.some((x) => x.art === 'removed' && x.imdbId === m.imdbId && x.dienst === m.dienst && (x.am ?? '') >= (m.am ?? ''))
  const shows = { ...motn.shows }
  for (const m of meldungen) {
    const anbieter = DIENSTE[m.dienst ?? '']
    const eintrag = m.imdbId ? Object.entries(shows).find(([k, s]) => (s.imdbId ?? k) === m.imdbId) : undefined
    const show = eintrag?.[1]
    if (m.art !== 'new' || m.deutsch !== true || !anbieter || !m.am || !show) continue
    if (show.dienste?.[anbieter]?.seit || entfernt(m)) continue
    const alt = show.dienste?.[anbieter]
    const dienste = { ...show.dienste, [anbieter]: { gelistet: [], deutsch: [], ...alt, seit: m.am } }
    shows[eintrag![0]] ={ ...show, dienste }
  }
  return { ...motn, shows }
}
