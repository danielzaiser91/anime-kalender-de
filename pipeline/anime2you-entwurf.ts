/**
 * **Vom Anime2You-Vorschlag zum Handeintrag, Schritt 1: Entwurf.** Liest `data/proposals/anime2you-extraktion.json`, ordnet jeden Vorschlag ein
 * (neu / schon drin / nicht belastbar), schreibt die neuen belastbaren als YAML-Entwurf nach `data/proposals/anime2you-entwurf.yaml`
 * und gibt die Tabelle für die Beschreibung des Pull Requests aus. Nichts landet in `data/curated/` – das Übernehmen ist Handarbeit nach der Durchsicht.
 *
 * Aufruf: `npx tsx pipeline/anime2you-entwurf.ts [--bestand <json>] [--ausgabe <yaml>]`
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readJson, ROOT } from './lib/util.ts'
import yaml from 'js-yaml'
import { artikelNummer, eintragEntwurf, tabelle, urteile, type Bestandseintrag } from './lib/anime2you-entwurf.ts'
import type { Bestand } from './lib/anime2you-bestand.ts'

const wert = (name: string, vorgabe: string): string => process.argv[process.argv.indexOf(name) + 1] ?? vorgabe
const bestandsDatei = process.argv.includes('--bestand') ? wert('--bestand', '') : resolve(ROOT, 'data/proposals/anime2you-extraktion.json')
const ausgabe = process.argv.includes('--ausgabe') ? wert('--ausgabe', '') : resolve(ROOT, 'data/proposals/anime2you-entwurf.yaml')

interface Roh {
  slug: string
  search?: string
  titleDe?: string
  platform: string
  sender?: string
  schedule?: { firstEpisodeDate?: string }
  sources?: string[]
}

function curatedEintraege(): Bestandseintrag[] {
  const ordner = resolve(ROOT, 'data/curated')
  const dateien = readdirSync(ordner).filter((f) => /\.ya?ml$/.test(f))
  const roh = dateien.flatMap((f) => (yaml.load(readFileSync(resolve(ordner, f), 'utf8')) as Roh[] | null) ?? [])
  return roh.map((e) => ({
    slug: e.slug,
    titel: [e.search, e.titleDe].filter((t): t is string => !!t),
    platform: e.platform,
    sender: e.sender,
    datum: e.schedule?.firstEpisodeDate,
    artikel: (e.sources ?? []).map(artikelNummer).filter((n): n is string => !!n),
  }))
}

const bestand = readJson<Bestand>(bestandsDatei, { gelesen: {}, vorschlaege: [] })
const liste = urteile(bestand.vorschlaege, curatedEintraege())
const neu = liste.filter((u) => u.status === 'neu')
const kopf = [
  '# Entwurf aus data/proposals/anime2you-extraktion.json (npx tsx pipeline/anime2you-entwurf.ts).',
  '# Kein Bestandteil des Baus. Nach der Durchsicht gehören die Einträge von Hand in die passende Datei unter data/curated/.',
  '# Vor dem Übernehmen: anilistId klären, Zitat und Tag am Artikel gegenlesen.',
]
const eintraege = neu.length ? neu.map((u) => eintragEntwurf(u.v)) : ['# Keine neuen belastbaren Vorschläge.']
writeFileSync(ausgabe, [...kopf, '', ...eintraege.flatMap((e) => [e, ''])].join('\n'), 'utf8')
console.log(tabelle(liste))
console.log(`\n${liste.length} Vorschläge: ${neu.length} neu, ${liste.filter((u) => u.status === 'schon drin').length} schon drin, ${liste.filter((u) => u.status === 'nicht belastbar').length} nicht belastbar.`)
