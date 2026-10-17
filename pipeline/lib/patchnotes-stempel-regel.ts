import { STEMPEL_DATEI, PATCHNOTES_ORDNER } from './patchnotes.ts'

const EINTRAG = new RegExp(`^${PATCHNOTES_ORDNER}/([^/]+)\\.yaml$`)

/** Namen der bestehenden Einträge, die ein PR umschreibt (`M`), aus `git diff --name-status --no-renames`. Neue (`A`) und gelöschte (`D`) zählen nicht. */
export function umgeschriebeneEintraege(nameStatus: string): string[] {
  return nameStatus
    .split('\n')
    .map((z) => z.split('\t'))
    .filter(([status]) => status === 'M')
    .map(([, pfad]) => EINTRAG.exec(pfad ?? '')?.[1])
    .filter((name): name is string => name !== undefined)
}

export const STEMPEL_PFAD = `${PATCHNOTES_ORDNER}/${STEMPEL_DATEI}`

/** Befund zum Stempel „überarbeitet bis“ in einem PR, oder `null`: Er sinkt nie, verschwindet nicht, und wer Texte bestehender Einträge umschreibt, hebt ihn mindestens auf deren jüngsten Tag. `tage`: Tag je umgeschriebenem Eintrag. */
export function stempelBefund({ tage, alt, neu }: { tage: string[]; alt?: string; neu?: string }): string | null {
  if (alt !== undefined && neu !== undefined && neu < alt) return `${STEMPEL_PFAD} sinkt von ${alt} auf ${neu}.`
  if (alt !== undefined && neu === undefined) return `${STEMPEL_PFAD} wurde gelöscht (stand auf ${alt}); ohne ihn verlieren alle Tage den Entwurfs-Stift.`
  if (!tage.length) return null
  const juengster = [...tage].sort().at(-1)!
  if (neu !== undefined && neu >= juengster) return null
  return `Der PR schreibt Einträge bis ${juengster} um, ${STEMPEL_PFAD} steht auf ${neu ?? 'nichts'}. Den Stempel auf mindestens ${juengster} setzen, sonst behalten diese Tage den Entwurfs-Stift.`
}
