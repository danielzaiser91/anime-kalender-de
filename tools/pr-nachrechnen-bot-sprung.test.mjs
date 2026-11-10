/**
 * Reiner Bot-Datensprung entwertet keinen PR (10.11.2026, Nachrechnen-Deadlock): Verdrahtung über `datenpfadGrund` mit gh-Attrappe, dazu die
 * Gegenproben (Mensch, Code, Kettendatei, Handdaten, abgeschnittener Vergleich). Fälle 3347, 3358, 3351 mit den echten Dateien der Sprünge
 * vom 10.11.2026 (Compare Kettenbasis...main, gekürzt auf je eine Datei je Ordner).
 */
import { botSprungAusnahme, datenpfadGrund, reinerBotSprung } from './pr-nachrechnen.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const DATEN = ['daniel-zum-abarbeiten/listen/justwatch-widersprueche.md', 'daniel-zum-abarbeiten/00-wache.md', 'data/ann-ids.json', 'data/adn-catalog.json', 'public/data/events.json', 'extension/offene-amazon.js', 'extension/manifest.json']
const BOTS = ['anime-kalender-daten[bot]', 'github-actions[bot]', 'anime-kalender-bot', 'claude[bot]']
const FALL = {
  3347: ['pipeline/lib/treffer-erben.ts', 'pipeline/check-weg-nein-gti.ts', 'tools/check-logic-liste.txt', 'data/patchnotes/b.yaml'],
  3358: ['data/cover-eigen-masse.json', 'pipeline/lib/eigene-cover-masse.ts', 'package.json', 'tools/buehne-faelle.mjs'],
  3351: ['web/src/lib/i18n.tsx', 'web/src/components/detail/live-link.tsx', 'docs/wissen/quellen.md'],
}
const PR_KOPF = 'a'.repeat(40)

/** Attrappe: Compare-Antwort und PR-Dateien; `leser` zeichnet Aufrufe auf. */
function lauf(nr, dateien, autoren, { anzahl = dateien.length, commitsGesamt = autoren.length, antwort = null, prDateien = FALL[nr] } = {}) {
  const aufrufe = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (args[1].includes('/compare/')) return JSON.stringify({ status: 'ahead', anzahl, dateien, commitsGesamt, autoren })
    if (args[1].endsWith(`/pulls/${nr}/files`)) return `${prDateien.join('\n')}\n`
    throw new Error(`unerwarteter gh-Aufruf ${args.join(' ')}`)
  }
  const leserAufrufe = []
  const leser = (bewegt, pr) => {
    leserAufrufe.push({ bewegt, pr })
    return antwort
  }
  const r = datenpfadGrund(gh, { number: nr, headRefOid: PR_KOPF }, 'b'.repeat(40), 'c'.repeat(40), leser, () => ({ fehler: 'kein git' }))
  return { r, leserAufrufe }
}

