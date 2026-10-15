/**
 * Millisekunden bis zur nächsten vollen Minute. Genau auf der Grenze (…:00.000) sind es 60 000, nicht 0:
 * Die Anzeige zeigt dann die Minute schon, ein Takt ohne Wartezeit wäre ein Leerlauf.
 */
export function msBisNaechsteMinute(jetztMs: number): number {
  return 60_000 - (jetztMs % 60_000)
}

/**
 * Ruft `tick` zu jeder vollen Minute auf (nicht 60 s nach dem Seitenaufruf), damit eine Minutenanzeige
 * höchstens die Zeit hinterherhinkt, die der Timer braucht. Je Minute neu geplant: Ein zu früh oder im
 * Hintergrund-Tab verspätet feuernder Timer korrigiert sich beim nächsten Mal selbst.
 * Rückgabe: Aufräumfunktion.
 */
export function minutenTakt(tick: () => void, jetzt: () => number = Date.now): () => void {
  let id: ReturnType<typeof setTimeout>
  const planen = () => {
    id = setTimeout(() => {
      tick()
      planen()
    }, msBisNaechsteMinute(jetzt()))
  }
  planen()
  return () => clearTimeout(id)
}
