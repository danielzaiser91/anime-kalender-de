// PoC (nicht eingehängt), Teil von docs/wissen/cartoon-reihen.md. Aufruf: node tools/archiv/cartoon-reihen-auswerten.mjs <Ordner mit wd-voll.json> (Ausgabe des -poc-Skripts als wd-voll.json); schreibt gruppen.json dorthin.
import { readFileSync, writeFileSync } from 'node:fs'
const S = process.argv[2]
const w = JSON.parse(readFileSync(S + '/wd-voll.json', 'utf8'))
const carts = Object.values(JSON.parse(readFileSync('data/cartoons.json', 'utf8')))
const name = Object.fromEntries(carts.map((c) => [String(c.tmdbId), c.titleEn]))
const tmdbVonQid = {}
for (const [q, it] of Object.entries(w.items)) for (const t of it.tmdb) tmdbVonQid[q] = t
const meineTmdb = new Set(carts.map((c) => String(c.tmdbId)))
const gefunden = new Set(Object.values(w.items).flatMap((i) => i.tmdb))
console.log('Cartoons', carts.length, 'mit Wikidata-Item (P4983)', gefunden.size, 'Items', Object.keys(w.items).length)
const mitRel = Object.entries(w.items).filter(([, i]) => Object.keys(i.rel).length)
console.log('Items mit mind. einer Beziehung', mitRel.length)
const art = { serie: 0, teilVon: 0, franchise: 0, folgtAuf: 0, gefolgtVon: 0, basiertAuf: 0 }
for (const [, i] of mitRel) for (const k of Object.keys(i.rel)) art[k]++
console.log(art)

const STOP = new Set(['the', 'and', 'tales', 'show', 'adventures', 'with', 'from', 'next', 'time', 'life', 'into', 'girl', 'boys'])
const woerter = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((x) => x.length >= 3 && !STOP.has(x)))
function gemeinsamesWort(a, b) {
  const wa = woerter(a)
  for (const x of woerter(b)) if (wa.has(x)) return true
  return false
}
// Gruppen je Stufe
function gruppen(stufe) {
  const parent = new Map()
  const f = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
  const add = (x) => { if (!parent.has(x)) parent.set(x, x) }
  const u = (a, b) => { add(a); add(b); parent.set(f(a), f(b)) }
  const hubKeys = stufe === 'A' || stufe === 'B' ? ['serie', 'teilVon'] : ['serie', 'teilVon', 'franchise']
  for (const [q, it] of Object.entries(w.items)) {
    add(q)
    if (stufe === 'E') for (const n of Object.keys(it.rel.basiertAuf ?? {})) if (w.items[n]) u(q, n)
    for (const k of hubKeys) for (const h of Object.keys(it.rel[k] ?? {})) u(q, 'hub:' + h)
    if (stufe === 'B' || stufe === 'C' || stufe === 'D' || stufe === 'E') for (const k of ['folgtAuf', 'gefolgtVon']) for (const n of Object.keys(it.rel[k] ?? {})) { if (w.items[n] && (stufe !== 'D' && stufe !== 'E' || gemeinsamesWort(it.label + ' ' + (name[tmdbVonQid[q]] ?? ''), w.items[n].label + ' ' + (name[tmdbVonQid[n]] ?? '')))) u(q, n) }
  }
  for (const [h, m] of Object.entries(w.mitglieder)) {
    if (!hubKeys.length) continue
    for (const [q, v] of Object.entries(m)) {
      // Hub-Art unbekannt in `mitglieder`: P8345 nur bei Stufe C zulassen
      const it = w.items[q]
      const art = it ? hubKeys.some((k) => it.rel[k]?.[h]) : false
      if (art) u(q, 'hub:' + h)
    }
  }
  const g = new Map()
  for (const q of Object.keys(w.items)) {
    const r = f(q)
    const t = tmdbVonQid[q]
    if (!t || !meineTmdb.has(t)) continue
    if (!g.has(r)) g.set(r, new Set())
    g.get(r).add(t)
  }
  return [...g.values()].filter((s) => s.size >= 2)
}
const out = {}
for (const s of ['A', 'H', 'B', 'C', 'D', 'E']) {
  const g = gruppen(s)
  const titel = new Set(g.flatMap((x) => [...x]))
  console.log(`Stufe ${s}: ${g.length} Reihen mit >= 2 Cartoon-Gliedern, ${titel.size} Titel`)
  out[s] = g.map((x) => [...x].map((t) => t + ' ' + name[t]))
}
// Hubs, deren Mitglieder auch außerhalb unseres Bestands liegen (Lücken)
let aussen = 0
for (const [h, m] of Object.entries(w.mitglieder)) {
  const draussen = Object.values(m).filter((v) => !meineTmdb.has(v.tmdb))
  aussen += draussen.length
}
console.log('Hub-Mitglieder mit TMDB-ID außerhalb des Cartoon-Bestands:', aussen)
writeFileSync(S + '/gruppen.json', JSON.stringify(out, null, 1))
console.log('Anfragen', w.anfragen, 'Sekunden', w.sekunden)
