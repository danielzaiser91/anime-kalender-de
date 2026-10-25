// Bilanz der TMDB-Zuordnung ohne Folgenzahl (Messung, kein Tor): Lücken je Grund und Gegenprobe alt gegen neu.
// Aufruf: npx tsx tools/tmdb-ohne-zahl-bilanz.ts <commit>   (titles.json und Folgendateien aus <commit>, TMDB-Dateien aus dem Arbeitsordner)
// Gegenprobe: je Titel mit TMDB-Eintrag und `episodes` die alte Regel (mit Folgenzahl) gegen die neue (Folgenzahl weggelassen),
// beide mit den vorhandenen Titeln der Folgendatei als Vergleich.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { tmdbFolgentitel } from '../pipeline/bau/folgentitel-tmdb.ts'

interface FolgenDatei {
  f: [number, string][]
  de: [number, number][]
}
const sha = process.argv[2] ?? 'HEAD'
const lies = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'))

/** Alle Pfade eines Commits in einem einzigen git-Aufruf (`cat-file --batch`); fehlende Pfade fehlen in der Antwort. */
function ausCommit(pfade: string[]): Map<string, string> {
  const r = spawnSync('git', ['cat-file', '--batch'], { input: pfade.map((p) => `${sha}:${p}\n`).join(''), maxBuffer: 1 << 30, windowsHide: true })
  const aus = new Map<string, string>()
  const b = r.stdout
  let pos = 0
  for (const p of pfade) {
    const ende = b.indexOf(10, pos)
    const kopf = b.subarray(pos, ende).toString().split(' ')
    pos = ende + 1
    if (kopf[1] === 'missing') continue
    const groesse = Number(kopf[2])
    aus.set(p, b.subarray(pos, pos + groesse).toString('utf8'))
    pos += groesse + 1
  }
  return aus
}

const t = JSON.parse(ausCommit(['public/data/titles.json']).get('public/data/titles.json') ?? '[]')
const arr: any[] = Array.isArray(t) ? t : (t.titles ?? Object.values(t))
const dateien = ausCommit(arr.map((x) => `public/data/folgen/${x.id}.json`))
const tm = lies('data/tmdb-folgen.json')
const ti = lies('data/tmdb-titles.json')
const n404 = fs.existsSync('data/tmdb-folgen-404.json') ? lies('data/tmdb-folgen-404.json') : {}
const leer = (n: string | undefined) => !n || /^(folge|episode)\s*\d*$/i.test(n)
const summe: Record<string, [number, number]> = {}
const z = { mitZahl: 0, alt: 0, neu: 0, gleich: 0, abweichend: 0, strenger: 0, neuNur: [] as string[], abgewiesen: [] as number[] }

for (const x of arr) {
  const roh = dateien.get(`public/data/folgen/${x.id}.json`)
  if (!roh) continue
  const f: FolgenDatei = JSON.parse(roh)
  const inDe = (n: number) => f.de.some(([a, b]) => n >= a && n <= b)
  const luecken = f.f.filter((a) => inDe(a[0]) && leer(a[1]))
  const e = tm[x.id]
  const nummern = f.f.map((a) => a[0])
  const vorhanden = new Map(f.f.filter((a) => !leer(a[1])).map((a) => [a[0], a[1]] as [number, string]))
  if (e && x.episodes) {
    z.mitZahl++
    const alt = tmdbFolgentitel(x, ti[x.id]?.nameDe, e, nummern, vorhanden)
    const neu = tmdbFolgentitel({ ...x, episodes: undefined }, ti[x.id]?.nameDe, e, nummern, vorhanden)
    if (alt) z.alt++
    if (neu) z.neu++
    if (!neu && tmdbFolgentitel({ ...x, episodes: undefined }, ti[x.id]?.nameDe, e, nummern)) z.abgewiesen.push(x.id)
    if (alt && neu && JSON.stringify([...alt]) === JSON.stringify([...neu])) z.gleich++
    else if (alt && neu) z.abweichend++
    else if (alt) z.strenger++
    else if (neu) z.neuNur.push(`${x.id} ${x.titleEn}`)
  }
  if (!luecken.length) continue
  const grund = x.format === 'MOVIE' ? 'Film' : !['TV', 'TV_SHORT', 'ONA'].includes(x.format) ? 'Format ' + x.format : !ti[x.id]?.tmdbId ? 'keine tmdbId' : !e ? (n404[x.id]?.tmdbId === ti[x.id]?.tmdbId ? 'TMDB 404' : 'kein Eintrag in tmdb-folgen.json') : 'mit Eintrag'
  const schluessel = `${grund}${x.episodes ? ', mit episodes' : ', ohne episodes'}`
  summe[schluessel] ??= [0, 0]
  summe[schluessel][0]++
  summe[schluessel][1] += luecken.length
}
console.log(`Stand ${sha}`)
for (const [k, v] of Object.entries(summe).sort()) console.log(`Lücke ${k}: ${v[0]} Titel, ${v[1]} Folgen im deutschen Bereich`)
console.log(`Gegenprobe: ${z.mitZahl} Titel mit Eintrag und episodes; alte Regel gibt bei ${z.alt}, neue bei ${z.neu}; gleich ${z.gleich}, abweichend ${z.abweichend}, strenger ${z.strenger}, nur neu ${z.neuNur.length} ${JSON.stringify(z.neuNur)}`)
console.log(`Davon vom Vergleich mit vorhandenen Titeln abgewiesen: ${z.abgewiesen.length} ${JSON.stringify(z.abgewiesen)}`)
