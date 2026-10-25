/**
 * Bestandswache: `titelliste-fehlt` in `data/adn-anisearch-offen.json` (ADN-Zuordnung, Wochenlauf). Bewertung in `lib/adn-offen-wache.ts`;
 * Warnung ab 1 Serie (Exit 0, auch bei vielen), rot nur bei fehlender/kaputter Datei oder falscher Anzahl. Test: `check-adn-offen-wache.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bewerteOffenDatei } from './lib/adn-offen-wache.ts'

export function main(datei: string): number {
  const w = bewerteOffenDatei(existsSync(datei) ? readFileSync(datei, 'utf8') : null)
  const marke = { ok: '✓', warnung: '⚠ WARNUNG', rot: '✖' }[w.stufe]
  const zeile = `  ${marke} ADN-Titelliste: ${w.text}`
  if (w.stufe === 'rot') console.error(zeile)
  else console.log(zeile)
  if (w.stufe === 'rot') console.error('VERSTÖSSE: 1')
  else console.log('VERSTÖSSE: 0')
  return w.stufe === 'rot' ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2] ?? fileURLToPath(new URL('../data/adn-anisearch-offen.json', import.meta.url))))
}
