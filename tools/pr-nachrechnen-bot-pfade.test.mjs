/**
 * Tests für tools/pr-nachrechnen-bot-pfade.mjs: die Liste der Bot-Dateien ohne Leser in der PR-Kette (21.10.2026) und ihre Wirkung auf
 * `datenpfadAusnahme`. Die Liste steht hier fest eingetragen (nicht aus dem Modul gelesen); der Wächter am Ende sucht Leser im Bau.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { datenpfadAusnahme } from './pr-nachrechnen.mjs'
import { BOT_DATEIEN_OHNE_LESER } from './pr-nachrechnen-bot-pfade.mjs'

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
  'data/crunchyroll-woche-belege.json',
  'data/folgen-zuordnung.json',
  'data/imdb-ids.json',
  'data/kanal-widerspruch.json',
  'data/meldungen-uebernahme.json',
  'data/meldungen-zurueckgestellt.json',
  'data/meldungs-auffaelligkeiten.json',
  'data/motn-changes.json',
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
  'data/crunchyroll.json', 'data/crunchyroll-woche.json', 'data/termine-verpasst.json', 'data/tv-programm.json', 'data/bestand-historie.jsonl',
  'data/cr-einzelwerke.json', 'data/dub-confirmed.yaml', 'data/adn-raw/561.json.gz', 'data/crunchyroll-raw/GG5H5XQMD.de.json.gz', 'data/anisearch-raw/1.html.gz',
  'daniel-zum-abarbeiten/listen/justwatch-widersprueche.md', 'daniel-zum-abarbeiten/stand.md', 'daniel-zum-abarbeiten/listen/07-neu.md',
  'tools/design-klassen-grenzen.json', 'tools/umfang-grenzen.json', 'extension/offene-netflix.js', 'extension/offene-amazon.js', 'public/og/a.jpg',
]
for (const datei of GELESEN) pruefe(`gelesen/ausgeschlossen: ${datei} -> keine Ausnahme`, ausnahme([datei]) === `main bewegte ${datei}`)

// Wächter: kein Schritt des Baus nennt eine Datei der Liste im Code (Kommentare zählen nicht). Einzige bekannte Stelle: nebendateien.ts schreibt 18-suchadressen.md.
const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dateien = (ordner) => fs.readdirSync(path.join(wurzel, ordner), { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.(ts|tsx|mjs)$/.test(e.name))
  .map((e) => path.join(e.parentPath, e.name))
const gelesenVomBau = ['pipeline/bau', 'shared', 'web/src'].flatMap(dateien).concat(['pipeline/build.ts', 'pipeline/validate.ts'].map((f) => path.join(wurzel, f)))
const BEKANNT = new Set(['pipeline/bau/nebendateien.ts|daniel-zum-abarbeiten/listen/18-suchadressen.md'])
const treffer = []
for (const datei of gelesenVomBau) {
  const rel = path.relative(wurzel, datei).split(path.sep).join('/')
  const code = fs.readFileSync(datei, 'utf8').split('\n').filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n')
  for (const eintrag of ERWARTET) {
    const name = eintrag.split('/').pop()
    if (code.includes(name) && !BEKANNT.has(`${rel}|${eintrag}`)) treffer.push(`${rel}: ${name}`)
  }
}
pruefe('Wächter: kein Bau-Schritt nennt eine Datei der Liste (sonst ist sie gelesen und gehört gestrichen)', treffer.length === 0, treffer)
pruefe('Wächter: sieht die Bau-Dateien (nicht leer gelaufen)', gelesenVomBau.length > 100, gelesenVomBau.length)
pruefe('Wächter: sieht die bekannte Stelle', fs.readFileSync(path.join(wurzel, 'pipeline/bau/nebendateien.ts'), 'utf8').includes('18-suchadressen.md'))

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-bot-pfade.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log(`pr-nachrechnen-bot-pfade.test: grün (${ERWARTET.length} Bot-Dateien ohne Leser, ${GELESEN.length} gelesene/ausgeschlossene bleiben draußen, ${gelesenVomBau.length} Bau-Dateien durchsucht)`)
