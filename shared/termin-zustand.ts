import { berlinToUtc } from './time.ts'
import type { Release, ReleaseEvent } from './types.ts'

/**
 * Wo steht ein Termin gerade? Eine Stelle für „erschienen“, „fällig“ und „ausgeblieben“.
 *
 * - `angekuendigt`: Der Zeitpunkt liegt in der Zukunft, oder die Folge hängt hinter einer offenen Lücke.
 * - `faellig`: Der Zeitpunkt ist verstrichen, aber es gibt keine Sichtung (`ohneSichtung`) — höchstens `FAELLIG_HOECHSTENS_MS` lang.
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

/**
 * So lange gilt ein Termin ohne Sichtung als „fällig“; danach zählt er wieder als erschienen (geschätzt, „≈“), wie vor dem Vermerk.
 * Gemessen (15.11.2026, 80 Stände von `releases.json` 15.10.–15.11.): Nur 7 Folgen standen je „fällig“, 36 / 156 / 164 / 324 / 332 / 500 / 668 h lang —
 * Crunchyroll hat sie nicht binnen Stunden im Katalog geführt (Rückfüllung), die Annahme „sichtbar binnen einer Stunde“ trägt nicht über einen Tag.
 */
export const FAELLIG_HOECHSTENS_MS = 24 * 36e5

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
  return e.ohneSichtung && jetzt.getTime() - zeitpunkt <= FAELLIG_HOECHSTENS_MS ? 'faellig' : 'erschienen'
}

/** Wie lange der Termin her ist (ms, negativ davor); ohne Uhrzeit zählt der Tagesschluss. */
export function abstandSeitTermin(e: Pick<TerminFelder, 'date' | 'time'>, jetzt: Date): number {
  return jetzt.getTime() - berlinToUtc(e.date, e.time ?? '23:59').getTime()
}

/**
 * Ist diese Folge eines Crunchyroll-Wochenplans nur angekündigt? Das ist sie, wenn keine Sichtung sie belegt: nicht
 * beobachtet, nicht von einer späteren Beobachtung überholt (dann ist sie sicher erschienen) und nicht von `belegtBis` gedeckt.
 * Nur Crunchyroll: Dort sieht der Katalog (`crunchyroll-neu.json`) meist binnen Stunden, was erscheint (nicht immer: `FAELLIG_HOECHSTENS_MS`);
 * andere Anbieter haben keinen Sichtungsweg, ihr Termin bleibt Termin.
 */
export function ohneSichtungVon(release: Pick<Release, 'platform' | 'releaseType' | 'tvLetzteSichtung'>, s: NonNullable<Release['schedule']>, episode: number): boolean {
  if (release.platform !== 'crunchyroll' || release.releaseType !== 'weekly' || release.tvLetzteSichtung) return false
  if (s.observed?.[episode]) return false
  if (s.belegtBis && episode <= s.belegtBis.folge) return false
  const beobachtet = Object.keys(s.observed ?? {}).map(Number)
  return !beobachtet.some((n) => n > episode)
}

/** Setzt `ohneSichtung` an den Terminen des Wochenplans, die nur angekündigt sind; der Vermerk „ausgeblieben“ bleibt davon unberührt. */
export function markiereOhneSichtung(release: Release, termine: ReleaseEvent[]): ReleaseEvent[] {
  const s = release.schedule
  if (!s) return termine
  return termine.map((e) => (e.estimated && e.episode != null && !e.verpasst && ohneSichtungVon(release, s, e.episode) ? { ...e, ohneSichtung: true } : e))
}
