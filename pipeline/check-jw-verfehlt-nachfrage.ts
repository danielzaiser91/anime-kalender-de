/**
 * Fährt `main()` aus `fetch-justwatch-audio.ts` gegen eine Kulisse (Wegwerf-Ordner als `AK_ROOT`, feste Uhr, Abruf-Attrappe) und belegt, was
 * `verbucheFehlschlag` mit einem alten Befund macht, wenn die Namenssuche den Titel nicht mehr findet: ein Befund mit fremder TMDB-Kennung wird nicht
 * behalten (Magister Negi Magi: Befund trägt 16950, unsere Kennung ist 8859); sonst fragt der Lauf einmal über den gespeicherten Pfad nach (`urlV2`):
 * ein Titel ohne Angebote wird ein frischer Befund ohne Angebot (Rainbow Rangers, City Hunter, Golgo 13), nicht „verfehlt“. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

type Detail = 'leer' | 'angebot' | 'nicht-gefunden' | 'sperre' | 'andere-kennung'
const angebot = [{ monetizationType: 'FLATRATE', audioLanguages: ['de'], subtitleLanguages: [], standardWebURL: 'https://x', package: { clearName: 'Netflix' } }]
const detailKnoten = (tmdbId: number, offers: unknown[]) => ({ id: 'tm1', objectType: 'MOVIE', content: { title: 'T', fullPath: '', ageCertification: '12', externalIds: { tmdbId: String(tmdbId) } }, offers })

/** Ein Lauf mit einem Titel und seinem alten Befund; die Namenssuche liefert nie etwas, die Nachfrage über den Pfad (`urlV2`) die Antwort `detail`. */
async function lauf(id: number, tmdbId: number, vorher: Befund, detail: Detail = 'nicht-gefunden'): Promise<{ befund: Befund; pfade: string[] }> {
  writeFileSync(join(oeffentlich, 'titles.json'), JSON.stringify([titel(id, tmdbId)]))
  writeFileSync(join(oeffentlich, 'releases.json'), '[]')
  writeFileSync(join(ordner, 'tmdb-von-hand.yaml'), '[]\n')
  writeFileSync(join(ordner, 'justwatch-audio.json'), JSON.stringify({ [String(id)]: vorher }))
  const pfade: string[] = []
  const abruf = (async (_url: string, init?: RequestInit) => {
    const q = JSON.parse(String(init?.body ?? '{}'))
    if (!String(q.query).includes('urlV2')) return { data: { popularTitles: { edges: [] } } }
    pfade.push(q.variables.p)
    if (detail === 'sperre') throw new Error('429 Too Many Requests')
    if (detail === 'nicht-gefunden') return { errors: [{ message: 'URL not found', extensions: { code: 'NOT_FOUND' } }], data: null }
    const kennung = detail === 'andere-kennung' ? tmdbId + 1 : tmdbId
    return { data: { urlV2: { node: detailKnoten(kennung, detail === 'angebot' ? angebot : []) } } }
  }) as unknown as typeof fetchJson
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
  return { befund: JSON.parse(readFileSync(join(ordner, 'justwatch-audio.json'), 'utf8'))[String(id)], pfade }
}

/* Negi: Befund trägt TMDB 16950, der Titel hat 8859 — der Befund gehört einem anderen Titel und wird nicht behalten. */
const { befund: fremd, pfade: fremdPfade } = await lauf(900101, 8859, alterBefund('ts35532', 16950), 'leer')
pruefe('fremde Kennung: keine Nachfrage über den Pfad des fremden Befunds', fremdPfade.length === 0, fremdPfade)
pruefe('fremde Kennung: Befund wird nicht behalten (kein jwId, kein verfehltAm)', !fremd.jwId && !fremd.verfehltAm, fremd)
pruefe('fremde Kennung: Befund steht als ohneTreffer mit unserer Kennung', fremd.ohneTreffer === true && fremd.tmdbId === 8859, fremd)

/* Kontrolle: gleiche Kennung, Namenssuche findet nichts — die alte Antwort bleibt, mit verfehltAm. */
const { befund: gleich, pfade: gleichPfade } = await lauf(900102, 8859, alterBefund('ts1', 8859))
pruefe('gleiche Kennung, Adresse unbekannt: alte Antwort bleibt mit verfehltAm', gleich.jwId === 'ts1' && gleich.verfehltAm === '2026-11-19' && !gleich.ohneTreffer, gleich)
pruefe('gleiche Kennung: genau einmal über den gespeicherten Pfad nachgefragt', gleichPfade.length === 1 && gleichPfade[0] === '/de/Serie/ts1', gleichPfade)

/* Nachfrage findet den Titel ohne Angebote (City Hunter, Golgo 13, Rainbow Rangers): frischer Befund, kein verfehltAm, Pfad bleibt. */
const { befund: leer } = await lauf(900103, 38954, alterBefund('tm140811', 38954), 'leer')
pruefe('Nachfrage ohne Angebote: frischer Befund (heute, Angebote leer, kein verfehltAm)', leer.geprueftAm === '2026-11-19' && leer.angebote?.length === 0 && !leer.verfehltAm && !leer.ohneTreffer, leer)
pruefe('Nachfrage ohne Angebote: jwId, Kennung und Pfad bleiben', leer.jwId === 'tm1' && leer.tmdbId === 38954 && leer.jwPfad === '/de/Serie/tm140811', leer)

/* Nachfrage mit Angeboten: sie werden übernommen. */
const { befund: mit } = await lauf(900104, 17922, alterBefund('tm49473', 17922), 'angebot')
pruefe('Nachfrage mit Angeboten: Angebot übernommen, kein verfehltAm', mit.angebote?.length === 1 && !mit.verfehltAm, mit)

/* Gegenproben: Sperre ist keine Verneinung; ein Knoten mit anderer Kennung wird nicht übernommen. */
const { befund: gesperrt } = await lauf(900105, 38954, alterBefund('tm140811', 38954), 'sperre')
pruefe('Sperre bei der Nachfrage: alter Befund unverändert', gesperrt.geprueftAm === '2026-11-11' && !gesperrt.verfehltAm && gesperrt.jwId === 'tm140811', gesperrt)
const { befund: anders } = await lauf(900106, 38954, alterBefund('tm140811', 38954), 'andere-kennung')
pruefe('Nachfrage mit anderer Kennung: nicht übernommen, alte Antwort bleibt mit verfehltAm', anders.jwId === 'tm140811' && anders.verfehltAm === '2026-11-19', anders)

process.chdir(tmpdir())
rmSync(wurzel, { recursive: true, force: true, maxRetries: 3 })
console.log(`check-jw-verfehlt-nachfrage: ${geprueft} Prüfungen, ${fehler} Fehler`)
process.exit(fehler ? 1 : 0)
