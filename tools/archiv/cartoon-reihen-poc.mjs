// PoC (nicht eingehängt): Cartoon-Reihen aus Wikidata (CC0) über P4983 (TMDB-TV-Kennung).
// Aufruf: node tools/archiv/cartoon-reihen-poc.mjs <ausgabe.json> [--limit N]
// Schreibt nichts ins Repo; nur die angegebene Ausgabedatei.
import { readFileSync, writeFileSync } from 'node:fs'
const UA = 'anime-kalender.de-reihen-poc/0.1 (https://anime-kalender.de) node-fetch'
const WDQS = 'https://query.wikidata.org/sparql'
const out = process.argv[2]
const limit = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 0)
const carts = Object.values(JSON.parse(readFileSync('data/cartoons.json', 'utf8')))
let ids = carts.map((c) => c.tmdbId)
if (limit) ids = ids.slice(0, limit)
let anfragen = 0
const t0 = Date.now()
async function sparql(q) {
  for (let versuch = 0; versuch < 5; versuch++) {
    anfragen++
    const r = await fetch(WDQS, {
      method: 'POST',
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=' + encodeURIComponent(q),
    })
    if (r.status === 429 || r.status >= 500) {
      const w = Number(r.headers.get('retry-after') ?? 30)
      console.error('Status', r.status, 'warte', w)
      await new Promise((s) => setTimeout(s, (w + 1) * 1000))
      continue
    }
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return (await r.json()).results.bindings
  }
  throw new Error('aufgegeben')
}
const q = (u) => u.value.split('/').pop()
const PROPS = { P179: 'serie', P361: 'teilVon', P8345: 'franchise', P155: 'folgtAuf', P156: 'gefolgtVon', P144: 'basiertAuf' }
const items = {} // qid -> {tmdb, label, rel:{}}
for (let i = 0; i < ids.length; i += 100) {
  const block = ids.slice(i, i + 100).map((x) => `"${x}"`).join(' ')
  const rows = await sparql(`SELECT ?s ?sLabel ?tmdb ?p ?o ?oLabel WHERE {
    VALUES ?tmdb { ${block} } ?s wdt:P4983 ?tmdb .
    OPTIONAL { VALUES ?p { wdt:P179 wdt:P361 wdt:P8345 wdt:P155 wdt:P156 wdt:P144 } ?s ?p ?o . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". } }`)
  for (const r of rows) {
    const s = q(r.s)
    const it = (items[s] ??= { tmdb: new Set(), label: r.sLabel.value, rel: {} })
    it.tmdb.add(r.tmdb.value)
    if (r.p) {
      const k = PROPS[r.p.value.split('/').pop()]
      ;(it.rel[k] ??= {})[q(r.o)] = r.oLabel.value
    }
  }
  console.error(`Block ${i / 100 + 1}: ${Object.keys(items).length} Items, ${Math.round((Date.now() - t0) / 1000)} s`)
  await new Promise((s) => setTimeout(s, 3000))
}
// Naben: alle Ziele von P179/P361/P8345 -> Mitglieder mit TMDB-TV-Kennung (auch außerhalb unseres Bestands)
const naben = new Set()
for (const it of Object.values(items)) for (const k of ['serie', 'teilVon', 'franchise']) for (const h of Object.keys(it.rel[k] ?? {})) naben.add(h)
const nabenListe = [...naben]
const mitglieder = {} // hub -> {qid:{tmdb,label}}
for (let i = 0; i < nabenListe.length; i += 10) {
  const v = nabenListe.slice(i, i + 10).map((x) => 'wd:' + x).join(' ')
  let rows = []
  try {
    rows = await sparql(`SELECT ?h ?m ?mLabel ?tmdb WHERE {
    VALUES ?h { ${v} } { ?m wdt:P179 ?h } UNION { ?m wdt:P361 ?h } UNION { ?m wdt:P8345 ?h } ?m wdt:P4983 ?tmdb .
    SERVICE wikibase:label { bd:serviceParam wikibase:language "de,en". } }`)
  } catch (e) { console.error('Nabe übersprungen', e.message) }
  for (const r of rows) ((mitglieder[q(r.h)] ??= {})[q(r.m)] = { tmdb: r.tmdb.value, label: r.mLabel.value })
  await new Promise((s) => setTimeout(s, 3000))
}
const nameHub = {}
for (const it of Object.values(items)) for (const k of ['serie', 'teilVon', 'franchise']) Object.assign(nameHub, it.rel[k] ?? {})
const ergebnis = {
  stand: new Date().toISOString(), anfragen, sekunden: Math.round((Date.now() - t0) / 1000), abgefragt: ids.length,
  items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { ...v, tmdb: [...v.tmdb] }])),
  mitglieder, nameHub,
}
writeFileSync(out, JSON.stringify(ergebnis, null, 1))
console.error('fertig', anfragen, 'Anfragen')
