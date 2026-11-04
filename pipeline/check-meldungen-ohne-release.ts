/**
 * Wächter „Meldung mit Termin und deutschem Ton ohne Release“ (Ziel 0): Eine Meldung, die Anime2You vor mehr als zwei Tagen mit Tag und
 * deutschem Ton brachte und die kein Release wurde, steht in `data/proposals/nicht-zugeordnet.json` (Bau, `bau/08-news-tv.ts`). Die
 * Zahl darf nur sinken: `GRENZE` ist der Stand vom 04.11.2026 und wird mit jedem erledigten Fall gesenkt, nie angehoben.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { ueberfaelligOhneRelease } from './lib/meldungen-ohne-release.ts'
import type { NichtZugeordnet } from './lib/sammel-unzugeordnet.ts'

const GRENZE = 13

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const e = (artikel: string): NichtZugeordnet => ({ titel: 'T', artikel, tag: '2026-11-03', anbieter: ['netflix'], quelle: 'Einzelartikel' })

function faelle(): void {
  const tage = new Map([['a', '2026-11-01'], ['b', '2026-10-31'], ['c', '2026-11-04']])
  const heute = '2026-11-03'
  const liste = [e('a'), e('b'), e('c'), e('ohne-datum')]
  const urls = ueberfaelligOhneRelease(liste, tage, heute).map((b) => b.eintrag.artikel)
  pruefe('genau zwei Tage alt (01.11. bei Stand 03.11.) ist noch nicht überfällig', !urls.includes('a'), urls)
  pruefe('drei Tage alt (31.10.) ist überfällig', urls.includes('b'), urls)
  pruefe('jünger als der Stand (04.11.) ist nicht überfällig', !urls.includes('c'), urls)
  pruefe('ohne bekannten Meldetag gilt als überfällig (fail closed)', urls.includes('ohne-datum'), urls)
  pruefe('leere Liste: nichts überfällig', ueberfaelligOhneRelease([], tage, heute).length === 0)
}

function echteDaten(): number {
  const datei = JSON.parse(readFileSync(join(wurzel, 'data/proposals/nicht-zugeordnet.json'), 'utf8')) as { stand: string; eintraege: NichtZugeordnet[] }
  const vorschlaege = (JSON.parse(readFileSync(join(wurzel, 'data/proposals/anime2you.json'), 'utf8')) as { proposals: { articleUrl: string; publishedAt: string }[] }).proposals
  const tage = new Map(vorschlaege.map((v) => [v.articleUrl, v.publishedAt]))
  const alt = ueberfaelligOhneRelease(datei.eintraege, tage, datei.stand)
  console.log(`Meldungen mit Termin und deutschem Ton ohne Release, älter als 2 Tage: ${alt.length} (Stand ${datei.stand}, Grenze ${GRENZE}, Ziel 0; ohne Meldetag: ${alt.filter((b) => !b.gemeldetAm).length})`)
  for (const b of alt) console.log(`  - ${b.eintrag.titel} (${b.eintrag.anbieter.join('/')}, Tag ${b.eintrag.tag}, gemeldet ${b.gemeldetAm ?? '?'})`)
  return alt.length
}

function main(): number {
  faelle()
  const n = echteDaten()
  pruefe(`Zahl überfälliger Meldungen ohne Release (${n}) nicht über der Grenze ${GRENZE}`, n <= GRENZE)
  if (n < GRENZE) console.log(`  Hinweis: ${n} < ${GRENZE} — GRENZE in dieser Datei senken.`)
  console.log(fehler ? `✖ ${fehler} Fehler` : '✓ check-meldungen-ohne-release')
  return fehler ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) process.exit(main())
