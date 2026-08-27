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
  const ohne = url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase()

  /**
   * **Bei einer Suchadresse ist der Suchbegriff die Adresse.**
   *
   * Der Query-String fällt sonst weg, und das ist bei einer Titelseite
   * richtig: `…/dp/B0B8TR93HR?ref_=atv_dp` und `…/dp/B0B8TR93HR` sind
   * dieselbe Seite. Bei `amazon.de/s?k=Cowboy+Bebop` bleibt danach `amazon.de/s`
   * übrig — und das ist die Adresse **jeder** Amazon-Suche.
   *
   * 118 unserer Prime-Verweise sind solche Suchen. Am 27.08.2026 wurde eine
   * einzige Meldung („Cowboy Bebop gibt es dort nicht") auf alle 118 verteilt:
   * Sie trugen für die Zuordnung denselben Schlüssel. Der Lauf schrieb 118
   * Einträge `available: false` in `dub-confirmed.yaml`, entfernte 118
   * Verweise und machte den Deploy rot — gefangen hat es die Zusicherung „es
   * gibt überhaupt Suchadressen im Bestand" in `check:zugangsart`.
   *
   * Der Fehler lag latent seit es Suchadressen gibt; erst die erste Meldung
   * gegen eine von ihnen hat ihn ausgelöst.
   */
  /* Amazon schreibt das Leerzeichen mal als %20, mal als + — beides derselbe Begriff. */
  const begriff = /[?&]k=([^&#]+)/.exec(url)?.[1]?.replace(/\+/g, ' ')
  return begriff && /\/s$/.test(ohne) ? `${ohne}?k=${decodeURIComponent(begriff).toLowerCase()}` : ohne
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
