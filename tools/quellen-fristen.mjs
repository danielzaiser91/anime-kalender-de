/**
 * Quellen, die seltener laufen als der Nachtlauf — mit ihrer eigenen Frist.
 *
 * Der Anlass: Am 16.08.2026 schlug die Prüfung Alarm, weil `adn-catalog` seit
 * 5,1 Tagen nichts geliefert hatte. Kaputt war nichts. Der ADN-Katalog wird
 * **wöchentlich** geholt, montags um 5:41 — gegen eine Frist von vier Tagen
 * gemessen, meldet er sich also ab jedem Freitag als stumm. Eine Warnung, die
 * jede Woche zuverlässig zu Unrecht kommt, ist schlimmer als keine: Man hört
 * auf hinzusehen.
 *
 * Die Frist ist jeweils die Taktung plus zwei Tage Luft — ein einzelner
 * ausgefallener Lauf soll noch keinen Alarm auslösen, zwei hintereinander schon.
 */
export const FRISTEN = {
  /*
    **Diese beiden laufen nur von Daniels Rechner — und deshalb unregelmäßig.**

    Das anonyme Crunchyroll-Token trägt die Region der abrufenden Leitung; aus
    der Cloud käme der US-Katalog, dessen Schweigen nichts belegt. Die Skripte
    brechen dort ab, und bis zum 02.09.2026 taten sie das jede Woche unbemerkt in
    einer `&&`-Kette, die zwei weitere Läufe mitriss.

    Drei Wochen sind großzügig, und das ist Absicht: Eine Warnung, die zu oft zu
    Unrecht kommt, wird überlesen (CLAUDE.md, 16.08.2026). Kommt sie, ist der
    Griff `npm run data:cr-einzelwerke && npm run data:cr-filmbloecke` — von hier,
    nicht aus der Cloud.
  */
  'cr-einzelwerke': 21,
  'cr-filmbloecke': 21,

  // Wöchentlich, montags.
  'adn-catalog': 9,
  // Wochenlauf (refresh-weekly.yml, 400 Kennungen je Lauf); ohne Eintrag galt die Standardfrist von 4 Tagen.
  'anisearch-eintraege': 9,
  'anilist-voices': 9,
  'anime-offline-database': 9,
  'ann-voices': 9,
  // Läuft wöchentlich, holt aber nur, was älter als 28 Tage ist — ein Lauf
  // ohne neue Seiten meldet trotzdem seinen Bestand.
  'crunchyroll-dub': 9,
  // Läuft täglich — vier Abrufe. Bleibt er zwei Tage stumm, ist etwas kaputt.
  'crunchyroll-neu': 3,
  /*
    Stündlich. Fällt der Leser aus, steht `data/crunchyroll-woche.json` still — und weil der Schritt
    als geduldeter läuft (`continue-on-error`), bleibt der Lauf trotzdem grün: Am 28.09.2026 wechselte
    der Artikel auf die kurze Schreibweise, und die Datei stand drei Tage auf der Vorwoche, ohne dass
    es jemandem auffiel. Ein Tag Frist meldet das am zweiten Tag als Blocker.
  */
  'crunchyroll-woche': 1,
  // Mehrmals täglich; zwei stumme Tage heißen, RTL+ hat die Seite umgebaut.
  'tv-programm': 3,
  /*
    Quellen, die bei jedem Tageslauf (refresh-data.yml) oder öfter laufen und bis zum 26.10.2026 unbemerkt auf der
    Standardfrist standen. Frist 3 = Taktung plus zwei Tage Luft, wie `crunchyroll-neu`; Gesundheitsdatei vom 26.10.2026:
    alle zuletzt vor weniger als einem Tag erfolgreich. `tv-de` und `messbelege` laufen stündlich; `messbelege` zählt
    eine leere Warteschlange als Erfolg (`leerIstOk`).
  */
  adn: 3,
  anime2you: 3,
  'anisearch-dubs': 3,
  'anisearch-zuordnung': 3,
  messbelege: 3,
  toggo: 3,
  'tv-de': 3,
  /*
    Ebenfalls im Tageslauf, aber hier ist nicht belegt, dass ein Lauf jeden Tag etwas zählt (Warteschlange, neue Titel):
    bewusst die bisherige Standardfrist von 4 Tagen, jetzt eingetragen, damit der Wächter `quellen-fristen-takt.test.mjs`
    sie als Entscheidung liest und nicht als vergessene Quelle.
  */
  anisearch: 4,
  'beleg-lesungen': 4,
  'cartoon-reihen': 4,
  'wikipedia-folgen': 4,
  /*
    Wöchentlich. Der Lauf arbeitet eine Liste ab, die kleiner wird — sind alle
    Verweise beurteilt, holt er nichts mehr und meldet trotzdem seinen Bestand.
  */
  'crunchyroll-offene': 9,
  // Wöchentlich, eine Wikidata-Abfrage (19.09.2026).
  'wikidata-imdb': 9,
  // Wöchentlich, wie der Lauf, der sie füllt.
  'youtube-check': 9,
  // Wöchentlich, 400 Titel je Lauf gegen 60 Tage Wiedervorlage.
  'tmdb-titles': 9,
  /* Wöchentlich, 40 Titel je Lauf — Taktung plus zwei Tage Luft. */
  'justwatch-audio': 9,
  /* Täglich geholt, also Taktung plus zwei Tage Luft — wie bei den anderen täglichen Quellen. */
  trailer: 4,
  /* Täglich geholt, also Taktung plus zwei Tage Luft. */
  cartoons: 4,
  /* Täglich im ADN-Lauf geholt (die Datei merkt sich den Tag) — zwei Tage Luft. */
  'adn-news': 4,
  // Wöchentlich. Ein Fenster von zwölf Monaten enthält in ruhigen Wochen
  // **null** Anime-Kinostarts — das ist kein Ausfall, sondern die Branche.
  'tmdb-kino': 9,
  /* Wochenlauf plus zwei Tage Luft — ein ausgefallener Lauf ist noch kein Alarm. */
  'tmdb-folgen': 9,
  /* Wochenlauf wie die TMDB-Folgen der Anime. */
  'cartoon-folgen': 9,
  /* Stündlich, aber nur wenn gemeldet wurde — eine Woche ohne Meldung ist normal. */
  rohfolgen: 30,
  /*
    **Das Kontingent ist der Takt, nicht der Kalender.**

    Die Streaming-Availability-API hat ein Monatskontingent. Ist es
    aufgebraucht, setzt der Lauf keine Anfrage mehr ab — und galt damit als
    stumm. Am 28.08.2026 hat das den täglichen Lauf rot gemacht, obwohl nichts
    kaputt war: HTTP 429, fünf Tage vor Monatsende.

    Dreiunddreißig Tage decken einen vollen Kontingentzyklus plus zwei Tage
    Luft ab. Bleibt sie darüber hinaus stumm, ist es ein echter Ausfall.

    Dieselbe Lehre wie beim ADN-Katalog: Eine Warnung, die zuverlässig zu
    Unrecht kommt, ist schlimmer als keine — man hört auf hinzusehen.
  */
  'motn-changes': 33,
  /* Wöchentlich, 150 Titel je Lauf gegen 90 Tage Wiedervorlage. */
  'anisearch-folgen': 9,
  // Nur auf Abruf (daten-auf-abruf.yml, ohne Zeitplan): Stille ist Normalfall, erst ein Monat ohne Lauf fällt auf.
  'anisearch-cover-eigen': 30,
  // Wöchentlich. Anime laufen im Kino als Sondervorstellung — in vielen
  // Wochen gibt es keinen einzigen, und das ist kein Ausfall.
  cinestar: 9,
  // Wöchentlich, wie der Lauf, der sie füllt.
  'link-check': 9,
  /*
    Wöchentlich. Der Lauf findet nur etwas, wenn seit dem letzten Mal ein Titel
    ohne deutschen Namen dazugekommen ist — in ruhigen Wochen sind null Treffer
    der Normalfall und kein Ausfall.
  */
  'wikidata-titel': 9,
  /**
   * Monatlich — die Taktung kommt hier nicht vom Nutzen, sondern vom
   * Kontingent.
   *
   * Die Streaming Availability API gibt 1.000 Anfragen im **Monat** her, Reset
   * am Monatsersten. `.github/workflows/tonspuren-monatlich.yml` holt am
   * Zweiten jedes Monats bis zu 800 davon in einem Lauf — ein täglicher oder
   * wöchentlicher Takt würde das Kontingent vorzeitig verbrauchen.
   *
   * Gegen die Taktung spricht der gemessene Verzug der Quelle nicht: Sie hinkt
   * ein paar Tage hinterher, und was seit Jahren auf Netflix liegt, liegt auch
   * nächsten Monat noch dort. Genau dieser Bestand ist ihr Zweck.
   *
   * Derselbe Kontingentzyklus wie bei `motn-changes`, deshalb derselbe Wert:
   * ein voller Monat plus zwei Tage Luft. Bis 01.09.2026 stand hier 9 — eine
   * Frist für Wochentakt, die seit Einführung des monatlichen Workflows nicht
   * mehr passte und den Bau-Lauf einen Tag vor dem nächsten planmäßigen Abruf
   * fälschlich rot machte (Lauf 33555019125, Issue #34).
   */
  motn: 33,
}
