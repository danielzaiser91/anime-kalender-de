/**
 * Die eine Quelle des Kanal-Wissens für jeden Leser des Baus: Stufe 3, spätes Urteil, Wächter D-25..D-27,
 * Wegwahl (`belegFuer`), Prime-Phase (`rohDeutsch`), Aussortieren der Rohfolgen, Bestandsprüfung.
 * Ein neuer Leser nimmt diese Quelle und nicht `loadDubChecks()` (Issue #1601).
 */
import { adressGleich } from '../../shared/adresse-kern.ts'
import { loadDubChecks, type DubCheck } from './dub-confirmed.ts'
import { ladeMerkliste, mitMerkliste } from './kanal-merkliste.ts'

const wissen = new WeakMap<DubCheck[], DubCheck[]>()

/** Was der Bau über Kanal-Seiten weiß: die Belegliste samt Merkliste, einmal je Belegliste (`rohDeutsch()` merkt sich seine Mengen je Liste). */
export function kanalWissen(checks: DubCheck[]): DubCheck[] {
  if (!wissen.has(checks)) wissen.set(checks, mitMerkliste(checks, ladeMerkliste()))
  return wissen.get(checks)!
}

/** Das Kanal-Wissen aus den Handbelegen auf der Platte samt Merkliste. */
export function ladeKanalWissen(): DubCheck[] {
  return kanalWissen(loadDubChecks())
}

/** Steht diese Adresse des Titels als Kanal-Seite im Kanal-Wissen? Ersetzt den Handbeleg der Adresse, wenn der Lauf keinen hat (zurückgestellt). */
export function kanalAdresseGemerkt(checks: DubCheck[], titleId: number, plattform: string, adresse: string | null): boolean {
  return kanalWissen(checks).some((c) => c.kanalOhneBeleg === true && c.anilistId === titleId && c.platform === plattform && adressGleich(c.url, adresse ?? undefined))
}
