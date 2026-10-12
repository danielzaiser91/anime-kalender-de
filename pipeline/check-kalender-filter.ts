/**
 * Zusicherungen zur Trennung von Kalender und Datenbank (Daniel, 09.10.2026): Woche und Monat teilen keine Filter und keine Suche
 * mit der Datenbank; geteilt bleiben nur die Schnellfilter. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import { kalenderBasis, kalenderFilter } from '../web/src/lib/kalender-filter.ts'
import { parseHash } from '../web/src/lib/router.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nKalender und Datenbank teilen keine Filter:')
const datenbank: FilterState = {
  ...EMPTY_FILTERS,
  genres: ['Fantasy'],
  excluded: { ...EMPTY_FILTERS.excluded, keywords: ['Ecchi'], releaseTypes: ['disc'] },
  search: 'naruto',
  minConfidence: 'high',
  favoritesOnly: true,
}
const basis = kalenderBasis(datenbank)
pruefe('Wechsel in den Kalender: Listen, Ausschlüsse, Suche und Vertrauensstufe der Datenbank fallen weg',
  basis.genres.length === 0 && basis.excluded.keywords.length === 0 && basis.search === '' && basis.minConfidence === 'low', basis)
pruefe('… die Schnellfilter samt „Disc ausblenden" bleiben (Vorlieben des Geräts)',
  basis.favoritesOnly && basis.excluded.releaseTypes.join() === 'disc')

const eigen: FilterState = { ...EMPTY_FILTERS, platforms: ['netflix'], search: 'x', excluded: { ...EMPTY_FILTERS.excluded, releaseTypes: ['disc'] } }
const wirksam = kalenderFilter(basis, eigen)
pruefe('Kalenderfilter: eigene Liste gilt, die Suche nie', wirksam.platforms.join() === 'netflix' && wirksam.search === '', wirksam)
pruefe('… „Disc ausblenden" kommt aus den Vorlieben, nicht aus dem Speicher des Kalenders',
  kalenderFilter(EMPTY_FILTERS, eigen).excluded.releaseTypes.length === 0 && wirksam.excluded.releaseTypes.join() === 'disc')
pruefe('… und die Schnellfilter kommen aus der Route', wirksam.favoritesOnly)

const router = readFileSync('web/src/lib/router.ts', 'utf8')
pruefe('Adresse: buildHash schreibt für Woche und Monat keinen Filter', /if \(!istKalender\(route\.view\)\) \{\s*writeLists/.test(router))
pruefe('Adresse: parseHash liest für Woche und Monat weder Suche noch Listen', /search: kalender \? '' : /.test(router) && /\.\.\.\(kalender \? \{\} : readLists/.test(router))
pruefe('Navigation: der Kalender bekommt nur die Schnellfilter der Route', /if \(istKalender\(merged\.view\)\) merged\.filters = kalenderBasis/.test(router))

console.log('\nUnbekannte Kennungen in der Adresse:')
const fremd = parseHash('#/datenbank?p=prime,netflix&rt=bogus&st=foo&fsk=7,12&xp=xyz&g=Action').filters
pruefe('p=prime wird verworfen, netflix bleibt', fremd.platforms.join() === 'netflix', fremd.platforms)
pruefe('Unbekannte Art, Status, FSK und Ausschluss-Plattform fallen weg', fremd.releaseTypes.length === 0 && fremd.statuses.length === 0 && fremd.fsk.join() === '12' && fremd.excluded.platforms.length === 0, fremd)
pruefe('Offene Listen (Genre) bleiben unberührt', fremd.genres.join() === 'Action')

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nKalender-Filter: alle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
