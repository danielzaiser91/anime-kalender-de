/**
 * Zusicherungen zum schnelleren Eintreffen von Daten (15.10.2026):
 * - leichter Anime2You-Abruf: erste Feed-Seite, Volltext nur für neue Adressen, Datei nur bei Änderung;
 * - Zeitplan: der leichte Abruf läuft im Stundenlauf (neue Meldung spätestens nach einer Stunde im Bestand), der aniSearch-Dub-Abruf genau einmal täglich
 *   und nicht mehr zusätzlich im Wochenlauf (Limit mit Token: 1 Abruf je Stunde).
 */
import { readFileSync } from 'node:fs'
import { leichteFeeds, volltextNoetig, vorschlaegeGeaendert } from './lib/anime2you-leicht.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const feeds = [{ url: 'https://x/feed/' }, { url: 'https://x/feed/?paged=2' }, { url: 'https://x/disc/feed/' }]
pruefe('leichte Feeds: keine Blätterseiten', leichteFeeds(feeds).length === 2 && leichteFeeds(feeds).every((f) => !f.url.includes('paged')))

const bekannt = new Map([['https://x/a', 1]])
pruefe('leicht: bekannte Adresse ohne Volltext', !volltextNoetig(true, bekannt, 'https://x/a'))
pruefe('leicht: neue Adresse mit Volltext', volltextNoetig(true, bekannt, 'https://x/neu'))
pruefe('voll: bekannte Adresse wie bisher mit Volltext', volltextNoetig(false, bekannt, 'https://x/a'))

pruefe('gleiche Liste: nicht schreiben', !vorschlaegeGeaendert([{ a: 1 }], [{ a: 1 }]))
pruefe('neue Meldung: schreiben', vorschlaegeGeaendert([{ a: 1 }], [{ a: 1 }, { a: 2 }]))

function workflow(name: string): string {
  return readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')
}
function schritte(text: string, muster: string): number {
  return text.split('\n').filter((z) => !z.trim().startsWith('#') && z.includes(muster)).length
}
pruefe('Stundenlauf holt Anime2You leicht (neue Meldung spätestens nach einer Stunde im Bestand)', schritte(workflow('refresh-hourly.yml'), 'npm run data:anime2you -- --leicht') === 1)
pruefe('Tageslauf holt die aniSearch-Dubs', schritte(workflow('refresh-data.yml'), 'npm run data:anisearch-dubs') === 1)
pruefe('Wochenlauf holt sie nicht zusätzlich', schritte(workflow('refresh-weekly.yml'), 'npm run data:anisearch-dubs') === 0)

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nSchnellere Daten: alle Zusicherungen erfüllt')
