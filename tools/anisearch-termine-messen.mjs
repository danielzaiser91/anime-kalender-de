#!/usr/bin/env node
/**
 * Wie viele Termine brächte aniSearch — und wie sähen sie aus?
 *
 * Misst gegen den ausgelieferten Datensatz, ohne den Bau zu starten: `titles.json`
 * für die Titel mit belegter Synchro, `releases.json` für die, die schon einen
 * Termin haben. Aufruf: node tools/anisearch-termine-messen.mjs
 */
import { readFileSync } from 'node:fs'
const j = (f) => JSON.parse(readFileSync(f, 'utf8'))
const alsListe = (d) => (Array.isArray(d) ? d : (d.titles ?? d.releases ?? Object.values(d)))

const anisearch = j('data/anisearch.json')
const titles = alsListe(j('public/data/titles.json'))
const releases = alsListe(j('public/data/releases.json'))
const mitTermin = new Set(releases.map((r) => r.titleId))

const iso = (s) => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s ?? '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined
}

let kandidaten = 0
let vorJp = 0
let ohneDatum = 0
const jahre = {}
const beispiele = []
for (const t of titles) {
  if (mitTermin.has(t.id)) continue
  const de = (anisearch[t.id]?.info?.languages ?? []).find((l) => l.language === 'Deutsch')
  if (!de?.released) continue
  const [von, bis] = de.released.trim().split(/\s*-\s*/)
  const start = iso(von)
  if (!start) {
    ohneDatum++
    continue
  }
  /* Eine deutsche Fassung kann nicht vor der japanischen Ausstrahlung erschienen sein. */
  if (t.jpYear && Number(start.slice(0, 4)) < t.jpYear) {
    vorJp++
    continue
  }
  kandidaten++
  const jahr = start.slice(0, 4)
  jahre[jahr] = (jahre[jahr] ?? 0) + 1
  if (beispiele.length < 10) {
    beispiele.push(`${t.id} ${(t.titleDe ?? t.title ?? '').slice(0, 40)} | ${start}${iso(bis) ? '–' + iso(bis) : ''} | ${de.publisher?.[0] ?? '—'}`)
  }
}

console.log(`Titel im Bestand: ${titles.length}, davon ohne Termin: ${titles.filter((t) => !mitTermin.has(t.id)).length}`)
console.log(`Neue Termine aus aniSearch: ${kandidaten}`)
console.log(`  verworfen: ${ohneDatum} ohne Tagesdatum, ${vorJp} vor der japanischen Ausstrahlung`)
const sortiert = Object.entries(jahre).sort((a, b) => b[0].localeCompare(a[0]))
console.log(`  jüngste Jahrgänge: ${sortiert.slice(0, 6).map(([j, n]) => `${j}: ${n}`).join(', ')}`)
console.log(`  künftig (nach heute): ${Object.entries(jahre).filter(([j]) => Number(j) > 2026).reduce((s, [, n]) => s + n, 0)}`)
console.log('\nBeispiele:')
for (const b of beispiele) console.log('  ' + b)
