import type { Release, Title } from '../../shared/types.ts'
import { synchroBelegt } from '../../shared/titles.ts'

export type UebersichtTexte = { ueberschrift: string; stand: string; seitenTitel: string; beschreibung: string; listenName: string }

/** Zahl der Termine, deren Titel belegte Synchro hat (`synchroBelegt`, dieselbe Entscheidung wie auf der Titelseite). Der Katalog muss vollständig sein, nicht `titles-core.json`. */
export function belegteTermine(releases: Release[], katalog: Map<number, Title>): number {
  return releases.filter((r) => {
    const t = katalog.get(r.titleId)
    return t !== undefined && synchroBelegt(t)
  }).length
}

/** Die Sammelseite nennt auch Termine ohne belegte Synchro, darum sagt sie nur, wie viele belegt sind (nichts behaupten, was nicht belegt ist). */
export function uebersichtTexte(anzahl: number, belegt: number, kommend: number): UebersichtTexte {
  const synchro = belegt === anzahl ? 'Deutsche Synchro bei allen belegt.' : `Deutsche Synchro belegt bei ${belegt}, bei den übrigen angekündigt oder wahrscheinlich.`
  return {
    ueberschrift: 'Alle Termine',
    stand: `${anzahl} Veröffentlichungen, ${kommend} davon stehen noch an. ${synchro}`,
    seitenTitel: 'Alle Anime-Termine: Synchro belegt oder angekündigt — Anime-Kalender DE',
    beschreibung: `Alle ${anzahl} Termine mit Datum und Anbieter. ${synchro}`,
    listenName: 'Anime-Termine: deutsche Synchro belegt oder angekündigt',
  }
}
