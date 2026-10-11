/**
 * Holt `robots.txt` von www.anisearch.de und cdn.anisearch.de wörtlich nach `data/anisearch-robots.txt` und bricht ab (Exit 1), wenn der Cover-Pfad
 * `/images/anime/cover/` für alle User-Agents oder für uns gesperrt ist. Läuft als erster Schritt von `data:anisearch-cover` und nur in Actions
 * (kein Abruf bei aniSearch von Daniels Rechner, 11.10.2026). Aufruf: `npx tsx pipeline/fetch-anisearch-robots.ts`
 */
import { log, warn, writeText } from './lib/util.ts'
import { coverFrei, ROBOTS_HOSTS, UNSER_AGENT } from './lib/anisearch-robots.ts'

/** Ein Abschnitt je Host: Kopfzeile mit Status und Stand, darunter der Wortlaut unverändert. Ein Netzfehler zählt als Status 0. */
export async function holeRobots(abruf: typeof fetch = fetch, jetzt: Date = new Date()): Promise<string> {
  const teile: string[] = []
  for (const host of ROBOTS_HOSTS) {
    let status = 0
    let text = ''
    try {
      const antwort = await abruf(`https://${host}/robots.txt`, { headers: { 'user-agent': UNSER_AGENT } })
      status = antwort.status
      text = await antwort.text()
    } catch (fehler) {
      warn(`${host}/robots.txt: ${(fehler as Error).message}`)
    }
    teile.push(`### ${host} (HTTP ${status}) Stand ${jetzt.toISOString()}\n${text.replace(/\s+$/, '')}\n`)
  }
  return teile.join('\n')
}

async function main(): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) {
    warn('aniSearch-robots.txt: nur in GitHub Actions, nie von diesem Rechner (Daniel, 11.10.2026)')
    process.exit(1)
  }
  const datei = await holeRobots()
  writeText('data/anisearch-robots.txt', datei)
  const urteil = coverFrei(datei)
  if (!urteil.frei) {
    warn(`Cover-Lauf abgebrochen, nichts wird geladen: ${urteil.grund}. Wortlaut: data/anisearch-robots.txt`)
    process.exit(1)
  }
  log(urteil.grund)
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('fetch-anisearch-robots.ts')) await main()
