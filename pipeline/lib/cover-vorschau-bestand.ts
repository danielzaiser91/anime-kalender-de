/**
 * Ratsche „Cover vorhanden, Link-Vorschau trotzdem Standardbild“ auf dem gebauten Bestand (`public/data`), vor dem Seitenbau.
 *
 * Warum hier und nicht nur in `check-teilseiten`: Jene Ratsche liest `dist/data`, in der Kette eines Code-PR also den eingecheckten Stand
 * vor dessen Wirkung (05.11.2026: PR 2872 war grün, main brach erst mit dem Bestandsbau danach: 471 statt 449). Als Bestandsprüfung läuft
 * sie im Job PR-Datenbau auf dem frisch gebauten Bestand.
 *
 * Gleiche Entscheidung wie der Seitenbau: `vorschauBild` mit denselben Maßen; Titel mit Termin tragen das Terminbild und zählen nicht.
 */
import { teilbarerSlug } from '../../shared/teilen.ts'
import type { Title } from '../../shared/types.ts'
import { ueberHoechstens } from './hoechstens-ratsche.ts'
import { vorschauBild, type PlakatMasse } from './titel-vorschau.ts'

const STANDARD = 'standard'

/** Teilbare Titel mit Cover und ohne Termin, deren Vorschau das Standardbild wäre. */
export function standardTrotzCoverTitel(titel: Title[], mitTermin: ReadonlySet<number>, masse: PlakatMasse): Title[] {
  return titel.filter(
    (t) => t.coverImage && teilbarerSlug(t) !== undefined && !mitTermin.has(t.id) && vorschauBild(t.bannerImage, t.coverImage, STANDARD, masse).url === STANDARD,
  )
}

/** Meldung bei Überschreitung samt den jüngsten Kennungen (der Zuwachs liegt meist bei neuen Titeln), sonst nichts. */
export function coverVorschauBestandMangel(treffer: Title[], hoechstens: number, zeigen = 10): string | undefined {
  if (!ueberHoechstens(treffer.length, hoechstens)) return undefined
  const juengste = treffer
    .map((t) => t.id)
    .sort((a, b) => b - a)
    .slice(0, Math.min(zeigen, treffer.length - hoechstens))
  return `${treffer.length} Titel mit Cover zeigen das Standardbild als Link-Vorschau, erlaubt höchstens ${hoechstens} (jüngste Kennungen: ${juengste.join(', ')})`
}
