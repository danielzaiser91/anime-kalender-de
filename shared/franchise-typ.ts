/**
 * Ein Eintrag einer Reihe, wie ihn `franchises.json` führt.
 *
 * Bewusst knapp: Die Datei beantwortet nur „welche Staffeln, Filme und
 * Specials gehören zusammen und in welcher Reihenfolge". Cover, Genres und
 * Beschreibungen stehen bereits in `titles.json` — sie hier zu wiederholen
 * würde die Datei verdoppeln, ohne eine Frage zu beantworten.
 */
export interface FranchiseMember {
  id: number; al?: number // `al`: AniList-Kennung für den Quellenverweis
  name: string
  format?: string
  jpYear?: number
  /**
   * Startdatum laut AniList, so genau wie es dort steht (`2026`, `2026-06`,
   * `2026-06-19`).
   *
   * Ein Katalogtitel hat sonst gar keine Zeitangabe: Bei „Lord of Mysteries"
   * stand im Panel dreimal nur das Format.
   */
  jpStart?: string
  /** `NOT_YET_RELEASED` heißt: Der Termin steht noch aus. */
  jpStatus?: string
  /**
   * **Der früheste deutsche Termin dieses Teils — das Datum, das hier zählt.**
   *
   * Die Auswahlbox zeigte bis zum 12.09.2026 `jpStart`, also die japanische
   * Ausstrahlung. Daniel: „jp release dates sind fast komplett irrelevant …
   * sie sind eine nette zusatz info, dürfen aber nie prominent präsentiert
   * werden, uns interessieren de release dates, daher hier in dieser box
   * niemals jp release dates anzeigen, nur de dates wenn bekannt, falls
   * unbekannt, lieber kein datum dort."
   *
   * Kein Datum ist also die richtige Antwort, wo wir keins haben — und
   * `jpStart` bleibt im Datensatz, weil die Reihe danach **sortiert** wird.
   */
  deStart?: string
  episodes?: number
  /**
   * Steht dieser Teil nur im Katalog hinter dem Toggle?
   *
   * Die Reihe eines geöffneten Titels ist vollständig, unabhängig davon, was
   * der Toggle gerade zeigt. Dass ein Teil noch keine deutsche Fassung hat, gehört trotzdem
   * sichtbar — die Liste stellt ihn gestrichelt dar.
   */
  ohneSynchro?: boolean
  /**
   * Cover **ohne** Adressvorsatz — `ANILIST_COVER_BASIS` kommt beim Laden dazu.
   *
   * Stand hier bis zum 13.08.2026 bewusst nicht drin: „Sie würden die Datei
   * verdoppeln, und für eine Auswahlliste braucht es sie nicht." Aus der
   * Auswahlliste ist ein Karussell aus Vorschaukarten geworden, und eine Karte
   * ohne Bild ist keine. Die Begründung von damals gilt also nicht mehr — der
   * Preis dafür steht in der Zeile, in der `franchises.json` geschrieben wird.
   */
  cover?: string
  /**
   * **Hängt dieser Teil an einem anderen der Reihe?**
   *
   * AniList kennt die Beziehung `PARENT`: Specials und Beiwerk nennen die Serie,
   * zu der sie gehören; das Format tut es nicht. Bei chinesischen Produktionen
   * ist **alles** eine ONA, und ohne dieses Feld standen bei „Lord of Mysteries"
   * die Specials unter „Hauptserie".
   */
  beiwerk?: boolean
  /** Eine eigene Serie derselben Reihe, keine Staffel (Fortsetzung mit eigenem Titel); aus `data/cartoon-eigene-serien.yaml`. */
  eigenesWerk?: boolean
  /** Belegte deutsche Staffelnummer (aniSearch); steuert `staffelBeschriftungen()`, nicht den Titel. */
  staffelQuelle?: number
  /** Kennung des Originals, wenn dieser Teil eine Neuverfilmung ist; Remake und Folgendes zählen als eigene Linie (`zaehlgruppen()`). */
  remakeVon?: number
}

/** franchiseId → alle Einträge der Reihe, in Ausstrahlungsreihenfolge. */
export type Franchises = Record<number, FranchiseMember[]>
