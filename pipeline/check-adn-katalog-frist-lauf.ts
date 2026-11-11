/**
 * Der echte Ablauf von `fetch-adn.ts --catalog` mit Ablauffrist für leere Antworten und Schwund-Wache (Vorschlag Bauer 3296, 09.11.2026).
 *
 * Kulisse wie `check-adn-sprachriegel-lauf.ts` (`AK_ROOT`, Attrappe `tools/adn-franzoesisch-mock.mjs`): ein Katalog mit 20 Serien, nur die
 * ältesten (`--limit`) werden gefragt, die übrigen tragen einen frischen Stempel. Fragen: bleibt die Serie, was steht im Zähler
 * `adn-leer-folge.json`, wie endet der Lauf (Exit-Code, Logzeile).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Video = { id: number; shortNumber: string; languages: string[]; releaseDate: string }
const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/adn-franzoesisch-mock.mjs')).href
const DEUTSCH: Video[] = [{ id: 1, shortNumber: '1', languages: ['vostde', 'vde'], releaseDate: '2026-01-01T10:00:00+01:00' }]

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ALLE = Array.from({ length: 20 }, (_, i) => 6001 + i)
const show = (showId: number) => ({
  showId,
  title: `Serie ${showId}`,
  url: `https://animationdigitalnetwork.com/de/video/${showId}`,
  episodes: [{ date: '2026-01-01', time: '12:00', number: '1', title: 'Folge 1', id: 1 }],
  batch: false,
  fromCatalog: true,
})

/** Fragt die ersten `gefragt` Serien (die übrigen tragen einen frischen Stempel); `status` setzt Antworten je Kennung, `zaehler` ist der Zählerstand davor. */
function lauf(gefragt: number, status: string, zaehler?: Record<string, number>) {
  const kulisse = mkdtempSync(join(tmpdir(), 'adn-frist-'))
  try {
    mkdirSync(join(kulisse, 'data', 'curated'), { recursive: true })
    writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
    const katalog = join(kulisse, 'data', 'adn-catalog.json')
    writeFileSync(katalog, JSON.stringify({ scrapedAt: '', window: { from: '', to: '' }, shows: ALLE.map(show) }))
    const stand = Object.fromEntries(ALLE.slice(gefragt).map((id) => [String(id), '2999-12-31T00:00:00.000Z']))
    writeFileSync(join(kulisse, 'data', 'adn-katalog-stand.json'), JSON.stringify(stand))
    const zaehlerPfad = join(kulisse, 'data', 'adn-leer-folge.json')
    if (zaehler) writeFileSync(zaehlerPfad, JSON.stringify(zaehler))
    const antwort = join(kulisse, 'antwort.json')
    writeFileSync(antwort, JSON.stringify(DEUTSCH))
    const l = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-adn.ts'), '--catalog', '--limit', String(gefragt)], {
      cwd: wurzel,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, AK_ROOT: kulisse, AK_ADN_ANTWORT: antwort, AK_ADN_LISTE: ALLE.join(','), AK_ADN_LISTE_VDE: ALLE.join(','), AK_ADN_STATUS: status, AK_ADN_WIEDERHOLUNG_MS: '0' },
    })
    const ids = (JSON.parse(readFileSync(katalog, 'utf8')) as { shows: { showId: number }[] }).shows.map((s) => s.showId)
    const zaehlerNachher = existsSync(zaehlerPfad) ? (JSON.parse(readFileSync(zaehlerPfad, 'utf8')) as Record<string, number>) : undefined
    return { l, ausgabe: `${l.stdout}${l.stderr}`, ids, zaehlerNachher }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}
const laeuft = (r: ReturnType<typeof lauf>) => r.ausgabe.includes('ADN-Katalog:') && r.ausgabe.includes('Serien mit deutscher Synchro')

console.log('ADN-Katalog: Ablauffrist für leere Antworten und Schwund-Wache\n')

const a = lauf(1, '6001:404')
pruefe('erste leere Antwort: Lauf endet regulär', laeuft(a), a.ausgabe.slice(-400))
pruefe('erste leere Antwort: Serie bleibt, Katalog unverändert', a.ids.length === 20 && a.ids.includes(6001), a.ids)
pruefe('erste leere Antwort: Zähler 1', JSON.stringify(a.zaehlerNachher) === '{"6001":1}', a.zaehlerNachher)
pruefe('erste leere Antwort: Exit 0', a.l.status === 0, a.l.status)

const b = lauf(1, '6001:404', { '6001': 1, '6010': 1 })
pruefe('zweite leere Antwort in Folge: Lauf endet regulär', laeuft(b), b.ausgabe.slice(-400))
pruefe('zweite leere Antwort in Folge: Serie gestrichen, die übrigen 19 bleiben', b.ids.length === 19 && !b.ids.includes(6001), b.ids)
pruefe('zweite leere Antwort: Zähler der Gestrichenen verschwindet, nicht gefragte Serie behält ihren Stand', JSON.stringify(b.zaehlerNachher) === '{"6010":1}', b.zaehlerNachher)
pruefe('zweite leere Antwort: Laufprotokoll nennt Streichung mit Kennung', b.ausgabe.includes('ADN-Katalog: 1 Serien nach 2 leeren Antworten in Folge gestrichen (6001)'), b.ausgabe.slice(-600))
pruefe('Streichung bis genau 5 % Schwund (1 von 20): Exit 0', b.l.status === 0, b.l.status)

const c = lauf(1, '', { '6001': 1 })
pruefe('leer, dann voll: Serie bleibt', c.ids.length === 20 && c.ids.includes(6001), c.ids)
pruefe('leer, dann voll: Zähler zurück auf nichts', JSON.stringify(c.zaehlerNachher) === '{}', c.zaehlerNachher)

const d = lauf(1, '6001:500', { '6001': 1 })
pruefe('Abbruch (500) zwischen zwei leeren Antworten: Serie bleibt', d.ids.length === 20, d.ids)
pruefe('Abbruch (500): Zähler bleibt bei 1 (keine Auskunft)', JSON.stringify(d.zaehlerNachher) === '{"6001":1}', d.zaehlerNachher)

const e = lauf(2, '6001:404,6002:404', { '6001': 1, '6002': 1 })
pruefe('zwei Streichungen (10 % Schwund): nichts gestrichen, Katalog bleibt 20', e.ids.length === 20, e.ids)
pruefe('mehr als 5 % Schwund: Lauf rot', e.l.status === 1, e.l.status)
pruefe('mehr als 5 % Schwund: Laufprotokoll nennt Zahlen', e.ausgabe.includes('ADN-Katalog verlöre 2 von 20 Serien'), e.ausgabe.slice(-600))
pruefe('bei rot läuft der Zähler weiter (2), nichts Neues gestrichen', JSON.stringify(e.zaehlerNachher) === '{"6001":2,"6002":2}', e.zaehlerNachher)

// Gateway-Ausfall: alle 20 antworten im zweiten Lauf leer, der Katalog darf nicht verschwinden.
const alleLeer = lauf(20, ALLE.map((id) => `${id}:404`).join(','), Object.fromEntries(ALLE.map((id) => [String(id), 1])))
pruefe('alle leer im zweiten Lauf: Katalog bleibt 20', alleLeer.ids.length === 20, alleLeer.ids.length)
pruefe('alle leer im zweiten Lauf: Lauf rot', alleLeer.l.status === 1, alleLeer.l.status)

console.log()
if (fehler) {
  console.error(`${fehler} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('Alle Zusicherungen halten.')
console.log('VERSTÖSSE: 0')
