/**
 * Zusicherungen für die Arbeit vom 07.10.2026: Plakat-Auswahl, „keine Synchro laut aniSearch", Teile ohne belegte Synchro,
 * Zugang über den Dub-Endpunkt und die Suche in Schritten. Läuft hinter `check:logic` (ein eigenes Skript hält dessen Datei unter der Grenze).
 */
import { readFileSync } from 'node:fs'
import { keineSynchroLautAnisearch } from './bau/ohne-beleg.ts'
import { ANISEARCH_ID_BASIS, anisearchNurKatalog } from './bau/anisearch-titel.ts'
import { ohneBelegteSynchro } from './bau/synchro-belegt.ts'
import { ausAnisearchDubs } from './lib/anisearch-synchro-ids.ts'
import { waehlePlakat } from './lib/tmdb-plakat.ts'
import { sucheGen, sucheMitFundstellen, treibe } from '../web/src/lib/search.ts'
import { istOhneBelegteSynchro, sortiereNachTitel } from '../web/src/lib/titel-sortierung.ts'
import { anzeigeName } from '../shared/titles.ts'
import type { Release, Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Plakat-Auswahl')
const bild = (iso: string | null, width: number, height: number) => ({ file_path: `/${iso}${width}.jpg`, width, height, iso_639_1: iso })
pruefe('das japanische Plakat geht vor dem größeren englischen', waehlePlakat([bild('en', 2000, 3000), bild('ja', 1000, 1500)])?.iso_639_1 === 'ja')
pruefe('innerhalb einer Sprache gewinnt das breiteste', waehlePlakat([bild('ja', 1000, 1500), bild('ja', 2000, 3000)])?.width === 2000)
pruefe('Querformate zählen nicht', waehlePlakat([bild('ja', 3000, 1500)]) === undefined)
pruefe('ohne Bilder kein Plakat', waehlePlakat([]) === undefined)

console.log('Teile ohne belegte Synchro')
const titel = (t: Partial<Title>): Title => ({ id: 900001, jpYear: 2026, dubConfidence: 'low', streams: [], ...t }) as Title
const nichts: Release[] = []
pruefe('ein Titel von 2026 ohne jeden Beleg gilt als unbelegt', ohneBelegteSynchro(titel({}), nichts))
pruefe('ein Stream mit belegter Synchro hebt das auf', !ohneBelegteSynchro(titel({ streams: [{ platform: 'netflix', dub: true } as never] }), nichts))
pruefe('ein sicherer Termin hebt es auf', !ohneBelegteSynchro(titel({}), [{ titleId: 900001, schedule: { estimated: false } } as Release]))
pruefe('ein geschätzter Termin (Start mit Untertiteln) hebt es nicht auf', ohneBelegteSynchro(titel({}), [{ titleId: 900001, schedule: { estimated: true } } as Release]))
pruefe('ein älterer Titel bleibt unberührt', !ohneBelegteSynchro(titel({ jpYear: 2005 }), nichts))
pruefe('hohe Sicherheit bleibt unberührt', !ohneBelegteSynchro(titel({ dubConfidence: 'high' }), nichts))

console.log('Keine Synchro laut aniSearch')
const dubs = JSON.parse(readFileSync('data/anisearch-dubs.json', 'utf8')) as Record<string, string>
const idMit = (kz: string) => Number(Object.keys(dubs).find((k) => dubs[k] === kz))
const mitErst = (id: number, extra: Partial<Title> = {}) => titel({ id, deErstausgabe: { von: '2024-10-21', publisher: 'Crunchyroll' } as never, ...extra })
pruefe('deutsche Ausgabe, aniSearch nennt kein Deutsch: keine Synchro', keineSynchroLautAnisearch(mitErst(idMit('-'))))
pruefe('ein Stream mit belegter Synchro schlägt das', !keineSynchroLautAnisearch(mitErst(idMit('-'), { streams: [{ platform: 'netflix', dub: true } as never] })))
pruefe('ohne deutsche Ausgabe gilt die Regel nicht', !keineSynchroLautAnisearch(titel({ id: idMit('-') })))
pruefe('Deutsch vertont: bleibt', !keineSynchroLautAnisearch(mitErst(idMit('d'))))
pruefe('Deutsch abgebrochen (Teilsynchro): bleibt', !keineSynchroLautAnisearch(mitErst(idMit('c'))))
pruefe('Deutsch geplant: bleibt', !keineSynchroLautAnisearch(mitErst(idMit('p'))))
const neu = ausAnisearchDubs([])
pruefe('Titel mit vertontem, geplantem oder abgebrochenem Deutsch kommen in den Bestand', neu.length > 0 && neu.every((id) => 'dpc'.includes(dubs[String(id)] ?? '-')))
pruefe('was schon im Bestand steht, wird nicht noch einmal geholt', !ausAnisearchDubs(neu.map((id) => ({ id }))).length)

console.log('Suche in Schritten')
const viele = Array.from({ length: 1000 }, (_, i) => `Titel ${i} Naruto`)
/* Jeder Eintrag kostet hier absichtlich Zeit: Die Suche gibt nach Zeit ab, nicht nach Anzahl. */
const langsam = (t: string): string[] => {
  const bis = performance.now() + 0.05
  while (performance.now() < bis);
  return [t]
}
const gen = sucheGen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], langsam)
let abgaben = 0
let r = gen.next()
while (!r.done) { abgaben++; r = gen.next() }
pruefe('ein langsamer Suchlauf gibt mehrfach ab (mindestens alle 6 ms)', abgaben >= 5, abgaben)
const sync = sucheMitFundstellen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], (t) => [t])
pruefe('synchron und in Schritten liefern dasselbe', JSON.stringify(sync) === JSON.stringify(treibe(sucheGen(viele, 'naruto', (t) => [{ art: 'titel', text: t }], (t) => [t]))))
pruefe('ohne Suchbegriff bleibt alles drin', sucheMitFundstellen(viele, '', (t) => [{ art: 'titel', text: t }], (t) => [t]).length === viele.length)

