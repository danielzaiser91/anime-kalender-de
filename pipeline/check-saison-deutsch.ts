/**
 * Saison-Ansicht (Daniel, 11.10.2026): Ein Titel mit belegtem deutschen Weg steht nie unter „Kommt noch“ einer abgeschlossenen Saison.
 * Gerechnet wird wie der Bau (`katalogAusBestand`) auf `titles.json`, nicht auf der erzeugten `saison.json` — die kommt erst mit dem nächsten Bestandsbau. Die Prüfung auf den echten Daten steht in `check-saison-deutsch-bestand.ts`.
 */
import { deutscheAngabe } from './bau/saison-deutsch.ts'
import { katalogZeile, type SaisonKatalogTitel } from '../web/src/lib/saison.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (t: Partial<Title>): Title => ({ id: 900002, jpYear: 2026, streams: [], ...t }) as Title
const sicher = (datum: string): Release => ({ titleId: 900002, platform: 'netflix', schedule: { firstEpisodeDate: datum } }) as Release
const geschaetzt = (datum: string): Release => ({ titleId: 900002, platform: 'netflix', schedule: { firstEpisodeDate: datum, estimated: true } }) as Release
const mitDub = titel({ streams: [{ platform: 'netflix', url: 'https://x', dub: true }] })
const mitFolge = titel({ streams: [{ platform: 'netflix', url: 'https://x', dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }] })
const sub = (platform: string, datum: string): Release => ({ titleId: 900002, platform, schedule: { firstEpisodeDate: datum } }) as Release
const katalog = (extra: Partial<SaisonKatalogTitel>): SaisonKatalogTitel => ({ id: 900002, jpStart: '2026-07-03', ...extra })
const T0 = '2026-10-11'

console.log('Saison-Datei: deutsche Angabe je Katalogtitel')
pruefe('ohne Beleg keine Angabe', Object.keys(deutscheAngabe(titel({}), [sicher('2026-07-02')])).length === 0)
pruefe('belegte Folge 1: deutsch, Anbieter und Tag des Termins auf dem Weg mit Tonbeleg', JSON.stringify(deutscheAngabe(mitFolge, [sicher('2026-07-02')])) === JSON.stringify({ deutsch: true, deVon: '2026-07-02', anbieter: ['netflix'] }))
pruefe('dub: true ohne belegte Folge: deutsch und Anbieter, aber kein Tag', JSON.stringify(deutscheAngabe(mitDub, [sicher('2026-07-02')])) === JSON.stringify({ deutsch: true, anbieter: ['netflix'] }))
pruefe('Untertitel-Termin einer anderen Plattform vor der Synchro zählt nicht', deutscheAngabe(mitFolge, [sub('crunchyroll', '2026-07-01'), sicher('2026-07-05')]).deVon === '2026-07-05')
pruefe('nur ein Termin einer anderen Plattform: kein Tag', deutscheAngabe(mitFolge, [sub('crunchyroll', '2026-07-01')]).deVon === undefined)
pruefe('belegte Folge 3: der beobachtete Tag dieser Folge', deutscheAngabe(titel({ streams: [{ platform: 'netflix', url: 'https://x', dub: true, dubRanges: [{ from: 3, to: 3, dub: true }] }] }), [{ titleId: 900002, platform: 'netflix', schedule: { firstEpisodeDate: '2026-07-02', observed: { 3: '2026-07-16' } } } as unknown as Release]).deVon === '2026-07-16')
pruefe('ein geschätzter Termin ist kein deutscher Tag', deutscheAngabe(mitFolge, [geschaetzt('2026-07-02')]).deVon === undefined)
pruefe('ohne Release gilt der ganze Tag der Erstausgabe', deutscheAngabe(titel({ deErstausgabe: { von: '2026-07-05', synchro: true } }), []).deVon === '2026-07-05')
pruefe('ein Erstausgabe-Datum nur auf Monat oder Jahr genau zählt nicht', deutscheAngabe(titel({ deErstausgabe: { von: '2026-07-00', synchro: true } }), []).deVon === undefined)

console.log('Saison-Zeile eines Katalogtitels')
const belegt = katalogZeile(katalog({ deutsch: true, deVon: '2026-07-02', anbieter: ['netflix'] }), T0)
pruefe('belegter Weg, Tag verstrichen: Auf Deutsch, erschienen, mit Datum', belegt.stufe === 'auf-deutsch' && belegt.erschienen && belegt.deutsch && belegt.de === '2026-07-02', belegt)
const ohneTag = katalogZeile(katalog({ deutsch: true }), T0)
pruefe('Weg mit Tonbeleg, aber ohne belegte Folge: bestätigt unter „Kommt noch“, nicht erschienen', !ohneTag.erschienen && ohneTag.de === undefined && ohneTag.stufe === 'bestaetigt' && ohneTag.deutsch, ohneTag)
pruefe('belegter Weg, Tag in der Zukunft: bestätigt, noch nicht erschienen', katalogZeile(katalog({ deutsch: true, deVon: '2026-11-01' }), T0).stufe === 'bestaetigt')
pruefe('ohne belegten Weg: offen, angekündigt bleibt angekündigt', katalogZeile(katalog({}), T0).stufe === 'offen' && katalogZeile(katalog({ angekuendigt: true }), T0).stufe === 'angekuendigt')

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
