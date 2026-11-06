/**
 * Warnung (nie rot): Fast-Doppel in den Handbelegen, also Belege, die sich nur im Prüfdatum unterscheiden
 * (`pipeline/lib/handbeleg-fast-doppel.ts`). Bestandsbau und Meldungen schreiben `data/dub-confirmed.yaml` laufend,
 * ein neues Paar entsteht jederzeit (Verlauf 21.09.–03.11.2026: 4 → 44 überzählige, in Schüben, seit 30.10. keiner); Rot würde den Bestandsbau stoppen.
 * Aufräumen: `npx tsx tools/handbelege-fast-doppel.ts` (liefert die Datenänderung für einen PR, die Fälle stehen in `check-handbeleg-fast-doppel.ts`).
 *
 * Aufruf: `check:bestand` (steckt darin) oder `tsx pipeline/check-handbeleg-fast-doppel-bestand.ts`
 */
import { readFileSync } from 'node:fs'
import { entferneFastDoppel } from './lib/handbeleg-fast-doppel.ts'

const bilanz = entferneFastDoppel(readFileSync('data/dub-confirmed.yaml', 'utf8'))
if (bilanz.entfernt) {
  console.log(`⚠ WARNUNG Handbelege: ${bilanz.entfernt} Fast-Doppel (gleich bis auf das Prüfdatum) zusammenführbar — npx tsx tools/handbelege-fast-doppel.ts`)
}
if (bilanz.gemischt) console.log(`⚠ WARNUNG Handbelege: ${bilanz.gemischt} Fast-Doppel-Gruppe(n) aus Browser-Meldung und Handprüfung — von Hand ansehen`)
console.log(`check-handbeleg-fast-doppel-bestand: ${bilanz.entfernt} zusammenführbar, ${bilanz.blockiert} blockiert, ${bilanz.gemischt} gemischt, ${bilanz.gruppen} Gruppen.`)
