import type { Title } from '../../shared/types.ts'

/**
 * **Beiwerk und eigene Werke am Titel** (`Title.beiwerk`, `Title.eigenesWerk`), damit jeder Zähler dieselben Teile
 * ausschließt wie das Panel (`hauptstaffeln()`): `beiwerk`, wenn AniList einen anderen Teil derselben Reihe als
 * `PARENT` nennt (wie `franchises.json`, 13-4), `eigenesWerk` für die Kennungen der Handlisten (`ladeAlleEigenenWerke`).
 * Die Elternkante eines Titels, der nur im Katalog steht, kennt der Hauptbestand nicht — sie zählt hier nicht.
 */
export function markiereReihenteile(titles: Map<number, Title>, eltern: Map<number, number[]>, eigene: Set<number>): { beiwerk: number; eigenesWerk: number } {
  const zaehler = { beiwerk: 0, eigenesWerk: 0 }
  for (const t of titles.values()) {
    if (t.franchiseId === undefined) continue
    if ((eltern.get(t.id) ?? []).some((e) => titles.get(e)?.franchiseId === t.franchiseId)) {
      t.beiwerk = true
      zaehler.beiwerk++
    }
    if (eigene.has(t.id)) {
      t.eigenesWerk = true
      zaehler.eigenesWerk++
    }
  }
  return zaehler
}
