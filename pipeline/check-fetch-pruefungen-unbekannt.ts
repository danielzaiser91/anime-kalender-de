/**
 * Meldungen aus dem Kasten „Nicht auf der Prüfliste" (F109 = A, 07.11.2026) durch den echten Abholer `fetch-pruefungen.ts`,
 * als Prozess gegen eine Wegwerf-Wurzel (`AK_ROOT`) und eine Abruf-Attrappe (`tools/meldung-unbekannt-mock.mjs`).
 * Fünf Seiten tragen `unbekannt=1` in der Notiz: eindeutiger Name, mehrdeutiger Name, nur im Katalog ohne Synchro,
 * ohne jeden Treffer, Adresse schon im Bestand. Erwartet wird, dass keine verschwindet: jede ist zugeordnet oder steht
 * mit eigenem Grund in der Liste ohne Zuordnung, und das Protokoll zählt jeden Ausgang. Dieselbe Seite ohne Kennzeichen
 * bleibt bei der Standardzeile und taucht in der Zählung nicht auf.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-unbekannt-mock.mjs')).href
const fehler: string[] = []
const LISTE = 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md'

const seite = (kennung: string) => `https://www.amazon.de/dp/${kennung}`
const titel = (id: number, titleDe: string, streams: unknown[] = [], zusatz: object = {}) => ({ id, titleDe, format: 'TV', episodes: 12, streams, ...zusatz })
const BESTAND = [
  titel(900011, 'Kastenprobe Alpha'),
  titel(900021, 'Kastenprobe Beta'),
  titel(900022, 'Kastenprobe Beta'),
  titel(900041, 'Kastenprobe Delta', [{ platform: 'primevideo', url: seite('B0KASTEN04') }]),
  titel(900051, 'Kastenprobe Sigma'),
  titel(900052, 'Kastenprobe Sigma Zwei'),
  titel(900061, 'Kastenprobe Tau'),
  titel(900062, 'Kastenprobe Tau 2'),
  titel(900071, 'Kastenprobe Upsilon', [], { episodes: undefined, format: 'MOVIE' }),
]
const KATALOG = [{ id: 900031, titleEn: 'Kastenprobe Gamma', format: 'TV' }]

function zeile(nr: number, kennung: string, name: string, markiert: boolean, kennzeichen = 'unbekannt=1', folgen = 12) {
  return {
    id: 940000 + nr,
    plattform: 'primevideo',
    url: seite(kennung),
    sprachen: '["Deutsch"]',
    befund: 'dub',
    titel: name,
    folgen,
    folge_nr: 1,
    staffel: 1,
    staffeln: null,
    serientitel: null,
    notiz: `Amazon-Seite ${kennung}: alle 12 Folgen geprüft, Abos: keine Angabe${markiert ? ' — Staffel nicht im Bestand, Titel von der Seite gelesen, ' + kennzeichen : ''}, zugang=abo`,
    teil_von: null,
    teil_bis: null,
    gemeldet_am: '2026-11-07T10:00:00.000Z',
    seiten_kennung: kennung,
    titel_id: null,
    folge: null,
  }
}

function lauf(zeilen: unknown[]) {
  const tmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-unbekannt-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten/listen']) mkdirSync(join(tmp, ordner), { recursive: true })
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify(BESTAND))
    writeFileSync(join(tmp, 'public/data/franchises.json'), JSON.stringify({ 77: [{ id: 900061, name: 'Kastenprobe Tau', format: 'TV', jpStart: '2020-01-01' }, { id: 900062, name: 'Kastenprobe Tau 2', format: 'TV', jpStart: '2021-01-01' }] }))
    writeFileSync(join(tmp, 'public/data/cartoons.json'), '[]')
    writeFileSync(join(tmp, 'public/data/ohne-synchro-namen.json'), JSON.stringify(KATALOG))
    writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), '# leer\n')
    writeFileSync(join(tmp, 'meldungen.json'), JSON.stringify(zeilen))
    const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, LAUF_TOKEN: 'test', AK_ROOT: tmp, AK_MELDUNGEN: join(tmp, 'meldungen.json') },
    })
    const liste = existsSync(join(tmp, LISTE)) ? readFileSync(join(tmp, LISTE), 'utf8') : ''
    const ausgabe = `${r.stdout}\n${r.stderr}`
    if (r.status !== 0 || !ausgabe.includes('Prüfungen abgeholt')) fehler.push(`Lauf endete mit ${r.status}, ohne Schlusszeile: ${ausgabe.slice(-400)}`)
    return { ausgabe, liste }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

const reihe = [
  zeile(1, 'B0KASTEN01', 'Kastenprobe Alpha', true),
  /* Eine zweite Zeile derselben Seite ohne Kennzeichen: die Gruppe zählt, sobald eine Zeile es trägt, und nur einmal. */
  zeile(11, 'B0KASTEN01', 'Kastenprobe Alpha', false),
  zeile(2, 'B0KASTEN02', 'Kastenprobe Beta', true),
  zeile(3, 'B0KASTEN03', 'Kastenprobe Gamma', true),
  zeile(4, 'B0KASTEN05', 'Kastenprobe Epsilon', true),
  zeile(5, 'B0KASTEN04', 'Kastenprobe Delta', true),
  /* Ein Teil des Katalognamens ist kein Katalogtreffer (Gleichheit, nicht „enthält"). */
  zeile(8, 'B0KASTEN06', 'Kastenprobe Gamm', true),
  /* A1: exakter Name, aber die Seite passt nicht zum Titel: eine Folge gegen zwölf; Titel in einer Reihe; Film mit zwölf Folgen */
  zeile(13, 'B0KASTEN09', 'Kastenprobe Sigma', true, 'unbekannt=1', 1),
  zeile(16, 'B0KASTEN12', 'Kastenprobe Sigma Zwei', true, 'unbekannt=1', 30),
  zeile(14, 'B0KASTEN10', 'Kastenprobe Tau', true),
  zeile(15, 'B0KASTEN11', 'Kastenprobe Upsilon', true),
]
const markiert = lauf(reihe)
const ZAEHLZEILE = 'Unbekannte Prime-Seiten: 10 gemeldet — 1 über den Namen zugeordnet, 1 über die Adresse, 5 mehrdeutig, 1 im Katalog ohne Synchro, 2 ohne Treffer'
if (!markiert.ausgabe.split('\n').some((z) => z.endsWith(ZAEHLZEILE))) fehler.push(`Zählzeile fehlt oder weicht ab: ${markiert.ausgabe.split('\n').filter((z) => z.includes('Unbekannte Prime')).join(' | ') || '(keine)'}`)
const liste = markiert.liste.split('\n')
const zeileZu = (kennung: string) => liste.find((z) => z.includes(seite(kennung))) ?? ''
if (zeileZu('B0KASTEN01') || zeileZu('B0KASTEN04')) fehler.push('eindeutiger Name und bekannte Adresse gehören nicht in die Liste ohne Zuordnung')
if (!zeileZu('B0KASTEN02').includes('Mehrere oder nur ähnliche Treffer') || !zeileZu('B0KASTEN02').includes('900021') || !zeileZu('B0KASTEN02').includes('900022')) fehler.push(`mehrdeutig: Grund oder Vorschläge fehlen: ${zeileZu('B0KASTEN02')}`)
if (!zeileZu('B0KASTEN03').includes('Titel steht im Katalog ohne Synchro') || !zeileZu('B0KASTEN03').includes('900031')) fehler.push(`Katalog: Grund oder Vorschlag fehlen: ${zeileZu('B0KASTEN03')}`)
if (!zeileZu('B0KASTEN05').includes('Kein Treffer im Bestand')) fehler.push(`ohne Treffer: Grund fehlt: ${zeileZu('B0KASTEN05')}`)
const warnungen = markiert.ausgabe.split('\n').filter((z) => z.includes('im Datensatz nicht gefunden'))
if (warnungen.length !== 8) fehler.push(`acht Meldungen bleiben liegen, aber ${warnungen.length} Warnzeilen: ${warnungen.join(' | ')}`)
if (!zeileZu('B0KASTEN06').includes('Kein Treffer im Bestand')) fehler.push(`Teilname des Katalogtitels ist kein Katalogtreffer: ${zeileZu('B0KASTEN06')}`)
for (const [kennung, grund] of [['B0KASTEN09', 'Seite nennt 1 Folgen, der Titel hat 12'], ['B0KASTEN12', 'Seite nennt 30 Folgen, der Titel hat 12'], ['B0KASTEN10', 'Reihe mit 2 Einträgen'], ['B0KASTEN11', 'der Titel ist ein Film']]) {
  if (!zeileZu(kennung).includes('Name stimmt, aber') || !zeileZu(kennung).includes(grund)) fehler.push(`exakter Name, aber Seite passt nicht (${kennung}): ${zeileZu(kennung)}`)
}

