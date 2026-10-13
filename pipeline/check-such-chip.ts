/**
 * Das × am Such-Chip der Datenbank leert die Suche (Daniel, 13.10.2026), „Zurücksetzen" lässt sie stehen (Daniel, 29.09.2026).
 * Beides geht durch verschiedene Türen: Zurücksetzen durch `setFilters` (nimmt die Suche aus der Adresse mit),
 * das × durch den Rückruf aus `SucheLeerenContext`. Das Verhalten im Browser prüft `tools/such-chip-messen.mjs`.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const lies = (pfad: string): string => readFileSync(pfad, 'utf8')

console.log('\nSuch-Chip und Zurücksetzen:')
const app = lies('web/src/App.tsx')
const aktiv = lies('web/src/components/kalender/AktiveFilter.tsx')
const bereich = lies('web/src/components/DatenbankBereich.tsx')
const chipZeile = aktiv.split('\n').find((z) => z.includes("t('filter.suche'")) ?? ''

pruefe('das × am Such-Chip ruft den Rückruf der Seite auf, nicht onChange', chipZeile.includes('weg: onSucheLeeren') && !chipZeile.includes('search:'), chipZeile.trim())
pruefe('ohne Rückruf (Kalender) gibt es keinen Such-Chip', /if \(filters\.search\.trim\(\) && onSucheLeeren\)/.test(aktiv))
pruefe('der Rückruf kommt aus SucheLeerenContext', /useContext\(SucheLeerenContext\)/.test(aktiv))
pruefe(
  'nur die Datenbank stellt ihn bereit, und er setzt die Suche auf leer',
  /<SucheLeerenContext\.Provider value=\{\(\) => p\.navigate\(\{ filters: \{ \.\.\.route\.filters, search: '' \} \}\)\}>/.test(bereich) &&
    !app.includes('SucheLeerenContext'),
)
pruefe(
  'Zurücksetzen behält die Suche (setFilters nimmt route.filters.search mit)',
  /const setFilters = \(filters: FilterState\) => navigate\(\{ filters: \{ \.\.\.filters, search: route\.filters\.search \} \}\)/.test(app),
)
pruefe('„Alle zurücksetzen" geht weiter durch onChange', /onChange\(\{ \.\.\.EMPTY_FILTERS \}\)/.test(aktiv))

if (verletzt) process.exit(1)
