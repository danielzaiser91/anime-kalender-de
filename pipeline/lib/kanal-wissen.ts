/**
 * Die eine Quelle des Kanal-Wissens für jeden Leser des Baus: Stufe 3, spätes Urteil, Wächter D-25..D-27,
 * Wegwahl (`belegFuer`), Prime-Phase (`rohDeutsch`), Aussortieren der Rohfolgen, Bestandsprüfung.
 * Ein neuer Leser nimmt diese Quelle und nicht `loadDubChecks()` (Issue #1601).
 */
import { loadDubChecks, type DubCheck } from './dub-confirmed.ts'

/** Was der Bau über Kanal-Seiten weiß, aus einer geladenen Belegliste. */
export function kanalWissen(checks: DubCheck[]): DubCheck[] {
  return checks
}

/** Das Kanal-Wissen aus den Handbelegen auf der Platte. */
export function ladeKanalWissen(): DubCheck[] {
  return kanalWissen(loadDubChecks())
}
