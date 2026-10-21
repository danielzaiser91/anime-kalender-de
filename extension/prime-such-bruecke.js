/**
 * **Prime: die eigene Meldung überbrückt den Stand über Seitenwechsel hinweg** (4.31.10, 21.10.2026).
 *
 * Daniel am 21.10.2026: Nach „gemeldet ✓" stand der Titel nach dem nächsten Seitenaufruf wieder in
 * der Liste (Bernard Bär, Mission Mars, Die Boonies; Meldungen im Briefkasten 01:04 Z, Diagnose
 * 01:09 Z: `lokalErledigt` gesetzt, `inGemeldeteSuchen` false). Ursache: `istGemeldet()` und
 * `fertig()` fragen bei vorhandenem Stand (`?stand=1`, fünf Minuten im Edge-Cache) nur den Stand und
 * `frischGemeldet` — und das ist eine Menge im Arbeitsspeicher der Seite, mit jedem Seitenaufruf leer.
 * Der gespeicherte Vermerk (`amazonSuche`, `amazonErledigt`) blieb unbeachtet.
 *
 * Der Vermerk trägt jetzt den Zeitpunkt (ISO) und überbrückt genau die Frist des Stands; danach
 * entscheidet wieder der Worker allein (Daniel, 28.08.2026: „single source of truth").
 */
{
  /* Fünf Minuten Cache des Stands plus ein Takt Luft. */
  const BRUECKE_MS = 10 * 60 * 1000

  /** Der Vermerk einer eigenen Meldung: ISO-Zeit, nicht nur der Tag (4.31.9 und früher speicherte den Tag). */
  globalThis.akPrimeVermerk = (jetzt) => new Date(jetzt).toISOString()

  /** Gilt ein gespeicherter Vermerk (ISO-Zeit) zur Zeit `jetzt` (ms) noch als Überbrückung? */
  globalThis.akPrimeBruecke = (vermerk, jetzt) => {
    const am = Date.parse(vermerk)
    return Number.isFinite(am) && jetzt >= am && jetzt - am < BRUECKE_MS
  }
}
