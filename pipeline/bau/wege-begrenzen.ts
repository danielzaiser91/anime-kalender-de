import type { Title } from '../../shared/types.ts'
import { behalteNurHandbelegteWege } from '../lib/handbeleg-weg.ts'
import type { DubCheck } from '../lib/dub-confirmed.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'
import { istEigenerTitel } from '../../shared/eigene-titel.ts'

/**
 * **Titel nur bei aniSearch und eigene Titel (`data/eigene-titel.yaml`) tragen keine Wege, die der Name erraten hat** (07.10.2026: ein Special bekam über den Namen die Crunchyroll-Serie seiner Hauptfassung).
 * Eine Kennung belegt, dass es den Titel gibt, nicht, wo er läuft; ein Handbeleg „deutsch“ mit Adresse bleibt. Wege aus einem sicheren Termin kommen später (`ergaenzeWegeAusTerminen`).
 */
export function begrenzeWegeAufBelege(titles: Iterable<Title>, checks: DubCheck[]): void {
  for (const t of titles) if (t.id >= ANISEARCH_ID_BASIS || istEigenerTitel(t.id)) behalteNurHandbelegteWege(t, checks)
}
