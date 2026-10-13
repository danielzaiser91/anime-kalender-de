/**
 * Zusicherung zu `reinIds:` in `data/reihen-von-hand.yaml` (12.10.2026): Wo der `grund` „AniList-Beziehung" sagt, liegen alle Teile in einer `rel`-Komponente des Katalogs;
 * Ausnahmen (kein Katalogeintrag, `rel: []`) stehen im Grund unter „(außer …)". Der Katalog liegt nur im Cache (`data/cache/anilist-katalog.json`): ohne ihn entfällt der Teil „Datei", die Selbstprüfung läuft immer. Läuft in `check:logic`.
 */
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { ROOT } from './lib/util.ts'
import { type KatalogRel, type ReinIdsEintrag, pruefeReinIdsGrund } from './lib/rein-ids-grund.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const katalog: KatalogRel[] = [
  { id: 1, rel: [2] },
  { id: 2, rel: [1] },
  { id: 3, rel: [2] },
  { id: 4, rel: [] },
  { id: 5, rel: [6] },
  { id: 6, rel: [5] },
]
const eintrag = (reinIds: number[], zusatz = ''): ReinIdsEintrag => ({ reinIds, grund: `X – aniSearch: ?; AniList-Beziehung im Katalog${zusatz}` })
const befunde = (e: ReinIdsEintrag): number => pruefeReinIdsGrund([e], katalog).length

pruefe('Selbstprüfung: Teile in einer Komponente sind in Ordnung (auch über einen Dritten, 1 – 2 – 3)', befunde(eintrag([1, 3])) === 0)
pruefe('Selbstprüfung: Teile in zwei Komponenten ohne Ausnahme sind ein Befund', befunde(eintrag([1, 5])) === 1)
pruefe('Selbstprüfung: ein Teil ohne Katalogeintrag ohne Ausnahme ist ein Befund', befunde(eintrag([1, 99])) === 1)
pruefe('Selbstprüfung: ein Teil mit `rel: []` ohne Ausnahme ist ein Befund', befunde(eintrag([1, 4])) === 1)
pruefe('Selbstprüfung: ein Teil ohne Katalogeintrag mit „(außer …)" ist in Ordnung', befunde(eintrag([1, 99], ' (außer X: kein AniList-Eintrag)')) === 0)
pruefe('Selbstprüfung: ein Teil mit `rel: []` mit „(außer …)" ist in Ordnung', befunde(eintrag([1, 4], ' (außer X: rel [])')) === 0)
pruefe('Selbstprüfung: „(außer …)" deckt keine Teile mit eigenen Beziehungen (zweite Komponente 5 – 6)', befunde(eintrag([1, 2, 3, 5], ' (außer X: kein AniList-Eintrag)')) === 1)
pruefe('Selbstprüfung: „(außer …)" ohne Ausnahme-Teil ist ein Befund (veralteter Zusatz)', befunde(eintrag([1, 3], ' (außer X: kein AniList-Eintrag)')) === 1)
const mononoke = (reinIds: number[]): ReinIdsEintrag => ({ reinIds, grund: 'A ist bei aniSearch die Nebengeschichte von B; bei AniList ist C mit A verbunden – B selbst hat bei AniList keine Beziehung' })
pruefe('Selbstprüfung: „bei AniList keine Beziehung" deckt einen Teil ohne Beziehung (Mononoke / ayakashi)', pruefeReinIdsGrund([mononoke([1, 4])], katalog).length === 0)
pruefe('Selbstprüfung: „bei AniList keine Beziehung" ist ein Befund, wenn der Teil doch Beziehungen hat', pruefeReinIdsGrund([mononoke([1, 5])], katalog).length === 1)
pruefe('Selbstprüfung: Gründe ohne „AniList-Beziehung" (Namensanfang, Handtext) werden nicht geprüft', pruefeReinIdsGrund([{ reinIds: [1, 5], grund: 'X – gleicher Namensanfang' }], katalog).length === 0)

const katalogDatei = `${ROOT}/data/cache/anilist-katalog.json`
if (existsSync(katalogDatei)) {
  const eintraege = (yaml.load(readFileSync(`${ROOT}/data/reihen-von-hand.yaml`, 'utf8')) as ReinIdsEintrag[]).filter((e) => e.reinIds)
  const datei = JSON.parse(readFileSync(katalogDatei, 'utf8')) as { eintraege: KatalogRel[]; geholtAm?: string }
  const echt = datei.eintraege
  // Der Befund hängt vom Cache-Stand ab (CI und lokal unterscheiden sich), also nennt er den geprüften Katalog.
  const stand = datei.geholtAm ? `, Stand ${datei.geholtAm.slice(0, 10)}` : ''
  for (const b of pruefeReinIdsGrund(eintraege, echt)) pruefe('reinIds-Grund gegen den Katalog', false, `${b} (Katalog: ${echt.length} Titel${stand})`)
  console.log(`reinIds-Grund: ${eintraege.length} Einträge gegen ${echt.length} Katalogtitel geprüft${stand}`)
} else {
  console.log('reinIds-Grund: kein Katalog-Cache (data/cache/anilist-katalog.json), nur die Selbstprüfung lief')
}

console.log(fehler ? `\nreinIds-Grund: ${fehler} Zusicherung(en) verletzt.` : 'reinIds-Grund: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
