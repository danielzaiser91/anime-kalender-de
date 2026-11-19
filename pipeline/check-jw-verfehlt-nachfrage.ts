/**
 * Fährt `main()` aus `fetch-justwatch-audio.ts` gegen eine Kulisse (Wegwerf-Ordner als `AK_ROOT`, feste Uhr, Abruf-Attrappe) und belegt, was
 * `verbucheFehlschlag` mit einem alten Befund macht, wenn die Namenssuche den Titel nicht mehr findet: ein Befund mit fremder TMDB-Kennung wird nicht
 * behalten (Magister Negi Magi: Befund trägt 16950, unsere Kennung ist 8859). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { festeUhr } from '../tools/feste-uhr.ts'
import type { fetchJson } from './lib/util.ts'

const wurzel = mkdtempSync(join(tmpdir(), 'ak-jw-verfehlt-'))
const ordner = join(wurzel, 'da' + 'ta')
const oeffentlich = join(wurzel, 'public', 'da' + 'ta')
mkdirSync(ordner, { recursive: true })
mkdirSync(oeffentlich, { recursive: true })
process.env.AK_ROOT = wurzel
process.chdir(wurzel)
festeUhr('2026-11-19T12:00:00Z')
const modul = './fetch-justwatch-audio.ts?nur-laden'
const { main } = (await import(modul)) as { main: (args: string[], welt: { abruf: typeof fetchJson; pause: () => Promise<void> }) => Promise<void> }

let fehler = 0
let geprueft = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  geprueft++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

interface Befund {
  geprueftAm?: string
  jwId?: string
  jwPfad?: string
  tmdbId?: number
  ohneTreffer?: boolean
  verfehltAm?: string
  angebote?: unknown[]
}
const titel = (id: number, tmdbId: number) => ({ id, tmdbId, titleEn: `Titel ${id}`, format: 'TV', streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${id}`, dub: true }], watchLinks: [] })
const alterBefund = (jwId: string, tmdbId: number): Befund => ({ geprueftAm: '2026-11-11', jwId, tmdbId, jwPfad: `/de/Serie/${jwId}`, angebote: [] })

/** Ein Lauf mit einem Titel und seinem alten Befund; die Namenssuche liefert nie etwas. */
async function lauf(id: number, tmdbId: number, vorher: Befund): Promise<Befund> {
  writeFileSync(join(oeffentlich, 'titles.json'), JSON.stringify([titel(id, tmdbId)]))
  writeFileSync(join(oeffentlich, 'releases.json'), '[]')
  writeFileSync(join(ordner, 'tmdb-von-hand.yaml'), '[]\n')
  writeFileSync(join(ordner, 'justwatch-audio.json'), JSON.stringify({ [String(id)]: vorher }))
  const abruf = (async () => ({ data: { popularTitles: { edges: [] } } })) as unknown as typeof fetchJson
  const log = console.log
  const warnung = console.warn
  console.log = () => undefined
  console.warn = () => undefined
  try {
    await main(['--limit', '5', '--alter', '0'], { abruf, pause: async () => undefined })
  } finally {
    console.log = log
    console.warn = warnung
  }
  return JSON.parse(readFileSync(join(ordner, 'justwatch-audio.json'), 'utf8'))[String(id)]
}

/* Negi: Befund trägt TMDB 16950, der Titel hat 8859 — der Befund gehört einem anderen Titel und wird nicht behalten. */
const fremd = await lauf(900101, 8859, alterBefund('ts35532', 16950))
pruefe('fremde Kennung: Befund wird nicht behalten (kein jwId, kein verfehltAm)', !fremd.jwId && !fremd.verfehltAm, fremd)
pruefe('fremde Kennung: Befund steht als ohneTreffer mit unserer Kennung', fremd.ohneTreffer === true && fremd.tmdbId === 8859, fremd)

/* Kontrolle: gleiche Kennung, Namenssuche findet nichts — die alte Antwort bleibt, mit verfehltAm. */
const gleich = await lauf(900102, 8859, alterBefund('ts1', 8859))
pruefe('gleiche Kennung: alte Antwort bleibt mit verfehltAm', gleich.jwId === 'ts1' && gleich.verfehltAm === '2026-11-19' && !gleich.ohneTreffer, gleich)

console.log(`check-jw-verfehlt-nachfrage: ${geprueft} Prüfungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
