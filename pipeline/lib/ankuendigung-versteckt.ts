import type { Title } from '../../shared/types.ts'
import { frischAngekuendigt } from '../bau/ohne-beleg.ts'

/** Titel hinter dem Toggle „Anime ohne deutsche Synchro“, deren Synchro-Ankündigung am Bau-Zeitpunkt noch frisch ist. */
export function versteckteFrischeAnkuendigungen(hinterToggle: Title[], heuteIso: string): Title[] {
  return hinterToggle.filter((t) => frischAngekuendigt(t, heuteIso))
}

/** Einzeilige Warnung für `commit-data.sh` (`⚠ WARNUNG`), oder `undefined`, wenn keiner betroffen ist. */
export function versteckteWarnzeile(titel: Title[]): string | undefined {
  if (!titel.length) return undefined
  const namen = titel.map((t) => `${t.id} ${t.titleEn ?? t.titleRomaji ?? ''}`.trim()).join('; ')
  return `  ⚠ WARNUNG Ankündigung: ${titel.length} Titel mit frischer Synchro-Ankündigung stehen hinter dem Toggle „ohne deutsche Synchro“ (Grund prüfen: aniSearch „Deutsch nicht genannt“, Handurteil, japanischer Start noch offen): ${namen}`
}
