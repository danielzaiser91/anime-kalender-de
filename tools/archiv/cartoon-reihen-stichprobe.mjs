// PoC (nicht eingehängt), Teil von docs/wissen/cartoon-reihen.md. Aufruf: node tools/archiv/cartoon-reihen-stichprobe.mjs <Ordner mit wd-voll.json> (Ausgabe des -poc-Skripts als wd-voll.json); schreibt gruppen.json dorthin.
import { readFileSync } from 'node:fs'
const S = process.argv[2]
const w = JSON.parse(readFileSync(S + '/wd-voll.json', 'utf8'))
const g = JSON.parse(readFileSync(S + '/gruppen.json', 'utf8'))
const carts = Object.values(JSON.parse(readFileSync('data/cartoons.json', 'utf8')))
const fest = [117682, 100617, 128255, 259819, 39373, 50137, 60625, 4194, 246, 94605, 95557, 71024, 138502, 157747, 3934, 1433, 45140, 33765, 61175, 2309]
// 20 weitere gleichmäßig aus dem Bestand
const rest = carts.filter((c) => !fest.includes(c.tmdbId))
const zufall = []
for (let i = 7; i < rest.length && zufall.length < 20; i += Math.floor(rest.length / 20)) zufall.push(rest[i].tmdbId)
const proben = [...fest, ...zufall]
const qVon = {}
for (const [q, it] of Object.entries(w.items)) for (const t of it.tmdb) qVon[t] = q
const inGruppe = (stufe, t) => g[stufe].find((x) => x.some((y) => y.startsWith(t + ' ')))
let nItem = 0, nRel = 0, nH = 0, nB = 0
for (const t of proben) {
  const c = carts.find((x) => x.tmdbId === t)
  const q = qVon[String(t)]
  const it = q && w.items[q]
  const rel = it ? Object.keys(it.rel).join(',') : ''
  const h = inGruppe('H', String(t)), b = inGruppe('B', String(t))
  if (it) nItem++
  if (rel) nRel++
  if (h) nH++
  if (b) nB++
  console.log([t, c.titleEn, c.jahr, q ?? '-', rel || '-', h ? 'H' + h.length : '-', b ? 'B' + b.length : '-'].join(' | '))
}
console.log({ proben: proben.length, nItem, nRel, nH, nB })
