/** Typen und Titel-Normalisierung für die Crunchyroll-Daten — ohne Playwright,
 *  damit der Build sie importieren kann, ohne einen Browser zu starten. */
import { addDays } from '../../shared/time.ts'

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

/**
 * Womit gerechnet wird, wenn die Staffellänge nirgends belegt ist.
 *
 * Die Zahl erfindet keine Folgenzahl — sie verhindert eine Rückrechnung. Wer im
 * Kalender bei Folge 25 einsteigt, kann in keiner Staffel stecken, die bei eins
 * anfängt, egal wie großzügig man sie schätzt.
 */
const VORGABE_STAFFELLAENGE = 12

/**
 * Was aus einer durchlaufenden Zählung folgt: Startnummer, Starttermin und die
 * Zahl der Folgen, die dieses Release wirklich abdeckt.
 */
export interface Durchzaehlung {
  firstEpisodeNumber: number
  firstEpisodeDate: string
  episodeCount: number
  /** Warum die Zählung nicht bei eins beginnt — gehört an den Release. */
  note: string
}

export const DURCHZAEHLUNG_BELEGT =
  'Crunchyroll zählt die Reihe durch: Diese Staffel setzt mitten in der Zählung ein.'
export const DURCHZAEHLUNG_UNKLAR =
  'Crunchyroll zählt die Reihe durch. Wo die Staffel beginnt, ist nicht belegt — ' +
  'geführt sind deshalb nur die im Kalender gesehenen Folgen.'

/**
 * Zählt Crunchyroll diese Reihe durch — und wenn ja, ab welcher Folge?
 *
 * Crunchyroll nummeriert über alle Staffeln hinweg, AniList je Staffel. Für
 * „Wistoria: Wand and Sword Staffel 2" heißt das: Crunchyroll führt die Folgen
 * 13 bis 24, AniList zählt zwölf. Ohne diese Unterscheidung rechnete der Build
 * aus „Folge 17 am 31.05.2026" einen Start am 08.02.2026 zurück und legte dort
 * die Folgen 1 bis 12 hin — zwölf Termine, die es nie gab, während die acht
 * belegten Termine aus dem Fenster [1..12] herausfielen und als Stützpunkte
 * nicht einmal mehr wirkten (gemessen am 21.08.2026, gemeldet von Daniel).
 *
 * Das Kennzeichen ist einfach: Liegt die kleinste beobachtete Folgennummer über
 * dem, was die Staffel hergibt, kann sie nicht zu einer Zählung ab Folge 1
 * gehören.
 *
 * Wo die Staffel dann **anfängt**, ist die zweite Frage, und sie ist nur mit
 * zwei Belegen zu beantworten:
 *
 *  1. die Staffellänge — aus AniList oder aniSearch, nicht die Vorgabe;
 *  2. die letzte Folge — belegt dadurch, dass der Kalender über den letzten
 *     gesehenen Termin hinausgereicht und dort nichts mehr gefunden hat. Das
 *     ist derselbe Schluss, mit dem `overlapsWindow` in `build.ts` eine ganze
 *     behauptete Synchro verwirft.
 *
 * Fehlt einer der beiden, wird **nicht** geschätzt: Dann bleibt der Zeitraum
 * auf die gesehenen Folgen beschränkt. Eine zweite Vermutung über die erste zu
 * legen wäre genau der Fehler, um den es hier geht.
 *
 * `kalenderBis` ist der letzte Tag, für den der Kalender **überhaupt** eine
 * deutsche Folge führt — nicht das Ende des abgesuchten Zeitraums. Der
 * Unterschied ist der ganze Punkt: Am 21.08.2026 lief der Abruf bis zum 30.08.,
 * die letzte deutsche Kachel im gesamten Kalender stand aber auf dem 19.08.
 * Crunchyroll kündigt Synchronfolgen also kaum vor. Gegen das abgesuchte
 * Fenster gemessen sah jede gerade laufende Reihe abgeschlossen aus, und „The
 * 100 Girlfriends Staffel 3" hätte statt bei Folge 25 bei Folge 17 begonnen —
 * dieselbe Erfindung eine Ebene höher.
 *
 * Und noch einmal, weil hier alles daran hängt: Die früheste Beobachtung ist
 * **nicht** der Staffelstart. Der Kalender zeigt nur ein Fenster von Wochen;
 * was davor lief, steht dort nie.
 */
export function durchlaufendeZaehlung(
  beobachtet: Record<number, string> | undefined,
  belegteFolgenzahl: number | undefined,
  kalenderBis: string | undefined,
  startnummer = 1,
): Durchzaehlung | undefined {
  const gesehen = beobachtet ?? {}
  const nummern = Object.keys(gesehen)
    .map(Number)
    .filter((n) => n > 0 && gesehen[n])
    .sort((a, b) => a - b)
  if (!nummern.length) return undefined

  const kleinste = nummern[0]
  const groesste = nummern[nummern.length - 1]
  if (kleinste <= startnummer + (belegteFolgenzahl ?? VORGABE_STAFFELLAENGE) - 1) return undefined

  const nurBelegtes: Durchzaehlung = {
    firstEpisodeNumber: kleinste,
    firstEpisodeDate: gesehen[kleinste],
    episodeCount: groesste - kleinste + 1,
    note: DURCHZAEHLUNG_UNKLAR,
  }
  if (!belegteFolgenzahl) return nurBelegtes
  // Mehr gesehene Folgen, als die Staffel haben soll: Dann stimmt die
  // Folgenzahl nicht, und auf ihr lässt sich nichts aufbauen.
  if (groesste - kleinste + 1 > belegteFolgenzahl) return nurBelegtes
  // Hätte die nächste Folge schon im Kalender stehen müssen? Nur dann ist das
  // Ausbleiben ein Beleg für das Ende — sonst läuft die Reihe weiter, und ihre
  // letzte gesehene Folge taugt nicht als Anker.
  if (!kalenderBis || addDays(gesehen[groesste], 7) > kalenderBis) return nurBelegtes

  const firstEpisodeNumber = groesste - belegteFolgenzahl + 1
  return {
    firstEpisodeNumber,
    firstEpisodeDate: addDays(gesehen[kleinste], -7 * (kleinste - firstEpisodeNumber)),
    episodeCount: belegteFolgenzahl,
    note: DURCHZAEHLUNG_BELEGT,
  }
}

/** Zieht die Serien-ID aus einer Crunchyroll-URL. */
export function crunchyrollSeriesId(url: string | undefined): string | undefined {
  return url ? (/\/series\/([A-Z0-9]+)/i.exec(url)?.[1] ?? undefined) : undefined
}
