/**
 * Reiner Bot-Datensprung entwertet keinen PR (10.11.2026, Nachrechnen-Deadlock): Verdrahtung über `datenpfadGrund` mit gh-Attrappe und
 * Commit-Paaren (Autor, Dateien), dazu die Gegenproben je Konto und Pfadklasse (Prüfer-Auflagen A1-A5 zu PR 3384): `claude[bot]` zählt nur für
 * Wache und Doku, Datenkonten nur für erzeugte Dateien (Positivliste), Erweiterungsdateien nur ohne Berührung von `extension/`.
 * Fälle 3347, 3358, 3351 mit den echten Dateien der Sprünge vom 10.11.2026 (Compare Kettenbasis...main, gekürzt auf je eine Datei je Ordner).
 */
import { botSprungAusnahme, datenpfadGrund, reinerBotSprung } from './pr-nachrechnen.mjs'
import { ERZEUGTE_DATEIEN, erzeugteDatei } from './pr-nachrechnen-bot-erzeugt.mjs'
import { commitDateien } from './pr-nachrechnen-vergleich-git.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const DATEN = ['daniel-zum-abarbeiten/listen/justwatch-widersprueche.md', 'data/ann-ids.json', 'data/adn-catalog.json', 'public/data/events.json', 'extension/offene-amazon.js', 'extension/manifest.json']
const WACHE = ['daniel-zum-abarbeiten/00-wache.md', 'status.md']
const DK = 'anime-kalender-daten[bot]'
const CL = 'claude[bot]'
const FALL = {
  3347: ['pipeline/lib/treffer-erben.ts', 'pipeline/check-weg-nein-gti.ts', 'tools/check-logic-liste.txt', 'data/patchnotes/b.yaml'],
  3358: ['data/cover-eigen-masse.json', 'pipeline/lib/eigene-cover-masse.ts', 'package.json', 'tools/buehne-faelle.mjs'],
  3351: ['web/src/lib/i18n.tsx', 'web/src/components/detail/live-link.tsx', 'docs/wissen/quellen.md'],
}
const PR_KOPF = 'a'.repeat(40)
const echt = [{ autor: DK, dateien: DATEN }, { autor: 'github-actions[bot]', dateien: ['data/adn-catalog.json'] }, { autor: 'anime-kalender-bot', dateien: ['daniel-zum-abarbeiten/00-wache.md'] }, { autor: CL, dateien: WACHE }]

/** Attrappe: Compare-Antwort aus den Commits, PR-Dateien, Commit-Paare (`keinGit`: Paarung scheitert); der Leser zeichnet Aufrufe auf. */
function lauf(nr, commits, { anzahl, commitsGesamt = commits.length, antwort = null, prDateien = FALL[nr], keinGit = false } = {}) {
  const dateien = [...new Set(commits.flatMap((c) => c.dateien))]
  const autoren = commits.map((c) => c.autor)
  const gh = (args) => {
    if (args[1].includes('/compare/')) return JSON.stringify({ status: 'ahead', anzahl: anzahl ?? dateien.length, dateien, commitsGesamt, autoren })
    if (args[1].endsWith(`/pulls/${nr}/files`)) return `${prDateien.join('\n')}\n`
    throw new Error(`unerwarteter gh-Aufruf ${args.join(' ')}`)
  }
  const leserAufrufe = []
  const leser = (bewegt, pr) => {
    leserAufrufe.push({ bewegt, pr })
    return antwort
  }
  const paare = () => (keinGit ? { fehler: 'kein git' } : { commits })
  const r = datenpfadGrund(gh, { number: nr, headRefOid: PR_KOPF }, 'b'.repeat(40), 'c'.repeat(40), leser, () => ({ fehler: 'kein git' }), paare)
  return { r, leserAufrufe }
}
const aktuell = (x) => /nur Bot-Daten bewegt/.test(x.r.ausnahme ?? '') && x.leserAufrufe.length === 0
const veraltet = (x) => x.r.ausnahme === undefined && x.r.grund !== undefined