console.log('Sortierung nach Titel')
const echte = (JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]).slice(0, 400)
const kollator = new Intl.Collator('de')
const rangfolge = echte.slice().sort((x, y) => kollator.compare(anzeigeName(x), anzeigeName(y)) || x.id - y.id)
const mitRang = echte.map((t) => ({ ...t, tr: rangfolge.findIndex((r) => r.id === t.id) }))
const ohneRang = echte.map((t) => ({ ...t }))
const gruppeMit = mitRang.map((main) => ({ main }))
const gruppeOhne = ohneRang.map((main) => ({ main }))
sortiereNachTitel(gruppeMit)
sortiereNachTitel(gruppeOhne)
pruefe('mit Rang und ohne Rang ergibt dieselbe Reihenfolge', gruppeMit.every((g, i) => g.main.id === gruppeOhne[i]!.main.id))
pruefe('die Reihenfolge ist die der deutschen Sortierung', gruppeOhne.every((g, i) => i === 0 || kollator.compare(anzeigeName(gruppeOhne[i - 1]!.main), anzeigeName(g.main)) <= 0))

console.log('Datenbank blendet angekündigte Titel ohne belegte Synchro aus')
pruefe('ein Titel mit dem Merkmal os gilt als ohne belegte Synchro', istOhneBelegteSynchro({ id: 1, os: true } as unknown as Title))
pruefe('ein gewöhnlicher Titel nicht', !istOhneBelegteSynchro({ id: 2 } as unknown as Title))

console.log('Titel nur bei aniSearch')
const eintraege = JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { dub: string; ty: string }>
const ids = Object.keys(eintraege).map(Number)
pruefe('es gibt Einträge', ids.length > 100, ids.length)
pruefe('jede Kennung ist positiv und die Titelkennung liegt über allen AniList-Kennungen', ids.every((i) => i > 0 && ANISEARCH_ID_BASIS + i > 1_000_000))
pruefe('jeder Eintrag trägt ein bekanntes Deutsch-Kennzeichen', Object.values(eintraege).every((e) => 'dpc-'.includes(e.dub) && e.dub.length === 1))
pruefe('nur Einträge ohne Deutsch bleiben im Katalog', [...anisearchNurKatalog()].every((id) => eintraege[String(id - ANISEARCH_ID_BASIS)]?.dub === '-') && anisearchNurKatalog().size === Object.values(eintraege).filter((e) => e.dub === '-').length)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
