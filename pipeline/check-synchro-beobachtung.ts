/**
 * Zusicherungen zur Beobachtungsliste angekündigter Starts ohne Synchro-Beleg (`lib/synchro-beobachtung.ts`, Skript `synchro-beobachtung.ts`):
 * Regel als reine Funktion mit Tabellenfällen an beiden Rändern, dazu das Skript als Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`)
 * über zwei Läufe (Beleg kommt, `seit` bleibt) und ein kaputter Bestand (Exit 0 mit Warnung).
 * Aufruf: npx tsx pipeline/check-synchro-beobachtung.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { beobachtungsListe, type BeobachtungsEintrag } from './lib/synchro-beobachtung.ts'
import type { SynchroBelege } from './lib/synchro-widerspruch.ts'

let fehler = 0
const pruefe = (ok: boolean, text: string) => {
  if (ok) return void console.log(`  ✓ ${text}`)
  fehler++
  console.error(`  ✖ ${text}`)
}
const HEUTE = '2026-11-20'
const titel = (id: number, extra: object = {}) => ({ id, titleRomaji: `Probe ${id}`, anisearchId: id + 1000, streams: [], ...extra }) as unknown as Title
const rel = (titleId: number, start: string | undefined, platform = 'disc', extra: object = {}) =>
  ({ slug: `r-${titleId}-${platform}-${start}`, titleId, platform, schedule: start ? { firstEpisodeDate: start } : undefined, ...extra }) as unknown as Release
const belege = (b: Partial<SynchroBelege> = {}): SynchroBelege => ({ nachAnisearch: {}, nachTitel: {}, handJa: new Set(), ...b })
const eintrag = (id: number, anbieter: string, start: string, seit: string): BeobachtungsEintrag => ({ titel: `Probe ${id}`, id, anbieter, start, seit })
const ids = (t: Title[], r: Release[], alt: BeobachtungsEintrag[] = [], b = belege()) => beobachtungsListe(t, r, alt, HEUTE, b).map((e) => `${e.id}:${e.anbieter}`).join()

console.log('\nBeobachtungsliste: Fenster der Aufnahme')
pruefe(ids([titel(1)], [rel(1, '2026-11-13')]) === '1:disc', 'Start vor 7 Tagen → aufgenommen')
pruefe(ids([titel(1)], [rel(1, '2026-11-12')]) === '', 'Start vor 8 Tagen → nicht aufgenommen')
pruefe(ids([titel(1)], [rel(1, '2026-12-20')]) === '1:disc', 'Start in 30 Tagen → aufgenommen')
pruefe(ids([titel(1)], [rel(1, '2026-12-21')]) === '', 'Start in 31 Tagen → nicht aufgenommen')
pruefe(ids([titel(1)], [rel(1, undefined)]) === '', 'Release ohne Starttag → nicht aufgenommen')
pruefe(ids([titel(1)], [rel(2, '2026-11-25')]) === '', 'Release eines unbekannten Titels (Cartoon-Kennung) → nicht aufgenommen')

console.log('\nBeobachtungsliste: Synchro-Beleg nimmt heraus')
const r1 = [rel(1, '2026-11-25')]
pruefe(ids([titel(1, { streams: [{ platform: 'netflix', url: '', dub: true }] })], r1) === '', 'Stream dub: true → nicht aufgenommen')
pruefe(ids([titel(1, { streams: [{ platform: 'netflix', url: '', dub: false }] })], r1) === '1:disc', 'Stream dub: false belegt nichts → aufgenommen')
pruefe(ids([titel(1)], r1, [], belege({ nachAnisearch: { '1001': 'd' } })) === '', 'aniSearch d → nicht aufgenommen')
pruefe(ids([titel(1)], r1, [], belege({ nachAnisearch: { '1001': 'c' } })) === '', 'aniSearch c → nicht aufgenommen')
pruefe(ids([titel(1)], r1, [], belege({ nachAnisearch: { '1001': 'p' } })) === '1:disc', 'aniSearch p (geplant) belegt nichts → aufgenommen')
pruefe(ids([titel(1)], r1, [], belege({ nachTitel: { '1': 'd' } })) === '', 'Marke über die Titel-Kennung → nicht aufgenommen')
pruefe(ids([titel(1)], r1, [], belege({ handJa: new Set([1]) })) === '', 'Handbeleg dub: true → nicht aufgenommen')
pruefe(ids([titel(1)], r1, [eintrag(1, 'disc', '2026-11-25', '2026-11-10')], belege({ handJa: new Set([1]) })) === '', 'Beleg nimmt auch einen alten Eintrag heraus')

console.log('\nBeobachtungsliste: Entnahme 14 Tage nach dem Start, seit bleibt')
const alt = (start: string) => [eintrag(1, 'disc', start, '2026-11-01')]
pruefe(ids([titel(1)], [rel(1, '2026-11-06')], alt('2026-11-06')) === '1:disc', 'alter Eintrag, Start vor 14 Tagen → bleibt')
pruefe(ids([titel(1)], [rel(1, '2026-11-05')], alt('2026-11-05')) === '', 'alter Eintrag, Start vor 15 Tagen → entnommen')
pruefe(ids([titel(1)], [rel(1, '2026-11-09')]) === '', 'derselbe Start ohne alten Eintrag (vor 11 Tagen) → nicht neu aufgenommen')
const bleibt = beobachtungsListe([titel(1)], [rel(1, '2026-11-12')], alt('2026-11-12'), HEUTE, belege())
pruefe(bleibt[0]?.seit === '2026-11-01' && bleibt[0]?.start === '2026-11-12', 'seit des alten Eintrags bleibt erhalten')
pruefe(beobachtungsListe([titel(1)], r1, [], HEUTE, belege())[0]?.seit === HEUTE, 'neuer Eintrag: seit = heute')
pruefe(ids([titel(1)], r1, [eintrag(1, 'netflix', '2026-11-25', '2026-11-01')]) === '1:disc', 'alter Eintrag eines anderen Anbieters verlängert diesen nicht')

console.log('\nBeobachtungsliste: ein Eintrag je Titel und Anbieter')
const zwei = beobachtungsListe([titel(1)], [rel(1, '2026-12-04'), rel(1, '2026-11-25')], [], HEUTE, belege())
pruefe(zwei.length === 1 && zwei[0].start === '2026-11-25', 'zwei Disc-Termine eines Titels → ein Eintrag mit dem früheren Start')
const anbieter = ids([titel(1)], [rel(1, '2026-11-25', 'primevideo'), rel(1, '2026-11-25', 'disc')])
pruefe(anbieter === '1:disc,1:primevideo', `zwei Anbieter → zwei Einträge, sortiert — ${anbieter}`)
pruefe(ids([titel(2), titel(1)], [rel(2, '2026-11-24'), rel(1, '2026-11-26')]) === '2:disc,1:disc', 'Sortierung nach Start')
pruefe(ids([titel(1)], [rel(1, '2026-11-25', 'tv', { sender: 'TOGGO plus' })]) === '1:tv: TOGGO plus', 'TV nennt den Sender')

console.log('\nBeobachtungsliste: Skript als Prozess')
const wurzel = join(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'synchro-beobachtung-'))
mkdirSync(join(ordner, 'public', 'data'), { recursive: true })
mkdirSync(join(ordner, 'data', 'proposals'), { recursive: true })
writeFileSync(join(ordner, 'data', 'anisearch-ids-hand.yaml'), '')
writeFileSync(join(ordner, 'public', 'data', 'titles.json'), JSON.stringify([titel(900001), titel(900002)]))
writeFileSync(join(ordner, 'public', 'data', 'releases.json'), JSON.stringify([rel(900001, '2026-11-25'), rel(900002, '2026-11-26')]))
const ziel = join(ordner, 'data', 'proposals', 'synchro-beobachtung.json')
const lauf = (heute: string) =>
  spawnSync(process.execPath, ['--import', 'tsx', join(wurzel, 'pipeline', 'synchro-beobachtung.ts'), `--heute=${heute}`], { cwd: wurzel, encoding: 'utf8', timeout: 60000, env: { ...process.env, AK_ROOT: ordner } })
const lies = (): { stand: string; eintraege: BeobachtungsEintrag[] } => JSON.parse(readFileSync(ziel, 'utf8'))
writeFileSync(join(ordner, 'data', 'anisearch-dub-ids.json'), JSON.stringify({}))
const eins = lauf('2026-11-20')
pruefe(eins.status === 0 && eins.stdout.includes('Synchro-Beobachtung: 2 Einträge') && lies().eintraege.map((e) => e.id).join() === '900001,900002', `Lauf 1: beide Titel auf der Liste — ${eins.stderr.trim().slice(0, 100)}`)
writeFileSync(join(ordner, 'data', 'anisearch-dub-ids.json'), JSON.stringify({ '901001': 'd' }))
const zweiter = lauf('2026-11-22')
const nach = lies()
pruefe(zweiter.status === 0 && nach.stand === '2026-11-22' && nach.eintraege.map((e) => e.id).join() === '900002', 'Lauf 2: Titel mit Marke d fällt heraus, der andere bleibt')
pruefe(nach.eintraege[0]?.seit === '2026-11-20', 'Lauf 2: seit stammt aus Lauf 1 (Datei wird als Vorstand gelesen)')
writeFileSync(join(ordner, 'public', 'data', 'titles.json'), '{kaputt')
const vorher = readFileSync(ziel, 'utf8')
const kaputt = lauf('2026-11-23')
pruefe(kaputt.status === 0 && kaputt.stderr.includes('WARNUNG Synchro-Beobachtung') && readFileSync(ziel, 'utf8') === vorher, `kaputter Bestand → Exit 0, Warnung, Datei unverändert — ${kaputt.stderr.trim().slice(0, 100)}`)
rmSync(ordner, { recursive: true, force: true })

console.log(`Synchro-Beobachtung: ${fehler ? fehler + ' Fall/Fälle rot' : 'alle Fälle grün'}`)
if (fehler) process.exit(1)
