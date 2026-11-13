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
import { beobachtungsListe, ohneSynchroStarts, type BeobachtungsEintrag } from './lib/synchro-beobachtung.ts'
import { alterswarnungen } from './lib/synchro-beobachtung-alter.ts'
import { latenzStand } from './lib/synchro-latenz.ts'
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
const zweiUmgekehrt = beobachtungsListe([titel(1)], [rel(1, '2026-11-25'), rel(1, '2026-12-04')], [], HEUTE, belege())
pruefe(zweiUmgekehrt.length === 1 && zweiUmgekehrt[0].start === '2026-11-25', 'dieselben Termine in umgekehrter Reihenfolge → derselbe Eintrag')
const anbieter = ids([titel(1)], [rel(1, '2026-11-25', 'primevideo'), rel(1, '2026-11-25', 'disc')])
pruefe(anbieter === '1:disc,1:primevideo', `zwei Anbieter → zwei Einträge, sortiert — ${anbieter}`)
pruefe(ids([titel(2), titel(1)], [rel(2, '2026-11-24'), rel(1, '2026-11-26')]) === '2:disc,1:disc', 'Sortierung nach Start')
pruefe(ids([titel(5), titel(3)], [rel(5, '2026-11-24'), rel(3, '2026-11-24')]) === '3:disc,5:disc', 'gleicher Start: nach Kennung')
pruefe(ids([titel(1)], [rel(1, '2026-11-25', 'tv', { sender: 'TOGGO plus' })]) === '1:tv: TOGGO plus', 'TV nennt den Sender')

console.log('\nBeobachtungsliste: zweite Quelle ohne-synchro.json (reine Funktion)')
const ohneStarts = ohneSynchroStarts([titel(1, { jpStart: '2026-11-25' }), titel(2, { jpStart: '2026-12' }), titel(3), titel(4, { jpStart: '2026' })])
pruefe(ohneStarts.length === 1 && ohneStarts[0].titleId === 1 && ohneStarts[0].platform === 'unbekannt', 'nur voller Tag zählt, Anbieter unbekannt')
pruefe(ids([titel(1, { jpStart: '2026-11-25' })], ohneStarts) === '1:unbekannt', 'als Start-Eintrag aufgenommen')
pruefe(ids([titel(1, { jpStart: '2026-11-25' })], ohneStarts, [], belege({ nachTitel: { '1': 'd' } })) === '', 'Beleg nimmt auch diese Quelle heraus')
pruefe(ids([titel(1, { jpStart: '2026-11-12' })], ohneSynchroStarts([titel(1, { jpStart: '2026-11-12' })])) === '', 'gleiches Fenster: vor 8 Tagen → nicht aufgenommen')

console.log('\nBeobachtungsliste: Latenz bis Beleg (reine Funktion)')
const l1 = eintrag(1, 'disc', '2026-11-25', '2026-11-10')
const l2 = eintrag(2, 'disc', '2026-11-25', '2026-11-12')
const lat = (alt: BeobachtungsEintrag[], neu: BeobachtungsEintrag[], vor: object, hist: Record<string, string>, heute = HEUTE) => latenzStand(alt, neu, vor, hist, heute)
pruefe(lat([l1], [], {}, { '1': '2026-11-15' }).belegt[0]?.tage === 5, 'Eintrag weg, Historie 5 Tage später → tage 5')
pruefe(lat([l1], [l1], {}, { '1': '2026-11-15' }).belegt.length === 0, 'Eintrag noch auf der Liste → nichts gezählt')
pruefe(lat([l1], [], {}, { '1': '2026-11-09' }).belegt.length === 0, 'Historie vor der Aufnahme (Altbestand) → nichts gezählt')
pruefe(lat([l1], [], {}, { '1': '2026-11-10' }).belegt[0]?.tage === 0, 'Beleg am Aufnahmetag → tage 0')
pruefe(lat([l1], [], {}, {}).abgeloest.length === 1, 'ohne Historie → wartet')
pruefe(lat([], [], { abgeloest: [l1] }, {}, '2026-12-25').abgeloest.length === 1, 'wartet 45 Tage nach seit')
pruefe(lat([], [], { abgeloest: [l1] }, {}, '2026-12-26').abgeloest.length === 0, 'nach 46 Tagen verworfen')
pruefe(lat([l1, l2], [], { belegt: [{ id: 1, titel: 'x', seit: '2026-11-10', beleg: '2026-11-11', tage: 1 }] }, { '1': '2026-11-15', '2': '2026-11-18' }).belegt.map((b) => `${b.id}:${b.tage}`).join() === '1:1,2:6', 'schon gezählt bleibt, neuer kommt dazu, keine Doppelzählung')
pruefe(lat([l1], [], { abgeloest: [l1] }, {}).abgeloest.length === 1, 'derselbe Eintrag in alt und abgeloest → einmal')
const viele = Array.from({ length: 101 }, (_, i) => ({ id: i + 10, titel: 'x', seit: '2026-11-01', beleg: '2026-11-02', tage: 1 }))
pruefe(lat([], [], { belegt: viele }, {}).belegt.length === 100 && lat([], [], { belegt: viele }, {}).belegt[0].id === 11, 'belegt wird auf die letzten 100 gekappt')

