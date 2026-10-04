/**
 * **Ein Special, das als Bonus auf einer deutschen Disc liegt** (Daniel, 04.10.2026).
 *
 * Eine aniSearch-Artikelseite führt je Ausgabe die Tonspuren und unter „Enthaltene Titel" jedes Werk mit
 * Typ: Megalo Box Gesamtausgabe BD (polyband) = Serie + Bonus „Audio Drama" + Bonus „Six Mix Cosmic", Tonspur
 * Deutsch/Japanisch. Liegt ein Bonus, eine OVA oder ein TV-Spezial auf einer Disc mit deutscher Tonspur, ist
 * das der Beleg, den die Marke „Synchronisiert" am Werk selbst oft nicht trägt (aniSearch pflegt sie je
 * Eintrag, nicht je Disc). Eine **Audiobeschreibung** zählt nicht als deutsche Tonspur.
 *
 * Grenze: Die Tonspur gilt der Disc, nicht je Titel. Ob der Bonus selbst gesprochen ist, sagt die Seite nicht —
 * Handprüfung am Einzelfall bleibt der Maßstab (`daniel-zum-abarbeiten/`), die Oberfläche nennt die Quelle.
 */
import type { Title } from '../../shared/types.ts'
import type { Artikel } from './anisearch-artikel.ts'
import { readJson } from './util.ts'

export interface DiscBonus {
  /** Frühester Erscheinungstag einer solchen Ausgabe (ISO). */
  von?: string
  publisher?: string
  /** Artikelnummern bei aniSearch, die das belegen. */
  artikel: string[]
}

const ZAEHLT = new Set(['Bonus', 'OVA', 'TV-Spezial'])
const AUDIOBESCHREIBUNG = /audiobeschreibung|audio description|audio-description/i

export const hatDeutscheTonspur = (audio: string[] | undefined): boolean =>
  (audio ?? []).some((a) => /deutsch/i.test(a) && !AUDIOBESCHREIBUNG.test(a))

/** aniSearch-Anime-Kennung → Beleg. `ausgaben` liefert das Erscheinungsdatum je Artikelnummer. */
export function discBonusAus(
  artikel: Record<string, Artikel>,
  datumJeArtikel: Map<string, string>,
): Map<number, DiscBonus> {
  const raus = new Map<number, DiscBonus>()
  for (const [nr, a] of Object.entries(artikel)) {
    if (!hatDeutscheTonspur(a.audio)) continue
    for (const i of a.enthalten ?? []) {
      if (!ZAEHLT.has(i.typ)) continue
      const alt = raus.get(i.anisearchId)
      const datum = datumJeArtikel.get(nr)
      raus.set(i.anisearchId, {
        von: [alt?.von, datum].filter(Boolean).sort()[0],
        publisher: alt?.publisher ?? a.publisher,
        artikel: [...(alt?.artikel ?? []), nr],
      })
    }
  }
  return raus
}

/** Artikelnummer → frühestes Datum, aus `data/disc-ausgaben.json`. */
export function datumJeArtikel(ausgaben: Record<string, { url?: string; datum?: string }[]>): Map<string, string> {
  const m = new Map<string, string>()
  for (const liste of Object.values(ausgaben))
    for (const a of liste) {
      const nr = /\/article\/(\d+),/.exec(a.url ?? '')?.[1]
      if (nr && a.datum && !(m.get(nr)! <= a.datum)) m.set(nr, a.datum)
    }
  return m
}

/**
 * Setzt den Beleg an die Titel: Wer als Bonus auf einer deutschen Disc liegt, gilt als deutsch belegt
 * (`deErstausgabe.synchro`), mit dem Datum und Verlag der Disc. Eine vorhandene Marke bleibt unangetastet.
 */
export function discBonusAnwenden(titles: Map<number, Title>): number {
  const bonus = discBonusAus(
    readJson<Record<string, Artikel>>('data/anisearch-artikel.json', {}),
    datumJeArtikel(readJson('data/disc-ausgaben.json', {})),
  )
  const nachAid = new Map<number, Title>()
  for (const t of titles.values()) if (t.anisearchId) nachAid.set(t.anisearchId, t)
  let n = 0
  for (const [aid, b] of bonus) {
    const t = nachAid.get(aid)
    if (!t || t.deErstausgabe?.synchro) continue
    t.deErstausgabe = { ...t.deErstausgabe, ...(b.von ? { von: b.von } : {}), ...(b.publisher ? { publisher: b.publisher } : {}), synchro: true, quelle: 'disc' }
    n++
  }
  return n
}
