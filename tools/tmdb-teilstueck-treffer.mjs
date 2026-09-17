/**
 * **Welche TMDB-Zuordnung ist ein Teilstück-Treffer?** (17.09.2026)
 *
 * „Your Name." bekam die Kennung von „Call Me by Your Name": Unser Titel steckt
 * vollständig im längeren fremden, und die Ähnlichkeit teilte durch den kürzeren.
 * Seit heute teilt `fetch-tmdb-titles.ts` durch den längeren — die alten Einträge
 * bleiben davon aber unberührt.
 *
 * Dieser Lauf holt zu jeder gespeicherten Kennung die echten Titel und meldet genau
 * dieses Muster: alte Ähnlichkeit hoch, neue niedrig. Ein Originaltitel in anderer
 * Sprache (母をたずねて三千里 = „Marco") fällt dadurch **nicht** auf.
 *
 * Aufruf: node tools/tmdb-teilstueck-treffer.mjs <api-key> [--entfernen]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const KEY = process.argv[2]
const ENTFERNEN = process.argv.includes('--entfernen')
if (!KEY) {
  console.error('Aufruf: node tools/tmdb-teilstueck-treffer.mjs <api-key> [--entfernen]')
  process.exit(1)
}

const datei = resolve(wurzel, 'data/tmdb-titles.json')
const tmdb = JSON.parse(readFileSync(datei, 'utf8'))
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = new Map((roh.titles ?? roh).map((t) => [String(t.id), t]))

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const woerter = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2))
function paar(a, b) {
  const A = woerter(a)
  const B = woerter(b)
  if (!A.size || !B.size) return { kurz: 0, lang: 0 }
  let n = 0
  for (const w of A) if (B.has(w)) n++
  return { kurz: n / Math.min(A.size, B.size), lang: n / Math.max(A.size, B.size) }
}

const eintraege = Object.entries(tmdb).filter(([id, e]) => e?.tmdbId && titel.has(id))
console.log(`${eintraege.length} gespeicherte Zuordnungen werden geprüft.`)
/**
 * **Von Hand geprüft und richtig** (17.09.2026) — Paar aus unserer und TMDBs Kennung.
 *
 * Alle zehn sind dasselbe Werk unter einem längeren Namen: TMDB stellt die Reihe voran
 * („Pokémon 20: Du bist dran!", „Marvel Anime - X-Men") oder führt den deutschen
 * Untertitel als ganzen Titel („Sekunden in Moll"). Ohne diese Liste meldet der Lauf sie
 * bei jeder Ausführung erneut, und die acht echten Fehltreffer gingen darin unter.
 *
 * Ändert sich die Zuordnung, passt das Paar nicht mehr und der Fall wird wieder gemeldet.
 */
const GEPRUEFT = new Set([
  '2882:21269', // Superbuch ⊂ Das Superbuch - Die Bibel für Kinder
  '3132:27422', // Christoph Columbus ⊂ The True Adventures of Christopher Columbus
  '3434:13488', // Bumpety Boo ⊂ Der kleine gelbe Superflitzer
  '4107:20986', // Gurren Lagann The Movie ⊂ Gurren Lagann - Childhood's End
  '6919:43146', // X-Men ⊂ Marvel Anime - X-Men
  '20665:61663', // Shigatsu wa Kimi no Uso ⊂ Sekunden in Moll
  '98298:436931', // Pokémon: Der Film - Du bist dran! ⊂ Pokémon 20
  '100744:494407', // Pokémon: Die Macht in uns ⊂ Pokémon 21
  '101166:553835', // Danmachi ⊂ DanMachi: Arrow of the Orion
  '114564:662708', // Pokémon: Geheimnisse des Dschungels ⊂ Pokémon 23
])
const verdacht = []
let gefragt = 0
for (const [id, e] of eintraege) {
  if (GEPRUEFT.has(`${id}:${e.tmdbId}`)) continue
  const art = e.kind === 'tv' ? 'tv' : 'movie'
  const antwort = await fetch(`https://api.themoviedb.org/3/${art}/${e.tmdbId}?api_key=${KEY}&language=de-DE`)
  if (!antwort.ok) {
    if (antwort.status === 404) verdacht.push({ id, grund: 'Kennung gibt es bei TMDB nicht mehr', tmdbId: e.tmdbId })
    continue
  }
  gefragt++
  const j = await antwort.json()
  const fremde = [j.title, j.name, j.original_title, j.original_name].filter(Boolean)
  const x = titel.get(id)
  const unsere = [x.titleDe, x.titleEn, x.titleRomaji, x.titleNative].filter(Boolean)
  let besteLang = 0
  let besteKurz = 0
  let name = fremde[0] ?? ''
  for (const f of fremde)
    for (const u of unsere) {
      const p = paar(u, f)
      if (p.lang > besteLang) besteLang = p.lang
      if (p.kurz > besteKurz) {
        besteKurz = p.kurz
        name = f
      }
    }
  /*
    Genau das Muster: passt vollständig in den fremden Titel, füllt ihn aber nicht aus —
    **und die fremden Zusatzwörter stehen vorn**. Steht unser Titel am Anfang des fremden,
    ist es der Normalfall („Wind Breaker: Staffel 2" ⊂ „Wind Breaker", „Pokémon Horizonte" ⊂
    „Pokémon Horizonte: Die Serie"); steht er am Ende, ist es ein anderes Werk („Your Name."
    ⊂ „Call Me by Your Name").
  */
  const anfang = unsere.some((u) => {
    const un = norm(u)
    return fremde.some((f) => {
      const fn = norm(f)
      return un && fn && (fn.startsWith(un) || un.startsWith(fn))
    })
  })
  if (besteKurz >= 0.9 && besteLang < 0.75 && !anfang)
    verdacht.push({ id, grund: `Teilstück-Treffer: „${x.titleDe ?? x.titleEn}" ⊂ „${name}"`, tmdbId: e.tmdbId })
  if (gefragt % 200 === 0) console.log(`  ${gefragt}/${eintraege.length}`)
  await new Promise((r) => setTimeout(r, 25))
}

console.log(`\n${verdacht.length} Verdachtsfälle:`)
for (const v of verdacht) console.log(`  ${v.id} (tmdb ${v.tmdbId}) — ${v.grund}`)
if (!ENTFERNEN) {
  console.log('\nNichts geändert. Mit --entfernen werden die Einträge gelöscht; der nächste TMDB-Lauf sucht sie neu.')
} else if (verdacht.length) {
  for (const v of verdacht) delete tmdb[v.id]
  writeFileSync(datei, JSON.stringify(tmdb, null, 2) + '\n')
  console.log(`\n${verdacht.length} Einträge entfernt — der nächste Lauf sucht sie mit der neuen Regel.`)
}
