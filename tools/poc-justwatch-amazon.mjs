#!/usr/bin/env node
/*
  Proof of Concept (17.09.2026): Taugt JustWatch als Lebenszeichen für Amazon-Adressen?

  Daniel: „vorher belegen das es tatsächlich korrekte ergebnisse liefert, kritische
  stichproben + manuelle hand-gegenproben". Schreibt nichts in den Bestand, nur
  docs/poc-justwatch-amazon.md.

  Stichprobe: Amazon-Adressen mit **gemessenem** Befund aus data/link-check.json
  (200 mit Produktseite = lebt, 404 = tot), zugeordnet über data/anisearch.json,
  data/dub-confirmed.yaml und den Datensatz; nur Titel mit TMDB-Kennung.
  Frage je Adresse: Nennt JustWatch dieselbe ASIN (Kauf) bzw. ein Amazon-Angebot
  für den Titel (Prime)? Gut ist der Weg, wenn „lebt" oft und „tot" nie getroffen wird.

  Aufruf: node tools/poc-justwatch-amazon.mjs [--je 40]
*/
import { readFileSync, writeFileSync } from 'node:fs'

const je = Number(process.argv[process.argv.indexOf('--je') + 1]) || 40
const lies = (p) => JSON.parse(readFileSync(p, 'utf8'))
const links = lies('data/link-check.json')
const tmdb = lies('data/tmdb-titles.json')
const anisearch = lies('data/anisearch.json')
const titles = lies('public/data/titles.json')
const yaml = readFileSync('data/dub-confirmed.yaml', 'utf8')

const asin = (u) => (u.match(/\/(?:dp|detail|product)\/([A-Z0-9]{10})(?![A-Z0-9])/i) || [])[1]?.toUpperCase()
const istPrime = (u) => /\/gp\/video\/detail\//i.test(u)

/* Adresse → Titel: Datensatz, aniSearch, Handbelege. */
const zuTitel = new Map()
const merke = (u, id, name) => { const a = asin(u); if (a && !zuTitel.has(a)) zuTitel.set(a, { id: String(id), name }) }
const namen = new Map(titles.map((t) => [String(t.id), t.titleDe || t.titleRomaji || t.titleEn]))
for (const t of titles) for (const x of [...(t.streams ?? []), ...(t.watchLinks ?? [])]) merke(x.url, t.id, namen.get(String(t.id)))
for (const [id, e] of Object.entries(anisearch)) for (const s of e.streams ?? []) if (s.url) merke(s.url, id, namen.get(id))
for (const m of yaml.matchAll(/anilistId:\s*(\d+)[\s\S]{0,200}?url:\s*(\S+)/g)) merke(m[2], m[1], namen.get(m[1]))

const gruppen = { prime: { lebt: [], tot: [] }, kauf: { lebt: [], tot: [] } }
for (const [u, b] of Object.entries(links)) {
  if (!/amazon\./.test(u) || !asin(u)) continue
  const status = b.status === 200 ? 'lebt' : b.status === 404 ? 'tot' : null
  if (!status) continue
  const t = zuTitel.get(asin(u))
  if (!t?.name || !tmdb[t.id]?.tmdbId) continue
  gruppen[istPrime(u) ? 'prime' : 'kauf'][status].push({ url: u, asin: asin(u), ...t, tmdbId: tmdb[t.id].tmdbId })
}
/* Feste Auswahl: jede n-te, damit ein zweiter Lauf dieselbe Stichprobe zieht. */
const auswahl = (l) => l.filter((_, i) => i % Math.max(1, Math.floor(l.length / je)) === 0).slice(0, je)

const SUCHE = `query S($q:String!,$country:Country!,$language:Language!){popularTitles(country:$country,first:5,filter:{searchQuery:$q}){edges{node{id content(country:$country,language:$language){title externalIds{tmdbId}} offers(country:$country,platform:WEB){monetizationType standardWebURL package{clearName}}}}}}`
const cache = new Map()
async function angebote(name, tmdbId) {
  const k = `${name}|${tmdbId}`
  if (cache.has(k)) return cache.get(k)
  await new Promise((r) => setTimeout(r, 1000))
  const r = await fetch('https://apis.justwatch.com/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)' },
    body: JSON.stringify({ query: SUCHE, variables: { q: name, country: 'DE', language: 'de' } }),
  })
  const j = await r.json()
  const knoten = (j.data?.popularTitles?.edges ?? []).map((e) => e.node).find((n) => String(n.content.externalIds?.tmdbId ?? '') === String(tmdbId))
  const erg = knoten ? (knoten.offers ?? []).map((o) => ({ anbieter: o.package?.clearName ?? '?', art: o.monetizationType, url: o.standardWebURL ?? '' })) : null
  cache.set(k, erg)
  return erg
}

const zeilen = []
const tabelle = []
for (const art of ['kauf', 'prime']) {
  for (const status of ['lebt', 'tot']) {
    const probe = auswahl(gruppen[art][status])
    const z = { art, status, n: probe.length, unbekannt: 0, gleicheAsin: 0, amazonAngebot: 0, keinAmazon: 0 }
    for (const p of probe) {
      const off = await angebote(p.name, p.tmdbId)
      let urteil
      if (!off) { z.unbekannt++; urteil = 'JW kennt Titel nicht' }
      else {
        const am = off.filter((o) => /amazon/i.test(o.anbieter))
        const gleich = off.some((o) => asin(o.url) === p.asin)
        if (gleich) z.gleicheAsin++
        if (am.length) z.amazonAngebot++; else z.keinAmazon++
        urteil = gleich ? 'gleiche ASIN' : am.length ? `Amazon-Angebot (${am.map((o) => o.anbieter + ' ' + o.art).join(', ')})` : 'kein Amazon-Angebot'
      }
      zeilen.push(`| ${art} | ${status} | ${p.name} | [${p.asin}](${p.url}) | ${urteil} |`)
    }
    tabelle.push(z)
    console.log(z)
  }
}

writeFileSync('docs/poc-justwatch-amazon.md', `# PoC: JustWatch als Lebenszeichen für Amazon-Adressen (${new Date().toISOString().slice(0, 10)})

Befund aus \`data/link-check.json\` (gemessen) gegen JustWatch (heute). „tot" darf nie „gleiche ASIN" treffen.

| Art | Befund | Stichprobe | JW kennt Titel nicht | gleiche ASIN | Amazon-Angebot | kein Amazon |
|---|---|---|---|---|---|---|
${tabelle.map((z) => `| ${z.art} | ${z.status} | ${z.n} | ${z.unbekannt} | ${z.gleicheAsin} | ${z.amazonAngebot} | ${z.keinAmazon} |`).join('\n')}

## Einzelfälle

| Art | Befund | Titel | Adresse | JustWatch |
|---|---|---|---|---|
${zeilen.join('\n')}
`)
console.log('docs/poc-justwatch-amazon.md geschrieben')
