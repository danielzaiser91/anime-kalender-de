import { istAusgeblieben } from './logic.ts'
import type { ReleaseEvent } from './types.ts'

/**
 * Die letzte Folge des Blocks, der mit `n` am selben Tag erscheint — nur mit belegten Terminen (`estimated`
 * fehlt) und lückenlos ab `n`. Fortgeschriebene Folgen legt `expandEvents` nie auf denselben Tag, ein Block ist
 * also immer belegt; die Prüfung hält es trotzdem fest. Tag = Berlin-Tag des Termins.
 * Panel (`antwort-block.ts`) und Vorschaubild (`pipeline/lib/og-termin.ts`) entscheiden hier gemeinsam, ob „Nächste Folgen" steht.
 */
export function folgenblockBis(derselben: ReleaseEvent[], n: ReleaseEvent): number | undefined {
  if (n.episode == null || n.estimated || n.sichtung || n.releaseType !== 'weekly' || istAusgeblieben(n)) return undefined
  const amTag = derselben.filter((e) => e.date === n.date && !e.estimated && !e.sichtung && !istAusgeblieben(e))
  let bis = n.episode
  while (amTag.some((e) => e.episode === bis + 1)) bis++
  return bis > n.episode ? bis : undefined
}
