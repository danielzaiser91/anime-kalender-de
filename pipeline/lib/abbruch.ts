/**
 * **Ein geduldeter Schritt muss sich melden** (30.09.2026).
 *
 * Anlass: Der Wochenprogramm-Leser scheiterte drei Tage lang **still**. Der Artikel wechselte auf die
 * kurze Schreibweise („vom 28.9. bis 4.10."), `wocheAus()` konnte sie nicht lesen, `main()` warf —
 * und der Schritt im Stundelauf trägt `continue-on-error: true`, der Lauf blieb also grün.
 * `data/crunchyroll-woche.json` stand derweil auf der Vorwoche, und aufgefallen ist es nur, weil
 * jemand die Datei zufällig ansah.
 *
 * Diese Meldung geht denselben Weg wie jede andere Störung: als **Vorfall** an den Worker, den die
 * Statusanzeige zeigt. Sie ist absichtlich billig — ein `fetch`, kein Wurf, kein `process.exit`.
 * Wer geduldet scheitern darf, ruft sie auf; `tools/check-workflows.mjs` achtet darauf.
 */
import { warn } from './util.ts'

export async function meldeAbbruch(
  art: string,
  fehler: unknown,
  plattform = 'crunchyroll',
  url?: string,
): Promise<void> {
  const meldung = fehler instanceof Error ? fehler.message : String(fehler)
  const token = process.env.LAUF_TOKEN
  if (!token) {
    warn(`Abbruch (${art}): ${meldung} — ohne LAUF_TOKEN kein Vorfall gemeldet`)
    return
  }
  const worker = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
  try {
    await fetch(`${worker}/vorfall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({ plattform, art, url: url ?? '', text: `Lauf abgebrochen: ${meldung}` }),
    })
  } catch (err) {
    warn(`Vorfall nicht gemeldet: ${(err as Error).message}`)
  }
}
