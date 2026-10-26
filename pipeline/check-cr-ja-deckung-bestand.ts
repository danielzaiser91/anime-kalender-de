/**
 * Zusicherung am gebauten Bestand: Jedes Crunchyroll-Ja ohne Folgenbereiche in einer Serie mit Null-Block ist durch ein Block-Urteil,
 * den eigenen Termin oder einen Handbeleg gedeckt (16.10.2026, Dorohedoro S1 und Special; Ursache: Serienkennung eines Slots).
 * Die Regel selbst prüft `check-cr-ja-deckung.ts` in check:logic; dieser Lauf misst sie an den echten Daten.
 *
 * Aufruf: npm run check:bestand-liste
 */
import { resolve } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { crBelegKennungen, type BelegQuellen } from './lib/cr-ja-belege.ts'
import { crJaOhneDeckung, kennungenMitCrTermin } from './lib/cr-ja-deckung.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { melde } from './lib/quarantaene.ts'
import { readJson, ROOT } from './lib/util.ts'

const lies = <T>(datei: string, leer: T): T => readJson<T>(resolve(ROOT, datei), leer)
const roh = lies<Title[] | { titles: Title[] }>('public/data/titles.json', [])
const rel = lies<Release[] | { releases: Release[] }>('public/data/releases.json', [])
const titel = Array.isArray(roh) ? roh : roh.titles

const mitBeleg = crBelegKennungen({
  handbelege: loadDubChecks(),
  katalog: [...lies<BelegQuellen['katalog']>('data/cr-einzelwerke.json', []), ...lies<BelegQuellen['katalog']>('data/cr-filmbloecke.json', [])],
  zuordnung: lies<BelegQuellen['zuordnung']>('data/cr-katalog-zuordnung.json', []),
  offene: lies<BelegQuellen['offene']>('data/crunchyroll-offene.json', {}),
  titel,
})

const offen = crJaOhneDeckung({
  titles: titel,
  mitTermin: kennungenMitCrTermin(Array.isArray(rel) ? rel : rel.releases),
  mitBeleg,
  crDub: lies<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] }),
})

if (offen.length) {
  console.error(`✖ ${offen.length} Crunchyroll-Ja ohne Deckung in Serien mit Null-Block (weder Block-Urteil noch Termin noch Handbeleg):`)
  for (const z of offen) {
    console.error(`    ${z}`)
    melde(Number(z.split(' ')[0]), 'cr-ja-deckung', 'Crunchyroll-Ja ohne Deckung')
  }
  console.log(`VERSTÖSSE: ${offen.length}`)
  process.exit(1)
}
console.log('✓ Jedes Crunchyroll-Ja ohne Bereiche in Serien mit Null-Block ist gedeckt.')
console.log('VERSTÖSSE: 0')
