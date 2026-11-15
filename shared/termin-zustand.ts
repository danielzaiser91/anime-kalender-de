import { berlinToUtc } from './time.ts'

/**
 * Wo steht ein Termin gerade? Eine Stelle für „erschienen“, „fällig“ und „ausgeblieben“.
 *
 * - `angekuendigt`: Der Zeitpunkt liegt in der Zukunft, oder die Folge hängt hinter einer offenen Lücke.
 * - `faellig`: Der Zeitpunkt ist verstrichen, aber es gibt keine Sichtung (`ohneSichtung`).
 * - `erschienen`: Der Zeitpunkt ist verstrichen, und nichts spricht dagegen.
 * - `ausgeblieben`: Der Anbieter hat den Termin verstreichen lassen (`verpasst` ohne `erschienenAm`).
 */
export type TerminZustand = 'angekuendigt' | 'faellig' | 'erschienen' | 'ausgeblieben'

/** Was der Zustand vom Termin liest (`ReleaseEvent` ist ein Obermenge davon). */
export interface TerminFelder {
  date: string
  time?: string
  verpasst?: { erschienenAm?: string }
  nachLuecke?: boolean
  releaseType?: string
  platform?: string
  /** Vom Plan gesetzt: Der Termin ist nur angekündigt, keine Sichtung belegt die Folge. */
  ohneSichtung?: boolean
}

/** Ein Katalogstart (`batch`, nicht TV) ohne Uhrzeit: alle Folgen an einem Tag, Zeitpunkt unbekannt (Bass X Machina, 03.11.2026). */
export function istKatalogstartOhneUhrzeit(e: { time?: string; releaseType?: string; platform?: string }): boolean {
  return !e.time && e.releaseType === 'batch' && e.platform !== 'tv'
}

function tagesGrenze(e: { time?: string; releaseType?: string; platform?: string }, amTagesbeginn: boolean): string {
  return amTagesbeginn && istKatalogstartOhneUhrzeit(e) ? '00:00' : '23:59'
}

/**
 * Hat der Anbieter diesen Termin verstreichen lassen, ohne die Folge bisher
 * nachzuliefern? Nachgeholt (`erschienenAm`) zählt nicht mehr dazu.
 */
export function istAusgeblieben(ereignis: { verpasst?: { erschienenAm?: string } }): boolean {
  return Boolean(ereignis.verpasst && !ereignis.verpasst.erschienenAm)
}

/**
 * Der Zustand eines Termins zur Zeit `jetzt`. Fehlt die Uhrzeit, gilt der Tag als abgeschlossen (23:59);
 * ein Katalogstart ohne Uhrzeit zählt ab 00:00 (`katalogAmTagesbeginn`, Push: false, Netflix schaltet erst gegen 9 Uhr frei).
 */
export function terminZustand(e: TerminFelder, jetzt: Date = new Date(), katalogAmTagesbeginn = true): TerminZustand {
  if (istAusgeblieben(e)) return 'ausgeblieben'
  if (e.nachLuecke) return 'angekuendigt'
  const zeitpunkt = berlinToUtc(e.date, e.time ?? tagesGrenze(e, katalogAmTagesbeginn)).getTime()
  if (zeitpunkt > jetzt.getTime()) return 'angekuendigt'
  return e.ohneSichtung ? 'faellig' : 'erschienen'
}
