import { zeitMitMarke } from '@shared/zeit-text.ts'
import type { Release, ReleaseEvent } from '@shared/types.ts'
import { anbieterDesKanals } from '@shared/kanal-anbieter.ts'

/**
 * Eine Kachel mit allen Anbietern eines Titels an einem Tag: je Anbieter ein Bündel (`buendeleKacheln`), das erste
 * bestimmt Cover, Titel und Reihenfolge. Bei einem Anbieter allein hat sie genau ein Bündel.
 */
export type AnbieterKachel = ReleaseEvent[][]

/** Was eine eigene Auskunft trägt und deshalb nie in eine Anbieter-Kachel wandert: Ausgebliebenes, Premiere, Sprachhinweis. */
export const eigenstaendigBeiAnbietern = (ev: ReleaseEvent): boolean => !!ev.verpasst || !!ev.premiere || !!ev.sprache

/** Zu einem Prime-Termin der Anbieter hinter seinem Kanal (`Release.kanal`: „Crunchyroll“ → crunchyroll), sonst `undefined`; Ausgabe für `vereineAnbieter`. */
export const kanalAnbieterVon = (releaseBySlug: Map<string, Release>) => (ev: ReleaseEvent): string | undefined =>
  ev.platform === 'primevideo' ? anbieterDesKanals(releaseBySlug.get(ev.releaseSlug)?.kanal) : undefined

/**
 * Geht der Kanal-Termin im Anbieter auf? Ist `gruppe` der Kanal eines Anbieters, der schon in der Kachel steht, entfällt sie; ist sie der
 * Anbieter eines Kanals, der schon dort steht, tritt sie an dessen Stelle. `true` heißt: `gruppe` ist erledigt.
 */
function geheAuf(kachel: AnbieterKachel, gruppe: ReleaseEvent[], kanalVon: (ev: ReleaseEvent) => string | undefined): boolean {
  const kopf = gruppe[0]!
  const anbieter = kanalVon(kopf)
  if (anbieter && kachel.some((b) => b[0]!.platform === anbieter)) return true
  const kanal = kachel.findIndex((b) => kanalVon(b[0]!) === kopf.platform)
  if (kanal < 0) return false
  kachel[kanal] = gruppe
  return true
}

/**
 * Legt die Bündel eines Tages zusammen, die denselben Titel bei verschiedenen Anbietern zeigen (Reborn as a Space Mercenary,
 * 11.10.2026: Crunchyroll und Prime Video am selben Tag als zwei Kacheln). Die Kachel steht dort, wo ihr erstes Bündel stand.
 *
 * `eigenstaendig` hält zurück, was eine eigene Auskunft trägt (Ausgebliebenes, Premiere, Sprachhinweis); ohne Titelkennung
 * lässt sich nicht sagen, ob es derselbe Titel ist. Ein zweites Bündel desselben Anbieters (eine Premiere
 * neben der Folgenreihe) bleibt eine eigene Kachel.
 *
 * `kanalVon` nennt zu einem Prime-Termin den Anbieter, dessen Bestand der Kanal führt („Prime Video (Crunchyroll)“ → crunchyroll).
 * Steht dieser Anbieter am selben Tag in der Kachel, geht der Kanal in ihm auf und bekommt keine eigene Leiste (Daniel, 13.10.2026);
 * ohne den Anbieter am Tag (Filter nur auf Prime) bleibt der Kanal-Termin, wie er ist.
 */
export function vereineAnbieter(
  gruppen: ReleaseEvent[][],
  eigenstaendig: (ev: ReleaseEvent) => boolean,
  kanalVon: (ev: ReleaseEvent) => string | undefined = () => undefined,
): AnbieterKachel[] {
  const kacheln: AnbieterKachel[] = []
  const nachTitel = new Map<number, AnbieterKachel>()
  for (const gruppe of gruppen) {
    const kopf = gruppe[0]!
    const offen = kopf.titleId > 0 && !eigenstaendig(kopf) ? nachTitel.get(kopf.titleId) : undefined
    if (offen && geheAuf(offen, gruppe, kanalVon)) continue
    if (offen && !offen.some((b) => b[0]!.platform === kopf.platform)) {
      offen.push(gruppe)
      continue
    }
    const neu = [gruppe]
    kacheln.push(neu)
    if (kopf.titleId > 0 && !eigenstaendig(kopf) && !offen) nachTitel.set(kopf.titleId, neu)
  }
  return kacheln
}

/** Zeit wie die Marke auf dem Cover sie schreibt: „≈ 16:00" bei einer Schätzung, leer ohne Uhrzeit. */
export const zeitText = (ev: ReleaseEvent): string => zeitMitMarke(ev, '≈ ')

/** Alle Anbieter nennen dieselbe Zeit (samt Schätzung) — dann reicht eine Marke auf dem Cover, sonst steht die Zeit je Anbieter. */
export const zeitGemeinsam = (buendel: ReleaseEvent[][]): boolean => buendel.every((b) => zeitText(b[0]!) === zeitText(buendel[0]![0]!))

/** Alle Anbieter nennen dieselbe Folge und dieselbe Zahl weiterer Folgen — dann genügt eine Zeile für alle. */
export const folgeGemeinsam = (buendel: ReleaseEvent[][]): boolean => {
  const gleich = (a: ReleaseEvent[], b: ReleaseEvent[]): boolean =>
    a[0]!.episode === b[0]!.episode && a[0]!.episodeCount === b[0]!.episodeCount && a.length === b.length && a[0]!.katalog === b[0]!.katalog
  return buendel.every((b) => gleich(b, buendel[0]!))
}

/** Hartkantiger Farbverlauf aus gleich breiten Feldern, ein Feld je Anbieter (`linear-gradient`). */
export function anbieterVerlauf(farben: string[]): string {
  if (farben.length < 2) return farben[0] ?? '#888'
  const schritt = 100 / farben.length
  const teile = farben.map((f, i) => `${f} ${+(i * schritt).toFixed(2)}% ${+((i + 1) * schritt).toFixed(2)}%`)
  return `linear-gradient(to right, ${teile.join(', ')})`
}
