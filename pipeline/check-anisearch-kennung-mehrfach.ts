/**
 * Zusicherung: Eine aniSearch-Kennung, die mehrere Titel des Hauptbestands tragen, ist per Handdatei gebunden oder wird gemeldet
 * (Regel und Anlass: `lib/anisearch-kennung-mehrfach.ts`). Die Prüfung am ausgelieferten Bestand läuft im Bau (`bau/auslieferung-pruefen.ts`).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-anisearch-kennung-mehrfach.ts`
 */
import { anisearchKennungMehrfach } from './lib/anisearch-kennung-mehrfach.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\naniSearch-Kennung bei mehreren Titeln:')
{
  /* GANTZ (384, Brücke) und GANTZ 2 (395, Hand) teilen Seite 585. */
  const gantz = [{ id: 384, anisearchId: 585 }, { id: 395, anisearchId: 585 }]
  pruefe('Hand bindet alle bis auf einen: in Ordnung', anisearchKennungMehrfach(gantz, { 395: 585 }).length === 0)
  pruefe('Hand bindet alle: in Ordnung', anisearchKennungMehrfach(gantz, { 384: 585, 395: 585 }).length === 0)
  const neu = anisearchKennungMehrfach(gantz, {})
  pruefe('keine Handbindung: eine Meldung mit Kennung und beiden Titeln', neu.length === 1 && neu[0]!.includes('585') && neu[0]!.includes('384') && neu[0]!.includes('395'), neu)
  pruefe('Handbindung auf eine andere Kennung zählt nicht', anisearchKennungMehrfach(gantz, { 384: 999, 395: 999 }).length === 1)
  pruefe('drei Titel, einer gebunden: Meldung', anisearchKennungMehrfach([...gantz, { id: 400, anisearchId: 585 }], { 395: 585 }).length === 1)
  pruefe('jede Kennung nur einmal: nichts', anisearchKennungMehrfach([{ id: 1, anisearchId: 5 }, { id: 2, anisearchId: 6 }, { id: 3 }, { id: 4 }], {}).length === 0)
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
