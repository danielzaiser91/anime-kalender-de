import { readJson } from '../lib/util.ts'
import type { CrunchyrollEntry } from '../lib/crunchyroll.ts'
/** Der Simulcast-Kalender (seit ~21.10.2026 auf /de/simulcasts umgeleitet): nur noch Beleg der damals gemessenen Termine. */
const CR_CALENDAR_URL = 'https://www.crunchyroll.com/de/simulcastcalendar'

/**
 * Der Beleglink eines Crunchyroll-Eintrags. Termine aus dem Wochenprogramm (Beobachtung mit `quelle: 'woche'`) belegt der Artikel,
 * den der Sammler gelesen hat (`artikel` in `data/crunchyroll-woche.json`). Der Simulcast-Kalender ist seit ~21.10.2026 umgeleitet:
 * Einträge, die nur aus ihm stammen, behalten den historischen Link (kein besserer Beleg für die damals gemessenen Termine).
 */
export function crQuelleUrl(slot: Pick<CrunchyrollEntry, 'observations'>): string {
  const artikel = readJson<{ artikel?: string }>('data/crunchyroll-woche.json', {}).artikel
  const ausWoche = (slot.observations ?? []).some((o) => o.quelle === 'woche')
  return ausWoche && artikel ? artikel : CR_CALENDAR_URL
}
