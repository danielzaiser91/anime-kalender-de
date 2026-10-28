/**
 * Der echte Ablauf von `fetch-adn.ts` gegen eine französische Antwort (Anlass: Lauf vom 28.10.2026, PR 2274, Prüfer-Befund 1 und 2).
 *
 * Das Skript läuft ganz durch (`AK_ROOT`-Kulisse, Attrappe `tools/adn-franzoesisch-mock.mjs`, Antwort = Fixture aus Commit 4b8f4c268):
 * Archiv, Katalog und Abfrage-Stand bleiben byte-gleich, die Bilanz zählt, mehr als MAX_VERWORFEN Verwerfungen färben den Exit-Code rot.
 * Das fängt, wenn ein Schreibweg die Verwerfung ignoriert oder die Bilanz in `main` nicht verdrahtet ist.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

type Video = { id: number; shortNumber: string; languages: string[] }
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/adn-franzoesisch-mock.mjs')).href
const ausschnitt = JSON.parse(readFileSync(join(wurzel, 'pipeline/fixtures/adn-sprachriegel-ausschnitt.json'), 'utf8')) as Record<
  string,
  { vorher: Video[]; nachher: Video[] }
>
// Teils vertont (ein Video ohne vde), sonst zählt `laufendeSerien` die Serie nicht als laufend.
const DEUTSCH: Video[] = [...ausschnitt['1375'].vorher, { id: 1, shortNumber: '0', languages: ['vostde'] }]
const FRANZ = ausschnitt['1375'].nachher

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const KATALOGSHOW = {
  showId: 1375,
  title: 'Dorohedoro',
  url: 'https://animationdigitalnetwork.com/de/video/1375',
  episodes: [{ date: '2026-01-01', time: '12:00', number: '1', title: 'Folge 1', id: 1 }],
  batch: false,
  fromCatalog: true,
}

/** Baut eine Kulisse (Archiv-Serien, Katalog) und lässt `fetch-adn.ts` mit `modus` laufen; liefert Ausgabe, Exit-Code und Dateistand davor/danach. */
function lauf(modus: string, archivIds: number[], liste: number[]) {
  const kulisse = mkdtempSync(join(tmpdir(), 'adn-franz-'))
  try {
    const archiv = join(kulisse, 'data', 'adn-raw')
    mkdirSync(archiv, { recursive: true })
    for (const id of archivIds) writeFileSync(join(archiv, `${id}.json.gz`), gzipSync(JSON.stringify({ showId: id, videos: DEUTSCH }), { level: 9 }))
    // Beim Laden liest `bau/grundlagen.ts` diese Handdateien; leer genügt.
    mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
    writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
    const katalogPfad = join(kulisse, 'data', 'adn-catalog.json')
    writeFileSync(katalogPfad, JSON.stringify({ scrapedAt: '', window: { from: '', to: '' }, shows: [KATALOGSHOW] }))
    const antwort = join(kulisse, 'antwort.json')
    writeFileSync(antwort, JSON.stringify(FRANZ))
    const stand = (): Record<string, Buffer> =>
      Object.fromEntries(readdirSync(archiv).map((d) => [d, readFileSync(join(archiv, d))]))
    const vorher = { archiv: stand(), katalog: readFileSync(katalogPfad) }
    const l = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-adn.ts'), modus], {
      cwd: wurzel,
      encoding: 'utf8',
      env: { ...process.env, AK_ROOT: kulisse, AK_ADN_ANTWORT: antwort, AK_ADN_LISTE: liste.join(',') },
    })
    const nachher = { archiv: stand(), katalog: readFileSync(katalogPfad) }
    const standDatei = join(kulisse, 'data', 'adn-katalog-stand.json')
    const abfrageStand = existsSync(standDatei) ? (JSON.parse(readFileSync(standDatei, 'utf8')) as Record<string, string>) : {}
    return { l, ausgabe: `${l.stdout}${l.stderr}`, vorher, nachher, abfrageStand }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}
const gleich = (a: Record<string, Buffer>, b: Record<string, Buffer>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => b[k]?.equals(a[k]))

console.log('ADN-Sammler: französische Antwort durch den ganzen Lauf\n')

// --laufend: sechs Archiv-Serien + eine neue Serie aus der Liste = sieben Verwerfungen > 5.
const laufend = lauf('--laufend', [2001, 2002, 2003, 2004, 2005, 2006], [1433])
pruefe('--laufend: Archiv bleibt byte-gleich', gleich(laufend.vorher.archiv, laufend.nachher.archiv))
pruefe('--laufend: neue Serie mit französischer Antwort legt kein Archiv an', !('1433.json.gz' in laufend.nachher.archiv))
pruefe('--laufend: Katalog bleibt byte-gleich', laufend.vorher.katalog.equals(laufend.nachher.katalog))
pruefe('--laufend: verworfene neue Serie steht nicht im Abfrage-Stand (kommt im nächsten Lauf wieder dran)', !('1433' in laufend.abfrageStand), laufend.abfrageStand)
pruefe('--laufend: Bilanz zählt sieben', laufend.ausgabe.includes('ADN-Sprachriegel: 7 Serien'), laufend.ausgabe.slice(-300))
pruefe('--laufend: mehr als fünf Verwerfungen färben den Lauf rot', laufend.l.status === 1, laufend.l.status)

// Genau eine Verwerfung bleibt grün.
const eine = lauf('--laufend', [2001], [])
pruefe('--laufend: eine Verwerfung zählt eins', eine.ausgabe.includes('ADN-Sprachriegel: 1 Serien'), eine.ausgabe.slice(-300))
pruefe('--laufend: eine Verwerfung lässt den Lauf grün', eine.l.status === 0, eine.l.status)
pruefe('--laufend: eine Verwerfung lässt das Archiv stehen', gleich(eine.vorher.archiv, eine.nachher.archiv))

// --refresh: der bekannte Katalogeintrag bleibt stehen.
const refresh = lauf('--refresh', [], [])
const nachRefresh = (JSON.parse(refresh.nachher.katalog.toString()) as { shows: unknown[] }).shows
pruefe('--refresh: Katalogeintrag bleibt unverändert', JSON.stringify(nachRefresh) === JSON.stringify([KATALOGSHOW]), nachRefresh)
pruefe('--refresh: Bilanz zählt eins', refresh.ausgabe.includes('ADN-Sprachriegel: 1 Serien'), refresh.ausgabe.slice(-300))

// --catalog: Serie aus Liste und Archiv; weder Archiv noch Katalog noch Stand ändern sich.
const katalog = lauf('--catalog', [1375], [1433])
const nachKatalog = (JSON.parse(katalog.nachher.katalog.toString()) as { shows: unknown[] }).shows
pruefe('--catalog: Archiv bleibt byte-gleich, keine neue Datei', gleich(katalog.vorher.archiv, katalog.nachher.archiv))
pruefe('--catalog: der alte Katalogeintrag der verworfenen Serie bleibt, es kommt nichts Neues dazu', JSON.stringify(nachKatalog) === JSON.stringify([KATALOGSHOW]), nachKatalog)
pruefe('--catalog: verworfene Serien stehen nicht im Abfrage-Stand', !('1433' in katalog.abfrageStand) && !('1375' in katalog.abfrageStand), katalog.abfrageStand)
pruefe('--catalog: Bilanz zählt zwei', katalog.ausgabe.includes('ADN-Sprachriegel: 2 Serien'), katalog.ausgabe.slice(-400))

console.log()
if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
