/**
 * Was Crunchyrolls Serienseiten über die deutsche Tonspur verraten — und wie
 * weit man dem trauen darf.
 *
 * **Der Grundsatz, der alles andere bestimmt:** Crunchyrolls Staffeleinteilung
 * wird *nicht* übernommen. Sie ist hier ausschließlich Beleg für die Tonspur.
 * Daniel am 12.08.2026: „bau darauf achten nicht crunchyrolls fehler
 * nachzubauen" — es gibt dort Folgendoppelungen, mehrfache Wähler-Einträge zur
 * selben Staffel, und Blöcke, die zwei unserer Staffeln zusammenfassen. Die
 * saubere Einteilung liefern Netflix und Prime Video, und unsere eigene kommt
 * von AniList. Die bleibt maßgeblich.
 *
 * Daraus folgt die Reihenfolge der Fälle unten: Erst wird versucht, **ohne**
 * jede Zuordnung auszukommen. Nur wenn das nicht geht, wird gerechnet — und
 * wenn die Rechnung nicht exakt aufgeht, bleibt der Eintrag ungeklärt.
 */
import type { Title } from '../../shared/types.ts'

export interface CrStaffel {
  name: string
  /** Verschiedene Folgennummern — nicht die Zahl der Kacheln. */
  folgen: number
  kacheln: number
  deutsch: number
  fremd: number
}

export interface CrSerie {
  url: string
  deutschImAngebot: boolean
  staffeln?: CrStaffel[]
  geprueftAm: string
  fehler?: string
}

export interface CrDubData {
  scrapedAt: string
  serien: CrSerie[]
}

/** Was wir über einen unserer Einträge auf Crunchyroll sagen können. */
export interface Urteil {
  titleId: number
  dub: boolean
  /** Woran es liegt — landet als Notiz in der Prüfliste und im Commit. */
  grund: string
}

/**
 * Beurteilt die Einträge, die auf **eine** Crunchyroll-Adresse zeigen.
 *
 * Vier Fälle, streng nach abnehmender Sicherheit:
 *
 * 1. **Keine deutsche Tonspur auf der ganzen Seite.** Dann hat keiner unserer
 *    Einträge dort eine — ohne jede Zuordnung. Das ist der häufigste Fall und
 *    der sicherste: Es wird nur widerlegt, nie behauptet.
 * 2. **Kein einziger Block enthält eine deutsche Folge.** Dasselbe Ergebnis auf
 *    anderem Weg; kommt vor, wenn die Audio-Zeile Deutsch führt, aber nur wegen
 *    eines Trailers oder einer Folge, die inzwischen weg ist.
 * 3. **Jeder Block ist vollständig deutsch.** Dann ist jeder unserer Einträge
 *    deutsch, egal wie die Blöcke geschnitten sind — auch hier ohne Zuordnung.
 * 4. **Gemischt.** Erst hier wird gerechnet, und nur mit exakt aufgehenden
 *    Summen (dieselbe Regel wie bei ADN). Geht sie nicht auf, bleibt alles
 *    offen. Lieber ein Fragezeichen als eine falsche Zahl.
 */
export function beurteile(serie: CrSerie, unsere: Title[]): Urteil[] {
  if (!unsere.length) return []

  if (!serie.deutschImAngebot) {
    return unsere.map((t) => ({
      titleId: t.id,
      dub: false,
      grund: 'Serienseite führt keine deutsche Tonspur',
    }))
  }

  const staffeln = serie.staffeln ?? []
  if (!staffeln.length) return []

  const gesamtDeutsch = staffeln.reduce((n, s) => n + s.deutsch, 0)
  if (gesamtDeutsch === 0) {
    return unsere.map((t) => ({
      titleId: t.id,
      dub: false,
      grund: 'keine einzige Folge mit deutscher Tonspur',
    }))
  }

  const vollstaendig = staffeln.every((s) => s.folgen > 0 && s.deutsch === s.folgen)
  if (vollstaendig) {
    return unsere.map((t) => ({
      titleId: t.id,
      dub: true,
      grund: `alle ${staffeln.length} Blöcke vollständig deutsch`,
    }))
  }

  /**
   * Gemischter Fall: unsere Einträge der Reihe nach an die Blöcke anlegen.
   *
   * Gerechnet wird über die Folgenzahl, wie bei ADN — nur dass hier die Blöcke
   * fremd sind und nicht angefasst werden dürfen. Ein Block wird nur dann einem
   * oder mehreren unserer Einträge zugeschlagen, wenn deren Folgenzahlen sich
   * **exakt** auf seine Folgenzahl summieren. Alles andere bleibt offen: Bei
   * einem Block, der zu 15 von 17 Folgen deutsch ist, entscheidet die genaue
   * Grenze darüber, ob unsere Staffel 4 vollständig deutsch ist oder nicht —
   * und diese Grenze lässt sich aus Summen nicht erraten.
   */
  const sortiert = unsere.slice().sort((a, b) => (a.jpYear ?? 0) - (b.jpYear ?? 0) || a.id - b.id)
  const urteile: Urteil[] = []
  let zeiger = 0
  for (const block of staffeln) {
    if (zeiger >= sortiert.length) break
    let summe = 0
    let laenge = 0
    while (zeiger + laenge < sortiert.length && summe < block.folgen) {
      summe += sortiert[zeiger + laenge].episodes ?? 0
      laenge++
    }
    if (summe !== block.folgen || laenge === 0) continue
    // Nur eindeutige Blöcke: entweder ganz deutsch oder gar nicht.
    if (block.deutsch === block.folgen) {
      for (const t of sortiert.slice(zeiger, zeiger + laenge)) {
        urteile.push({ titleId: t.id, dub: true, grund: `„${block.name}" vollständig deutsch` })
      }
    } else if (block.deutsch === 0) {
      for (const t of sortiert.slice(zeiger, zeiger + laenge)) {
        urteile.push({ titleId: t.id, dub: false, grund: `„${block.name}" ohne deutsche Folge` })
      }
    }
    // Teilweise vertretene Blöcke bleiben bewusst ohne Urteil.
    zeiger += laenge
  }
  return urteile
}