/* Dieselben Seiten ohne Kennzeichen: Standardzeile, keine Zählung (die Erweiterung vor F109 meldete so). */
const unmarkiert = lauf([
  zeile(6, 'B0KASTEN02', 'Kastenprobe Beta', false),
  zeile(7, 'B0KASTEN05', 'Kastenprobe Epsilon', false),
  /* bekannte Adresse ohne Kennzeichen und eine fremde Zeichenfolge davor: beides zählt nicht als „unbekannt=1" */
  zeile(9, 'B0KASTEN04', 'Kastenprobe Delta', false),
  zeile(10, 'B0KASTEN07', 'Kastenprobe Zeta', true, 'xunbekannt=1'),
  /* … und eine längere Zahl dahinter */
  zeile(12, 'B0KASTEN08', 'Kastenprobe Eta', true, 'unbekannt=10'),
  /* A1 ohne Kennzeichen: die alte Regel gilt unverändert, exakter Name ordnet zu, auch bei 1 Folge gegen 12 */
  zeile(17, 'B0KASTEN13', 'Kastenprobe Sigma', false, 'unbekannt=1', 1),
])
if (unmarkiert.ausgabe.includes('Unbekannte Prime-Seiten')) fehler.push('ohne Kennzeichen darf nichts als „Unbekannte Prime-Seiten" gezählt werden')
if (unmarkiert.liste.includes(seite('B0KASTEN13'))) fehler.push('ohne Kennzeichen darf die Folgenzahl-Prüfung nicht greifen (alte Regel)')
const standard = unmarkiert.liste.split('\n').find((z) => z.includes(seite('B0KASTEN05'))) ?? ''
if (!standard.includes('Titel von Hand suchen') || standard.includes('Kein Treffer im Bestand')) fehler.push(`ohne Kennzeichen bleibt die Standardzeile: ${standard}`)

if (fehler.length) {
  console.error(`check-fetch-pruefungen-unbekannt: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log(`check-fetch-pruefungen-unbekannt: ${ZAEHLZEILE.replace('Unbekannte Prime-Seiten: ', '')}; ohne Kennzeichen Standardzeile und keine Zählung.`)
