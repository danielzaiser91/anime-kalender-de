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

/** Kennungen mit frischer Synchro-Ankündigung (laut Datei), die nicht in `titles.json` stehen — egal wo sonst (hinter dem Toggle, nirgends). */
export function fehlenImHauptbestand(hauptIds: Set<number>, ankuendigungen: Map<number, NonNullable<Title['ankuendigung']>>, heuteIso: string): number[] {
  return [...ankuendigungen].filter(([id, a]) => !hauptIds.has(id) && frischAngekuendigt({ ankuendigung: a } as Title, heuteIso)).map(([id]) => id)
}

export function fehlenWarnzeile(ids: number[]): string | undefined {
  if (!ids.length) return undefined
  return `  ⚠ WARNUNG Ankündigung: ${ids.length} Titel mit frischer Synchro-Ankündigung fehlen in titles.json (Phase 10 prüfen, bau/ankuendigung-an-titel.ts): ${ids.join('; ')}`
}
