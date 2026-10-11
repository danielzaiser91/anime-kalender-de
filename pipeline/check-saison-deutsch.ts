/**
 * Saison-Ansicht (Daniel, 11.10.2026): Ein Titel mit belegtem deutschen Weg steht nie unter „Kommt noch“ einer abgeschlossenen Saison.
 * Gerechnet wird wie der Bau (`katalogAusBestand`) auf `titles.json`, nicht auf der erzeugten `saison.json` — die kommt erst mit dem nächsten Bestandsbau.
 */
import { readFileSync } from 'node:fs'
import { deutscheAngabe, releasesNachTitel } from './bau/saison-deutsch.ts'
import { katalogZeile, zeilenDerSaison, type SaisonDatei, type SaisonKatalogTitel } from '../web/src/lib/saison.ts'
import { saisonVon, versetzt } from '../shared/saison.ts'
import { todayIso } from '../shared/time.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (t: Partial<Title>): Title => ({ id: 900002, jpYear: 2026, streams: [], ...t }) as Title
const sicher = (datum: string): Release => ({ titleId: 900002, schedule: { firstEpisodeDate: datum } }) as Release
const geschaetzt = (datum: string): Release => ({ titleId: 900002, schedule: { firstEpisodeDate: datum, estimated: true } }) as Release
const mitDub = titel({ streams: [{ platform: 'netflix', url: 'https://x', dub: true }] })
const katalog = (extra: Partial<SaisonKatalogTitel>): SaisonKatalogTitel => ({ id: 900002, jpStart: '2026-07-03', ...extra })
const T0 = '2026-10-11'

console.log('Saison-Datei: deutsche Angabe je Katalogtitel')
pruefe('ohne Beleg keine Angabe', Object.keys(deutscheAngabe(titel({}), [sicher('2026-07-02')])).length === 0)
pruefe('Tonspur-Beleg: deutsch, Anbieter und Tag des sicheren Termins', JSON.stringify(deutscheAngabe(mitDub, [sicher('2026-07-02')])) === JSON.stringify({ deutsch: true, deVon: '2026-07-02', anbieter: ['netflix'] }))
pruefe('ein geschätzter Termin ist kein deutscher Tag', deutscheAngabe(mitDub, [geschaetzt('2026-07-02')]).deVon === undefined)
pruefe('ohne Release gilt der ganze Tag der Erstausgabe', deutscheAngabe(titel({ deErstausgabe: { von: '2026-07-05', synchro: true } }), []).deVon === '2026-07-05')
pruefe('ein Erstausgabe-Datum nur auf Monat oder Jahr genau zählt nicht', deutscheAngabe(titel({ deErstausgabe: { von: '2026-07-00', synchro: true } }), []).deVon === undefined)

console.log('Saison-Zeile eines Katalogtitels')
const belegt = katalogZeile(katalog({ deutsch: true, deVon: '2026-07-02', anbieter: ['netflix'] }), T0)
pruefe('belegter Weg, Tag verstrichen: Auf Deutsch, erschienen, mit Datum', belegt.stufe === 'auf-deutsch' && belegt.erschienen && belegt.deutsch && belegt.de === '2026-07-02', belegt)
const ohneTag = katalogZeile(katalog({ deutsch: true }), T0)
pruefe('belegter Weg ohne Tag: erschienen, ohne Datum', ohneTag.erschienen && ohneTag.de === undefined && ohneTag.stufe === 'auf-deutsch', ohneTag)
pruefe('belegter Weg, Tag in der Zukunft: bestätigt, noch nicht erschienen', katalogZeile(katalog({ deutsch: true, deVon: '2026-11-01' }), T0).stufe === 'bestaetigt')
pruefe('ohne belegten Weg: offen, angekündigt bleibt angekündigt', katalogZeile(katalog({}), T0).stufe === 'offen' && katalogZeile(katalog({ angekuendigt: true }), T0).stufe === 'angekuendigt')

console.log('Letzte und aktuelle Saison auf den echten Daten')
const lies = <T>(name: string): T => JSON.parse(readFileSync(`public/data/${name}`, 'utf8')) as T
const kern = lies<Title[]>('titles-core.json')
const voll = new Map(lies<Title[]>('titles.json').map((t) => [t.id, t]))
const nachTitel = releasesNachTitel(lies<Release[]>('releases.json'))
const datei = lies<SaisonDatei>('saison.json')
/* Wie der Bau: die deutsche Angabe aus dem Hauptbestand, nicht aus der erzeugten Datei. */
const neu: SaisonDatei = { ...datei, katalog: datei.katalog.map((k) => ({ ...k, ...(voll.has(k.id) ? deutscheAngabe(voll.get(k.id)!, nachTitel.get(k.id)) : {}) })) }
const heute = saisonVon(todayIso())
for (const [name, saison] of [['Letzte', versetzt(heute, -1)], ['Aktuelle', heute]] as const) {
  const zeilen = zeilenDerSaison(kern, nachTitel, saison, neu, todayIso())
  const kommt = zeilen.filter((z) => !z.erschienen)
  const beleg = (id: number) => (voll.get(id)?.streams ?? []).some((s) => s.dub === true && (s.dubRanges?.length ?? 0) > 0)
  pruefe(`${name} Saison: kein Titel mit belegter deutscher Folge unter „Kommt noch“`, kommt.every((z) => !beleg(z.id)), kommt.filter((z) => beleg(z.id)).map((z) => z.id))
  pruefe(`${name} Saison: jeder Titel mit Tonspur-Beleg zählt als deutsch`, zeilen.every((z) => !beleg(z.id) || z.deutsch), zeilen.filter((z) => beleg(z.id) && !z.deutsch).map((z) => z.id))
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
