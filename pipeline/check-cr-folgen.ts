/**
 * Prüft den Bestand: Hängt ein Titel an einer Crunchyroll-Serie, müssen seine Folgentitel dort (sinngemäß) vorkommen.
 *
 * Messung 07.10.2026: von 251 Titeln mit Crunchyroll-Weg und Titelliste sind 239 bestätigt; die übrigen zwölf haben andere Sprache der Titel
 * (Blue Exorcist, Dorohedoro, Mob Psycho 100 III, Dan Da Dan, Witch Watch, Babylon), sind Specials ohne eigene Titelliste (Picture Dramas) oder
 * K-On! (Crunchyroll führt dort nur die zweite Staffel). Die Untergrenze liegt bei 90 % und darf nur steigen.
 *
 * Aufruf: npm run check:cr-folgen
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson, ROOT } from './lib/util.ts'
import { BESTAETIGT_AB, crFolgenAnteil } from './lib/cr-folgen-abgleich.ts'
import type { Title } from '../shared/types.ts'

const UNTERGRENZE = 0.9
const roh = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
const titel = Array.isArray(roh) ? roh : roh.titles
let mitListe = 0
const offen: string[] = []
for (const t of titel) {
  const weg = (t.streams ?? []).find((s) => s.platform === 'crunchyroll')
  const kennung = /series\/([A-Z0-9]+)/.exec(weg?.url ?? '')?.[1]
  const datei = resolve(ROOT, 'public/data/folgen', `${t.id}.json`)
  if (!kennung || !existsSync(datei)) continue
  const folgen = (JSON.parse(readFileSync(datei, 'utf8')) as { f?: [number, string][] }).f?.map((x) => x[1]).filter(Boolean) ?? []
  if (folgen.length < 3) continue
  const anteil = crFolgenAnteil(kennung, folgen)
  if (anteil === undefined) continue
  mitListe++
  if (anteil < BESTAETIGT_AB) offen.push(`${t.titleDe ?? t.titleEn ?? t.titleRomaji} (${t.id}) ${Math.round(anteil * 100)} %`)
}
const quote = mitListe ? (mitListe - offen.length) / mitListe : 1
console.log(`${mitListe - offen.length} von ${mitListe} Crunchyroll-Zuordnungen an den Folgentiteln bestätigt (${Math.round(quote * 100)} %)`)
for (const o of offen) console.log('  offen:', o)
if (quote < UNTERGRENZE) {
  console.error(`✖ Weniger als ${UNTERGRENZE * 100} % bestätigt — eine Zuordnung ist vermutlich verrutscht.`)
  process.exit(1)
}
