/**
 * Bestandswache: Kein Anime2You-Zitat mit Staffelangabe als `zweiteQuelle` an einer Adresse einer anderen Staffel (`lib/staffelzitat.ts`, Test `check-staffelzitat.ts`).
 * Rot, der Titel wird zurückgestellt (Marke); Titel aus `STAFFELZITAT_BEKANNT` bleiben als WARNUNG sichtbar. Laufzeit: wenige Millisekunden.
 * Aufruf: `check:bestand` (steckt darin) oder `tsx pipeline/check-staffelzitat-bestand.ts`
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { readJson, ROOT } from './lib/util.ts'
import { staffelzitatVerstoesse, STAFFELZITAT_BEKANNT } from './lib/staffelzitat.ts'
import { meldeVerletzte } from './lib/quarantaene.ts'
import type { Title } from '../shared/types.ts'

const TITEL = 'public/data/titles.json'
if (!existsSync(resolve(ROOT, TITEL))) {
  console.error(`FEHLER: ${TITEL} fehlt — erst bauen`)
  console.log('VERSTÖSSE: 1')
  process.exit(1)
}
const datei = readJson<Title[] | { titles: Title[] }>(TITEL, [])
const folgen = new Map<number, number | null>((Array.isArray(datei) ? datei : datei.titles).map((t) => [t.id, t.episodes ?? null]))
const zeilen = yaml.load(readFileSync(resolve(ROOT, 'data/dub-confirmed.yaml'), 'utf8')) as Parameters<typeof staffelzitatVerstoesse>[0]
const alle = staffelzitatVerstoesse(zeilen, folgen)
const neu = alle.filter((v) => !STAFFELZITAT_BEKANNT.has(v.id))
for (const v of alle) {
  if (STAFFELZITAT_BEKANNT.has(v.id)) console.log(`⚠ WARNUNG Staffelzitat ${v.id} (bekannt, Daten-PR offen): ${v.url}: ${v.grund}`)
  else console.error(`FEHLER: Staffelzitat ${v.id} ${v.url}: ${v.grund}`)
}
const treffer = meldeVerletzte(
  [...new Set(neu.map((v) => v.id))].map((id) => ({ id })),
  'staffelzitat-bestand',
  'Anime2You-Zitat nennt eine andere Staffel als die Adresse der Zeile',
  () => true,
)
console.log(`check-staffelzitat-bestand: ${zeilen.filter((z) => String(z.zweiteQuelle ?? '').startsWith('Anime2You')).length} Zitate geprüft, ${neu.length} Verstöße, ${alle.length - neu.length} bekannt.`)
console.log(`VERSTÖSSE: ${treffer.length}`)
process.exit(treffer.length ? 1 : 0)
