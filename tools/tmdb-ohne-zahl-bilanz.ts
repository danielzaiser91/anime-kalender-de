// Bilanz der TMDB-Zuordnung ohne Folgenzahl (Wegwerf-Messung, kein Tor).
// Aufruf: npx tsx tools/tmdb-ohne-zahl-bilanz.ts <commit>   (Folgendateien und titles.json aus <commit>, TMDB-Dateien aus dem Arbeitsordner)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { tmdbFolgentitel } from '../pipeline/bau/folgentitel-tmdb.ts'

const sha = process.argv[2] ?? 'HEAD'
const git = (p: string): string => execFileSync('git', ['show', `${sha}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 29, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })
const lies = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'))
const t = JSON.parse(git('public/data/titles.json'))
const arr: any[] = Array.isArray(t) ? t : (t.titles ?? Object.values(t))
const tm = lies('data/tmdb-folgen.json')
const ti = lies('data/tmdb-titles.json')
const leer = (n: string | undefined) => !n || /^(folge|episode)\s*\d*$/i.test(n)
const summe: Record<string, [number, number]> = {}
const zaehle = (grund: string, folgen: number) => {
  summe[grund] ??= [0, 0]
  summe[grund][0]++
  summe[grund][1] += folgen
}
let gewinnTitel = 0
let gewinnFolgen = 0
for (const x of arr) {
  let f: { f: [number, string][]; de: [number, number][] }
  try {
    f = JSON.parse(git(`public/data/folgen/${x.id}.json`))
  } catch {
    continue
  }
  const inDe = (n: number) => f.de.some(([a, b]) => n >= a && n <= b)
  const luecken = f.f.filter((a) => inDe(a[0]) && leer(a[1]))
  if (!luecken.length) continue
  const e = tm[x.id]
  const ohneZahl = !x.episodes
  const grund = x.format === 'MOVIE' ? 'Film' : !['TV', 'TV_SHORT', 'ONA'].includes(x.format) ? 'Format ' + x.format : !ti[x.id]?.tmdbId ? 'keine tmdbId' : !e ? 'kein Eintrag in tmdb-folgen.json' : ohneZahl ? 'ohne episodes, mit Eintrag' : 'mit episodes, mit Eintrag'
  zaehle(grund + (ohneZahl ? ' [ohne episodes]' : ''), luecken.length)
  if (!e || !ohneZahl) continue
  const aus = tmdbFolgentitel(x, ti[x.id]?.nameDe, e, f.f.map((a) => a[0]))
  const gefuellt = luecken.filter((a) => aus?.has(a[0])).length
  if (gefuellt) {
    gewinnTitel++
    gewinnFolgen += gefuellt
  }
}
console.log(`Stand ${sha}`)
for (const [k, v] of Object.entries(summe).sort()) console.log(`${k}: ${v[0]} Titel, ${v[1]} Lückenfolgen im deutschen Bereich`)
console.log(`Gewinn der neuen Regel am Bestand: ${gewinnTitel} Titel, ${gewinnFolgen} Folgen`)
