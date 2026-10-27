/**
 * Tests für tools/pr-nachrechnen.mjs: Basis aus dem echten Checkout-Log, Entscheidung aktuell / veraltet / unklar, Aufrufe an gh,
 * Startlogik als eigener Prozess (Vorlader tools/pr-nachrechnen-mock.mjs) und die Bindung an pr-pruefung.yml und pr-pruefer.yml.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { attrappe } from './pr-nachrechnen-leser-attrappe.mjs'
import { gitLeser } from './pr-nachrechnen-leser-git.mjs'
import { COMPARE_GRENZE, JOB, KETTE, REF_ABSTAND_MS, REF_PRUEFUNGEN, basisAusLog, botSprungAusnahme, datenpfadAusnahme, hindernis, main, nachrechnen, neuesterLauf, schlafe } from './pr-nachrechnen.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Echter Anlassfall: Log von „Kette – Workflows“ im Lauf 39267257518 (PR 1597, Kopf 08798af3f), Zeilen 171–176.
const KOPF = '08798af3f0daf193fc754d6eda60ee60b526450f'
const BASIS = '7a466acc8119e87fbe8dc51782126a6167c5b70a'
const MAIN = 'c0ffee'.padEnd(40, '0')
const ECHTES_LOG = [
  '2026-10-19T14:15:22.8707228Z Turn off this advice by setting config variable advice.detachedHead to false',
  '2026-10-19T14:15:22.8707733Z ',
  `2026-10-19T14:15:22.8708669Z HEAD is now at 810f0279 Merge ${KOPF} into ${BASIS}`,
  '2026-10-19T14:15:22.8775018Z ##[endgroup]',
  '2026-10-19T14:15:22.8826771Z [command]/usr/bin/git log -1 --format=%H',
  '2026-10-19T14:15:22.8859380Z 810f027929fbf47f94fe0b32c4db49d512cecbe2',
].join('\n')

pruefe('Basis aus dem echten Log', basisAusLog(ECHTES_LOG, KOPF) === BASIS, basisAusLog(ECHTES_LOG, KOPF))
pruefe('Windows-Zeilenenden im Log', basisAusLog(ECHTES_LOG.replaceAll('\n', '\r\n'), KOPF) === BASIS)
pruefe('Zeile zu einem anderen Kopf zählt nicht', basisAusLog(ECHTES_LOG, MAIN) === null)
pruefe('Kopf ist keine SHA (Muster im Kopf) -> null', basisAusLog(ECHTES_LOG, '.*') === null)
pruefe('Log ohne Checkout-Zeile -> null', basisAusLog(ECHTES_LOG.split('\n').filter((z) => !z.includes('HEAD is now')).join('\n'), KOPF) === null)
pruefe('abgeschnittene Basis -> null', basisAusLog(ECHTES_LOG.replace(BASIS, BASIS.slice(0, 39)), KOPF) === null)
pruefe('Zeile mit Anhang hinter der Basis -> null', basisAusLog(ECHTES_LOG.replace(BASIS, `${BASIS}x`), KOPF) === null)

const lauf = (headSha, createdAt, databaseId) => ({ headSha, createdAt, databaseId })
pruefe('neuester Lauf: der neueste in der Mitte gewinnt', neuesterLauf([lauf(KOPF, '2026-10-19T10:00:00Z', 1), lauf(KOPF, '2026-10-19T12:00:00Z', 2), lauf(KOPF, '2026-10-19T11:00:00Z', 3)], KOPF).databaseId === 2)
pruefe('neuester Lauf: Lauf zu altem Kopf zählt nicht, auch wenn neuer', neuesterLauf([lauf(KOPF, '2026-10-19T10:00:00Z', 1), lauf(MAIN, '2026-10-19T12:00:00Z', 2)], KOPF).databaseId === 1)
pruefe('neuester Lauf: Zeitzonen-Schreibweise als Zeitpunkt', neuesterLauf([lauf(KOPF, '2026-10-19T13:00:00+02:00', 1), lauf(KOPF, '2026-10-19T11:30:00Z', 2)], KOPF).databaseId === 2)
pruefe('neuester Lauf: keiner zum Kopf -> null', neuesterLauf([lauf(MAIN, '2026-10-19T10:00:00Z', 1)], KOPF) === null)

const offen = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE' }
pruefe('hindernis: offen und mergebar -> keins', hindernis(offen) === null)
pruefe('hindernis: geschlossen', /nicht offen \(CLOSED\)/.test(hindernis({ ...offen, state: 'CLOSED' })))
pruefe('hindernis: Konflikt (reopened startet dann keine Kette)', /Konflikt/.test(hindernis({ ...offen, mergeable: 'CONFLICTING' })))
pruefe('hindernis: Mergebarkeit unbekannt', /noch nicht berechnet \(UNKNOWN\)/.test(hindernis({ ...offen, mergeable: 'UNKNOWN' })))

// Kulisse: Antworten je genauer Argumentliste; drei Läufe, drei Jobs, der richtige jeweils in der Mitte.
// Merge-Commit des PR: M_ALT (Basis BASIS) beim ersten Lesen, nach dem ersten Wiederöffnen M_NEU (Basis MAIN), wie an PR 1602 gemessen.
const PR = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x' }
const M_ALT = 'a1'.padEnd(40, '1')
const M_NEU = 'b2'.padEnd(40, '2')
const JQ_VERGLEICH = '{status, anzahl: (.files | length), dateien: [.files[] | .filename, (.previous_filename // empty)], commitsGesamt: .total_commits, autoren: [.commits[] | .author.login // .commit.author.name]}'
// Standard: ein Commit eines Menschen, damit die Bot-Sprung-Ausnahme (Merge-Fluss C) nur greift, wo ein Fall sie verlangt.
const vergleich = (dateien, status = 'ahead', anzahl = dateien.length, autoren = ['danielzaiser91'], commitsGesamt = autoren.length) => JSON.stringify({ status, anzahl, dateien, commitsGesamt, autoren })
function antworten({ nr = 7, pr = PR, mainSha = BASIS, laeufe, jobs, log = ECHTES_LOG, mergeShas = [M_ALT, M_NEU], mainDateien = ['tools/x.mjs'], prDateien = 'src/a.ts\n', autoren } = {}) {
  return {
    [`api repos/{owner}/{repo}/compare/${BASIS}...${mainSha} --jq ${JQ_VERGLEICH}`]: { aus: Array.isArray(mainDateien) ? vergleich(mainDateien, 'ahead', mainDateien.length, autoren) : mainDateien.roh },
    [`api repos/{owner}/{repo}/pulls/${nr}/files --paginate --jq .[] | .filename, (.previous_filename // empty)`]: { aus: prDateien },
    [`api repos/{owner}/{repo}/pulls/${nr} --jq .merge_commit_sha`]: { aus: mergeShas.map((s) => `${s}\n`) },
    [`api repos/{owner}/{repo}/commits/${M_ALT} --jq .parents[0].sha`]: { aus: `${BASIS}\n` },
    [`api repos/{owner}/{repo}/commits/${M_NEU} --jq .parents[0].sha`]: { aus: `${MAIN}\n` },
    [`pr view ${nr} --json number,state,mergeable,headRefOid,headRefName`]: { aus: JSON.stringify(pr) },
    [`run list --workflow ${KETTE} --event pull_request --branch fix/x --limit 20 --json databaseId,headSha,createdAt`]: {
      aus: JSON.stringify(laeufe ?? [lauf(KOPF, '2026-10-19T10:00:00Z', 11), lauf(KOPF, '2026-10-19T12:00:00Z', 12), lauf(KOPF, '2026-10-19T11:00:00Z', 13)]),
    },
    'run view 12 --json jobs': { aus: JSON.stringify({ jobs: jobs ?? [{ name: 'Kette – Logik', databaseId: 91 }, { name: JOB, databaseId: 92 }, { name: 'PR-Prüfkette', databaseId: 93 }] }) },
    'api repos/{owner}/{repo}/actions/jobs/92/logs': { aus: log },
    'api repos/{owner}/{repo}/git/ref/heads/main --jq .object.sha': { aus: `${mainSha}\n` },
    [`pr close ${nr}`]: { aus: '' },
    [`pr reopen ${nr}`]: { aus: '' },
  }
}
function kulisse(daten, { reopenFehler = 0 } = {}) {
  const aufrufe = []
  const meldungen = []
  const gewartet = []
  let rest = reopenFehler
  const gh = (args) => {
    const schluessel = args.join(' ')
    aufrufe.push(schluessel)
    if (schluessel === 'pr reopen 7' && rest-- > 0) throw new Error('auf')
    const a = daten[schluessel]
    if (a === undefined || a.fehler !== undefined) throw new Error(a?.fehler ?? `HTTP 404: ${schluessel}`)
    const n = aufrufe.filter((x) => x === schluessel).length
    return Array.isArray(a.aus) ? a.aus[Math.min(n, a.aus.length) - 1] : a.aus
  }
  return { gh, aufrufe, meldungen, gewartet, melde: (t) => meldungen.push(t), warte: (ms) => gewartet.push(ms) }
}
const schreibend = (aufrufe) => aufrufe.filter((a) => a.startsWith('pr close') || a.startsWith('pr reopen'))

{
  const k = kulisse(antworten())
  const code = nachrechnen(7, k.gh, k.melde, k.warte)
  pruefe('aktuell (Basis = main) -> 0, nichts geschlossen', code === 0 && schreibend(k.aufrufe).length === 0, k.aufrufe)
  pruefe('aktuell: Meldung nennt main', k.meldungen.join() === 'PR 7: aktuell, die Kette rechnete gegen main 7a466acc8', k.meldungen)
  pruefe('liest Log des Jobs aus dem neuesten Lauf (12, Job 92)', k.aufrufe.includes('run view 12 --json jobs') && k.aufrufe.includes('api repos/{owner}/{repo}/actions/jobs/92/logs'), k.aufrufe)
}
{
  const k = kulisse(antworten({ mainSha: MAIN }))
  const code = nachrechnen(7, k.gh, k.melde, k.warte)
  const ref = `api repos/{owner}/{repo}/pulls/7 --jq .merge_commit_sha`
  const folge = k.aufrufe.filter((a) => a === ref || schreibend([a]).length > 0)
  pruefe('veraltet, Merge-Commit alt -> 1, öffnen, neu gerechneten Merge-Commit abwarten, erneut öffnen', code === 1 && folge.join() === [ref, 'pr close 7', 'pr reopen 7', ref, 'pr close 7', 'pr reopen 7'].join() && k.gewartet.length === 0, k.aufrufe)
  pruefe('veraltet: Meldung nennt beide Stände und den Grund', /NICHT AKTUELL \(Kette gegen 7a466acc8, main ist c0ffee000; main bewegte tools\/x\.mjs; main bewegte tools\/x\.mjs\)/.test(k.meldungen.join()), k.meldungen)
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: [M_NEU] }))
  const code = nachrechnen(7, k.gh, k.melde, k.warte)
  pruefe('veraltet, Merge-Commit schon neu gerechnet -> einmal öffnen genügt', code === 1 && schreibend(k.aufrufe).join() === 'pr close 7,pr reopen 7' && k.gewartet.length === 0, k.aufrufe)
}
// Echter Anlass (PR 1602): direkt nach dem Wiederöffnen ist merge_commit_sha leer; leer heißt „noch nicht neu“, nie „neu“.
for (const [name, folge, warten] of [['leer nach dem Öffnen', [M_ALT, '', '', M_NEU], 2]]) {
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: folge }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`Merge-Commit ${name} -> 1, wartet ${warten}×, öffnet zweimal`, code === 1 && k.gewartet.length === warten && schreibend(k.aufrufe).length === 4 && !k.aufrufe.some((a) => a.includes('commits/ ')), { code, a: k.aufrufe, m: k.meldungen })
}
// F55 (20.10.2026): main nur unter public/data/ und data/cache/ bewegt, PR berührt sie nicht -> Kette gilt weiter (Exit 0).
const DATEN_MAIN = ['public/data/titles.json', 'data/cache/ordner/anilist', 'public/data/news.json']
{
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: DATEN_MAIN }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe('nur Daten bewegt -> 0, nichts geschlossen', code === 0 && schreibend(k.aufrufe).length === 0, { code, a: k.aufrufe })
  pruefe('nur Daten bewegt: Meldung nennt beide Stände und die Pfade', k.meldungen.join() === 'PR 7: aktuell, Kette gegen 7a466acc8, main ist c0ffee000, seitdem nur Daten bewegt (public/data/, data/cache/, 53 Bot-Dateien ohne Leser)', k.meldungen)
  pruefe('nur Daten bewegt: liest Vergleich und PR-Dateien', k.aufrufe.some((a) => a.includes('/compare/')) && k.aufrufe.some((a) => a.includes('/pulls/7/files')), k.aufrufe)
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: [] }))
  pruefe('main ohne Dateiänderung (leerer Vergleich) -> 0', main(['7'], k.gh, k.melde, k.warte) === 0 && schreibend(k.aufrufe).length === 0, k.aufrufe)
}
// Alles andere zählt: je Pfad ein Fall, einzeln und neben Datenpfaden (Datenpfad zuerst und zuletzt, der Fremde in der Mitte).
// 21.10.2026: Bot-Berichte und Sammler-Ausgaben ohne Leser in der Kette (Liste und Einzelfälle: pr-nachrechnen-bot-pfade.test.mjs).
{
  const bot = ['daniel-zum-abarbeiten/00-START-HIER.md', 'daniel-zum-abarbeiten/listen/12-verpasste-termine.md', 'data/source-health.json']
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: bot }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe('nur Bot-Berichte bewegt -> 0, nichts geschlossen', code === 0 && schreibend(k.aufrufe).length === 0, { code, a: k.aufrufe })
}
// 26.10.2026 (PR 2118: main bewegte daniel-zum-abarbeiten/00-wache.md): Doku auf main entwertet keinen PR; andere Daniel-Dateien (Prüfungen lesen sie) und Patch Notes (der Bau liest sie) schon.
for (const [name, dateien, prDateien, erwartet] of [
  ['Daniel-Datei wörtlich vom Anlass', ['daniel-zum-abarbeiten/00-wache.md'], 'src/a.ts\n', 0],
  ['Doku zwischen Datenpfaden', ['public/data/titles.json', 'docs/wissen/betrieb.md', 'data/cache/ordner/a'], 'src/a.ts\n', 0],
  ['Markdown im Wurzelordner', ['CLAUDE.md'], 'src/a.ts\n', 0],
  ['Patch Notes', ['data/patchnotes/neu.yaml'], 'src/a.ts\n', 1],
  ['andere Daniel-Datei (stand.md liest eine Prüfung)', ['daniel-zum-abarbeiten/stand.md'], 'src/a.ts\n', 1],
  ['Daniel-Datei x.md', ['daniel-zum-abarbeiten/x.md'], 'src/a.ts\n', 1],
  ['Namensvetter docsx/', ['docsx/a.md'], 'src/a.ts\n', 1],
  ['Doku und Code', ['docs/wissen/betrieb.md', 'shared/logic.ts'], 'src/a.ts\n', 1],
  ['Markdown in Unterordner (web/README.md)', ['web/README.md'], 'src/a.ts\n', 1],
  ['PR berührt dieselbe Doku-Datei', ['docs/wissen/betrieb.md'], 'docs/wissen/betrieb.md\n', 1],
]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: dateien, prDateien }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`main bewegt ${name} -> ${erwartet}`, code === erwartet && schreibend(k.aufrufe).length === (erwartet === 1 ? 4 : 0), { code, m: k.meldungen })
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: ['daniel-zum-abarbeiten/00-START-HIER.md', 'shared/logic.ts'] }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe('Bot-Bericht und shared/logic.ts bewegt -> 1, neu angestoßen', code === 1 && schreibend(k.aufrufe).length === 4, { code, m: k.meldungen })
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: ['daniel-zum-abarbeiten/00-START-HIER.md'], prDateien: 'daniel-zum-abarbeiten/00-START-HIER.md\n' }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe('PR berührt selbst einen Bot-Bericht -> 1, neu angestoßen', code === 1 && schreibend(k.aufrufe).length === 4, { code, m: k.meldungen })
}
for (const fremd of ['tools/umfang-grenzen.json', 'extension/pruefstand.json', 'data/dub-confirmed.yaml', 'public/og/a.png', 'pipeline/build.ts', 'public/data-x/a.json', 'data/cache-x/a.json', 'xpublic/data/a.json', 'data/curated/a.yaml', 'public/index.html']) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: ['public/data/titles.json', fremd, 'data/cache/ordner/a'] }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`main bewegte auch ${fremd} -> 1, neu angestoßen`, code === 1 && schreibend(k.aufrufe).length === 4, { code, m: k.meldungen })
}
for (const [name, prDateien] of [['public/data', 'src/a.ts\npublic/data/titles.json\ntools/b.mjs\n'], ['data/cache', 'data/cache/x\n'], ['nur eine Datei', 'public/data/x.json']]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: DATEN_MAIN, prDateien }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`PR berührt ${name} -> 1, neu angestoßen`, code === 1 && schreibend(k.aufrufe).length === 4, { code, m: k.meldungen })
  pruefe(`PR berührt ${name}: Meldung nennt die Datei`, /; der PR berührt (public\/data\/|data\/cache\/|public\/data\/x\.json)/.test(k.meldungen.join()), k.meldungen)
}
for (const [name, roh, erwartet] of [
  ['diverged', vergleich(DATEN_MAIN, 'diverged'), 1],
  ['behind', vergleich(DATEN_MAIN, 'behind'), 1],
  ['identical', vergleich(DATEN_MAIN, 'identical'), 1],
  ['genau an der Compare-Grenze', vergleich(DATEN_MAIN, 'ahead', COMPARE_GRENZE), 1],
  ['eine unter der Compare-Grenze', vergleich(DATEN_MAIN, 'ahead', COMPARE_GRENZE - 1), 0],
]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: { roh } }))
  const code = main(['7'], k.gh, k.melde, k.warte, undefined, () => ({ fehler: 'aus' }))
  pruefe(`Vergleich ${name} -> ${erwartet}`, code === erwartet && schreibend(k.aufrufe).length === (erwartet === 1 ? 4 : 0), { code, m: k.meldungen })
}
pruefe('Compare-Grenze ist 300 (Grenze der GitHub-API)', COMPARE_GRENZE === 300)
// 27.10.2026 (Anlass PR 2146, 300 Dateien): Ab der Grenze zählt der lokale Vergleich (git), nicht der abgeschnittene der API.
const VIELE = Array.from({ length: 400 }, (_, i) => `data/cache/q/${i}.json`)
const voll = (dateien, autoren = ['github-actions[bot]'], fehler) => {
  const f = (basis, main) => {
    f.aufrufe.push([basis, main])
    return fehler === undefined ? { dateien, autoren, commitsGesamt: autoren.length } : { fehler }
  }
  f.aufrufe = []
  return f
}
for (const [name, v, prDateien, erwartet, text] of [
  ['300 Dateien, lokal alles Daten, PR ohne Leser', voll(VIELE), 'data/patchnotes/a.yaml\n', 0, /seitdem nur Daten bewegt/],
  ['300 Dateien, lokal eine Datei mit Leser (tools/x.mjs)', voll([...VIELE, 'tools/x.mjs']), 'data/patchnotes/a.yaml\n', 1, /main bewegte tools\/x\.mjs/],
  ['300 Dateien, lokal Datenpfad vom PR berührt', voll(VIELE), `${VIELE[399]}\n`, 1, /der PR berührt data\/cache\/q\/399\.json/],
  ['300 Dateien, git scheitert (Zeitlimit)', voll([], [], 'ETIMEDOUT'), 'data/patchnotes/a.yaml\n', 1, /evtl\. abgeschnitten \(lokales git: ETIMEDOUT\)/],
]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: { roh: vergleich(DATEN_MAIN, 'ahead', 300) }, prDateien }))
  const code = main(['7'], k.gh, k.melde, k.warte, undefined, v)
  pruefe(`lokaler Vergleich: ${name} -> ${erwartet}`, code === erwartet && text.test(k.meldungen.join()) && schreibend(k.aufrufe).length === (erwartet === 1 ? 4 : 0), { code, m: k.meldungen })
  pruefe(`lokaler Vergleich: ${name}: git bekam Basis und main`, v.aufrufe.length === 1 && v.aufrufe[0].join() === `${BASIS},${MAIN}`, v.aufrufe)
}
{
  const v = voll(VIELE)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: DATEN_MAIN, prDateien: 'data/patchnotes/a.yaml\n' }))
  main(['7'], k.gh, k.melde, k.warte, undefined, v)
  pruefe('lokaler Vergleich: unter der Grenze fragt kein git', v.aufrufe.length === 0, v.aufrufe)
}
// Mehr Commits als die API-Liste (250) trägt: lokal gezählt, Autoren aus git.
const bots300 = JSON.stringify({ status: 'ahead', anzahl: 1, dateien: ['data/a.json'], commitsGesamt: 300, autoren: ['github-actions[bot]'] })
for (const [name, autoren, erwartet, text] of [
  ['300 Commits, alles Bots, Leser sagt null', Array(300).fill('anime-kalender-daten[bot]'), 0, /nur Daten-Bots/],
  ['300 Commits, einer davon ein Mensch (Autor zählt nicht)', [...Array(299).fill('github-actions[bot]'), 'danielzaiser91'], 0, /nur Daten-Bots/],
]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: { roh: bots300 }, prDateien: 'tools/x.mjs\n' }))
  const code = main(['7'], k.gh, k.melde, k.warte, () => null, voll(['data/curated/a.yaml'], autoren))
  pruefe(`lokaler Vergleich: ${name} -> ${erwartet}`, code === erwartet && text.test(k.meldungen.join()), { code, m: k.meldungen })
}
// Abruffehler und Unsinn: Exit 2, nichts angestoßen, nie still 0.
for (const [name, aendere] of [
  ['Vergleich nicht abrufbar', (d) => { delete d[`api repos/{owner}/{repo}/compare/${BASIS}...${MAIN} --jq ${JQ_VERGLEICH}`] }],
  ['PR-Dateien nicht abrufbar', (d) => { delete d['api repos/{owner}/{repo}/pulls/7/files --paginate --jq .[] | .filename, (.previous_filename // empty)'] }],
  ['Vergleich kein JSON', (d) => { d[`api repos/{owner}/{repo}/compare/${BASIS}...${MAIN} --jq ${JQ_VERGLEICH}`] = { aus: '' } }],
]) {
  const daten = antworten({ mainSha: MAIN, mainDateien: DATEN_MAIN })
  aendere(daten)
  const k = kulisse(daten)
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`${name} -> 2, nichts angestoßen`, code === 2 && schreibend(k.aufrufe).length === 0, { code, m: k.meldungen })
}
// Reine Entscheidung, unabhängig von gh.
pruefe('Ausnahme: Umbenennung aus Datenpfad heraus ist ein Fremdpfad der PR-Seite', datenpfadAusnahme({ status: 'ahead', anzahl: 2, dateien: ['public/data/a.json'] }, ['neu.json', 'data/cache/ordner/alt']) !== null)
pruefe('Ausnahme: genau eine Datenpfad-Datei im Vergleich -> null', datenpfadAusnahme({ status: 'ahead', anzahl: 1, dateien: ['data/cache/ordner/a'] }, ['x.ts']) === null)
// A1 (Prüfer 2123 R1): design-regeln.md liest tools/design-kontrast.mjs (check:logic), andere Doku nicht.
pruefe('Ausnahme: reiner Doku-Commit an design-regeln.md bei CSS-PR -> main bewegte die Datei', datenpfadAusnahme({ status: 'ahead', anzahl: 1, dateien: ['docs/wissen/design-regeln.md'] }, ['web/src/index.css']) === 'main bewegte docs/wissen/design-regeln.md')
pruefe('Ausnahme: andere Doku (docs/wissen/anderes.md) -> null', datenpfadAusnahme({ status: 'ahead', anzahl: 1, dateien: ['docs/wissen/anderes.md'] }, ['web/src/index.css']) === null)
// Merge-Fluss C (23.10.2026), Leser-Regel seit 26.10.2026 (pr-nachrechnen-leser.mjs, Regel selbst: pr-nachrechnen-leser.test.mjs): Ein
// Bot-Sprung nur unter data/ entwertet nur einen PR, dessen Code die bewegten Dateien liest. Hier die Verdrahtung, erst mit einem
// Leser-Stub (zeichnet Argumente auf), dann mit dem echten Git-Anschluss über einem Fake-git.
const BOTS = ['anime-kalender-daten[bot]', 'github-actions[bot]']
const BOT_MAIN = ['data/crunchyroll-woche.json', 'public/data/titles.json', 'data/curated/tv-2026.yaml']
const CODE_PR = 'docs/wissen/a.md\ndaniel-zum-abarbeiten/stand.md\nCLAUDE.md\ndata/patchnotes/neu.yaml\n'
const leserStub = (antwort) => {
  const f = (bewegt, pr, refs) => {
    f.aufrufe.push({ bewegt, pr, refs })
    return antwort
  }
  f.aufrufe = []
  return f
}
{
  const stub = leserStub(null)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: CODE_PR }))
  const code = main(['7'], k.gh, k.melde, k.warte, stub)
  pruefe('C: Leser sagt null -> 0, nichts geschlossen', code === 0 && schreibend(k.aufrufe).length === 0, { code, m: k.meldungen })
  pruefe('C: Meldung nennt die Bot-Ausnahme', k.meldungen.join() === 'PR 7: aktuell, Kette gegen 7a466acc8, main ist c0ffee000, seitdem nur Daten-Bots unter data/, kein Code des PR liest die bewegten Dateien', k.meldungen)
  const a = stub.aufrufe[0]
  pruefe('C: Leser bekommt bewegte Dateien ohne public/data, PR-Dateien und Stände', stub.aufrufe.length === 1 && a.bewegt.join() === 'data/crunchyroll-woche.json,data/curated/tv-2026.yaml' && a.pr.join() === CODE_PR.trim().split('\n').join() && JSON.stringify(a.refs) === JSON.stringify({ nummer: 7, kopf: KOPF, main: MAIN }), stub.aufrufe)
}
{
  const stub = leserStub('der PR liest data/crunchyroll-woche.json (tools/x.mjs)')
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: 'tools/x.mjs\n' }))
  const code = main(['7'], k.gh, k.melde, k.warte, stub)
  pruefe('C: Leser nennt Grund -> 1, neu angestoßen, Meldung trägt den Grund', code === 1 && schreibend(k.aufrufe).length === 4 && k.meldungen.join().includes('der PR liest data/crunchyroll-woche.json (tools/x.mjs)'), { code, m: k.meldungen })
}
for (const beruehrt of ['data/crunchyroll-woche.json', 'public/data/titles.json']) {
  const stub = leserStub(null)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: `${CODE_PR}${beruehrt}\n` }))
  const code = main(['7'], k.gh, k.melde, k.warte, stub)
  pruefe(`C: PR berührt bewegte Datei ${beruehrt} -> 1, Leser nicht gefragt`, code === 1 && stub.aufrufe.length === 0 && k.meldungen.join().includes(`der PR berührt ${beruehrt}`), { code, m: k.meldungen })
}
// Verdrahtung mit dem echten Git-Anschluss: Anlassfall PR 2043 (nur ein Workflow) bleibt gültig, ein PR am Leser wird veraltet.
const REPO = {
  main: {
    'pipeline/bau/cr.ts': "import { x } from '../lib/helfer'\nconst d = 'data/crunchyroll-woche.json'\n",
    'pipeline/lib/helfer.ts': 'export const x = 1\n',
    '.github/workflows/bestand-bauen.yml': 'steps:\n  - run: npm run data:build\n',
  },
  kopf: {},
}
for (const [name, pr, erwartet] of [['Workflow ohne Leser', '.github/workflows/bestand-bauen.yml\n', 0], ['Helfer des Lesers', 'pipeline/lib/helfer.ts\n', 1], ['Leser selbst', 'pipeline/bau/cr.ts\n', 1], ['Daten des PR (Handbelege)', 'data/dub-confirmed.yaml\n', 1]]) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: pr }))
  const code = nachrechnen(7, k.gh, k.melde, k.warte, gitLeser(attrappe(REPO, { mainSha: MAIN }).git))
  pruefe(`C: echter Anschluss, ${name} -> ${erwartet}`, code === erwartet && schreibend(k.aufrufe).length === (erwartet === 1 ? 4 : 0), { code, m: k.meldungen })
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: '.github/workflows/bestand-bauen.yml\n' }))
  const code = nachrechnen(7, k.gh, k.melde, k.warte, gitLeser(attrappe(REPO, { mainSha: MAIN, fetchFehler: true }).git))
  pruefe('C: Git nicht erreichbar -> im Zweifel veraltet (1) mit Grund', code === 1 && k.meldungen.join().includes('Leser nicht ermittelbar'), { code, m: k.meldungen })
}
{
  // Bot-Sprung mit Doku-Datei dabei: der Leser bekommt nur die Datendatei
  const stub = leserStub(null)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: ['data/crunchyroll-woche.json', 'docs/wissen/betrieb.md'], autoren: BOTS, prDateien: 'src/a.ts\n' }))
  const code = main(['7'], k.gh, k.melde, k.warte, stub)
  pruefe('Bot-Sprung mit Doku: Leser sieht nur die Datendatei', code === 0 && stub.aufrufe.length === 1 && stub.aufrufe[0].bewegt.join() === 'data/crunchyroll-woche.json', { code, a: stub.aufrufe })
}
// 27.10.2026 (PR 2165): Der Autor entscheidet nicht; Mensch-Commit auf data/ ohne Leser -> aktuell, mit Leser oder mit Code -> veraltet.
for (const [name, autoren] of [['ein Mensch dazwischen', ['anime-kalender-daten[bot]', 'danielzaiser91', 'github-actions[bot]']], ['nur ein Mensch (Squash-Merge)', ['danielzaiser91']], ['fremder Bot', ['dependabot[bot]']]]) {
  const frei = leserStub(null)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: ['data/patchnotes/_ueberarbeitet-bis.txt'], autoren, prDateien: CODE_PR }))
  const code = main(['7'], k.gh, k.melde, k.warte, frei)
  pruefe(`C: ${name}, Datei ohne Leser -> 0`, code === 0 && schreibend(k.aufrufe).length === 0 && frei.aufrufe.length === 1, { code, m: k.meldungen })
  const liest = leserStub('der PR liest data/patchnotes/_ueberarbeitet-bis.txt (tools/x.mjs)')
  const k2 = kulisse(antworten({ mainSha: MAIN, mainDateien: ['data/patchnotes/_ueberarbeitet-bis.txt'], autoren, prDateien: CODE_PR }))
  const code2 = main(['7'], k2.gh, k2.melde, k2.warte, liest)
  pruefe(`C: ${name}, Datei mit Leser -> 1, neu angestoßen`, code2 === 1 && schreibend(k2.aufrufe).length === 4 && /der PR liest data\/patchnotes/.test(k2.meldungen.join()), { code2, m: k2.meldungen })
  const k3 = kulisse(antworten({ mainSha: MAIN, mainDateien: [...BOT_MAIN, 'web/src/a.tsx'], autoren, prDateien: CODE_PR }))
  const code3 = main(['7'], k3.gh, k3.melde, k3.warte, leserStub(null))
  pruefe(`C: ${name}, Code auf main bewegt -> 1`, code3 === 1 && /main bewegte web\/src\/a\.tsx/.test(k3.meldungen.join()), { code3, m: k3.meldungen })
}
for (const fremd of ['tools/umfang-grenzen.json', 'extension/a.json', 'datax/a.json']) {
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: [...BOT_MAIN, fremd], autoren: BOTS, prDateien: CODE_PR }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`C: main bewegte ${fremd} -> 1`, code === 1 && k.meldungen.join().includes(`; main bewegte ${fremd}`), { code, m: k.meldungen })
}
{
  // Über 300 Dateien nicht unter public/data/ und data/cache/: nur der Leser-Weg (Merge-Fluss C) kann die Kette gelten lassen
  const stub = leserStub(null)
  const k = kulisse(antworten({ mainSha: MAIN, mainDateien: { roh: vergleich(DATEN_MAIN, 'ahead', 300) }, prDateien: 'data/patchnotes/a.yaml\n' }))
  const code = main(['7'], k.gh, k.melde, k.warte, stub, voll(Array.from({ length: 400 }, (_, i) => `data/curated/${i}.yaml`)))
  pruefe('lokaler Vergleich: 400 kuratierte Dateien, Leser null -> 0, Leser bekam alle 400', code === 0 && stub.aufrufe[0]?.bewegt.length === 400, { code, m: k.meldungen })
  const v = voll(VIELE)
  const k2 = kulisse(antworten({ mainSha: MAIN, mainDateien: { roh: vergleich(DATEN_MAIN, 'diverged', 300) }, prDateien: 'data/patchnotes/a.yaml\n' }))
  const code2 = main(['7'], k2.gh, k2.melde, k2.warte, undefined, v)
  pruefe('lokaler Vergleich: diverged fragt kein git, 1', code2 === 1 && v.aufrufe.length === 0, { code2, a: v.aufrufe })
}
const botVergleich = (o) => ({ status: 'ahead', anzahl: 1, dateien: ['data/a.json'], commitsGesamt: 2, autoren: BOTS, ...o })
pruefe('C: mehr Commits als geliefert (Liste abgeschnitten) -> Grund', botSprungAusnahme(botVergleich({ commitsGesamt: 3 }), ['worker/a.ts'], leserStub(null)) === 'Vergleich evtl. abgeschnitten')
pruefe('C: design-regeln.md unter den Bewegungen -> Bot bewegte die Datei', botSprungAusnahme(botVergleich({ dateien: ['data/a.json', 'docs/wissen/design-regeln.md'] }), ['web/src/index.css'], leserStub(null)) === 'main bewegte docs/wissen/design-regeln.md')
pruefe('C: genau an der Compare-Grenze -> Grund',botSprungAusnahme(botVergleich({ anzahl: 300 }), ['worker/a.ts'], leserStub(null)) === 'Vergleich evtl. abgeschnitten')
pruefe('C: eine unter der Compare-Grenze -> null', botSprungAusnahme(botVergleich({ anzahl: 299 }), ['docs/a.md'], leserStub(null)) === null)
pruefe('C: diverged -> Grund', /diverged/.test(botSprungAusnahme(botVergleich({ status: 'diverged' }), ['worker/a.ts'], leserStub(null))))
pruefe('C: Umbenennung aus data/ heraus auf PR-Seite: alter Name trifft eine bewegte Datei -> berührt', botSprungAusnahme(botVergleich({ dateien: ['data/alt.json', 'data/a.json'] }), ['docs/a.md', 'data/alt.json'], leserStub(null)) === 'der PR berührt data/alt.json')
// Takt und Frist wie in docs/wissen/betrieb.md beschrieben (alle 2 s, höchstens 60 s; gemessen war der Ref nach wenigen Sekunden neu).
pruefe('Warten: alle 2 s, höchstens 60 s', REF_ABSTAND_MS === 2000 && REF_PRUEFUNGEN * REF_ABSTAND_MS === 60000, { REF_ABSTAND_MS, REF_PRUEFUNGEN })
// Grenze relativ zu REF_PRUEFUNGEN: neu gerechnet bei der letzten erlaubten Prüfung -> 1; eine Prüfung später -> Fehler, kein zweites Öffnen.
for (const [alt, ok] of [[3, true], [REF_PRUEFUNGEN + 1, true], [REF_PRUEFUNGEN + 2, false]]) {
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: [...Array(alt).fill(M_ALT), M_NEU] }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  const gewartet = k.gewartet.join() === Array(Math.min(alt - 1, REF_PRUEFUNGEN)).fill(REF_ABSTAND_MS).join()
  const erwartet = ok ? 'pr close 7,pr reopen 7,pr close 7,pr reopen 7' : 'pr close 7,pr reopen 7'
  const meldung = ok || /FEHLER PR 7: Merge-Commit nicht neu gerechnet, die Kette läuft noch gegen 7a466acc8/.test(k.meldungen.join())
  pruefe(`Merge-Commit ${alt}× alt gelesen -> ${ok ? 1 : 2}`, code === (ok ? 1 : 2) && gewartet && schreibend(k.aufrufe).join() === erwartet && meldung, { code, w: k.gewartet.length, m: k.meldungen })
}
{
  const start = performance.now() // uhr-echt: misst, dass schlafe wirklich wartet
  pruefe('schlafe wartet wirklich (Atomics.wait läuft ab, mindestens die Frist)', schlafe(50) === 'timed-out' && performance.now() - start >= 50)
}
for (const [n, erwartet] of [[1, 'pr close 7,pr reopen 7,pr reopen 7'], [2, 'pr close 7,pr reopen 7,pr reopen 7,pr reopen 7']]) {
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: [M_NEU] }), { reopenFehler: n })
  const code = nachrechnen(7, k.gh, k.melde, k.warte)
  pruefe(`Öffnen scheitert ${n}× -> weiterer Versuch, Ergebnis 1`, code === 1 && schreibend(k.aufrufe).join() === erwartet, k.aufrufe)
}
{
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: [M_NEU] }), { reopenFehler: 3 })
  let meldung = ''
  try {
    nachrechnen(7, k.gh, k.melde, k.warte)
  } catch (e) {
    meldung = e.message
  }
  pruefe('Öffnen scheitert 3× -> lauter Fehler, kein vierter Versuch', /PR 7 BLEIBT GESCHLOSSEN/.test(meldung) && schreibend(k.aufrufe).length === 4, { meldung, a: k.aufrufe })
}
{
  const daten = antworten({ mainSha: MAIN })
  daten['pr close 7'] = { fehler: '403' }
  const k = kulisse(daten)
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe('Schließen scheitert -> 2, kein Öffnen', code === 2 && !k.aufrufe.includes('pr reopen 7') && /FEHLER 403/.test(k.meldungen.join()), { a: k.aufrufe, m: k.meldungen })
}

// 1597 R2, Befund 2: leerer Test-Merge vor dem Anstoß -> klare Meldung, Exit 2, nichts geschlossen, kein Absturz.
{
  const k = kulisse(antworten({ mainSha: MAIN, mergeShas: [''] }))
  const code = main(['7'], k.gh, k.melde, k.warte)
  const m = k.meldungen.join()
  pruefe('Test-Merge leer vor dem Anstoß -> 2, nichts geschlossen, klare Meldung', code === 2 && schreibend(k.aufrufe).length === 0 && /Test-Merge noch nicht berechnet, gleich erneut aufrufen/.test(m) && !/Cannot read/.test(m), { code, a: k.aufrufe, m })
}
// 1597 R2, Befund 1: Fehler nach dem Schließen sagen „SCHON ANGESTOSSEN“, Fehler davor nicht.
for (const [name, daten, opt, angestossen] of [
  ['Öffnen scheitert 3×', antworten({ mainSha: MAIN, mergeShas: [M_NEU] }), { reopenFehler: 3 }, true],
  ['Merge-Commit nie neu', antworten({ mainSha: MAIN, mergeShas: Array(REF_PRUEFUNGEN + 3).fill(M_ALT) }), {}, true],
  ['Schließen scheitert', { ...antworten({ mainSha: MAIN }), 'pr close 7': { fehler: '403' } }, {}, false],
]) {
  const k = kulisse(daten, opt)
  const code = main(['7'], k.gh, k.melde, k.warte)
  pruefe(`${name} -> 2, Meldung ${angestossen ? 'nennt' : 'verschweigt'} den Anstoß`, code === 2 && /SCHON ANGESTOSSEN/.test(k.meldungen.join()) === angestossen, { code, m: k.meldungen })
}

/** Fälle, die nichts anstoßen: Exit 2, Meldung, kein Schreibaufruf. */
const UNKLAR = [
  ['Konflikt', antworten({ pr: { ...PR, mergeable: 'CONFLICTING' }, mainSha: MAIN }), /Konflikt/],
  ['Mergebarkeit unbekannt', antworten({ pr: { ...PR, mergeable: 'UNKNOWN' }, mainSha: MAIN }), /noch nicht berechnet/],
  ['geschlossen', antworten({ pr: { ...PR, state: 'CLOSED' }, mainSha: MAIN }), /nicht offen/],
  ['kein Lauf zum Kopf', antworten({ laeufe: [lauf(MAIN, '2026-10-19T12:00:00Z', 12)], mainSha: MAIN }), /kein Kettenlauf zum Kopf 08798af3f/],
  ['Job fehlt im Lauf', antworten({ jobs: [{ name: 'Kette – Logik', databaseId: 91 }], mainSha: MAIN }), /keinen Job „Kette – Workflows“/],
  ['Log ohne Basis (Job übersprungen)', antworten({ log: 'Job übersprungen', mainSha: MAIN }), /Basis nicht im Log/],
]
for (const [name, daten, muster] of UNKLAR) {
  const k = kulisse(daten)
  const code = nachrechnen(7, k.gh, k.melde, k.warte)
  pruefe(`${name} -> 2, nichts angestoßen`, code === 2 && schreibend(k.aufrufe).length === 0 && muster.test(k.meldungen.join()), { code, a: k.aufrufe, m: k.meldungen })
}

