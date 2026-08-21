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

/**
 * Eine Folge, für die die Content-API eine deutsche Fassung führt.
 *
 * `verfuegbarAb` ist das `premium_available_date` **des deutschen Objekts**,
 * nicht das der Folge in der Staffelliste. Der Unterschied ist der ganze Punkt:
 * `/seasons/<id>/episodes` liefert immer die Episoden der Originalstaffel, und
 * deren Datumsfelder gehören zur japanischen Ausstrahlung. Für „Mushoku Tensei"
 * Staffel 3 stand dort der 04.07.2026 — die deutschen Folgen erschienen am
 * 19.08.2026 (Daniel, 21.08.2026).
 *
 * Das Feld wird derzeit von nichts ausgewertet. Es steht hier, weil es
 * ohnehin über die Leitung geht, sobald die deutsche Kennung gelesen wird, und
 * weil es ein **belegter deutscher Termin mit Uhrzeit** ist — die Terminlogik
 * daran anzuschließen ist eine eigene Aufgabe.
 */
export interface CrDeutscheFolge {
  /** Folgennummer, wie Crunchyroll sie führt. Fehlt bei Filmen und Specials. */
  nummer?: number
  /** Kennung der deutschen Fassung (`…DEDE`). */
  guid: string
  /** `premium_available_date` der deutschen Fassung, ISO in UTC. */
  verfuegbarAb?: string
}

export interface CrStaffel {
  name: string
  /** Verschiedene Folgennummern — nicht die Zahl der Kacheln. */
  folgen: number
  kacheln: number
  deutsch: number
  fremd: number
  /** Crunchyrolls Staffelkennung. Nur über die Content-API zu haben. */
  staffelId?: string
  /**
   * Führt die Staffel selbst eine `de-DE`-Fassung in `versions`?
   *
   * Das ist die Angabe eine Ebene über den Folgen und **nicht** dasselbe wie
   * `deutsch === folgen`: Eine laufende Staffel trägt die deutsche Fassung,
   * lange bevor alle ihre Folgen sie haben.
   */
  deutscheFassung?: boolean
  /** Je deutscher Folge die Kennung und der belegte deutsche Termin. */
  deutscheFolgen?: CrDeutscheFolge[]
}

