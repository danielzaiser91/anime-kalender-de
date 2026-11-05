/**
 * Zusicherungen zu `lib/adn-laufend-archiv.ts` und zur Warnzeile in `check-adn-anisearch.ts` (30.10.2026).
 *
 * 1. `--laufend` fragt eine Archivserie neu, wenn die ADN-Liste `vde` nennt und das Archiv keine deutsche Folge kennt (Anlass: Dreamland, ADN 887).
 *    Der Lauf geht ganz durch (`AK_ROOT`-Kulisse, Attrappe `tools/adn-franzoesisch-mock.mjs`); fremde Archivdateien bleiben byte-gleich.
 * 2. Die Warnzeile „Kalenderserien ohne Katalog und Liste“ erscheint im echten Skript, wenn eine Kalenderserie fehlt, und fehlt, wenn keine fehlt.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { listeNenntNeuesVde } from './lib/adn-laufend-archiv.ts'
import { kalenderLueckenZeile } from './lib/adn-anisearch.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/adn-franzoesisch-mock.mjs')).href

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('Auswahl aus Liste und Archivstand:')
const mitVde = { id: 1, title: 'A', languages: ['vostde', 'vde'] }
pruefe('Liste nennt vde, Archiv kennt keine deutsche Folge: fragen', listeNenntNeuesVde(mitVde, 0))
pruefe('Liste nennt vde, Archiv kennt genau eine deutsche Folge: nicht zusätzlich fragen', !listeNenntNeuesVde(mitVde, 1))
pruefe('Liste nennt vde, Archiv kennt mehrere deutsche Folgen: nicht zusätzlich fragen', !listeNenntNeuesVde(mitVde, 12))
pruefe('Liste nennt kein vde: nicht fragen', !listeNenntNeuesVde({ id: 1, title: 'A', languages: ['vostde', 'vostf'] }, 0))
pruefe('Eintrag ohne Sprachen: nicht fragen', !listeNenntNeuesVde({ id: 1, title: 'A' }, 0))
pruefe('Serie nicht in der Liste: nicht fragen', !listeNenntNeuesVde(undefined, 0))

console.log('\nWarnzeile Kalenderlücken:')
const zeile = kalenderLueckenZeile([{ showId: 7, title: 'Sieben' }, { showId: 9, title: 'Neun' }], 40)
pruefe('keine Lücke: keine Zeile', kalenderLueckenZeile([], 40) === undefined)
pruefe('eine Lücke: Zeile mit Zahl, Gesamtzahl, Kennung und Titel', kalenderLueckenZeile([{ showId: 7, title: 'Sieben' }], 40)?.startsWith('::warning::ADN-Kalender: 1 von 40 Serien') === true && kalenderLueckenZeile([{ showId: 7, title: 'Sieben' }], 40)?.endsWith(': 7 Sieben') === true)
pruefe('zwei Lücken: beide Serien, mit Semikolon getrennt', zeile?.startsWith('::warning::ADN-Kalender: 2 von 40 Serien') === true && zeile.endsWith(': 7 Sieben; 9 Neun'), zeile)

/** Das echte Skript `check-adn-anisearch.ts` in einem Wegwerf-Ordner mit Kopien der drei Datendateien; `kalender` ersetzt `data/adn.json`. */
function pruefskript(kalender: { showId: number; title: string }[]): string {
  const ordner = mkdtempSync(join(tmpdir(), 'adn-luecken-'))
  try {
    mkdirSync(join(ordner, 'data', 'curated'), { recursive: true })
    writeFileSync(join(ordner, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
    for (const d of ['adn-catalog.json', 'adn-anisearch-offen.json', 'ankuendigungen.yaml']) copyFileSync(join(wurzel, 'data', d), join(ordner, 'data', d))
    writeFileSync(join(ordner, 'data', 'adn.json'), JSON.stringify({ scrapedAt: '', window: { from: '', to: '' }, shows: kalender }))
    const l = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-adn-anisearch.ts')], { cwd: ordner, encoding: 'utf8' })
    return `${l.stdout}${l.stderr}`
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
const mitLuecke = pruefskript([{ showId: 900001, title: 'Testserie Lücke' }])
pruefe('Skript: Kalenderserie ohne Katalog und Liste löst die Warnzeile aus', mitLuecke.includes('::warning::ADN-Kalender: 1 von 1 Serien weder im Katalog noch auf der Liste der offenen: 900001 Testserie Lücke'), mitLuecke.slice(-400))
pruefe('Skript: Zähl-Schlusszeile nennt die Lücke', mitLuecke.includes('Kalenderserien ohne Katalog und Liste: 1'))
const ohneLuecke = pruefskript([])
pruefe('Skript: ohne Lücke keine Warnzeile, Skript läuft bis zum Ende', !ohneLuecke.includes('::warning::') && ohneLuecke.includes('check-adn-anisearch: ok'), ohneLuecke.slice(-300))

console.log('\n--laufend im ganzen Ablauf:')
const ALT = [{ id: 1, shortNumber: '1', type: 'EPS', releaseDate: '2020-01-01T00:00:00Z', languages: ['vostde'] }]
const NEU = [{ id: 1, shortNumber: '1', type: 'EPS', releaseDate: '2020-01-01T00:00:00Z', languages: ['vostde', 'vde'] }]
/** Archivdateien vor und nach einem Lauf; `liste` = alle Kennungen der ADN-Liste, `mitVdeListe` = die davon mit `vde`. */
function laufend(archiv: Record<number, unknown[]>, liste: number[], mitVdeListe: number[], start: { shows: unknown[]; offen: unknown[] } = { shows: [], offen: [] }) {
  const ordner = mkdtempSync(join(tmpdir(), 'adn-laufend-'))
  try {
    const dir = join(ordner, 'data', 'adn-raw')
    mkdirSync(dir, { recursive: true })
    mkdirSync(join(ordner, 'data', 'curated'), { recursive: true })
    writeFileSync(join(ordner, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
    writeFileSync(join(ordner, 'data', 'adn-catalog.json'), JSON.stringify({ scrapedAt: '', window: { from: '', to: '' }, shows: start.shows }))
    if (start.offen.length) writeFileSync(join(ordner, 'data', 'adn-anisearch-offen.json'), JSON.stringify({ anzahl: start.offen.length, serien: start.offen }))
    for (const [id, videos] of Object.entries(archiv)) writeFileSync(join(dir, `${id}.json.gz`), gzipSync(JSON.stringify({ showId: Number(id), videos })))
    const antwort = join(ordner, 'antwort.json')
    writeFileSync(antwort, JSON.stringify(NEU))
    const l = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-adn.ts'), '--laufend'], {
      cwd: wurzel,
      encoding: 'utf8',
      env: { ...process.env, AK_ROOT: ordner, AK_ADN_ANTWORT: antwort, AK_ADN_LISTE: liste.join(','), AK_ADN_LISTE_VDE: mitVdeListe.join(',') },
    })
    const gelesen = (d: string) => (JSON.parse(gunzipSync(readFileSync(join(dir, d))).toString()) as { videos: unknown[] }).videos
    const videos = Object.fromEntries(readdirSync(dir).map((d) => [Number(d.split('.')[0]), gelesen(d)]))
    const offenDatei = join(ordner, 'data', 'adn-anisearch-offen.json')
    const offen = existsSync(offenDatei) ? (JSON.parse(readFileSync(offenDatei, 'utf8')) as { serien: { showId: number; grund: string }[] }).serien : undefined
    const katalog = (JSON.parse(readFileSync(join(ordner, 'data', 'adn-catalog.json'), 'utf8')) as { shows: { showId: number; anisearchId?: number }[] }).shows
    return { l, ausgabe: `${l.stdout}${l.stderr}`, videos, offen, katalog }
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}
// 3001: Liste nennt vde, Archiv nicht → wird gefragt. 3002: Liste ohne vde → bleibt. 3003: Archiv kennt vde schon (alt, vollständig vertont) → bleibt.
const r = laufend({ 3001: ALT, 3002: ALT, 3003: NEU }, [3001, 3002, 3003], [3001, 3003])
pruefe('Lauf endet mit Exit 0', r.l.status === 0, r.ausgabe.slice(-400))
pruefe('Archivserie mit vde in der Liste und ohne deutsche Folge im Archiv wird neu gefragt', JSON.stringify(r.videos[3001]) === JSON.stringify(NEU), r.videos[3001])
pruefe('Archivserie, deren Liste kein vde nennt, bleibt unberührt', JSON.stringify(r.videos[3002]) === JSON.stringify(ALT), r.videos[3002])
pruefe('Archivserie mit bekanntem vde bleibt unberührt', JSON.stringify(r.videos[3003]) === JSON.stringify(NEU))
pruefe('Die Logzeile zählt genau eine laufende Serie', r.ausgabe.includes('ADN: 1 laufende Serien werden aufgefrischt'), r.ausgabe.slice(-400))

// 3004 steht in der Liste, aber weder im Katalog noch im Archiv: kommt in den Katalog und muss sofort in der Liste der offenen stehen (ohne Titelliste: „titelliste-fehlt“).
const neu = laufend({ 3001: ALT }, [3001, 3004], [3001, 3004])
pruefe('Neue Serie: Lauf endet mit Exit 0', neu.l.status === 0, neu.ausgabe.slice(-400))
pruefe('Neue Serie: Katalog nahm sie auf', neu.ausgabe.includes('1 neue Serien mit deutscher Fassung im Katalog'), neu.ausgabe.slice(-400))
pruefe('Neue Serie: steht in der Liste der offenen', JSON.stringify(neu.offen?.map((o) => o.showId)) === '[3004]', neu.offen)

// Bestand: 3001 mit Kennung, 3005 ohne Kennung und schon in der Liste der offenen. Beide bleiben unverändert, 3004 kommt zu beiden Dateien dazu.
const bestand = {
  shows: [
    { showId: 3001, title: 'Alt mit Kennung', episodes: [], anisearchId: 777 },
    { showId: 3005, title: 'Alt ohne Kennung', episodes: [] },
  ],
  offen: [{ showId: 3005, title: 'Alt ohne Kennung', grund: 'kein-kandidat', kandidaten: [] }],
}
const mitBestand = laufend({ 3001: ALT }, [3001, 3004, 3005], [3001, 3004], bestand)
pruefe('Bestand: Lauf endet mit Exit 0', mitBestand.l.status === 0, mitBestand.ausgabe.slice(-400))
pruefe('Bestand: Katalog hat 3001, 3005 und 3004', JSON.stringify(mitBestand.katalog.map((s) => s.showId)) === '[3001,3005,3004]', mitBestand.katalog)
pruefe('Bestand: 3001 behält seine Kennung, 3005 und 3004 haben keine', JSON.stringify(mitBestand.katalog.map((s) => s.anisearchId ?? null)) === '[777,null,null]', mitBestand.katalog)
pruefe('Bestand: Liste der offenen führt alte 3005 (Grund bleibt) und neue 3004', JSON.stringify(mitBestand.offen?.map((o) => [o.showId, o.grund])) === '[[3004,"titelliste-fehlt"],[3005,"kein-kandidat"]]', mitBestand.offen)

if (fehler) process.exit(1)
console.log('\ncheck-adn-laufend-archiv: ok')