for (const nr of [3347, 3358, 3351]) {
  const { r, leserAufrufe } = lauf(nr, DATEN, ['anime-kalender-daten[bot]', 'anime-kalender-bot', 'github-actions[bot]', 'claude[bot]'], { antwort: 'der PR liest data/ann-ids.json (x)' })
  pruefe(`${nr}: reiner Bot-Datensprung, Leser würde „liest“ sagen -> trotzdem aktuell, Leser nie gefragt`, /nur Bot-Daten bewegt/.test(r.ausnahme ?? '') && leserAufrufe.length === 0, r)
}
{
  const { r } = lauf(3358, [...DATEN, 'data/cover-eigen-masse.json'], BOTS)
  pruefe('3358: Bot bewegt dieselbe Datei wie der PR -> veraltet', /der PR berührt data\/cover-eigen-masse\.json/.test(r.grund ?? ''), r)
}
{
  const { r } = lauf(3347, [...DATEN, 'pipeline/lib/treffer-erben.ts'], BOTS)
  pruefe('3347: Bot-Konto bewegt Code des PR (Datei außerhalb Daten) -> veraltet', r.grund !== undefined, r)
}
// Gegenproben: jede Bedingung allein kippt zurück auf die Leser-Regel (Stub sagt „liest“ -> Grund).
for (const [name, dateien, autoren] of [
  ['ein Mensch dazwischen', DATEN, [...BOTS, 'danielzaiser91']],
  ['nur ein Mensch (Squash-Merge von Daten)', DATEN, ['danielzaiser91']],
  ['fremder Bot', DATEN, ['dependabot[bot]']],
  ['Code-Datei auf main (tools/x.mjs)', [...DATEN, 'tools/x.mjs'], BOTS],
  ['Workflow auf main', [...DATEN, '.github/workflows/sammler.yml'], BOTS],
  ['Handbelege (data/dub-confirmed.yaml)', [...DATEN, 'data/dub-confirmed.yaml'], BOTS],
  ['Patch Notes (data/patchnotes/a.yaml)', [...DATEN, 'data/patchnotes/a.yaml'], BOTS],
  ['Stand (daniel-zum-abarbeiten/stand.md)', [...DATEN, 'daniel-zum-abarbeiten/stand.md'], BOTS],
  ['Grenzdatei (tools/umfang-grenzen.json)', [...DATEN, 'tools/umfang-grenzen.json'], BOTS],
  ['Kettenwächter (tools/check-a.mjs)', [...DATEN, 'tools/check-a.mjs'], BOTS],
  ['keine Autoren', DATEN, []],
]) {
  const { r, leserAufrufe } = lauf(3347, dateien, autoren, { antwort: 'der PR ruft x auf' })
  pruefe(`Gegenprobe ${name}: Leser-Regel entscheidet, Urteil bleibt „veraltet“`, r.ausnahme === undefined && /der PR ruft x auf|main bewegte/.test(r.grund ?? ''), { r, leserAufrufe })
}
// Reine Funktion: Grenzen der Erkennung.
const v = (dateien, autoren = ['github-actions[bot]'], o = {}) => ({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: autoren.length, autoren, ...o })
pruefe('reinerBotSprung: eine Datei, ein Bot -> ja', reinerBotSprung(v(['data/a.json'])) === true)
pruefe('reinerBotSprung: public/data, Bild, Wache-Bericht, offene-*.js, Manifest -> ja', reinerBotSprung(v(['public/data/a.json', 'public/og/x.jpg', 'extension/offene-netflix.js', 'extension/manifest.json'])) === true)
pruefe('reinerBotSprung: extension/content.js (kein erzeugtes) -> nein', reinerBotSprung(v(['extension/content.js'])) === false)
pruefe('reinerBotSprung: keine Dateien -> nein', reinerBotSprung(v([])) === false)
pruefe('reinerBotSprung: Autor mit Großschreibung/ähnlichem Namen -> nein', reinerBotSprung(v(['data/a.json'], ['github-actions'])) === false)
// Abgeschnittener Vergleich (300 Dateien, mehr Commits als Autoren) bleibt veraltet, auch bei lauter Bots.
pruefe('botSprungAusnahme: genau 300 Dateien -> abgeschnitten', /abgeschnitten/.test(botSprungAusnahme(v(['data/a.json'], ['github-actions[bot]'], { anzahl: 300 }), ['x.ts'], () => null)))
pruefe('botSprungAusnahme: mehr Commits als Autoren -> abgeschnitten', /abgeschnitten/.test(botSprungAusnahme(v(['data/a.json'], ['github-actions[bot]'], { commitsGesamt: 2 }), ['x.ts'], () => null)))
pruefe('botSprungAusnahme: 299 Dateien, Bots -> null', botSprungAusnahme(v(['data/a.json'], ['github-actions[bot]'], { anzahl: 299 }), ['x.ts'], () => 'Leser') === null)
pruefe('botSprungAusnahme: umbenannt, alter Name in PR -> berührt', botSprungAusnahme(v(['data/alt.json', 'data/neu.json']), ['data/alt.json'], () => null) === 'der PR berührt data/alt.json')

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-bot-sprung.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-bot-sprung.test: grün')
