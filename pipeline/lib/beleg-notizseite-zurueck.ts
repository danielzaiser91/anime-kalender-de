import { findeFremdeNotizseiten } from './handbeleg-notizseite.ts'
import { liegenGeblieben, type OhneZuordnung } from './meldungen-liste.ts'
import type { Besitz, BelegBlock } from './beleg-fremd-zugeordnet.ts'

/**
 * Ein geschriebener Prime-Block, dessen Seite aus der Notiz („Amazon-Seite X“) genau einem anderen Titel gehört (19.11.2026,
 * Anlass: Zexal 10015 an der Seite von 15489 machte `check-handbeleg-notizseite-bestand` und den Bestandsbau rot, obwohl die
 * `url` des Blocks eigen war). Dieselbe Prüfung wie der Wächter (`findeFremdeNotizseiten`); die Meldung bleibt liegen.
 * `true`, wenn der Block ausfällt. Ohne `besitz.notizseiten` (Besitz ohne Titelliste) prüft sie nichts.
 */
export function verschiebeFremdeNotizseite(
  besitz: Besitz,
  b: BelegBlock,
  gruppe: readonly { id: number }[],
  p: { url: string; plattform: string; befund: string; serientitel: string | null; titel: string | null },
  warnungen: string[],
  liste: OhneZuordnung[],
): boolean {
  if (!besitz.notizseiten) return false
  const fremd = findeFremdeNotizseiten([{ anilistId: b.id, platform: b.platform, url: b.url, note: b.note }], besitz.notizseiten)
  if (!fremd.length) return false
  besitz.verschoben++
  besitz.gruppen.add(gruppe[0]!.id)
  const seiten = fremd.map((f) => f.split('@')[1]).join(', ')
  const grund = `Beleg für Titel ${b.id} (Meldung ${gruppe.map((x) => x.id).join(', ')}) nicht geschrieben: Notizseite ${seiten} gehört einem anderen Titel`
  liegenGeblieben(warnungen, liste, p, grund, [b.id], `Seite ${seiten} gehört schon einem anderen Titel: Zuordnung klären (Beleg wird nicht geschrieben)`)
  return true
}
