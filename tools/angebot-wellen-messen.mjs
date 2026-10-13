// Zählt je Anbieter die MOTN-Erfassungswellen (>= 12 Titel je Tag) samt Nachbartagen ±1/±2 (Befund 13.10.2026, docs/wissen/datensatz.md).
// Aufruf: node tools/angebot-wellen-messen.mjs [data/motn.json]
import { readFileSync } from 'node:fs'
const d = JSON.parse(readFileSync(process.argv[2] ?? 'data/motn.json', 'utf8'))
const jeTag = new Map()
for (const s of Object.values(d.shows)) {
  for (const [a, x] of Object.entries(s.dienste ?? {})) {
    if (!x.seit) continue
    const m = jeTag.get(a) ?? new Map()
    m.set(x.seit, (m.get(x.seit) ?? 0) + 1)
    jeTag.set(a, m)
  }
}
const tag = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
for (const [a, m] of jeTag) {
  const wellen = [...m].filter(([, n]) => n >= 12)
  const gesamt = [...m.values()].reduce((x, y) => x + y, 0)
  console.log(`\n== ${a}: ${m.size} Tage, ${gesamt} Titel, ${wellen.length} Wellen (>=12)`)
  for (const [t, n] of wellen.sort()) {
    const nb = [-2, -1, 1, 2].map((k) => `${k > 0 ? '+' : ''}${k}:${m.get(tag(t, k)) ?? 0}`).join(' ')
    console.log(`  ${t} n=${n}  Nachbarn ${nb}`)
  }
}
