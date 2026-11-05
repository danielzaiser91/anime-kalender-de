import type { Title } from '../../shared/types.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { log, warn } from '../lib/util.ts'
import { ladeAlleEigenenWerke } from './cartoon-reihen.ts'

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

/** Markiert mit den Quellen des Baus (Katalog-Elternkanten, Handlisten eigener Werke); nach der Reihenbildung, denn sie liest `franchiseId`. */
export function markiereReihenteileAusQuellen(titles: Map<number, Title>, katalog: () => KatalogEintrag[] = ladeKatalogEintraege): void {
  /* Ein unlesbarer Katalog stoppt den Bau nie: dann gibt es nur die eigenen Werke, ohne Beiwerk. */
  let eintraege: KatalogEintrag[] = []
  try {
    eintraege = katalog()
  } catch (e) {
    warn(`Beiwerk-Markierung ohne Katalog (Fehler): ${(e as Error).message}`)
  }
  const eltern = new Map(eintraege.filter((x) => x.eltern?.length).map((x) => [x.id, x.eltern!]))
  const z = markiereReihenteile(titles, eltern, new Set(ladeAlleEigenenWerke().flatMap((e) => e.ids)))
  log(`${z.beiwerk} Beiwerk-Titel, ${z.eigenesWerk} eigene Werke markiert (zählen nicht als Staffel)`)
}