for (const argv of [[], ['abc'], ['7', '8'], ['7x']]) {
  const k = kulisse(antworten())
  pruefe(`Aufruf ${JSON.stringify(argv)} -> 2 mit Hinweis, kein gh`, main(argv, k.gh, k.melde, k.warte) === 2 && k.aufrufe.length === 0 && /^Aufruf:/.test(k.meldungen[0]), k.meldungen)
}
{
  const k = kulisse(antworten())
  pruefe('main reicht die Nummer durch: aktuell -> 0', main(['7'], k.gh, k.melde, k.warte) === 0 && k.aufrufe[0].startsWith('pr view 7 '), k.aufrufe)
}

// Startlogik als eigener Prozess: echte argv, echtes gh() mit ersetztem execFileSync, echter Exit-Code.
function prozess(daten, argv) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-'))
  const env = { ...process.env, ATTRAPPE_DATEN: path.join(ordner, 'daten.json'), ATTRAPPE_LOG: path.join(ordner, 'log.ndjson') }
  fs.writeFileSync(env.ATTRAPPE_DATEN, JSON.stringify(daten))
  fs.writeFileSync(env.ATTRAPPE_LOG, '')
  const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
  const skript = fileURLToPath(new URL('./pr-nachrechnen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', vorlader, skript, ...argv], { encoding: 'utf8', windowsHide: true, env })
  const aufrufe = fs.readFileSync(env.ATTRAPPE_LOG, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
  fs.rmSync(ordner, { recursive: true, force: true })
  return { status: r.status, aus: r.stdout, err: r.stderr, aufrufe }
}
{
  const r = prozess(antworten(), ['7'])
  pruefe('Prozess: aktuell -> Exit 0, Zeile auf stdout', r.status === 0 && /PR 7: aktuell/.test(r.aus), r)
  const optionen = r.aufrufe.map(([befehl, , o]) => `${befehl} ${o.encoding} ${o.windowsHide} ${o.maxBuffer}`)
  pruefe('Prozess: jeder Aufruf ist gh, utf8, ohne Fenster, Puffer 64 MiB', optionen.length === 5 && optionen.every((o) => o === `gh utf8 true ${64 * 1024 * 1024}`), optionen)
}
{
  const r = prozess(antworten({ mainSha: MAIN }), ['7'])
  const args = r.aufrufe.map(([, a]) => a.join(' '))
  pruefe('Prozess: veraltet -> Exit 1, schließt und öffnet 7 zweimal', r.status === 1 && schreibend(args).join() === 'pr close 7,pr reopen 7,pr close 7,pr reopen 7', { status: r.status, args })
}
{
  const r = prozess(antworten({ nr: 1602, pr: { ...PR, number: 1602 }, mainSha: MAIN }), ['1602'])
  const args = r.aufrufe.map(([, a]) => a.join(' '))
  pruefe('Prozess: Nummer aus argv (1602) reicht bis zum Schließen', r.status === 1 && args[0].startsWith('pr view 1602 ') && args.slice(-2).join() === 'pr close 1602,pr reopen 1602', { status: r.status, args })
}
{
  // Ein Warten im echten Prozess: der Startblock reicht schlafe durch (fehlt es, scheitert der Aufruf mit Exit 2).
  const start = performance.now() // uhr-echt: belegt, dass der Startblock das echte Warten durchreicht
  const r = prozess(antworten({ mainSha: MAIN, mergeShas: [M_ALT, '', M_NEU] }), ['7'])
  const dauer = performance.now() - start
  const args = r.aufrufe.map(([, a]) => a.join(' '))
  pruefe('Prozess: Merge-Commit erst nach einem Warten neu -> Exit 1, zweimal geöffnet, wartet REF_ABSTAND_MS', r.status === 1 && schreibend(args).length === 4 && dauer >= REF_ABSTAND_MS, { status: r.status, aus: r.aus, dauer })
}
{
  const daten = antworten({ mainSha: MAIN })
  daten['pr reopen 7'] = { fehler: 'kaputt' }
  const r = prozess(daten, ['7'])
  pruefe('Prozess: bleibt geschlossen -> Exit 2, Meldung', r.status === 2 && /BLEIBT GESCHLOSSEN/.test(r.aus), r)
}
{
  const r = prozess(antworten({ mainSha: MAIN, mainDateien: DATEN_MAIN }), ['7'])
  const args = r.aufrufe.map(([, a]) => a.join(' '))
  pruefe('Prozess: nur Daten bewegt -> Exit 0, Zeile auf stdout, nichts geschlossen', r.status === 0 && /seitdem nur Daten bewegt/.test(r.aus) && schreibend(args).length === 0, { status: r.status, aus: r.aus, args })
}
{
  // Ohne eingespeisten Leser läuft der echte Git-Anschluss; die Attrappe kennt kein git -> „nicht ermittelbar“, im Zweifel veraltet.
  const r = prozess(antworten({ mainSha: MAIN, mainDateien: BOT_MAIN, autoren: BOTS, prDateien: '.github/workflows/w.yml\n' }), ['7'])
  const args = r.aufrufe.map(([befehl, a]) => `${befehl} ${a.join(' ')}`)
  pruefe('Prozess: Bot-Sprung ohne eingespeisten Leser -> echter Anschluss ruft git, Exit 1 mit Grund', r.status === 1 && args.some((a) => a.startsWith('git fetch -q origin refs/pull/7/head')) && /Leser nicht ermittelbar/.test(r.aus), { status: r.status, aus: r.aus, args })
}
{
  const r = prozess(antworten({ mainSha: MAIN, mainDateien: [...DATEN_MAIN, 'tools/umfang-grenzen.json'] }), ['7'])
  pruefe('Prozess: auch umfang-grenzen.json bewegt -> Exit 1', r.status === 1, r)
}
{
  const r = prozess(antworten(), [])
  pruefe('Prozess: ohne Argument -> Exit 2, kein gh', r.status === 2 && r.aufrufe.length === 0 && /Aufruf:/.test(r.aus), r)
}

