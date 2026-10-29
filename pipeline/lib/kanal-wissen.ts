/**
 * Die eine Quelle des Kanal-Wissens für jeden Leser des Baus: Stufe 3, spätes Urteil, Wächter D-25..D-27,
 * Wegwahl (`belegFuer`), Prime-Phase (`rohDeutsch`), Aussortieren der Rohfolgen, Bestandsprüfung.
 * Ein neuer Leser nimmt diese Quelle und nicht `loadDubChecks()` (Issue #1601).
 */
import { adressGleich } from '../../shared/adresse-kern.ts'
import { resolve } from 'node:path'
import { istEntfernt, ladeBelegeEntfernt } from './belege-entfernt.ts'
import { loadDubChecks, type DubCheck } from './dub-confirmed.ts'
import { ladeMerkliste, mitMerkliste } from './kanal-merkliste.ts'
import { ROOT } from './util.ts'

const wissen = new WeakMap<DubCheck[], DubCheck[]>()

/** Die Merkliste ohne Seiten, die `data/belege-entfernt.yaml` für denselben Titel nennt: die Datei selbst löscht nie, der Leser lässt sie weg. */
function merklisteOhneEntfernte(): DubCheck[] {
  const entfernt = ladeBelegeEntfernt(resolve(ROOT, 'data/belege-entfernt.yaml'))
  return ladeMerkliste().filter((m) => !istEntfernt(entfernt, m.anilistId, m.url))
}

/** Was der Bau über Kanal-Seiten weiß: die Belegliste samt Merkliste, einmal je Belegliste (`rohDeutsch()` merkt sich seine Mengen je Liste). */
export function kanalWissen(checks: DubCheck[]): DubCheck[] {
  if (!wissen.has(checks)) wissen.set(checks, mitMerkliste(checks, merklisteOhneEntfernte()))
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
