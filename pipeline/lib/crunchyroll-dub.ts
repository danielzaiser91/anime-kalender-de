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
  /**
   * `undefined` heißt **nicht gesehen**, nicht „kein Deutsch".
   *
   * Bis zum 20.08.2026 war das Feld ein schlichtes `boolean`, und jede Seite,
   * auf der die Audio-Zeile fehlte, wurde als `false` verbucht — ein
   * Fehlschlag als Befund. Der Unterschied ist an den Zahlen abzulesen: Von 767
   * Nicht-Funden hatten **202** überhaupt keine Audio-Zeile, und die alte
   * Slug-Adressform kam nur auf 12 Prozent Erfolg gegenüber 39 Prozent bei
   * `/series/<id>/` — dieselbe Seite, nur einmal vor und einmal nach der
   * Weiterleitung gelesen (Daniels Verdacht, 20.08.2026, und er stimmte).
   *
   * Deshalb drei Zustände statt zwei: `true` belegt, `false` belegt das
   * Gegenteil, `undefined` sagt „wir haben es nicht gesehen".
   */
  deutschImAngebot?: boolean
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
 * Drei Fälle, streng nach abnehmender Sicherheit:
 *
 * 1. **Kein einziger Block enthält eine deutsche Folge.** Die Audio-Zeile führt
 *    Deutsch, die Folgenliste aber nicht — das kommt vor, wenn Deutsch nur an
 *    einem Trailer hängt oder an einer Folge, die inzwischen weg ist.
 * 2. **Jeder Block ist vollständig deutsch.** Dann ist jeder unserer Einträge
 *    deutsch, egal wie die Blöcke geschnitten sind — ohne jede Zuordnung.
 * 3. **Gemischt.** Erst hier wird gerechnet, und nur mit exakt aufgehenden
 *    Summen (dieselbe Regel wie bei ADN). Geht sie nicht auf, bleibt alles
 *    offen. Lieber ein Fragezeichen als eine falsche Zahl.
 *
 * ## Warum „keine deutsche Tonspur auf der Seite" **kein** Fall mehr ist
 *
 * Bis zum 15.08.2026 stand hier ein vierter, vorgeblich sicherster Fall: Fehlt
 * „Deutsch" in der Audio-Zeile, bekamen alle Einträge dieser Adresse `dub:
 * false` — mit der Begründung, es werde ja „nur widerlegt, nie behauptet".
 *
 * Diese Begründung ist falsch, und zwar aus einem Grund, der beim Schreiben
 * übersehen wurde: **Crunchyroll zeigt nicht allen dasselbe.** Nicht angemeldet,
 * angemeldet ohne Abo und angemeldet mit Abo sind drei verschiedene Ansichten
 * (Daniel, 15.08.2026). Unser Scraper ruft ohne Anmeldung ab und sieht damit
 * nicht, *was es gibt*, sondern *was ein Gast sehen darf*. Ein fehlendes
 * „Deutsch" ist unter dieser Bedingung keine Widerlegung, sondern eine
 * Nichtauskunft — und `dub: false` daraus zu machen ist genau die Sorte
 * Falschangabe, gegen die dieses Projekt gebaut ist.
 *
 * Der Messwert passte dazu: Der Lauf vom 12./13.08.2026 fand auf nur **151 von
 * 917** Seiten überhaupt Deutsch und führte „Frieren: Beyond Journey's End" als
 * Seite ohne deutsche Tonspur.
 *
 * Ein `false` kann jetzt nur noch aus der **Folgenliste** kommen (Fall 1 und 3)
 * — oder von einem Menschen aus `data/dub-confirmed.yaml`.
 */
export function beurteile(serie: CrSerie, unsere: Title[]): Urteil[] {
  if (!unsere.length) return []
  if (!serie.deutschImAngebot) return []

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