console.log('\nBeobachtungsliste: Alterswarnung (Schwelle 5 Tage nach dem Start, gemessen an der Historie)')
const alter = (start: string) => alterswarnungen([eintrag(7, 'disc', start, '2026-11-01')], '2026-11-20')
pruefe(alter('2026-11-15').length === 0, 'Start vor genau 5 Tagen → keine Warnung')
pruefe(alter('2026-11-14').length === 1, 'Start vor 6 Tagen → Warnung')
pruefe(alter('2026-11-25').length === 0, 'Start in der Zukunft → keine Warnung')
pruefe(alter('2026-11-14')[0] === 'Probe 7 (disc): Start 2026-11-14, seit 6 Tagen ohne Synchro-Beleg', 'Warnung nennt Titel, Anbieter, Start und Alter')
pruefe(alterswarnungen([eintrag(1, 'disc', '2026-11-01', 'x'), eintrag(2, 'disc', '2026-11-19', 'x'), eintrag(3, 'tv: X', '2026-11-10', 'x')], '2026-11-20').length === 2, 'mehrere Einträge: nur die alten, je eine Zeile')

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
const dubsDatei = join(ordner, 'data', 'anisearch-dubs.json')
const ids2 = () => lies().eintraege.map((e) => e.id).join()
writeFileSync(dubsDatei, JSON.stringify({ '900002': 'd' }))
pruefe(lauf('2026-11-22').status === 0 && ids2() === '', 'Lauf 3: Marke über die Titel-Kennung (anisearch-dubs.json) nimmt heraus')
rmSync(dubsDatei)
pruefe(lauf('2026-11-22').status === 0 && ids2() === '900002', 'Lauf 4: ohne diese Marke steht der Titel wieder auf der Liste')
writeFileSync(join(ordner, 'data', 'dub-confirmed.yaml'), ['- anilistId: 900002', '  platform: disc', '  dub: true', '  checkedAt: "2026-11-07"', ''].join('\n'))
pruefe(lauf('2026-11-22').status === 0 && ids2() === '', 'Lauf 5: Handbeleg dub: true nimmt heraus')
const ohneDatei = join(ordner, 'public', 'data', 'ohne-synchro.json')
const jsonLies = (): { eintraege: BeobachtungsEintrag[]; abgeloest: BeobachtungsEintrag[]; belegt: { id: number; tage: number; beleg: string }[] } => JSON.parse(readFileSync(ziel, 'utf8'))
writeFileSync(ohneDatei, JSON.stringify([titel(900003, { jpStart: '2026-11-24' }), titel(900004, { jpStart: '2026-12' })]))
writeFileSync(join(ordner, 'data', 'dub-confirmed.yaml'), '')
writeFileSync(dubsDatei, '{}')
const ohneLauf = lauf('2026-11-22')
const ohneListe = jsonLies().eintraege
pruefe(ohneLauf.status === 0 && ohneListe.length === 2 && ohneListe.some((e) => e.id === 900003 && e.anbieter === 'unbekannt' && e.start === '2026-11-24'), 'ohne-synchro.json: Titel mit vollem jpStart im Fenster → Anbieter unbekannt')
pruefe(!ohneListe.some((e) => e.id === 900004), 'ohne-synchro.json: Monatsangabe ohne Tag → nicht aufgenommen')
writeFileSync(join(ordner, 'data', 'anisearch-dub-ids.json'), JSON.stringify({ '901003': 'd' }))
lauf('2026-11-26')
const ohneWeg = jsonLies()
pruefe(ohneWeg.eintraege.every((e) => e.id !== 900003) && ohneWeg.abgeloest.some((e) => e.id === 900003) && ohneWeg.belegt.length === 0, 'Latenz: Beleg da, Historie kennt den Tag noch nicht → wartet in abgeloest')
writeFileSync(join(ordner, 'data', 'synchro-historie.json'), JSON.stringify({ angelegtAm: '2026-08-13', seit: { 900003: '2026-11-27' } }))
const latenzLauf = lauf('2026-11-27')
const bel = jsonLies()
pruefe(latenzLauf.stdout.includes('1 belegt (Tage bis Beleg: 5)') && bel.belegt.length === 1 && bel.belegt[0].id === 900003 && bel.belegt[0].tage === 5 && bel.abgeloest.length === 0, `Latenz: Historie kennt den Tag → belegt nach 5 Tagen — ${latenzLauf.stdout.trim().slice(0, 120)}`)
pruefe(lauf('2026-11-28').status === 0 && jsonLies().belegt.length === 1, 'Latenz: zweiter Lauf zählt denselben Titel nicht doppelt')
writeFileSync(ohneDatei, JSON.stringify([titel(900005, { jpStart: '2026-11-24' })]))
const imFenster = lauf('2026-11-29')
const ueber = lauf('2026-11-30')
pruefe(imFenster.status === 0 && !imFenster.stdout.includes('::warning::'), 'Lauf: Start vor 5 Tagen → keine Warnzeile')
pruefe(ueber.status === 0 && /::warning::Synchro-Beobachtung .*\(unbekannt\): Start 2026-11-24, seit 6 Tagen ohne Synchro-Beleg/.test(ueber.stdout) && ueber.stdout.split('::warning::').length === 2, `Lauf: Start vor 6 Tagen → genau eine Warnzeile (900001 und 900002 sind jünger) — ${ueber.stdout.trim().slice(0, 200)}`)
writeFileSync(join(ordner, 'public', 'data', 'titles.json'), '{kaputt')
const vorher = readFileSync(ziel, 'utf8')
const kaputt = lauf('2026-11-23')
pruefe(kaputt.status === 0 && kaputt.stderr.includes('WARNUNG Synchro-Beobachtung') && readFileSync(ziel, 'utf8') === vorher, `kaputter Bestand → Exit 0, Warnung, Datei unverändert — ${kaputt.stderr.trim().slice(0, 100)}`)
rmSync(ordner, { recursive: true, force: true })

console.log(`Synchro-Beobachtung: ${fehler ? fehler + ' Fall/Fälle rot' : 'alle Fälle grün'}`)
if (fehler) process.exit(1)
