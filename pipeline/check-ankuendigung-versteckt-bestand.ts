/**
 * Bestandswache: Ein Titel mit frischer Synchro-Ankündigung (bis 60 Tage nach `omuAb`) soll im Hauptbestand stehen, nicht hinter dem Toggle
 * „Anime ohne deutsche Synchro“ (26.10.2026, Iceblade Sorcerer Staffel 2). Hinter den Toggle gehört er trotzdem aus anderen Gründen
 * (aniSearch nennt kein Deutsch, Handurteil, japanischer Start liegt in der Zukunft): darum **nur eine Warnung** (Exit 0), die den Grund
 * zu prüfen bittet. Rot stoppt den ganzen Bestandsbau. Regel und Frist: `frischAngekuendigt` in `bau/ohne-beleg.ts`.
 * Test: `check-ankuendigung-sichtbar.ts`.
 *
 * Aufruf: npx tsx pipeline/check-ankuendigung-versteckt-bestand.ts [wurzel] [heute]
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { versteckteFrischeAnkuendigungen, versteckteWarnzeile } from './lib/ankuendigung-versteckt.ts'

/** Nur Ausgabe, nie ein Fehlerausgang: die Wache sperrt den Bestandsbau nicht (`tools/bestand-marken.mjs` zählt Ausgänge). */
export function main(wurzel: string, heuteIso: string): void {
  const hinten = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'ohne-synchro.json'), 'utf8')) as Title[]
  const zeile = versteckteWarnzeile(versteckteFrischeAnkuendigungen(hinten, heuteIso))
  console.log(zeile ?? '  ✓ Ankündigung: kein Titel mit frischer Synchro-Ankündigung hinter dem Toggle')
  console.log('VERSTÖSSE: 0')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] ?? fileURLToPath(new URL('..', import.meta.url)), process.argv[3] ?? todayIso())
}
