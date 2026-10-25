/**
 * Bestandsteil von `check-saison-deutsch.ts`: Letzte und aktuelle Saison auf den echten Daten (`titles-core.json`, `titles.json`, `releases.json`, `saison.json`).
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück;
 * PR-Ketten wurden daran rot, 12.10.2026). Die Einheitenprüfungen ohne Dateizugriff stehen in `check-saison-deutsch.ts`.
 */
import { readFileSync } from 'node:fs'
import { deutscheAngabe, releasesNachTitel } from './bau/saison-deutsch.ts'
import { zeilenDerSaison, type SaisonDatei } from '../web/src/lib/saison.ts'
import { saisonVon, versetzt } from '../shared/saison.ts'
import { todayIso } from '../shared/time.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

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
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
