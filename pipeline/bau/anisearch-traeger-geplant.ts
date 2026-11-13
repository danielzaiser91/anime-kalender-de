import type { Title } from '../../shared/types.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'
import { ladeKatalogEintraege } from '../lib/katalog-eingefroren.ts'
import { alle, traegerJeSeite } from './anisearch-titel.ts'
import { ohneSynchroVonHand } from './ohne-beleg.ts'
import { titelAusKatalogEintrag } from './katalog-titel.ts'
import { log } from '../lib/util.ts'

type Quellen = {
  traeger: Map<number, number[]>
  dub: (anisearchId: number) => string | undefined
  katalog: Map<number, KatalogEintrag>
  ausgenommen: Set<number>
}

const ausDateien = (): Quellen => ({
  traeger: traegerJeSeite(),
  dub: (seite) => alle()[String(seite)]?.dub,
  katalog: new Map(ladeKatalogEintraege().map((e) => [e.id, e])),
  ausgenommen: ohneSynchroVonHand(),
})

const meldung = (geholt: number[], ausgelassen: number[]): string =>
  `Geplante Synchro (p) laut aniSearch: ${geholt.length} Träger aus dem Katalog geholt (${geholt.join(', ')}), ${ausgelassen.length} durch Handurteil ausgelassen (${ausgelassen.join(', ')})`

/**
 * **Eine geplante Synchro (`p`) gehört genau einmal in den Bestand** (Dirigent, 12.11.2026, PR 3528: aniSearch 20905 wechselte `-` → `p`, der Träger
 * AniList 199112 lag nur im Katalog hinter dem Toggle, `ergaenzeAnisearchTitel` legte eine zweite Zeile 10020905 an: MAL-Dublette im Bestandsbau).
 * Trägt eine Seite `p` und liegt ihr Träger-AniList-Titel (Zuordnung über `anisearchId`) nur im Katalog, kommt der AniList-Titel in den Bestand;
 * die Seite hat dann einen Träger und bekommt keine eigene Kennung. Die Marke `p` selbst belegt die Ankündigung (`deutschMarke`). Ausgenommen:
 * ein Handurteil „keine Synchro“ (`data/ohne-synchro-von-hand.yaml`). Marke `-`, `d` und `c` ändern nichts. Muss vor `ergaenzeAnisearchTitel` laufen.
 * @returns die geholten AniList-Kennungen
 */
export function holeTraegerGeplanterSynchro(titles: Map<number, Title>, jpStart: Map<number, string>, jpStartAnzeige: Map<number, string>, q: Quellen = ausDateien()): number[] {
  const geholt: number[] = []
  const ausgelassen: number[] = []
  for (const [seite, kennungen] of q.traeger) {
    if (q.dub(seite) !== 'p' || kennungen.some((id) => titles.has(id))) continue
    /* Nur ein Träger je Seite: genau ein Titel. */
    const id = kennungen.find((k) => q.katalog.has(k) && !q.ausgenommen.has(k))
    const e = id === undefined ? undefined : q.katalog.get(id)
    if (id === undefined || !e) {
      ausgelassen.push(...kennungen.filter((k) => q.katalog.has(k) && q.ausgenommen.has(k)))
      continue
    }
    titles.set(id, { ...titelAusKatalogEintrag(e), dubConfidence: 'normal', ...(e.mal ? { malId: e.mal } : {}) })
    if (e.start) {
      jpStart.set(id, e.start)
      jpStartAnzeige.set(id, e.start)
    }
    geholt.push(id)
  }
  log(meldung(geholt, ausgelassen))
  return geholt
}
