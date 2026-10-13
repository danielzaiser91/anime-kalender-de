/**
 * Wartet auf eine Sperre aus `einzel-sperre.mjs` (`bau-vergleich`).
 */
import { nimmSperre } from './einzel-sperre.mjs'

export const FRIST_MS = 10 * 60_000

/**
 * Wie `nurEinmalGleichzeitig`, wartet aber höchstens `maxMs` auf die Freigabe (meldet es einmal und
 * dann jede Minute), bevor es mit Exit 3 abbricht. Für Werkzeuge, bei denen ein Wartender nützlicher
 * ist als ein Abbruch (`bau-vergleich`: Bauer-Läufe sollen sich nicht gegenseitig abweisen).
 */
export async function wartAufSperre(name, maxMs, takt = 5_000, wer) {
  const ende = Date.now() + maxMs
  let naechsteMeldung = 0
  for (;;) {
    const grund = nimmSperre(name, wer)
    if (!grund) return
    if (Date.now() + takt > ende) {
      console.error(`${grund} (nach ${Math.round(maxMs / 60_000)} min Warten aufgegeben)`)
      process.exit(3)
    }
    if (Date.now() >= naechsteMeldung) {
      console.log(`${grund.split(' — ')[0]} — warte bis zu ${Math.round(maxMs / 60_000)} min auf die Freigabe.`)
      naechsteMeldung = Date.now() + 60_000
    }
    await new Promise((fertig) => setTimeout(fertig, takt))
  }
}
