/**
 * Zusicherung am gebauten Bestand: Jedes Crunchyroll-Ja ohne Folgenbereiche in einer Serie mit Null-Block ist durch ein Block-Urteil,
 * den eigenen Termin oder einen Handbeleg gedeckt (16.10.2026, Dorohedoro S1 und Special; Ursache: Serienkennung eines Slots).
 * Die Regel selbst prüft `check-cr-ja-deckung.ts` in check:logic; dieser Lauf misst sie an den echten Daten.
 *
 * Aufruf: npm run check:bestand-liste
 */
import { resolve } from 'node:path'
import type { Release, Title } from '../shared/types.ts'
import { crJaOhneDeckung, kennungenMitCrTermin } from './lib/cr-ja-deckung.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { readJson, ROOT } from './lib/util.ts'

const roh = readJson<Title[] | { titles: Title[] }>(resolve(ROOT, 'public/data/titles.json'), [])
const rel = readJson<Release[] | { releases: Release[] }>(resolve(ROOT, 'public/data/releases.json'), [])
const titel = Array.isArray(roh) ? roh : roh.titles
const handbelege = loadDubChecks().filter((c) => c.platform === 'crunchyroll' && c.dub === true)

/** Titel mit Ja aus Katalogdateien, die der Bau nach Titelkennung (`09-4-3`) oder Adresse (`09-6`) anwendet. */
function mitKatalogBeleg(): Set<number> {
  const ids = new Set<number>()
  for (const datei of ['cr-einzelwerke', 'cr-filmbloecke']) {
    for (const e of readJson<{ id: number; treffer?: { audio?: string[] } | null }[]>(resolve(ROOT, `data/${datei}.json`), [])) {
      if (e.treffer?.audio?.includes('de-DE')) ids.add(e.id)
    }
  }
  for (const z of readJson<{ id: number; audio?: string[] }[]>(resolve(ROOT, 'data/cr-katalog-zuordnung.json'), [])) {
    if (z.audio?.includes('de-DE')) ids.add(z.id)
  }
  const offene = readJson<Record<string, { dub?: boolean }>>(resolve(ROOT, 'data/crunchyroll-offene.json'), {})
  for (const t of titel) {
    if (t.streams?.some((st) => st.platform === 'crunchyroll' && offene[st.url]?.dub === true)) ids.add(t.id)
  }
  return ids
}

const offen = crJaOhneDeckung({
  titles: titel,
  mitTermin: kennungenMitCrTermin(Array.isArray(rel) ? rel : rel.releases),
  mitBeleg: new Set([...handbelege.map((c) => c.anilistId), ...mitKatalogBeleg()]),
  crDub: readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] }),
})

if (offen.length) {
  console.error(`✖ ${offen.length} Crunchyroll-Ja ohne Deckung in Serien mit Null-Block (weder Block-Urteil noch Termin noch Handbeleg):`)
  for (const z of offen) console.error(`    ${z}`)
  process.exit(1)
}
console.log('✓ Jedes Crunchyroll-Ja ohne Bereiche in Serien mit Null-Block ist gedeckt.')
