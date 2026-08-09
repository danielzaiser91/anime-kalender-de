/** Typen und Titel-Normalisierung für die Crunchyroll-Daten — ohne Playwright,
 *  damit der Build sie importieren kann, ohne einen Browser zu starten. */

export interface CrunchyrollSlot {
  /** Normalisierter Titel ohne Sprach-Suffix, als Schlüssel zum Zuordnen. */
  key: string
  /** Titel so, wie Crunchyroll ihn schreibt. */
  rawTitle: string
  /** Serien-ID aus der Crunchyroll-URL — der stabilste Schlüssel überhaupt. */
  seriesId?: string
  seriesUrl?: string
  date: string
  /** "HH:MM" in Berliner Ortszeit. */
  time: string
  episode?: number
  /** true, wenn der Eintrag ausdrücklich als deutsche Synchro läuft. */
  german: boolean
}

/** Ein tatsächlich im Kalender gesehener Sendetermin. */
export interface CrunchyrollObservation {
  date: string
  /** Folgennummer, falls die Kachel eine nennt. */
  episode?: number
}

export interface CrunchyrollEntry {
  time: string
  /** 0 = Montag. */
  weekday: number
  dates: string[]
  rawTitle: string
  seriesId?: string
  seriesUrl?: string
  /**
   * Alle je gesehenen Termine mit Folgennummer, über Läufe hinweg gesammelt.
   *
   * Das ist die eigentliche Beweislage. `earliest` allein reichte nicht: Ein
   * einzelner Ausreißer — etwa eine Vorab-Folge an einem anderen Wochentag —
   * hat als „früheste Folge 1" den kompletten Sendeplan um zwei Tage
   * verschoben, obwohl vier spätere Termine einträchtig auf Montag zeigten.
   */
  observations?: CrunchyrollObservation[]
  /** Frühester gesehener Termin und die zugehörige Folgennummer. */
  earliest?: { date: string; episode?: number }
  /** true, wenn zwei aufeinanderfolgende Termine genau sieben Tage auseinanderliegen. */
  weeklyConfirmed?: boolean
}

export interface CrunchyrollData {
  scrapedAt: string
  /** Zeitraum, den der letzte Lauf tatsaechlich abgedeckt hat. */
  window?: { from: string; to: string }
  german: Record<string, CrunchyrollEntry>
  slots: CrunchyrollSlot[]
}

/** Macht Titel vergleichbar: Kleinschreibung, ohne Satzzeichen und Sprach-Suffix. */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\((deutsch|english|français|espa[ñn]ol|portugu[êe]s|italiano|polski)\)/g, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/[:!?,.'"„“”–—-]/g, ' ')
    .replace(/\bstaffel\s*(\d+)\b/g, 's$1')
    .replace(/\bseason\s*(\d+)\b/g, 's$1')
    .replace(/\b(\d+)(st|nd|rd|th)\s+season\b/g, 's$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Zieht die Serien-ID aus einer Crunchyroll-URL. */
export function crunchyrollSeriesId(url: string | undefined): string | undefined {
  return url ? (/\/series\/([A-Z0-9]+)/i.exec(url)?.[1] ?? undefined) : undefined
}
