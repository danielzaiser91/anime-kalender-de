/**
 * **Plausibilität vor dem Schreiben.** Ändert JustWatch seine Schnittstelle, sähe das aus wie
 * „überall keine Angebote" oder „nichts mehr gefunden" — und der Bau nähme Titeln ihre Wege.
 * Gemessen wird deshalb an Titeln, die **vorher** einen Treffer hatten (`verfehlt`), und am
 * Anteil leerer Treffer. Neue Fehlschläge zählen nicht: Die Schlange stellt früher
 * erfolglose Titel nach 28 Tagen erneut an, dort ist „ohne Treffer" der Normalfall
 * (Stichprobe 27.09.2026: 27 von 30 führt JustWatch gar nicht). Am 28.09.2026 verwarf die
 * alte Schwelle (70 % ohne Treffer) so einen Lauf mit 26 guten Treffern und 0 verfehlten.
 */
export function istUnplausibel({ getroffen, leer, verfehlt }: { getroffen: number; leer: number; verfehlt: number }): boolean {
  const bekannt = getroffen + verfehlt
  if (bekannt < 20) return false
  return leer / Math.max(getroffen, 1) > 0.25 || verfehlt / bekannt > 0.5
}