for (const nr of [3347, 3358, 3351]) {
  const x = lauf(nr, echt, { antwort: 'der PR liest data/ann-ids.json (x)' })
  pruefe(`${nr}: echter Sprung (drei Datenkonten, Wache von claude[bot]), Leser würde „liest“ sagen -> aktuell, Leser nie gefragt`, aktuell(x), x.r)
}
// A5: Permutationen der PR-Dateien, die Berührung gilt unabhängig von der Stelle in der Liste.
const permutationen = (a) => (a.length <= 1 ? [a] : a.flatMap((e, i) => permutationen([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [e, ...p])))
for (const [i, p] of permutationen(['pipeline/a.ts', 'data/ann-ids.json', 'docs/x.md']).entries()) {
  const x = lauf(3347, echt, { prDateien: p })
  pruefe(`Permutation ${i + 1} der PR-Dateien: PR berührt data/ann-ids.json -> veraltet`, veraltet(x) && /der PR berührt data\/ann-ids\.json/.test(x.r.grund), x.r)
  const y = lauf(3347, echt, { prDateien: p.filter((d) => d !== 'data/ann-ids.json') })
  pruefe(`Permutation ${i + 1} ohne die berührte Datei -> aktuell`, aktuell(y), y.r)
}
{
  const x = lauf(3358, [...echt, { autor: DK, dateien: ['data/cover-eigen-masse.json'] }])
  pruefe('3358: Bot bewegt dieselbe Datei wie der PR -> veraltet', /der PR berührt data\/cover-eigen-masse\.json/.test(x.r.grund ?? ''), x.r)
}
// A3: Erweiterungsdateien nur, wenn der PR `extension/` und `tools/extension-*` nicht berührt.
for (const pr of [['extension/liste.test.cjs'], ['tools/extension-tests.mjs', 'pipeline/a.ts'], ['pipeline/a.ts', 'extension/amazon.js']]) {
  const x = lauf(3347, [{ autor: DK, dateien: ['extension/offene-netflix.js', 'data/ann-ids.json'] }], { prDateien: pr, antwort: 'der PR ruft x auf' })
  pruefe(`A3: PR berührt ${pr.join('+')}, Bot bewegt offene-netflix.js -> Leser-Regel entscheidet, veraltet`, veraltet(x) && x.leserAufrufe.length === 1, x)
}
{
  const x = lauf(3347, [{ autor: DK, dateien: ['extension/manifest.json', 'data/ann-ids.json'] }], { prDateien: ['extension/liste.test.cjs'], antwort: 'der PR ruft x auf' })
  pruefe('A3: auch manifest.json zählt bei Berührung von extension/ nicht', veraltet(x), x)
  const y = lauf(3347, [{ autor: DK, dateien: ['extension/offene-netflix.js', 'extension/manifest.json'] }], { prDateien: ['pipeline/a.ts'] })
  pruefe('A3: PR ohne extension/ -> offene-netflix.js und manifest.json bewegt, aktuell', aktuell(y), y.r)
}
// A1: claude[bot] nur für Wache und Doku; Daten, Handdaten und Code von ihm -> Leser-Regel.
for (const d of ['data/curated/streaming-herbst-2026.yaml', 'data/anisearch-ids-hand.yaml', 'data/kanal-seiten.json', 'pipeline/bau/09-3-prime.ts', 'data/ann-ids.json', 'tools/umfang-grenzen.json', 'daniel-zum-abarbeiten/stand.md']) {
  const x = lauf(3347, [{ autor: CL, dateien: [d, ...WACHE] }, { autor: DK, dateien: ['data/ann-ids.json'] }], { antwort: 'der PR ruft x auf' })
  pruefe(`A1: claude[bot] bewegt ${d} -> veraltet`, veraltet(x), x)
  const y = lauf(3347, [{ autor: CL, dateien: [d] }], { antwort: 'der PR ruft x auf' })
  pruefe(`A1: nur claude[bot], ${d} -> veraltet`, veraltet(y), y)
}
{
  const x = lauf(3347, [{ autor: CL, dateien: WACHE }, { autor: DK, dateien: ['data/ann-ids.json'] }])
  pruefe('A1: claude[bot] nur Wache + Datenkonto erzeugt -> aktuell', aktuell(x), x.r)
  const y = lauf(3347, [{ autor: CL, dateien: ['docs/wissen/betrieb.md'] }, { autor: DK, dateien: ['data/ann-ids.json'] }])
  pruefe('A1: claude[bot] Doku unter docs/ -> aktuell', aktuell(y), y.r)
  const z = lauf(3347, [{ autor: CL, dateien: WACHE }, { autor: DK, dateien: ['data/ann-ids.json'] }], { keinGit: true, antwort: 'der PR ruft x auf' })
  pruefe('A1: claude[bot] dabei, Paarung (git) nicht lesbar -> fail-closed, veraltet', veraltet(z), z)
  const w = lauf(3347, [{ autor: DK, dateien: ['data/ann-ids.json'] }], { keinGit: true })
  pruefe('A1: ohne claude[bot] braucht es keine Paarung -> aktuell', aktuell(w), w.r)
  // Datei des Datenkontos in einem Commit von claude[bot] und umgekehrt: die Paarung entscheidet, nicht die Vereinigung.
  const u = lauf(3347, [{ autor: DK, dateien: WACHE }, { autor: CL, dateien: ['data/ann-ids.json'] }], { antwort: 'der PR ruft x auf' })
  pruefe('A1: Datei und Konto vertauscht (claude[bot] schreibt data/ann-ids.json) -> veraltet', veraltet(u), u)
}
// A2: Handdaten unter data/ nur über die Positivliste erzeugter Dateien; je Eintrag ein Fall (auch bei einem Datenkonto).
const HAND = ['data/dub-confirmed.yaml', 'data/patchnotes/a.yaml', 'data/curated/tv-2026.yaml', 'data/anisearch-ids-hand.yaml', 'data/ankuendigungen.yaml', 'data/blocker-von-hand.yaml', 'data/belege-entfernt.yaml', 'data/cartoon-handliste.yaml', 'data/cartoon-reihen-von-hand.yaml', 'data/erstausgabe-von-hand.yaml', 'data/folgentitel-hand.yaml', 'data/handlung-eigen.yaml', 'data/katalog-release-von-hand.yaml', 'data/kino-ankuendigungen.yaml', 'data/ohne-synchro-von-hand.yaml', 'data/reihen-von-hand.yaml', 'data/remake-von-hand.yaml', 'data/spinoff-von-hand.yaml', 'data/staffel-von-hand.yaml', 'data/synchro-von-hand.yaml', 'data/tmdb-von-hand.yaml', 'data/verweise-von-hand.yaml', 'data/kanal-seiten.json', 'data/cartoon-umzug.json', 'data/curated-ids.json', 'data/zuordnung-fremd-bekannt.json', 'data/justwatch-handpruefung.json', 'data/cr-zeit-korrekturen.json', 'data/neue-sammlerdatei-ohne-eintrag.json']
for (const d of HAND) {
  const x = lauf(3347, [{ autor: DK, dateien: ['data/ann-ids.json', d] }], { antwort: 'der PR ruft x auf' })
  pruefe(`A2: Datenkonto bewegt ${d} -> veraltet (nicht auf der Positivliste)`, veraltet(x) && !erzeugteDatei(d), x)
}
for (const d of ['data/ann-ids.json', 'data/anisearch-raw/1.json.gz', 'data/proposals/x.json']) pruefe(`A2: ${d} steht auf der Positivliste`, erzeugteDatei(d) === true)
pruefe('A2: Positivliste enthält keine Handdatei (*.yaml, *hand*, von-hand)', ERZEUGTE_DATEIEN.every((n) => !/\.ya?ml$|hand|ankuendigungen|kanal-seiten|cartoon-umzug|curated-ids|zuordnung-fremd/.test(n)), ERZEUGTE_DATEIEN.filter((n) => /\.ya?ml$|hand|kanal-seiten/.test(n)))
pruefe('A2: Positivliste ist sortiert und ohne Dubletten', ERZEUGTE_DATEIEN.every((n, i) => i === 0 || ERZEUGTE_DATEIEN[i - 1] < n))
// Weitere Gegenproben je Bedingung: Leser-Regel entscheidet, Urteil „veraltet“.
for (const [name, commits] of [
  ['ein Mensch dazwischen', [...echt, { autor: 'danielzaiser91', dateien: ['data/ann-ids.json'] }]],
  ['nur ein Mensch (Squash-Merge von Daten)', [{ autor: 'danielzaiser91', dateien: ['data/ann-ids.json'] }]],
  ['fremder Bot', [{ autor: 'dependabot[bot]', dateien: ['data/ann-ids.json'] }]],
  ['Code-Datei auf main (tools/x.mjs)', [{ autor: DK, dateien: [...DATEN, 'tools/x.mjs'] }]],
  ['Workflow auf main', [{ autor: DK, dateien: [...DATEN, '.github/workflows/sammler.yml'] }]],
  ['Grenzdatei (tools/umfang-grenzen.json)', [{ autor: DK, dateien: [...DATEN, 'tools/umfang-grenzen.json'] }]],
  ['Kettenwächter (tools/check-a.mjs)', [{ autor: DK, dateien: [...DATEN, 'tools/check-a.mjs'] }]],
]) {
  const x = lauf(3347, commits, { antwort: 'der PR ruft x auf' })
  pruefe(`Gegenprobe ${name}: Urteil bleibt „veraltet“`, veraltet(x), x)
}
// Reine Funktion: Grenzen der Erkennung.
const v = (dateien, autoren = ['github-actions[bot]'], o = {}) => ({ status: 'ahead', anzahl: dateien.length, dateien, commitsGesamt: autoren.length, autoren, ...o })
pruefe('reinerBotSprung: eine Datei, ein Datenkonto -> ja', reinerBotSprung(v(['data/ann-ids.json']), []) === true)
pruefe('reinerBotSprung: public/data, Bild, Wache-Bericht, offene-*.js, Manifest (PR ohne extension/) -> ja', reinerBotSprung(v(['public/data/a.json', 'public/og/x.jpg', 'daniel-zum-abarbeiten/00-wache.md', 'extension/offene-netflix.js', 'extension/manifest.json']), ['pipeline/a.ts']) === true)
pruefe('reinerBotSprung: extension/content.js (kein erzeugtes) -> nein', reinerBotSprung(v(['extension/content.js']), []) === false)
pruefe('reinerBotSprung: keine Dateien -> nein', reinerBotSprung(v([]), []) === false)
pruefe('reinerBotSprung: Autor ähnlich geschrieben -> nein', reinerBotSprung(v(['data/ann-ids.json'], ['github-actions']), []) === false)
pruefe('reinerBotSprung: claude[bot] ohne Commit-Paare -> nein', reinerBotSprung(v(['status.md'], [CL]), []) === false)
pruefe('reinerBotSprung: claude[bot] mit Paaren, nur Wache -> ja', reinerBotSprung(v(['status.md'], [CL], { commits: [{ autor: CL, dateien: ['status.md'] }] }), []) === true)
pruefe('reinerBotSprung: Commit eines Menschen in den Paaren -> nein', reinerBotSprung(v(['status.md'], [CL], { commits: [{ autor: CL, dateien: ['status.md'] }, { autor: 'danielzaiser91', dateien: ['status.md'] }] }), []) === false)
// Abgeschnittener Vergleich (300 Dateien, mehr Commits als Autoren) bleibt veraltet, auch bei lauter Bots.
pruefe('botSprungAusnahme: genau 300 Dateien -> abgeschnitten', /abgeschnitten/.test(botSprungAusnahme(v(['data/ann-ids.json'], ['github-actions[bot]'], { anzahl: 300 }), ['x.ts'], () => null)))
pruefe('botSprungAusnahme: mehr Commits als Autoren -> abgeschnitten', /abgeschnitten/.test(botSprungAusnahme(v(['data/ann-ids.json'], ['github-actions[bot]'], { commitsGesamt: 2 }), ['x.ts'], () => null)))
pruefe('botSprungAusnahme: 299 Dateien, Bots -> null', botSprungAusnahme(v(['data/ann-ids.json'], ['github-actions[bot]'], { anzahl: 299 }), ['x.ts'], () => 'Leser') === null)
pruefe('botSprungAusnahme: umbenannt, alter Name in PR -> berührt', botSprungAusnahme(v(['data/alt.json', 'data/neu.json']), ['data/alt.json'], () => null) === 'der PR berührt data/alt.json')

// Paarung aus git log: Ausgabe roh, Fehlerfall.
{
  const roh = '@@claude[bot]\n\nstatus.md\n\n@@anime-kalender-daten[bot]\n\ndata/ann-ids.json\npublic/data/events.json\n\n@@github-actions[bot]\n\n'
  const git = (args) => {
    if (args[0] === 'fetch') return ''
    return roh
  }
  const r = commitDateien(git)('b', 'm')
  pruefe('commitDateien: Autor und Dateien je Commit, Commit ohne Dateien bleibt', JSON.stringify(r.commits) === JSON.stringify([{ autor: 'claude[bot]', dateien: ['status.md'] }, { autor: 'anime-kalender-daten[bot]', dateien: ['data/ann-ids.json', 'public/data/events.json'] }, { autor: 'github-actions[bot]', dateien: [] }]), r)
  const f = commitDateien(() => { throw new Error('kaputt\nzweite Zeile') })('b', 'm')
  pruefe('commitDateien: git scheitert -> fehler', f.fehler === 'kaputt' && f.commits === undefined, f)
  const g = commitDateien((args) => (args[0] === 'fetch' ? '' : 'status.md\n'))('b', 'm')
  pruefe('commitDateien: Datei vor dem ersten Autor (kaputte Ausgabe) -> fehler', g.fehler !== undefined, g)
}

if (fehler.length > 0) {
  console.error(`pr-nachrechnen-bot-sprung.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen-bot-sprung.test: grün')
