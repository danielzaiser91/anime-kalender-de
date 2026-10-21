/**
 * **Meldungen offizieller Anime-Websites sammeln** (Daniel, 12.10.2026: Die Website eines Titels gilt als offiziell, wenn die Trailer-Beschreibung sie verlinkt;
 * ihre Meldungen zählen als Quelle). Liest die News-Listen der Hosts aus `data/offizielle-seiten.yaml` höflich (robots.txt, Crawl-delay, 2 s Takt, kleine Blöcke),
 * wählt mit dem Relevanzfilter die Meldungen zu Termin, Synchro, Staffel oder Ausstrahlung und schreibt sie als **Vorschläge** nach
 * `data/proposals/offizielle-news.json`. Nichts geht ohne Freigabe in den Bestand.
 *
 * Zwei Stufen je Lauf: erst Feed, WordPress-REST und JSON (ein Abruf, Felder), dann die HTML-Listen. Rohantworten liegen unter `data/cache/offizielle-news/`.
 *
 * Aufruf: `npx tsx pipeline/fetch-offizielle-news.ts [--hosts a.de,b.jp] [--grenze 30] [--frist 25] [--aus-cache] [--trocken]`
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { mitCache, mitTakt, netzHoler, nurCache } from './lib/offiziell-abruf.ts'
import { lauf } from './lib/offiziell-lauf.ts'
import { STAND_DATEI, VORSCHLAG_DATEI } from './lib/offiziell-pfade.ts'
import { ladeSeiten, titelJeHost, type TitelJahre } from './lib/offiziell-seiten.ts'
import type { Stand } from './lib/offiziell-stand.ts'
import { fuehreZusammen, type Vorschlagsdatei } from './lib/offiziell-vorschlaege.ts'
import { todayIso } from '../shared/time.ts'

const wert = (name: string, vorgabe: string): string => (process.argv.includes(name) ? (process.argv[process.argv.indexOf(name) + 1] ?? vorgabe) : vorgabe)
const hat = (name: string): boolean => process.argv.includes(name)

function titelJahre(): TitelJahre {
  const titel = readJson<{ id: number; jpYear?: number | null }[]>('public/data/titles.json', [])
  return Object.fromEntries(titel.flatMap((t) => (t.jpYear ? [[String(t.id), t.jpYear]] : [])))
}

async function main(): Promise<void> {
  const seiten = ladeSeiten()
  const stand = readJson<Stand>(STAND_DATEI, { hosts: {} })
  const titel = titelJeHost(readJson('data/anisearch.json', {}), titelJahre())
  const holer = mitTakt(hat('--aus-cache') ? nurCache() : mitCache(netzHoler()), hat('--aus-cache') ? 0 : 2000, sleep)
  const genannt = wert('--hosts', '')
  const ergebnis = await lauf(
    seiten,
    stand,
    titel,
    { jetzt: new Date(), grenze: Number(wert('--grenze', '30')), ende: Date.now() + Number(wert('--frist', '25')) * 60_000, uhr: Date.now, hosts: genannt ? genannt.split(',') : undefined },
    holer,
    sleep,
  )
  for (const z of ergebnis.zeilen) log(z)
  if (ergebnis.uebrig) warn(`Frist erreicht — ${ergebnis.uebrig} Hosts kommen beim nächsten Lauf dran.`)
  const datei = readJson<Vorschlagsdatei>(VORSCHLAG_DATEI, { vorschlaege: [] })
  const zusammen = fuehreZusammen(datei.vorschlaege, ergebnis.neu, todayIso())
  log(`Summe: ${ergebnis.zeilen.length} Hosts, ${ergebnis.gelesen} Meldungen gelesen, ${ergebnis.neu.length} relevant, ${zusammen.length - datei.vorschlaege.length} neu in der Vorschlagsdatei`)
  writeJson(STAND_DATEI, ergebnis.stand, true)
  if (!hat('--trocken')) writeJson(VORSCHLAG_DATEI, { vorschlaege: zusammen }, true)
}

await main()
