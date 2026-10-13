/**
 * Zusicherung: Ein belegtes Nein kommt zur Wiedervorlage — nach 28 Tagen seit dem Messdatum oder sofort, wenn der Kalender
 * nach dem Messdatum einen Termin des Anbieters meldet (Fund „Snowball Earth", 12.10.2026) — und die Wiedervorlage löscht nichts.
 * Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { NEIN_FRIST_TAGE, neinWiedervorlage, type NeinBeleg } from '../shared/nein-wiedervorlage.ts'
import { crunchyrollNeinAbruf } from './lib/crunchyroll-adressen.ts'
import type { PlatformId, Release } from '../shared/types.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const JETZT = new Date('2026-10-12T10:00:00Z')
const nein = (id: number, platform: string, am: string, rest: Partial<NeinBeleg> = {}): NeinBeleg => ({
  anilistId: id,
  platform,
  dub: false,
  checkedAt: am,
  ...rest,
})
const termin = (id: number, platform: PlatformId, erster: string, rest: Partial<Release['schedule']> = {}, url?: string): Release =>
  ({
    slug: `${platform}-${id}`,
    titleId: id,
    name: 'Probe',
    platform,
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: erster, episodeCount: 3, estimated: false, ...rest },
    sources: ['https://example.org/'],
    ...(url ? { platformUrl: url } : {}),
  }) as Release

console.log('\nFrist: 28 Tage seit dem Messdatum')
pruefe('27 Tage alt: noch nicht fällig', neinWiedervorlage([nein(1, 'disneyplus', '2026-09-15')], [], JETZT).length === 0)
const frist = neinWiedervorlage([nein(1, 'disneyplus', '2026-09-14')], [], JETZT)
pruefe('28 Tage alt: fällig, Grund Frist', frist.length === 1 && frist[0]!.grund === 'frist' && frist[0]!.alterTage === NEIN_FRIST_TAGE, frist)
pruefe('available: false ist auch ein Nein', neinWiedervorlage([{ anilistId: 2, platform: 'netflix', available: false, checkedAt: '2026-08-01' }], [], JETZT).length === 1)

console.log('\nKachel: sofort, wenn der Kalender nach dem Messdatum einen Termin meldet')
const kachel = neinWiedervorlage([nein(3, 'crunchyroll', '2026-09-26')], [termin(3, 'crunchyroll', '2026-10-12', { episodeCount: 1 })], JETZT)
pruefe('Termin am 12.10. nach dem Nein vom 26.09.: sofort fällig', kachel.length === 1 && kachel[0]!.grund === 'kachel' && kachel[0]!.kachelAm === '2026-10-12', kachel)
pruefe('ein geschätzter Termin ist keine Kachel', neinWiedervorlage([nein(3, 'crunchyroll', '2026-09-26')], [termin(3, 'crunchyroll', '2026-10-12', { estimated: true })], JETZT).length === 0)
pruefe('ein Termin vor dem Messdatum widerlegt das Nein nicht', neinWiedervorlage([nein(3, 'crunchyroll', '2026-09-26')], [termin(3, 'crunchyroll', '2026-09-20', { episodeCount: 1 })], JETZT).length === 0)
pruefe('ein Termin am Messtag zählt nicht (sonst bliebe das Nein nach der Neumessung fällig)', neinWiedervorlage([nein(3, 'crunchyroll', '2026-10-12')], [termin(3, 'crunchyroll', '2026-10-12', { episodeCount: 1 })], JETZT).length === 0)
pruefe('ein künftiger Termin ist noch keine Kachel', neinWiedervorlage([nein(3, 'crunchyroll', '2026-10-01')], [termin(3, 'crunchyroll', '2026-10-20', { episodeCount: 1 })], JETZT).length === 0)
pruefe('ein Termin eines anderen Anbieters zählt nicht', neinWiedervorlage([nein(3, 'crunchyroll', '2026-09-26')], [termin(3, 'netflix', '2026-10-12', { episodeCount: 1 })], JETZT).length === 0)

console.log('\nWas kein Nein ist, und was das Nein aufhebt')
pruefe('ein jüngeres Ja hebt das Nein auf', neinWiedervorlage([nein(4, 'netflix', '2026-08-01'), nein(4, 'netflix', '2026-09-30', { dub: true })], [], JETZT).length === 0)
pruefe('ein jüngeres Nein nach älterem Ja zählt mit seinem Datum', neinWiedervorlage([nein(4, 'netflix', '2026-08-01', { dub: true }), nein(4, 'netflix', '2026-08-20')], [], JETZT)[0]?.messAm === '2026-08-20')
pruefe('Teil-Synchro (dub: true mit Nein-Bereich) ist kein Nein', neinWiedervorlage([nein(5, 'disneyplus', '2026-08-01', { dub: true })], [], JETZT).length === 0)

console.log('\nOrdnung, Adresse, Unversehrtheit')
const reihe = neinWiedervorlage([nein(7, 'netflix', '2026-09-01'), nein(6, 'netflix', '2026-08-01', { url: 'https://www.netflix.com/title/1' })], [], JETZT)
pruefe('das älteste Nein steht zuerst', reihe.map((f) => f.titleId).join() === '6,7', reihe)
pruefe('die Adresse des Belegs reist mit', reihe[0]?.url === 'https://www.netflix.com/title/1')
const belege = [nein(8, 'netflix', '2026-08-01')]
const vorher = JSON.stringify(belege)
neinWiedervorlage(belege, [], JETZT)
pruefe('die Wiedervorlage ändert den Beleg nicht', JSON.stringify(belege) === vorher)

console.log('\nDub-Abruf: entfernte Crunchyroll-Adressen kommen wieder dran')
const entfernt = [
  { titleId: 3, plattform: 'crunchyroll', url: 'http://www.crunchyroll.com/de/snowball-earth', entferntAm: '2026-10-01' },
  { titleId: 9, plattform: 'netflix', url: 'https://www.netflix.com/title/9' },
  { titleId: 10, plattform: 'crunchyroll', url: 'https://www.amazon.de/dp/B0C9H2BQWM?tag=anisearch.de-21' },
]
const serie = 'https://www.crunchyroll.com/de/series/GT00371869/snowball-earth'
const ohneKachel = crunchyrollNeinAbruf(entfernt, [], [])
pruefe('die entfernte Crunchyroll-Adresse steht in der Liste des Abrufs', ohneKachel.adressen.has('http://www.crunchyroll.com/de/snowball-earth'), [...ohneKachel.adressen])
pruefe('Netflix-Adressen und fremde Hosts nicht', ohneKachel.adressen.size === 1)
pruefe('ohne Kachel keine Sofort-Frist', ohneKachel.kachelSeit.size === 0)
const mitKachel = crunchyrollNeinAbruf(entfernt, kachel, [termin(3, 'crunchyroll', '2026-10-12', { episodeCount: 1 }, serie)])
pruefe('mit Kachel: Serie sofort fällig, Adresse des Kalenders in der Liste', mitKachel.kachelSeit.get('GT00371869') === '2026-10-12' && mitKachel.adressen.has(serie), [...mitKachel.kachelSeit])

console.log('\nAnschluss im Abruf')
const abruf = readFileSync(new URL('./scrape-crunchyroll-dub.ts', import.meta.url), 'utf8')
pruefe(
  'scrape-crunchyroll-dub.ts bildet seine Liste auch aus den entfernten Adressen und macht Kachel-Serien sofort fällig',
  abruf.includes('crunchyrollNeinAbrufLaden()') && abruf.includes('nein?.adressen') && abruf.includes('nein?.kachelSeit'),
)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nOK')
