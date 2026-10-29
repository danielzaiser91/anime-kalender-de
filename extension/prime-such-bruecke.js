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

  /**
   * Der Briefkasten räumt lokale Vermerke aus, die er nicht führt (verworfene Meldung, 02.09.2026) —
   * aber nur solche, die jünger sind als der Prüfstand (`akVermerkGilt`): `gemeldet` liest der Worker
   * nur seit dem Datenlauf, ältere Vermerke fehlen dort zu Recht und sind angekommen (24.10.2026).
   * Der Vermerk vom Tag der Prüfliste (`listeVom`) bleibt als Überbrückung. Gibt `{ bereinigt, entfernt }` zurück.
   */
  globalThis.akPrimeAufraeumen = (erledigt, liste, adressen, listeVom) => {
    const bereinigt = {}
    let entfernt = 0
    for (const [id, wert] of Object.entries(erledigt)) {
      const url = liste[id]?.url ?? null
      const zeit = wert?.zeit ?? wert?.datum
      const frisch = listeVom && String(zeit ?? '').slice(0, 10) >= listeVom
      if (!url || adressen.has(url) || frisch || !globalThis.akVermerkGilt(zeit, listeVom)) bereinigt[id] = wert
      else entfernt++
    }
    return { bereinigt, entfernt }
  }

  /**
   * Eine gemeldete Suche gilt, solange ihr Vermerk jünger ist als der Prüfstand — dieselbe Regel wie für
   * Titelvermerke (`akPrimeAufraeumen`). Der Worker-Stand kennt die Suchadresse einer Meldung nicht (er
   * rechnet mit der Titeladresse), und die Zählung `gemeldeteSuchen` ist bis zu 2 h alt: nach den zehn
   * Minuten der Brücke stand die Suche sonst bei der nächsten Meldung wieder in der Liste (29.10.2026).
   */
  globalThis.akPrimeSuchVermerkGilt = (vermerk) =>
    Number.isFinite(Date.parse(vermerk)) && globalThis.akVermerkGilt(vermerk, globalThis.AK_OFFENE_AMAZON_ERZEUGT ?? null)

  /** Gilt ein gespeicherter Vermerk (ISO-Zeit) zur Zeit `jetzt` (ms) noch als Überbrückung? */
  globalThis.akPrimeBruecke = (vermerk, jetzt) => {
    const am = Date.parse(vermerk)
    return Number.isFinite(am) && jetzt >= am && jetzt - am < BRUECKE_MS
  }
}
