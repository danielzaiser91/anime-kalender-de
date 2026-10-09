import { readFileSync } from 'node:fs'
const UA = 'anime-kalender.de-reihen-poc/0.1 (https://anime-kalender.de) node-fetch'
const carts = Object.values(JSON.parse(readFileSync('data/cartoons.json', 'utf8')))
const ids = carts.map((c) => c.tmdbId)
const treffer = []
for (let i = 0; i < ids.length; i += 100) {
  const block = ids.slice(i, i + 100).map((x) => `"${x}"`).join(' ')
  const q = `SELECT ?tmdb ?al ?mal WHERE { VALUES ?tmdb { ${block} } ?s wdt:P4983 ?tmdb . OPTIONAL { ?s wdt:P8729 ?al } OPTIONAL { ?s wdt:P4086 ?mal } FILTER(BOUND(?al) || BOUND(?mal)) }`
  const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'query=' + encodeURIComponent(q) })
  const j = await r.json()
  for (const b of j.results.bindings) treffer.push([b.tmdb.value, b.al?.value, b.mal?.value])
  await new Promise((s) => setTimeout(s, 2000))
}
console.log('Cartoons mit AniList/MAL-Kennung in Wikidata:', treffer.length)
for (const [t, al, mal] of treffer) console.log(t, carts.find((c) => String(c.tmdbId) === t)?.titleEn, 'AL', al, 'MAL', mal)
