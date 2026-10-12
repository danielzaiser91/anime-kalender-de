import type { ReleaseEvent } from '@shared/types.ts'

/**
 * Eine Kachel mit allen Anbietern eines Titels an einem Tag: je Anbieter ein Bündel (`buendeleKacheln`), das erste
 * bestimmt Cover, Titel und Reihenfolge. Bei einem Anbieter allein hat sie genau ein Bündel.
 */
export type AnbieterKachel = ReleaseEvent[][]

/** Was eine eigene Auskunft trägt und deshalb nie in eine Anbieter-Kachel wandert: Ausgebliebenes, Premiere, Sprachhinweis. */
export const eigenstaendigBeiAnbietern = (ev: ReleaseEvent): boolean => !!ev.verpasst || !!ev.premiere || !!ev.sprache

/**
 * Legt die Bündel eines Tages zusammen, die denselben Titel bei verschiedenen Anbietern zeigen (Reborn as a Space Mercenary,
 * 11.10.2026: Crunchyroll und Prime Video am selben Tag als zwei Kacheln). Die Kachel steht dort, wo ihr erstes Bündel stand.
 *
 * `eigenstaendig` hält zurück, was eine eigene Auskunft trägt (Ausgebliebenes, Premiere, Sprachhinweis); ohne Titelkennung
 * lässt sich nicht sagen, ob es derselbe Titel ist. Ein zweites Bündel desselben Anbieters (Finale neben einer Folgenreihe)
 * bleibt eine eigene Kachel.
 */
export function vereineAnbieter(gruppen: ReleaseEvent[][], eigenstaendig: (ev: ReleaseEvent) => boolean): AnbieterKachel[] {
  const kacheln: AnbieterKachel[] = []
  const nachTitel = new Map<number, AnbieterKachel>()
  for (const gruppe of gruppen) {
    const kopf = gruppe[0]!
    const offen = kopf.titleId > 0 && !eigenstaendig(kopf) ? nachTitel.get(kopf.titleId) : undefined
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
export const zeitText = (ev: ReleaseEvent): string => (ev.time ? `${ev.timeEstimated || ev.estimated ? '≈ ' : ''}${ev.time}` : '')

/** Alle Anbieter nennen dieselbe Zeit (samt Schätzung) — dann reicht eine Marke auf dem Cover, sonst steht die Zeit je Anbieter. */
export const zeitGemeinsam = (buendel: ReleaseEvent[][]): boolean => buendel.every((b) => zeitText(b[0]!) === zeitText(buendel[0]![0]!))

/** Alle Anbieter nennen dieselbe Folge und dieselbe Zahl weiterer Folgen — dann genügt eine Zeile für alle. */
export const folgeGemeinsam = (buendel: ReleaseEvent[][]): boolean => {
  const gleich = (a: ReleaseEvent[], b: ReleaseEvent[]): boolean =>
    a[0]!.episode === b[0]!.episode && a[0]!.episodeCount === b[0]!.episodeCount && a.length === b.length
  return buendel.every((b) => gleich(b, buendel[0]!))
}

/** Hartkantiger Farbverlauf aus gleich breiten Feldern, ein Feld je Anbieter (`linear-gradient`). */
export function anbieterVerlauf(farben: string[]): string {
  if (farben.length < 2) return farben[0] ?? '#888'
  const schritt = 100 / farben.length
  const teile = farben.map((f, i) => `${f} ${+(i * schritt).toFixed(2)}% ${+((i + 1) * schritt).toFixed(2)}%`)
  return `linear-gradient(to right, ${teile.join(', ')})`
}
