/**
 * **Eine überholte Quelle gehört nicht auf die Handliste „Aussage nicht zu finden“** (12.11.2026): Trägt ein Termin eine Quelle mit
 * `stand: 'ueberholt'` und dem alten Tag in `sagt`, und belegt eine andere Quelle desselben Termins den heutigen Tag (`stand: 'aktuell'`),
 * ist der Beleg schon abgelöst — dass die Lesung die Marke nicht mehr findet, ist dann zu erwarten, nicht zu prüfen.
 * Die Quelle bleibt im Datensatz; nur die Liste ändert sich. `vermutlich-ueberholt` und eine fehlende `sagt` bleiben auf der Liste.
 */
import type { Release } from '../../shared/types.ts'
import type { Gruppe } from './beleg-suche.ts'

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/

/** Adresse und Titel (`url|titelId`), deren Quellen an allen Terminen des Titels abgelöst sind. */
export function abgeloesteBelege(releases: Release[]): Set<string> {
  const je = new Map<string, boolean>()
  for (const r of releases) {
    const heutig = (r.quellen ?? []).some((q) => q.stand === 'aktuell')
    for (const q of r.quellen ?? []) {
      const schluessel = `${q.url}|${r.titleId}`
      const abgeloest = q.stand === 'ueberholt' && ISO_TAG.test(q.sagt ?? '') && heutig
      je.set(schluessel, (je.get(schluessel) ?? true) && abgeloest)
    }
  }
  return new Set([...je].filter(([, ja]) => ja).map(([schluessel]) => schluessel))
}

/** Dieselben Gruppen; abgelöste Belege tragen `abgeloest: true`. */
export function markiereAbgeloeste(gruppen: Map<string, Gruppe[]>, releases: Release[]): Map<string, Gruppe[]> {
  const abgeloest = abgeloesteBelege(releases)
  const neu = new Map<string, Gruppe[]>()
  for (const [url, liste] of gruppen) neu.set(url, liste.map((g) => (abgeloest.has(`${url}|${g.id}`) ? { ...g, abgeloest: true } : g)))
  return neu
}
