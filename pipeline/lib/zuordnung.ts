/**
 * Vom gemeldeten Browser-Zustand zurück zu unserem Datensatz.
 *
 * Beide Funktionen hier sind an je einem realen Fehlschlag gewachsen, und beide
 * lösen dasselbe Problem: Was der Browser meldet, sieht nur *fast* aus wie das,
 * was bei uns steht.
 */

/**
 * Adressen vergleichbar machen, bevor sie verglichen werden.
 *
 * Daniels Meldung zu „K" fand ihren Titel nicht — unser Datensatz führt
 * `http://www.netflix.com/title/80040118`, der Browser meldete dieselbe Seite
 * als `https://…` (22.08.2026). Ein Protokollbuchstabe hat eine gültige
 * Prüfung verworfen, und zwar stillschweigend.
 *
 * Weggelassen werden deshalb Protokoll, `www.`, Schrägstrich am Ende und alles
 * ab Fragezeichen oder Raute — Anbieter hängen dort Sitzungs- und
 * Herkunftsangaben an, die mit der Seite nichts zu tun haben.
 */
export function schluesselAdresse(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()
}

/**
 * Einen Seitentitel auf seinen Kern bringen.
 *
 * Die letzte Chance auf eine Zuordnung, wenn die Adresse nichts hergibt:
 * Anbieter führen denselben Titel unter mehreren Kennungen — Daniels
 * JJK-Seite meldete `title/80237957`, wir kennen JJK als `title/81278456`.
 *
 * **Das Ergebnis ist ein Vorschlag, kein Beleg.** „Beyblade Burst Surge" und
 * „Beyblade Burst Rise" trennt ein Wort; wer hier automatisch übernimmt,
 * schreibt irgendwann einen Befund an die falsche Serie.
 */
export function titelSchluessel(text: string): string {
  return text
    .replace(/\s*[–—|-]\s*Netflix\s*$/i, '')
    .replace(/\s*[–—|-]\s*(Prime Video|Crunchyroll|Disney\+)\s*$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
