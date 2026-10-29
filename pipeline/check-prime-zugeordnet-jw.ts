/**
 * Zusicherung: **Die JustWatch-Seitenregel (Anime `11-6`, Cartoons `cartoon-jw-seite`) zählt keine von Hand gesperrte Meldung aus
 * `data/prime-zugeordnet.json` als Messung** (19.10.2026, PR 1612 R4). Gesperrt heißt: keine Messung, also setzt JustWatchs „de“ die
 * Flagge; eine mitgezählte Meldung ohne Deutsch wäre ein „nein“ und unterdrückte sie. Fährt beide echten Aufrufer gegen eine Kulisse
 * (`AK_ROOT`). Läuft in `check:logic`. Der Leser `09-7` steht in `check-prime-zugeordnet-lader.ts`, `09-3` in `check-prime-seiten-sperre.ts`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { StreamLink, Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-zugeordnet-jw-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: unknown) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
const gti = (n: number) => `amzn1.dv.gti.0000000${n}-0000-0000-0000-000000000000`
const amazon = (n: number) => `https://watch.amazon.de/detail?gti=${gti(n)}`
const SPERRE = 'B0SPERRE01'
const FREI = 'B0FREIFREI'
const heute = todayIso()

/** Vier erfundene Titel: Anime gesperrt/frei (900041/42), Cartoon gesperrt/frei (900043/44); Meldung je Titel ohne deutschen Ton. */
const faelle = [
  { id: 900041, n: 1, seite: SPERRE, flagge: true, name: 'Anime, gesperrte Meldung zählt nicht' },
  { id: 900042, n: 2, seite: FREI, flagge: false, name: 'Anime, Kontrolle: freie Meldung ist ein Nein' },
  { id: 900043, n: 3, seite: SPERRE, flagge: true, name: 'Cartoon, gesperrte Meldung zählt nicht' },
  { id: 900044, n: 4, seite: FREI, flagge: false, name: 'Cartoon, Kontrolle: freie Meldung ist ein Nein' },
]
const titel = (f: (typeof faelle)[number]): Title =>
  ({ id: f.id, titleRomaji: `Erfunden ${f.id}`, streams: [{ platform: 'primevideo', url: amazon(f.n) } as StreamLink] }) as unknown as Title

const fehler: string[] = []
try {
  schreibe('data/urteile.json', {})
  schreibe('data/belege-entfernt.yaml', faelle.filter((f) => f.seite === SPERRE).map((f) => ({ anilistId: f.id, url: `https://www.amazon.de/dp/${SPERRE}`, grund: 'Sperre', entferntAm: '2026-10-29' })))
  schreibe('data/justwatch-audio.json', Object.fromEntries(faelle.map((f) => [String(f.id), {
    geprueftAm: heute,
    jwId: `ts${f.id}`,
    staffeln: [{ nr: 1, angebote: [] }],
    angebote: [{ anbieter: 'Amazon Video', art: 'FLATRATE', audio: ['de', 'ja'], url: amazon(f.n) }],
  }])))
  schreibe('data/prime-zugeordnet.json', Object.fromEntries(faelle.map((f) => [amazon(f.n), {
    titleId: f.id,
    plattform: 'primevideo',
    seite: f.seite,
    asin: f.seite,
    folgen: [{ unsere: 1, sprachen: ['Japanisch'] }],
  }])))
  const { kennzeichneDeutschLautJustwatch } = await import('./bau/11-6-jw-vertrauen.ts')
  const { kennzeichneCartoonJwSeiten } = await import('./bau/cartoon-jw-seite.ts')
  const anime = faelle.slice(0, 2).map(titel)
  const cartoons = faelle.slice(2).map(titel)
  kennzeichneDeutschLautJustwatch({ titles: new Map(anime.map((t) => [t.id, t])), tmdbMehrdeutig: new Set(), alleChecks: [] })
  kennzeichneCartoonJwSeiten(cartoons, [])
  for (const t of [...anime, ...cartoons]) {
    const f = faelle.find((x) => x.id === t.id)!
    const hat = t.streams[0]!.dubQuelle === 'justwatch'
    if (hat !== f.flagge) fehler.push(`${f.name}: Flagge ${hat}, erwartet ${f.flagge}`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-zugeordnet-jw:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prime-zugeordnet-jw: ${faelle.length} Fälle ok.`)
