/**
 * Tests für tools/pr-nachrechnen-bot-pfade.mjs: die Liste der Bot-Dateien ohne Leser in der PR-Kette (21.10.2026) und ihre Wirkung auf
 * `datenpfadAusnahme`. Die Liste steht hier fest eingetragen (nicht aus dem Modul gelesen); der Wächter am Ende sucht Leser im Bau.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { datenpfadAusnahme } from './pr-nachrechnen.mjs'
import { BOT_DATEIEN_OHNE_LESER } from './pr-nachrechnen-bot-pfade.mjs'
import { BEKANNT_DOKU, BEKANNT_TREFFER } from './pr-nachrechnen-bot-pfade-bekannt.mjs'
import { bauDateien, dokuLeser, kettenDateien, leserImBau } from './pr-nachrechnen-bot-pfade-leser.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}
const ausnahme = (dateien, prDateien = ['x.ts']) => datenpfadAusnahme({ status: 'ahead', anzahl: dateien.length, dateien }, prDateien)

const ERWARTET = [
  'daniel-zum-abarbeiten/00-START-HIER.md',
  'daniel-zum-abarbeiten/00-wache-auswertung.md',
  'daniel-zum-abarbeiten/listen/06-netflix-rest.md',
  'daniel-zum-abarbeiten/listen/07-adn.md',
  'daniel-zum-abarbeiten/listen/07-alle-anbieter.md',
  'daniel-zum-abarbeiten/listen/07-crunchyroll.md',
  'daniel-zum-abarbeiten/listen/07-disneyplus.md',
  'daniel-zum-abarbeiten/listen/07-joyn.md',
  'daniel-zum-abarbeiten/listen/07-netflix.md',
  'daniel-zum-abarbeiten/listen/07-primevideo.md',
  'daniel-zum-abarbeiten/listen/07-youtube.md',
  'daniel-zum-abarbeiten/listen/08-arbeitspakete.md',
  'daniel-zum-abarbeiten/listen/09-youtube-liste.md',
  'daniel-zum-abarbeiten/listen/10-rtlplus.md',
  'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md',
  'daniel-zum-abarbeiten/listen/12-verpasste-termine.md',
  'daniel-zum-abarbeiten/listen/15-news-vorschau.md',
  'daniel-zum-abarbeiten/listen/16-justwatch-tonspuren.md',
  'daniel-zum-abarbeiten/listen/17-vorfaelle.md',
  'daniel-zum-abarbeiten/listen/18-suchadressen.md',
  'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md',
  'daniel-zum-abarbeiten/listen/cover-ohne-tmdb.md',
  'daniel-zum-abarbeiten/listen/tmdb-staffel0-unsicher.md',
  'data/abruf-stempel.json',
  'data/anbieter-vorschlaege.json',
  'data/anisearch-folgen-raw',
  'data/anisearch-sprecher-raw',
  'data/ann-holstand.json',
  'data/ann-raw',
  'data/beleg-fehlschlaege.json',
  'data/bestand-historie.jsonl',
  'data/crunchyroll-woche-belege.json',
  'data/folgen-zuordnung.json',
  'data/imdb-ids.json',
  'data/kanal-widerspruch.json',
  'data/meldungen-uebernahme.json',
  'data/meldungen-zurueckgestellt.json',
  'data/meldungs-auffaelligkeiten.json',
  'data/motn-raw',
  'data/pillen-luecken.json',
  'data/prime-kanal-aussortiert.json',
  'data/proposals/anime2you-extraktion.json',
  'data/proposals/aussagen.json',
  'data/proposals/offizielle-news.json',
  'data/qualitaet-verlauf.json',
  'data/rtlplus-katalog.json',
  'data/sammelartikel-stand.json',
  'data/source-health.json',
  'data/tmdb-kino.json',
  'data/tmdb-poster-grund.json',
  'data/wiedervorlage.json',
  'data/wikidata-titel.json',
  'tools/kalender-plausibilitaet-grenzen.json',
]
// Ordner der Liste: Inhalt zählt, die Datei selbst gibt es nicht.
const ORDNER = ['data/anisearch-folgen-raw', 'data/anisearch-sprecher-raw', 'data/ann-raw', 'data/motn-raw']

pruefe('Liste: genau die gemessenen Einträge, keiner doppelt', JSON.stringify([...BOT_DATEIEN_OHNE_LESER]) === JSON.stringify(ERWARTET) && new Set(ERWARTET).size === ERWARTET.length, BOT_DATEIEN_OHNE_LESER.length)
pruefe('Liste: 53 Einträge', ERWARTET.length === 53, ERWARTET.length)

for (const eintrag of ERWARTET) {
  const innen = ORDNER.includes(eintrag) ? `${eintrag}/1.json.gz` : eintrag
  pruefe(`${eintrag}: nur diese bewegt -> Ausnahme gilt`, ausnahme([innen]) === null)
  pruefe(`${eintrag}: neben Fremdem (Mitte) -> keine Ausnahme`, ausnahme(['public/data/a.json', 'tools/x.mjs', innen]) === 'main bewegte tools/x.mjs')
  pruefe(`${eintrag}: PR berührt die Datei -> keine Ausnahme`, ausnahme(['public/data/a.json'], ['y.ts', innen]) === `der PR berührt ${innen}`)
  pruefe(`${eintrag}: ähnlicher Name davor/danach zählt`, ausnahme([`x${eintrag}`]) !== null && ausnahme([`${eintrag}-x`]) !== null && ausnahme([`${eintrag}x/a`]) !== null)
}

// Gelesene Bot-Dateien (Tabelle der PR-Beschreibung) und die ausdrücklich ausgeschlossenen Pfade bleiben draußen.
const GELESEN = [
  'data/crunchyroll.json', 'data/crunchyroll-woche.json', 'data/termine-verpasst.json', 'data/tv-programm.json', 'data/motn-changes.json',
  'data/cr-einzelwerke.json', 'data/dub-confirmed.yaml', 'data/adn-raw/561.json.gz', 'data/crunchyroll-raw/GG5H5XQMD.de.json.gz', 'data/anisearch-raw/1.html.gz',
  'daniel-zum-abarbeiten/listen/justwatch-widersprueche.md', 'daniel-zum-abarbeiten/stand.md', 'daniel-zum-abarbeiten/listen/07-neu.md',
  'docs/wissen/design-regeln.md', 'tools/design-klassen-grenzen.json', 'tools/umfang-grenzen.json', 'extension/offene-netflix.js', 'extension/offene-amazon.js', 'public/og/a.jpg',
]
for (const datei of GELESEN) pruefe(`gelesen/ausgeschlossen: ${datei} -> keine Ausnahme`, ausnahme([datei]) === `main bewegte ${datei}`)

// Wächter gegen Leser im Datenbau (pr-nachrechnen-bot-pfade-leser.mjs). Bekannt sind zwei Stellen, die den Namen nur nennen:
// nebendateien.ts schreibt 18-suchadressen.md; lib/health.ts schreibt source-health.json und wird vom Bau nur über adn-news.ts erreicht (Import von artikelJeShow).
const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
// Dazu die Prüfungen der Kette (kettenDateien): ihre Treffer (Wegwerf-Wurzeln, Verbotslisten) stehen mit Grund in pr-nachrechnen-bot-pfade-bekannt.mjs.
const BEKANNT = BEKANNT_TREFFER
pruefe('Wächter: 38 bekannte Treffer (3 Bau, 35 Kette), keine stille Vergrößerung der Liste', BEKANNT.size === 38, BEKANNT.size)
const bau = bauDateien(wurzel)
const kette = kettenDateien(wurzel)
pruefe('Wächter: sieht die Kette (Logik-Liste, Tests, Kettenworkflow)', kette.includes('pipeline/check-sammelartikel.ts') && kette.includes('tools/briefkasten-wache.test.mjs') && kette.includes('.github/workflows/pr-pruefung.yml') && !kette.includes('tools/pr-nachrechnen-bot-pfade.test.mjs') && kette.length > 350, kette.length)
pruefe('Wächter: kein Bau-Schritt nennt eine Datei der Liste (sonst ist sie gelesen und gehört gestrichen)', leserImBau(wurzel, ERWARTET, BEKANNT).length === 0, leserImBau(wurzel, ERWARTET, BEKANNT))
pruefe('Wächter: sieht den Bau samt lib (nicht leer gelaufen)', bau.length >= 580 && bau.length <= 700 && bau.includes('pipeline/lib/health.ts') && bau.includes('pipeline/bau/nebendateien.ts'), bau.length)
pruefe('Wächter: sieht beide bekannten Stellen', leserImBau(wurzel, ERWARTET, new Set()).sort().join() === [...BEKANNT].sort().join(), leserImBau(wurzel, ERWARTET, new Set()))
const importiertHealth = bau.filter((d) => /from '(\.\/|\.\.\/lib\/)health\.ts'/.test(fs.readFileSync(path.join(wurzel, d), 'utf8')))
pruefe('Ausnahme health.ts: im Bau importiert nur adn-news.ts sie', importiertHealth.join() === 'pipeline/lib/adn-news.ts', importiertHealth)
const adnImporte = bau.flatMap((d) => fs.readFileSync(path.join(wurzel, d), 'utf8').split('\n').filter((z) => /from '.*\/adn-news\.ts'/.test(z)).map((z) => `${d}: ${z.trim()}`))
pruefe('Ausnahme health.ts: adn-news.ts nutzt der Bau nur für artikelJeShow', adnImporte.join() === "pipeline/bau/07-adn.ts: import { artikelJeShow, type AdnNews } from '../lib/adn-news.ts'", adnImporte)

// Dokument-Wächter (dokuLeser): die Ausnahme für docs/, Wurzel-Markdown und 00-wache.md gilt nur, solange kein Bau-Code und keine Prüfung sie liest.
pruefe('Doku-Wächter: 24 bekannte Treffer (23 nur genannt, 1 liest), keine stille Vergrößerung', BEKANNT_DOKU.size === 24, BEKANNT_DOKU.size)
pruefe('Doku-Wächter: kein unbekannter Leser von docs/, Wurzel-Markdown oder 00-wache.md', dokuLeser(wurzel, BEKANNT_DOKU).length === 0, dokuLeser(wurzel, BEKANNT_DOKU))
pruefe('Doku-Wächter: sieht den Leser design-kontrast und die Nennungen', dokuLeser(wurzel, new Set()).length === 24 && dokuLeser(wurzel, new Set()).includes('tools/design-kontrast.mjs|docs/'), dokuLeser(wurzel, new Set()))
pruefe('Doku-Wächter: das gelesene Dokument steht nicht in der Ausnahme, ein anderes schon', ausnahme(['docs/wissen/design-regeln.md']) === 'main bewegte docs/wissen/design-regeln.md' && ausnahme(['docs/wissen/anderes.md']) === null)
const DOKU_BASIS = { 'pipeline/build.ts': "import { a } from './lib/a.ts'\n", 'pipeline/validate.ts': '', 'pipeline/check-ja-hat-weg-bestand.ts': '', 'pipeline/lib/a.ts': 'export const a = 1\n' }
const DOKU_FIXTURES = [
  ['kein Leser', {}, []],
  ['Leser von docs/ in lib', { 'pipeline/lib/a.ts': "readFileSync('docs/wissen/x.md')\n" }, ['pipeline/lib/a.ts|docs/']],
  ['Leser von Wurzel-Markdown in der Logik-Liste', { 'tools/check-logic-liste.txt': 'pipeline/check-x.ts\n', 'pipeline/check-x.ts': "readFileSync('ZIELE.md')\n" }, ['pipeline/check-x.ts|ZIELE.md']],
  ['Leser von 00-wache.md im Kettenworkflow', { '.github/workflows/pr-pruefung.yml': 'run: cat daniel-zum-abarbeiten/00-wache.md\n' }, ['.github/workflows/pr-pruefung.yml|00-wache.md']],
  ['nur im Kommentar', { 'pipeline/lib/a.ts': "// docs/x.md ZIELE.md\n * 00-wache.md\n" }, []],
  ['Test nennt es nur als Fixture', { 'tools/x.test.mjs': "const f = 'docs/a.md'\n" }, []],
  ['Datei außerhalb der Hülle', { 'pipeline/fetch-x.ts': "const f = 'docs/a.md'\n" }, []],
  ['Wurzel-Markdown ohne Datei im Wurzelordner zählt nicht', { 'pipeline/lib/a.ts': "const f = 'NEU.md'\n" }, []],
]
for (const [name, extra, erwartet] of DOKU_FIXTURES) {
  const ort = fixture({ ...DOKU_BASIS, 'ZIELE.md': '', ...extra })
  const treffer = dokuLeser(ort, new Set())
  fs.rmSync(ort, { recursive: true, force: true })
  pruefe(`Doku-Wächter-Fixture: ${name}`, JSON.stringify(treffer) === JSON.stringify(erwartet), treffer)
}
{
  const ort = fixture({ ...DOKU_BASIS, 'pipeline/lib/a.ts': "readFileSync('docs/x.md')\n" })
  const still = dokuLeser(ort, new Set(['pipeline/lib/a.ts|docs/']))
  fs.rmSync(ort, { recursive: true, force: true })
  pruefe('Doku-Wächter-Fixture: bekannte Stelle bleibt still', still.length === 0, still)
}

// Fixture-Wurzeln: der Wächter muss einen Leser in lib, im Bau, in shared und in web/src finden, aber weder Kommentare noch Dateien außerhalb der Hülle.
function fixture(dateien) {
  const ort = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-pfade-'))
  for (const [name, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(path.join(ort, name)), { recursive: true })
    fs.writeFileSync(path.join(ort, name), inhalt)
  }
  return ort
}
const BASIS = { 'pipeline/build.ts': "import { a } from './lib/a.ts'\n", 'pipeline/validate.ts': '', 'pipeline/check-ja-hat-weg-bestand.ts': '', 'pipeline/lib/a.ts': 'export const a = 1\n' }
const EINTRAEGE = ['data/wiedervorlage.json', 'daniel-zum-abarbeiten/listen/07-adn.md']
for (const [name, extra, erwartet] of [
  ['ohne Leser', {}, []],
  ['Leser in lib (von build.ts importiert)', { 'pipeline/lib/a.ts': "export const a = readFileSync('data/wiedervorlage.json')\n" }, ['pipeline/lib/a.ts|data/wiedervorlage.json']],
  ['Leser in lib über Zwischenschritt (zwei Importe tief)', { 'pipeline/lib/a.ts': "import './b.ts'\n", 'pipeline/lib/b.ts': "export const b = '07-adn.md'\n" }, ['pipeline/lib/b.ts|daniel-zum-abarbeiten/listen/07-adn.md']],
  ['Leser in pipeline/bau (von build.ts importiert)', { 'pipeline/build.ts': "import './bau/x.ts'\n", 'pipeline/bau/x.ts': "const f = 'data/wiedervorlage.json'\n" }, ['pipeline/bau/x.ts|data/wiedervorlage.json']],
  ['Leser in validate.ts', { 'pipeline/validate.ts': "const f = 'wiedervorlage.json'\n" }, ['pipeline/validate.ts|data/wiedervorlage.json']],
  ['Leser in check-ja-hat-weg-bestand.ts', { 'pipeline/check-ja-hat-weg-bestand.ts': "const f = 'wiedervorlage.json'\n" }, ['pipeline/check-ja-hat-weg-bestand.ts|data/wiedervorlage.json']],
  ['Leser in shared', { 'shared/x.ts': "export const f = 'wiedervorlage.json'\n" }, ['shared/x.ts|data/wiedervorlage.json']],
  ['Leser in web/src', { 'web/src/x.tsx': "export const f = 'wiedervorlage.json'\n" }, ['web/src/x.tsx|data/wiedervorlage.json']],
  ['verschachtelte Datei in shared/lib, von keinem Einstieg importiert', { 'shared/lib/x.ts': "export const f = 'wiedervorlage.json'\n" }, ['shared/lib/x.ts|data/wiedervorlage.json']],
  ['verschachtelte Datei in web/src/lib, von keinem Einstieg importiert', { 'web/src/lib/x.tsx': "export const f = 'wiedervorlage.json'\n" }, ['web/src/lib/x.tsx|data/wiedervorlage.json']],
  ['.mjs in shared', { 'shared/y.mjs': "export const f = 'wiedervorlage.json'\n" }, ['shared/y.mjs|data/wiedervorlage.json']],
  ['Import in Backticks (import(`./lib/b.ts`))', { 'pipeline/build.ts': 'await import(`./lib/b.ts`)\n', 'pipeline/lib/b.ts': "const f = 'wiedervorlage.json'\n" }, ['pipeline/lib/b.ts|data/wiedervorlage.json']],
  ['Leser in Skript der Logik-Liste', { 'tools/check-logic-liste.txt': '# Kopf\npipeline/check-x.ts\n', 'pipeline/check-x.ts': "readFileSync(join(ROOT, 'data/wiedervorlage.json'))\n" }, ['pipeline/check-x.ts|data/wiedervorlage.json']],
  ['Logik-Liste nennt einen Ordner (kein Absturz, kein Treffer)', { 'tools/check-logic-liste.txt': '# data/wiedervorlage.json\npipeline\n\n' }, []],
  ['Leser in tools/*.test.mjs', { 'tools/x.test.mjs': "readFileSync('data/wiedervorlage.json')\n" }, ['tools/x.test.mjs|data/wiedervorlage.json']],
  ['Leser in tools/*.test.ts', { 'tools/x.test.ts': "readFileSync('data/wiedervorlage.json')\n" }, ['tools/x.test.ts|data/wiedervorlage.json']],
  ['Name in der Kette (pr-pruefung.yml)', { '.github/workflows/pr-pruefung.yml': 'run: cat data/wiedervorlage.json\n' }, ['.github/workflows/pr-pruefung.yml|data/wiedervorlage.json']],
  ['yml: nur im #-Kommentar', { '.github/workflows/pr-pruefung.yml': '# data/wiedervorlage.json\n' }, []],
  ['pipeline/check-*.ts ohne Eintrag in der Logik-Liste (läuft nicht in der Kette)', { 'pipeline/check-y.ts': "readFileSync('data/wiedervorlage.json')\n" }, []],
  ['Leser in Workflow außerhalb der Kette', { '.github/workflows/bestand-bauen.yml': 'run: cat data/wiedervorlage.json\n' }, []],
  ['nur im Kommentar', { 'pipeline/lib/a.ts': "// liest wiedervorlage.json\n/* wiedervorlage.json */\n * wiedervorlage.json\n" }, []],
  ['Datei außerhalb der Hülle (Sammler)', { 'pipeline/fetch-x.ts': "const f = 'wiedervorlage.json'\n" }, []],
  ['Import ohne Dateiendung (./lib/c)', { 'pipeline/build.ts': "import './lib/c'\n", 'pipeline/lib/c.ts': "const f = 'wiedervorlage.json'\n" }, ['pipeline/lib/c.ts|data/wiedervorlage.json']],
  ['Import mit Ordner (./lib/ord -> index.ts)', { 'pipeline/build.ts': "import './lib/ord'\n", 'pipeline/lib/ord/index.ts': "const f = 'wiedervorlage.json'\n" }, ['pipeline/lib/ord/index.ts|data/wiedervorlage.json']],
  ['lib-Datei, die niemand importiert', { 'pipeline/lib/lose.ts': "const f = 'wiedervorlage.json'\n" }, []],
  ['bekannte Stelle bleibt still', { 'pipeline/lib/a.ts': "const f = 'wiedervorlage.json'\n" }, []],
]) {
  const ort = fixture({ ...BASIS, ...extra })
  const bekannt = name === 'bekannte Stelle bleibt still' ? new Set(['pipeline/lib/a.ts|data/wiedervorlage.json']) : new Set()
  const treffer = leserImBau(ort, EINTRAEGE, bekannt)
  fs.rmSync(ort, { recursive: true, force: true })
  pruefe(`Wächter-Fixture: ${name}`, JSON.stringify(treffer) === JSON.stringify(erwartet), treffer)
}

// Fehlt ein Einstieg (hier validate.ts), läuft der Wächter durch und führt ihn nicht in der Hülle.
{
  const ort = fixture({ 'pipeline/build.ts': "import './lib/a.ts'\n", 'pipeline/lib/a.ts': 'export const a = 1\n', 'shared/s.ts': '' })
  const hülle = bauDateien(ort)
  fs.rmSync(ort, { recursive: true, force: true })
  pruefe('Wächter-Fixture: fehlender Einstieg steht nicht in der Hülle', JSON.stringify(hülle) === JSON.stringify(['pipeline/build.ts', 'pipeline/lib/a.ts', 'shared/s.ts']), hülle)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-bot-pfade.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log(`pr-nachrechnen-bot-pfade.test: grün (${ERWARTET.length} Bot-Dateien ohne Leser, ${GELESEN.length} gelesene/ausgeschlossene bleiben draußen, ${bau.length} Bau-Dateien durchsucht, 26 Wächter-Fixtures, 1 Hüllen-Fixture, ${DOKU_FIXTURES.length + 1} Doku-Wächter-Fixtures und ${BEKANNT.size} bekannte Treffer in ${kette.length} Ketten-Dateien, ${BEKANNT_DOKU.size} bekannte Doku-Treffer)`)
