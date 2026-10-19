import { warn } from '../lib/util.ts'
import { ladeQuarantaene } from '../lib/quarantaene.ts'
import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'
import type { DataMeta, ZurueckgestellterTitel } from '../../shared/meta-typ.ts'

/** Entfernt alle Einträge dieser Titel aus der Liste, an Ort und Stelle (spätere Phasen halten dieselbe Liste). */
function entferne<T extends { titleId: number }>(liste: T[], ids: Set<number>): void {
  for (let i = liste.length - 1; i >= 0; i--) {
    if (ids.has(liste[i]!.titleId)) liste.splice(i, 1)
  }
}

/**
 * **Titel-Quarantäne** (18.10.2026): Titel, an denen eine Bestandsprüfung rot war (`tools/quarantaene.mjs`), verlassen den Bau
 * samt Releases und Terminen; der Rest des Datensatzes geht aus. Die Phase steht nach `schliesseWegeAb` und nicht nach `02-titel`:
 * Kuratierte Releases entstehen auch ohne Titel (`05-releases`), und erst ab `baueMeta` legt keine Phase mehr etwas an.
 * Zurück kommt nur, was wirklich entfernt wurde — ein Eintrag, den es nicht gab, landet nicht in `meta.json`.
 */
export function stelleZurueck(
  { titles, releases, events }: { titles: Map<number, Title>; releases: Release[]; events: ReleaseEvent[] },
  liste = ladeQuarantaene(),
): ZurueckgestellterTitel[] {
  const ergebnis: ZurueckgestellterTitel[] = []
  for (const e of liste) {
    if (!titles.delete(e.titleId)) continue
    const slugs = releases.filter((r) => r.titleId === e.titleId).map((r) => r.slug)
    ergebnis.push({ ...e, releases: slugs })
  }
  const ids = new Set(ergebnis.map((e) => e.titleId))
  entferne(releases, ids)
  entferne(events, ids)
  if (ergebnis.length) warn(`${ergebnis.length} Titel zurückgestellt: ${[...ids].join(', ')}`)
  return ergebnis
}

/** Nennt die zurückgestellten Titel in `meta.json`; ohne Quarantäne fehlt das Feld (Leser: Bestandsprüfungen, `lib/quarantaene.ts`). */
export function vermerkeQuarantaene(meta: DataMeta, liste: ZurueckgestellterTitel[]): void {
  if (liste.length) meta.quarantaene = liste
}