export interface CrSerie {
  url: string
  /** Crunchyrolls Serienkennung, etwa `GRDV0019R`. Der Schlüssel zur API. */
  seriesId?: string
  /**
   * Woher die Angaben stammen.
   *
   * `'api'` ist der Regelweg über die Content-API. `'seitenanzeige'` ist die
   * Rückfallebene, die die gerenderte Serienseite liest — langsam, gröber und
   * von Crunchyrolls Übersetzungen abhängig. Das Feld steht hier, damit ein
   * späterer Vergleich weiß, was er vergleicht; alte Einträge tragen es nicht.
   */
  quelle?: 'api' | 'seitenanzeige'
  /**
   * Aus welchem **Länderkatalog** die Angaben stammen — `de`, `us`, oder gar nicht.
   *
   * Das entscheidende Feld dieser Datei, seit es zwei Stände gibt. Crunchyroll
   * leitet die Region aus der IP des Abrufs ab; GitHub-Runner stehen in den
   * USA, und aus US-Sicht trägt „Fairy Tail" durchgehend `ja-JP, en-US`,
   * während in Deutschland 277 Folgen deutsch sind (Daniel, 22.08.2026). Ein
   * fehlendes `de-DE` aus dem US-Katalog belegt deshalb **nichts** — aus dem
   * deutschen belegt es das Gegenteil.
   *
   * `undefined` heißt „Region nicht belegt" und wird behandelt wie `us`: Alle
   * Einträge aus den Läufen bis zum 21.08.2026 tragen es nicht, und sie sind
   * ausnahmslos US (1.655 geprüfte Folgen mit `eligible_region: "US"`).
   */
  katalog?: string
  /**
   * Staffelname und `versions` sagen Verschiedenes.
   *
   * Kein Fehler und kein Grund, etwas nicht zu übernehmen — `versions`
   * entscheidet. Das Feld ist die Buchführung darüber, wie oft die Kontrolle
   * danebenliegt; sähe man hier ein Muster, wäre der Denkfehler unserer, nicht
   * Crunchyrolls.
   */
  namensWiderspruch?: string
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
  /**
   * Crunchyroll sagt selbst, dass es die Serie nicht mehr gibt.
   *
   * Auf der Seite steht dann ein Banner: „Leider sind die Videos dieser Serie
   * nicht mehr verfügbar." Bis zum 21.08.2026 hat der Abruf daraus nichts
   * gemacht — er wartete zwanzig Sekunden auf eine Audio-Zeile, die es nie
   * geben würde, und meldete „keine Audio-Zeile gefunden". Eine Nicht-Antwort,
   * obwohl die Seite eine klare Antwort gibt (Daniel, 21.08.2026, an
   * „Dragon Ball" gezeigt).
   *
   * Das ist `available: false` und nicht `dub: false`: Es gibt dort kein
   * Angebot, nicht ein Angebot ohne deutsche Fassung.
   */
  nichtVerfuegbar?: boolean
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
 * Ein `false` kann deshalb nur aus der **Folgenliste** kommen (Fall 1 und 3),
 * aus dem **deutschen Katalog** (siehe unten) — oder von einem Menschen aus
 * `data/dub-confirmed.yaml`.
 *
 * ## Was der deutsche Katalog daran ändert
 *
 * Seit dem 22.08.2026 liest der Abruf über ein Zugangspaket von einer deutschen
 * Leitung (`lib/crunchyroll-api.ts`). Damit steht in `versions` das, was ein
 * Besucher in Deutschland zu sehen bekommt — und ein fehlendes `de-DE` ist dann
 * keine Nichtauskunft mehr, sondern eine Aussage. „Fairy Tail Final Season"
 * trägt dort `ja-JP` und sonst nichts, während die ersten beiden Blöcke `de-DE`
 * führen; genau so hat Daniel es von Hand gesehen.
 *
 * Das gilt **ausschließlich** für `katalog === 'de'`. Alles andere — der alte
 * Bestand, der Browser-Weg, ein Lauf aus einer dritten Region — bleibt bei der
 * Vorsichtsregel, und zwar auch dann, wenn es „bestimmt auch deutsch gemeint"
 * ist. Die Trennlinie ist der Beleg, nicht die Wahrscheinlichkeit.
 */
export function beurteile(serie: CrSerie, unsere: Title[]): Urteil[] {
  if (!unsere.length) return []

  const staffeln = serie.staffeln ?? []
  if (!staffeln.length) return []

  if (!serie.deutschImAngebot) {
    /**
     * Aus dem US-Katalog wird hier nie ein Nein.
     *
     * Der Grund steht oben: Dort fehlt `de-DE` auch bei Serien, die in
     * Deutschland vollständig synchronisiert vorliegen.
     */
    if (serie.katalog !== 'de') return []
    return unsere.map((t) => ({
      titleId: t.id,
      dub: false,
      grund: `deutscher Katalog führt in ${staffeln.length} Blöcken keine deutsche Fassung`,
    }))
  }

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
  /**
   * Die Reihe muss vorne anfangen, sonst wird nicht gerechnet.
   *
   * Das Anlegen unserer Einträge an die Blöcke beginnt beim ersten Block — es
   * unterstellt also, dass unsere Liste dieselbe Reihe von vorn abbildet. Haben
   * wir **weniger** Einträge als Crunchyroll Blöcke, stimmt das nicht mehr, und
   * die Folgenzahl allein merkt es nicht: Unter der Adresse
   * `sword-art-online-alternative-gun-gale-online` führt Crunchyroll zwei
   * Blöcke zu je zwölf Folgen, „Gun Gale Online" (keine deutsche Folge) und
   * „Gun Gale Online II" (vollständig deutsch). Unser einziger Eintrag unter
   * dieser Adresse ist **die zweite** Staffel, ebenfalls zwölf Folgen — die
   * Summe ging auf, und sie ging am falschen Block auf. Herausgekommen wäre
   * „Gun Gale Online II ohne deutsche Folge" für eine Staffel, die
   * durchgehend deutsch ist (21.08.2026).
   *
   * Vorher fiel das nicht auf, weil die Serienseite alle Blöcke als
   * vollständig deutsch las und damit Fall 2 zog. Die genauere Auskunft der
   * Content-API legt die Lücke frei.
   */
  if (unsere.length < staffeln.length) return []

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