// Bindung an die Workflows: JOB checkt den Merge-Commit des Ereignisses aus (kein eigenes ref), die Kette hört auf `reopened`.
const kette = parse(fs.readFileSync(new URL(`../.github/workflows/${KETTE}`, import.meta.url), 'utf8'))
const jobs = Object.values(kette.jobs).filter((j) => j.name === JOB)
const checkout = jobs[0]?.steps.filter((s) => String(s.uses ?? '').startsWith('actions/checkout@')) ?? []
pruefe(`${KETTE}: genau ein Job „${JOB}“ mit genau einem Checkout ohne ref`, jobs.length === 1 && checkout.length === 1 && checkout[0].with?.ref === undefined, checkout)
pruefe(`${KETTE}: reopened startet die Kette`, kette.on.pull_request.types.includes('reopened'), kette.on)
// A1 (Prüfer 1597): Wiederöffnen startet den CI-Prüfer nicht neu (Kosten, Freigabe könnte kippen); nur diese drei Ereignisse.
const pruefer = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
pruefe('pr-pruefer.yml: nur pull_request_target, ohne reopened', Object.keys(pruefer.on).join() === 'pull_request_target' && pruefer.on.pull_request_target.types.join() === 'opened,synchronize,ready_for_review', pruefer.on)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen.test: grün')
