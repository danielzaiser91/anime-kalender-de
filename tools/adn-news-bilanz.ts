/**
 * ADN-News-Zuordnungsbilanz: welche Serie (ADN-Kennung) bekommt mit der heutigen Auswahlregel welchen Artikel,
 * verglichen mit einem früheren Stand von `data/adn-news.json`. Je Serie eine Zeile: neu, weg, anders, gleich.
 * Der Lauf legt keine Rohantworten ab; die Beiträge kommen aus einer Datei (WordPress-Antwort als JSON-Liste)
 * oder per `--abrufen` aus derselben Schnittstelle wie `pipeline/lib/adn-news.ts` (ADN-API, kein aniSearch).
 * Aufruf: npx tsx tools/adn-news-bilanz.ts (<beitraege.json> | --abrufen) (<alt.json> | git:<ref>) [--gleich]
 *   `git:<ref>` liest `data/adn-news.json` aus dem Stand <ref> (z. B. git:origin/main~20).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  POSTS_API,
  SEITEN,
  artikelJeShow,
  auswahlAusBeitraegen,
  type AdnNews,
  type WpPost,
} from '../pipeline/lib/adn-news.ts'

export type Klasse = 'neu' | 'weg' | 'anders' | 'gleich'
export interface Zeile {
  showId: number
  klasse: Klasse
  alt?: string
  neu?: string
}

/** Vergleicht je Serienkennung den gewählten Artikel (spezifischster, `artikelJeShow`) in beiden Ständen. */
export function bilanz(alt: AdnNews | null, neu: AdnNews | null): Zeile[] {
  const a = artikelJeShow(alt)
  const n = artikelJeShow(neu)
  const ids = [...new Set([...a.keys(), ...n.keys()])].sort((x, y) => x - y)
  return ids.map((showId) => {
    const urlAlt = a.get(showId)?.url
    const urlNeu = n.get(showId)?.url
    const klasse: Klasse = !urlAlt ? 'neu' : !urlNeu ? 'weg' : urlAlt === urlNeu ? 'gleich' : 'anders'
    return { showId, klasse, alt: urlAlt, neu: urlNeu }
  })
}

/** Druckzeilen: Zählzeile zuerst, dann je Serie eine Zeile (gleiche nur mit `mitGleich`). */
export function zeilenDrucken(zeilen: Zeile[], verworfen: number, mitGleich: boolean): string[] {
  const zaehl = (k: Klasse) => zeilen.filter((z) => z.klasse === k).length
  const kopf = `ADN-News-Bilanz: ${zaehl('neu')} neu, ${zaehl('weg')} weg, ${zaehl('anders')} anders, ${zaehl('gleich')} gleich; ${verworfen} Serienverweise verworfen`
  const einzeln = zeilen
    .filter((z) => mitGleich || z.klasse !== 'gleich')
    .map((z) => `${z.klasse} ${z.showId} alt=${z.alt ?? '-'} neu=${z.neu ?? '-'}`)
  return [kopf, ...einzeln]
}

/** Neuer Stand aus rohen Beiträgen (feste Zeit über `geholtAm`, kein Uhrzugriff). */
export function standAusBeitraegen(beitraege: WpPost[], geholtAm: string): { stand: AdnNews; verworfen: number } {
  const { artikel, verworfen } = auswahlAusBeitraegen(beitraege)
  return { stand: { geholtAm, artikel }, verworfen }
}

/** Alter Stand: Dateipfad oder `git:<ref>` (liest `data/adn-news.json` aus dem Stand im Repo `repo`). */
export function leseAlt(quelle: string, repo: string): AdnNews | null {
  if (!quelle.startsWith('git:')) return JSON.parse(readFileSync(quelle, 'utf8')) as AdnNews
  const text = execFileSync('git', ['-C', repo, 'show', `${quelle.slice(4)}:data/adn-news.json`], {
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  return JSON.parse(text) as AdnNews
}

async function holeBeitraege(): Promise<WpPost[]> {
  const alle: WpPost[] = []
  for (let page = 1; page <= SEITEN; page++) {
    const res = await fetch(`${POSTS_API}?per_page=100&page=${page}&_fields=link,date,title,content`, {
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`ADN-News Seite ${page}: HTTP ${res.status}`)
    alle.push(...((await res.json()) as WpPost[]))
  }
  return alle
}

async function main(argv: string[]): Promise<number> {
  const args = argv.filter((a) => !a.startsWith('--') || a === '--abrufen')
  const [beitraegeArg, altArg] = args
  if (!beitraegeArg || !altArg) {
    console.error('Aufruf: npx tsx tools/adn-news-bilanz.ts (<beitraege.json> | --abrufen) (<alt.json> | git:<ref>) [--gleich]')
    return 2
  }
  const beitraege =
    beitraegeArg === '--abrufen' ? await holeBeitraege() : (JSON.parse(readFileSync(beitraegeArg, 'utf8')) as WpPost[])
  const alt = leseAlt(altArg, process.cwd())
  const { stand, verworfen } = standAusBeitraegen(beitraege, alt?.geholtAm ?? '')
  for (const z of zeilenDrucken(bilanz(alt, stand), verworfen, argv.includes('--gleich'))) console.log(z)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main(process.argv.slice(2)))
