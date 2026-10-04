import fs from 'node:fs'
// Misst, ob die Crunchyroll-Adresse eines Titels zu ihm passt (Daniel, 04.10.2026: Tokyo Revengers, Reborn as a Space Mercenary).
// Zwei Befunde: (1) Katalogname passt nicht zum Titelnamen (meist Franchise-Seiten, legitim), (2) die Titel einer Serie beanspruchen zusammen mehr Folgen als die Serie hat (Fehler).
// Aufruf: node tools/anilist-links-pruefen.mjs   (liest public/data/titles.json und data/cr-katalog-de.json, schreibt nichts)
// Misst: Zeigt der Crunchyroll-Weg eines Titels auf eine Serie, deren Katalogname nicht zum Titelnamen passt?
const t = JSON.parse(fs.readFileSync('public/data/titles.json', 'utf8'))
const a = Array.isArray(t) ? t : t.titles
const kat = JSON.parse(fs.readFileSync('data/cr-katalog-de.json', 'utf8')).eintraege
const nachId = new Map(kat.map((e) => [e.id, e]))
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(season|staffel|part|teil|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const woerter = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1))
const aehnlich = (x, y) => {
  const A = woerter(x)
  const B = woerter(y)
  if (!A.size || !B.size) return 0
  let g = 0
  for (const w of A) if (B.has(w)) g++
  return g / Math.max(A.size, B.size)
}
let geprueft = 0
let ohneKatalog = 0
const verdaechtig = []
for (const T of a) {
  for (const s of T.streams || []) {
    if (s.platform !== 'crunchyroll') continue
    const id = (/series\/([A-Z0-9]+)/.exec(s.url || '') || [])[1]
    if (!id) continue
    const k = nachId.get(id)
    if (!k) {
      ohneKatalog++
      continue
    }
    geprueft++
    const namen = [T.titleEn, T.titleDe, T.titleRomaji, T.titleNative].filter(Boolean)
    const best = Math.max(...namen.map((n) => aehnlich(n, k.titel)))
    if (best < 0.6) verdaechtig.push([T.id, T.titleEn || T.titleRomaji, '→', k.titel, id, best.toFixed(2)])
  }
}
console.log('Crunchyroll-Wege mit Katalogeintrag:', geprueft, '| ohne Katalogeintrag:', ohneKatalog, '| verdächtig:', verdaechtig.length)
for (const v of verdaechtig.slice(0, 60)) console.log(v.join(' | '))

// (2) Überbelegte Serien: Titel mit einer Crunchyroll-Serie mit genau einer Staffel, deren Folgensummen die Katalogzahl übersteigen.
const sid = (u) => (/series\/([A-Z0-9]+)/.exec(u || '') || [])[1]
const jeSerie = new Map()
for (const x of a) {
  const s = (x.streams || []).find((s) => s.platform === 'crunchyroll')
  const k = s && sid(s.url)
  if (k) jeSerie.set(k, [...(jeSerie.get(k) || []), x])
}
let ueber = 0
for (const [k, titel] of jeSerie) {
  const e = nachId.get(k)
  if (!e || (e.staffeln ?? 0) !== 1 || titel.length < 2) continue
  const summe = titel.reduce((z, x) => z + (x.episodes || 0), 0)
  if (summe <= e.folgen) continue
  ueber++
  console.log('ÜBERBELEGT', k, e.titel, '| Katalog', e.folgen, '| Summe', summe, '|', titel.map((x) => x.id).join(', '))
}
console.log('Überbelegte Serien:', ueber)
