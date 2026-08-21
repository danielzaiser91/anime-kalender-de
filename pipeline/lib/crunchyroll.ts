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

/**
 * Legt kuratierte Folgentermine über die aus dem Kalender abgelesenen.
 *
 * Der Kalender zeigt je Tag eine Kachel, und die trägt eine Folgennummer — für
 * einen Auftakt mit drei Folgen an einem Tag also die einer einzigen davon. Was
 * dort nicht steht, kann nur ein Mensch nachtragen, und dann darf der nächste
 * Lauf es ihm nicht wieder wegnehmen: Bei einer Kollision derselben
 * Folgennummer gewinnt die Handeintragung, wie überall sonst in diesem Projekt
 * (siehe `data/dub-confirmed.yaml`).
 *
 * Der Wochentakt bleibt davon unberührt — er trägt weiter alles, wofür niemand
 * etwas Abweichendes eingetragen hat.
 */
export function beobachtungenZusammenfuehren(
  abgeleitet: Record<number, string>,
  kuratiert: Record<number, string> | undefined,
): Record<number, string> | undefined {
  const zusammen = { ...abgeleitet, ...kuratiert }
  return Object.keys(zusammen).length ? zusammen : undefined
}

/** Zieht die Serien-ID aus einer Crunchyroll-URL. */
export function crunchyrollSeriesId(url: string | undefined): string | undefined {
  return url ? (/\/series\/([A-Z0-9]+)/i.exec(url)?.[1] ?? undefined) : undefined
}
