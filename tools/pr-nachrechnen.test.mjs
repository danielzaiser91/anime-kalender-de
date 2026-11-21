/**
 * Tests für tools/pr-nachrechnen.mjs: Urteil ohne Nachzug (eine Bewegung auf main hält nichts auf, nur Konflikt, Ersatz, Prüfer-Sperre),
 * `nachziehen` für Stapel-PRs (update-branch, Rückfall Schließen/Öffnen), Startlogik als eigener Prozess (Vorlader tools/pr-nachrechnen-mock.mjs)
 * und die Bindung an pr-pruefung.yml und pr-pruefer.yml.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { KOPF_ABSTAND_MS, KOPF_PRUEFUNGEN } from './pr-nachrechnen-zweig.mjs'
import { REF_ABSTAND_MS, REF_PRUEFUNGEN, hindernis, istDatenpfad, main, nachrechnen, nachziehen, nachziehenMain, schlafe } from './pr-nachrechnen.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const KOPF = '08798af3f0daf193fc754d6eda60ee60b526450f'
const BASIS = '7a466acc8119e87fbe8dc51782126a6167c5b70a'
const MAIN = 'c0ffee'.padEnd(40, '0')
const KOPF_NEU = 'd4'.padEnd(40, '4')
const M_ALT = 'a1'.padEnd(40, '1')
const M_NEU = 'b2'.padEnd(40, '2')

const offen = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE' }
pruefe('hindernis: offen und mergebar -> keins', hindernis(offen) === null)
pruefe('hindernis: geschlossen', /nicht offen \(CLOSED\)/.test(hindernis({ ...offen, state: 'CLOSED' })))
pruefe('hindernis: Konflikt nennt „Konflikt mit main“ (Leser basis-gemergt-neustart)', /Konflikt mit main: erst main hineinmergen/.test(hindernis({ ...offen, mergeable: 'CONFLICTING' })))
pruefe('hindernis: Mergebarkeit unbekannt nennt „noch nicht berechnet“ (Leser nacht-merger)', /noch nicht berechnet \(UNKNOWN\)/.test(hindernis({ ...offen, mergeable: 'UNKNOWN' })))
pruefe('istDatenpfad: public/data und data/cache ja, Code und Handdaten nein', istDatenpfad('public/data/titles.json') && istDatenpfad('data/cache/anilist-media.json') && !istDatenpfad('tools/check-x.mjs') && !istDatenpfad('data/dub-confirmed.yaml'))

// Kulisse: Antworten je genauer Argumentliste. Der PR-Kopf ist KOPF; main ist längst weiter (MAIN), das zählt nicht mehr.
const PR = { number: 7, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: KOPF, headRefName: 'fix/x', comments: [], commits: [] }
const FELDER = 'number,state,mergeable,headRefOid,headRefName,comments,commits'
const PUT = `api -X PUT repos/{owner}/{repo}/pulls/7/update-branch -f expected_head_sha=${KOPF}`
const KOPF_LESEN = 'api repos/{owner}/{repo}/pulls/7 --jq .head.sha'
const REF = 'api repos/{owner}/{repo}/pulls/7 --jq .merge_commit_sha'
function antworten({ nr = 7, pr = PR, offene = [], mergeShas = [M_ALT, M_NEU], zusatz = {} } = {}) {
  return {
    [`pr view ${nr} --json ${FELDER}`]: { aus: JSON.stringify(pr) },
    'pr list --state open --limit 200 --json number,title,body': { aus: JSON.stringify(offene) },
    'api repos/{owner}/{repo}/git/ref/heads/main --jq .object.sha': { aus: `${MAIN}\n` },
    [REF]: { aus: mergeShas.map((s) => `${s}\n`) },
    [`api repos/{owner}/{repo}/commits/${M_ALT} --jq .parents[0].sha`]: { aus: `${BASIS}\n` },
    [`api repos/{owner}/{repo}/commits/${M_NEU} --jq .parents[0].sha`]: { aus: `${MAIN}\n` },
    'pr close 7': { aus: '' },
    'pr reopen 7': { aus: '' },
    [PUT]: { aus: '{"message":"Updating pull request branch."}' },
    [KOPF_LESEN]: { aus: `${KOPF_NEU}\n` },
    ...zusatz,
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
const LESEN = [`pr view 7 --json ${FELDER}`, 'pr list --state open --limit 200 --json number,title,body']
const schreibend = (aufrufe) => aufrufe.filter((a) => /^pr (close|reopen|comment|edit|merge)|update-branch/.test(a))

// Kern der Änderung (Daniel 21.11.2026): main bewegte Code, kein Konflikt -> mergebar, Exit 0 (vorher 1 mit update-branch).
const WEGE = [
  ['nachrechnen', (k) => nachrechnen(7, k.gh, k.melde, false)],
  ['main', (k) => main(['7'], k.gh, k.melde)],
  ['main --trocken 7', (k) => main(['--trocken', '7'], k.gh, k.melde)],
  ['main 7 --trocken', (k) => main(['7', '--trocken'], k.gh, k.melde)],
]
for (const [name, aufruf] of WEGE) {
  const k = kulisse(antworten())
  const code = aufruf(k)
  pruefe(`${name}: mergebar, main weiter -> Exit 0, liest nur PR und Ersatz-Liste, schreibt nichts`, code === 0 && k.aufrufe.join() === LESEN.join() && schreibend(k.aufrufe).length === 0, { code, a: k.aufrufe })
  pruefe(`${name}: Meldung nennt Kopf und „kein Nachzug“`, k.meldungen.join() === 'PR 7: mergebar, kein Konflikt mit main (Kopf 08798af3f); eine Bewegung auf main erzwingt keinen Nachzug', k.meldungen)
}

/** Fälle, die aufhalten: Exit, Meldung, kein Schreibaufruf (für nachrechnen und nachziehen gleich). */
const ERSETZER = [{ number: 6, title: 'a', body: 'x' }, { number: 9, title: 'Neu', body: 'ersetzt PR #7' }, { number: 12, title: 'b', body: 'ersetzt PR 70' }]
const HALT = [
  ['Konflikt', antworten({ pr: { ...PR, mergeable: 'CONFLICTING' } }), 2, /^PR 7 hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu$/],
  ['Mergebarkeit unbekannt', antworten({ pr: { ...PR, mergeable: 'UNKNOWN' } }), 2, /^PR 7: Mergebarkeit noch nicht berechnet \(UNKNOWN\), gleich erneut aufrufen$/],
  ['geschlossen', antworten({ pr: { ...PR, state: 'CLOSED' } }), 2, /^PR 7 ist nicht offen \(CLOSED\)$/],
  ['ersetzt (auch bei Konflikt zuerst)', antworten({ pr: { ...PR, mergeable: 'CONFLICTING' }, offene: ERSETZER }), 3, /^PR 7: ERSETZT durch PR 9 /],
]
for (const [name, daten, exit, muster] of HALT) {
  for (const [weg, aufruf] of [['nachrechnen', (k) => nachrechnen(7, k.gh, k.melde, false)], ['nachziehen', (k) => nachziehen(7, k.gh, k.melde, k.warte, false, false)]]) {
    const k = kulisse(daten)
    const code = aufruf(k)
    pruefe(`${weg}: ${name} -> Exit ${exit}, nichts geschrieben`, code === exit && muster.test(k.meldungen.join()) && schreibend(k.aufrufe).length === 0, { code, a: k.aufrufe, m: k.meldungen })
  }
}

// Prüfer-Sperre (12.11.2026): Verdrahtung; die Kommentarformen prüft pr-nachrechnen-pruefer.test.mjs.
{
  const urteil = { createdAt: '2026-11-12T10:30:00Z', body: '**Prüfer-Review** für 08798af3f - Urteil: **ändern** (Runde 1)' }
  const sperrPr = (committedDate) => ({ ...PR, comments: [urteil], commits: [{ oid: KOPF, committedDate }] })
  const k = kulisse(antworten({ pr: sperrPr('2026-11-12T10:00:00Z') }))
  const code = main(['7'], k.gh, k.melde)
  pruefe('Prüfer „ändern“ ohne Folgecommit -> Exit 4 mit Meldung', code === 4 && k.meldungen.join() === 'PR 7: PRÜFER VERLANGT ÄNDERUNG (Urteil 2026-11-12T10:30:00Z, letzter Commit 2026-11-12T10:00:00Z)', { code, m: k.meldungen })
  const k2 = kulisse(antworten({ pr: sperrPr('2026-11-12T11:00:00Z') }))
  pruefe('Gegenprobe: Folgecommit nach dem Urteil -> 0', main(['7'], k2.gh, k2.melde) === 0, k2.meldungen)
}
// Zug-Schalter: Basis zug -> 0 ohne Urteil über main; das Feld baseRefName kommt nur mit Schalter dazu.
{
  const daten = { ...antworten(), [`pr view 7 --json ${FELDER},baseRefName`]: { aus: JSON.stringify({ ...PR, baseRefName: 'zug' }) } }
  const k = kulisse(daten)
  pruefe('Zug-PR bei gelegtem Schalter -> 0 mit Zug-Meldung', nachrechnen(7, k.gh, k.melde, true) === 0 && /Basis zug, kein Nachrechnen gegen main/.test(k.meldungen.join()), k.meldungen)
}
for (const argv of [[], ['abc'], ['7', '8'], ['7x'], ['--trocken'], ['--trocken', 'x']]) {
  const k = kulisse(antworten())
  pruefe(`Aufruf ${JSON.stringify(argv)} -> 2 mit Hinweis, kein gh`, main(argv, k.gh, k.melde) === 2 && k.aufrufe.length === 0 && /^Aufruf: node tools\/pr-nachrechnen\.mjs \[--trocken\] <PR-Nummer>$/.test(k.meldungen.join()), k.meldungen)
}
{
  const k = kulisse({})
  pruefe('gh scheitert -> Exit 2 mit FEHLER und Ursache, nie still 0', main(['7'], k.gh, k.melde) === 2 && /^pr-nachrechnen: FEHLER HTTP 404: pr view 7 /.test(k.meldungen.join()), k.meldungen)
}

// nachziehen (Stapel-PRs nach dem Basis-Merge): update-branch (Lehre 129, tools/pr-nachrechnen-zweig.mjs), Kopf neu -> Exit 1.
pruefe('pr-nachrechnen-zweig.mjs: Grenzen 15 Lesungen à 2000 ms (30 s)', KOPF_PRUEFUNGEN === 15 && KOPF_ABSTAND_MS === 2000, { KOPF_PRUEFUNGEN, KOPF_ABSTAND_MS })
const anzahlPut = (k) => k.aufrufe.filter((a) => a === PUT).length
const prSchreibend = (k) => schreibend(k.aufrufe).filter((a) => a.startsWith('pr ')).join()
{
  const k = kulisse(antworten({ zusatz: { [KOPF_LESEN]: { aus: [`${KOPF}\n`, `${KOPF}\n`, `${KOPF_NEU}\n`] } } }))
  const code = nachziehenMain(['7'], k.gh, k.melde, k.warte)
  pruefe('nachziehen: update-branch -> Exit 1, ein PUT, kein Schließen/Öffnen, wartet zweimal', code === 1 && anzahlPut(k) === 1 && prSchreibend(k) === '' && k.gewartet.join() === '2000,2000', { code, a: k.aufrufe, w: k.gewartet })
  pruefe('nachziehen: Meldung nennt den neuen Kopf', k.meldungen.join().includes(`neuer Kopf ${KOPF_NEU}: Kette abwarten`), k.meldungen)
}
for (const argv of [['--trocken', '7'], ['7', '--trocken']]) {
  const k = kulisse(antworten())
  const code = nachziehenMain(argv, k.gh, k.melde, k.warte)
  pruefe(`nachziehen trocken (${argv.join(' ')}) -> Exit 1, nichts geschrieben`, code === 1 && schreibend(k.aufrufe).length === 0 && /Trockenlauf: nichts geschlossen, geöffnet oder aktualisiert/.test(k.meldungen.join()), { code, a: k.aufrufe })
}
// A3 (PR 4104): 4xx = nichts angestoßen, Rückfall Schließen/Öffnen (Merge-Commit alt -> zweimal öffnen), Kopf nie gelesen.
for (const [status, fehlerText] of [['422', 'gh: Merge conflict (HTTP 422)'], ['403', 'gh: Resource not accessible by personal access token (HTTP 403)']]) {
  const k = kulisse(antworten({ zusatz: { [PUT]: { fehler: fehlerText } } }))
  const code = nachziehen(7, k.gh, k.melde, k.warte, false, false)
  pruefe(`nachziehen: update-branch ${status} -> Rückfall, Exit 1, zweimal geöffnet, Kopf nicht gelesen`, code === 1 && anzahlPut(k) === 1 && prSchreibend(k) === 'pr close 7,pr reopen 7,pr close 7,pr reopen 7' && !k.aufrufe.includes(KOPF_LESEN), k.aufrufe)
  pruefe(`nachziehen: Rückfallzeile ${status} genau einmal`, k.meldungen.filter((m) => m.includes(`update-branch abgewiesen (HTTP ${status}`)).length === 1, k.meldungen)
  pruefe(`nachziehen: Rückfall ${status} meldet zuletzt „geschlossen und wieder geöffnet“`, k.meldungen.at(-1) === 'PR 7: geschlossen und wieder geöffnet; Kette abwarten', k.meldungen)
}
{
  const k = kulisse(antworten({ mergeShas: [M_NEU], zusatz: { [PUT]: { fehler: 'gh: Merge conflict (HTTP 422)' } } }))
  pruefe('nachziehen: Merge-Commit schon auf main -> einmal öffnen genügt', nachziehen(7, k.gh, k.melde, k.warte, false, false) === 1 && prSchreibend(k) === 'pr close 7,pr reopen 7', k.aufrufe)
}
// A1/A2 (PR 4104): 5xx oder Zeitlimit nach Wirkung -> Kopf einmal lesen; unverändert = Exit 2 „SCHON ANGESTOSSEN“, nie zweiter PUT, nie Schließen.
for (const [name, fehlerText] of [['502', 'gh: Server Error (HTTP 502)'], ['Zeitlimit', 'FEHLER: gh api nach 30 s abgebrochen']]) {
  const wirkt = kulisse(antworten({ zusatz: { [PUT]: { fehler: fehlerText } } }))
  pruefe(`nachziehen: PUT wirkt, dann ${name} -> Exit 1 mit neuem Kopf`, nachziehenMain(['7'], wirkt.gh, wirkt.melde, wirkt.warte) === 1 && anzahlPut(wirkt) === 1 && wirkt.meldungen.join().includes(`neuer Kopf ${KOPF_NEU}`), wirkt.meldungen)
  const nicht = kulisse(antworten({ zusatz: { [PUT]: { fehler: fehlerText }, [KOPF_LESEN]: { aus: `${KOPF}\n` } } }))
  pruefe(`nachziehen: PUT ${name}, Kopf alt -> Exit 2 „SCHON ANGESTOSSEN möglich“, kein Schließen`, nachziehenMain(['7'], nicht.gh, nicht.melde, nicht.warte) === 2 && /SCHON ANGESTOSSEN möglich/.test(nicht.meldungen.join()) && !nicht.aufrufe.includes('pr close 7'), nicht.meldungen)
}
for (const [name, fehlerText] of [['502', 'gh: Server Error (HTTP 502)'], ['Zeitlimit', 'FEHLER: gh api nach 30 s abgebrochen']]) {
  const leer = kulisse(antworten({ zusatz: { [PUT]: { fehler: fehlerText }, [KOPF_LESEN]: { aus: '\n' } } }))
  pruefe(`nachziehen: PUT ${name}, leere Kopf-Antwort -> Exit 2 „SCHON ANGESTOSSEN möglich“ (leer ist kein neuer Kopf)`, nachziehenMain(['7'], leer.gh, leer.melde, leer.warte) === 2 && /SCHON ANGESTOSSEN möglich/.test(leer.meldungen.join()) && prSchreibend(leer) === '', leer.meldungen)
  const blind = kulisse(antworten({ zusatz: { [PUT]: { fehler: fehlerText }, [KOPF_LESEN]: { fehler: 'gh: Bad Gateway (HTTP 502)' } } }))
  pruefe(`nachziehen: PUT ${name}, Kopf nicht lesbar -> Exit 2 „SCHON ANGESTOSSEN“ mit Lesefehler`, nachziehenMain(['7'], blind.gh, blind.melde, blind.warte) === 2 && /SCHON ANGESTOSSEN/.test(blind.meldungen.join()) && /Kopf nicht lesbar \(gh: Bad Gateway/.test(blind.meldungen.join()) && prSchreibend(blind) === '', blind.meldungen)
}
// Nur Zeile und Text des Rückfalls: Status, auf 120 Zeichen gekürzter Text, Hinweis auf das Token-Recht nur bei „workflow“.
const T403 = 'gh: Resource not accessible by personal access token - refusing to allow a Personal Access Token to create or update workflow `.github/workflows/x.yml` without `workflow` scope (HTTP 403)'
{
  const zeile = (text) => {
    const k = kulisse(antworten({ zusatz: { [PUT]: { fehler: text } } }))
    nachziehenMain(['7'], k.gh, k.melde, k.warte)
    return k.meldungen.filter((m) => m.includes('update-branch abgewiesen'))
  }
  pruefe('Rückfallzeile 422: genau eine, mit Status und Text, ohne Token-Hinweis', zeile('gh: Merge conflict (HTTP 422)').join('|') === 'PR 7: update-branch abgewiesen (HTTP 422: gh: Merge conflict (HTTP 422)) – Rückfall Schließen/Öffnen')
  const z3 = zeile(T403)
  pruefe('Rückfallzeile 403 mit „workflow“: HTTP 403, Text auf genau 120 Zeichen gekürzt, Token-Hinweis', T403.length > 121 && z3.join('|') === `PR 7: update-branch abgewiesen (HTTP 403: ${T403.slice(0, 120)}) – Rückfall Schließen/Öffnen; Token ohne Workflows-Recht?`, z3)
  pruefe('Rückfallzeile 403 ohne „workflow“: kein Token-Hinweis', !zeile('gh: Resource not accessible (HTTP 403)').join().includes('Workflows-Recht'))
}
// PUT angenommen: Kopf lesen scheitert, bleibt alt oder leer -> Exit 2 „SCHON ANGESTOSSEN“, nie zweiter PUT, nie Schließen/Öffnen.
{
  const k = kulisse(antworten({ zusatz: { [KOPF_LESEN]: { fehler: 'gh: Bad Gateway (HTTP 502)' } } }))
  pruefe('nachziehen: PUT ok, Kopf lesen wirft -> Exit 2 „SCHON ANGESTOSSEN“ mit Lesefehler, ein PUT, nichts geschlossen', nachziehenMain(['7'], k.gh, k.melde, k.warte) === 2 && /SCHON ANGESTOSSEN/.test(k.meldungen.join()) && /Kopf nicht lesbar/.test(k.meldungen.join()) && anzahlPut(k) === 1 && prSchreibend(k) === '', k.meldungen)
  const alt = kulisse(antworten({ zusatz: { [KOPF_LESEN]: { aus: `${KOPF}\n` } } }))
  pruefe('nachziehen: PUT ok, Kopf bleibt alt -> Exit 2 „SCHON ANGESTOSSEN“ nach 16 Lesungen und 15 Pausen', nachziehenMain(['7'], alt.gh, alt.melde, alt.warte) === 2 && /SCHON ANGESTOSSEN/.test(alt.meldungen.join()) && alt.gewartet.length === 15 && alt.aufrufe.filter((a) => a === KOPF_LESEN).length === 16 && prSchreibend(alt) === '', { m: alt.meldungen, n: alt.gewartet.length })
  const leer = kulisse(antworten({ zusatz: { [KOPF_LESEN]: { aus: ['\n', `${KOPF_NEU}\n`] } } }))
  pruefe('nachziehen: PUT ok, leere Kopf-Antwort zählt nicht als neu (wartet, nennt dann den echten)', nachziehenMain(['7'], leer.gh, leer.melde, leer.warte) === 1 && leer.gewartet.length === 1 && leer.meldungen.join().includes(`neuer Kopf ${KOPF_NEU}`), { w: leer.gewartet, m: leer.meldungen })
}
// Takt und Frist des Rückfalls (alle 2 s, höchstens 60 s); eine Prüfung über der Grenze -> Fehler „SCHON ANGESTOSSEN“, kein zweites Öffnen.
pruefe('Warten: alle 2 s, höchstens 60 s', REF_ABSTAND_MS === 2000 && REF_PRUEFUNGEN * REF_ABSTAND_MS === 60000, { REF_ABSTAND_MS, REF_PRUEFUNGEN })
for (const [alt, ok] of [[3, true], [REF_PRUEFUNGEN + 1, true], [REF_PRUEFUNGEN + 2, false]]) {
  const k = kulisse(antworten({ mergeShas: [...Array(alt).fill(M_ALT), M_NEU], zusatz: { [PUT]: { fehler: 'gh: Merge conflict (HTTP 422)' } } }))
  const code = nachziehenMain(['7'], k.gh, k.melde, k.warte)
  const oeffnen = schreibend(k.aufrufe).filter((a) => a.startsWith('pr ')).length
  pruefe(`nachziehen: Merge-Commit ${alt}× alt -> ${ok ? 1 : 2}`, code === (ok ? 1 : 2) && oeffnen === (ok ? 4 : 2) && (ok || /SCHON ANGESTOSSEN/.test(k.meldungen.join())), { code, m: k.meldungen })
}
{
  const k = kulisse(antworten({ mergeShas: [''], zusatz: { [PUT]: { fehler: 'gh: Merge conflict (HTTP 422)' } } }))
  pruefe('nachziehen: Test-Merge leer vor dem Rückfall -> 2, nichts geschlossen', nachziehenMain(['7'], k.gh, k.melde, k.warte) === 2 && !k.aufrufe.includes('pr close 7') && /Test-Merge noch nicht berechnet/.test(k.meldungen.join()), k.meldungen)
}
{
  const k = kulisse(antworten({ mergeShas: [M_NEU], zusatz: { [PUT]: { fehler: 'gh: Merge conflict (HTTP 422)' } } }), { reopenFehler: 3 })
  pruefe('nachziehen: Öffnen scheitert 3× -> Exit 2 „BLEIBT GESCHLOSSEN“, kein vierter Versuch', nachziehenMain(['7'], k.gh, k.melde, k.warte) === 2 && /PR 7 BLEIBT GESCHLOSSEN/.test(k.meldungen.join()) && k.aufrufe.filter((a) => a === 'pr reopen 7').length === 3, k.meldungen)
}
{
  const start = performance.now() // uhr-echt: misst, dass schlafe wirklich wartet
  pruefe('schlafe wartet wirklich (Atomics.wait läuft ab, mindestens die Frist)', schlafe(50) === 'timed-out' && performance.now() - start >= 49)
}

// Startlogik als eigener Prozess: echte argv, echtes gh() mit ersetztem execFileSync, echter Exit-Code.
function prozess(daten, argv) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-'))
  const env = { ...process.env, ATTRAPPE_DATEN: path.join(ordner, 'daten.json'), ATTRAPPE_LOG: path.join(ordner, 'log.ndjson') }
  fs.writeFileSync(env.ATTRAPPE_DATEN, JSON.stringify(daten))
  fs.writeFileSync(env.ATTRAPPE_LOG, '')
  const vorlader = pathToFileURL(fileURLToPath(new URL('./pr-nachrechnen-mock.mjs', import.meta.url))).href
  const skript = fileURLToPath(new URL('./pr-nachrechnen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', vorlader, skript, ...argv], { encoding: 'utf8', windowsHide: true, env, timeout: 60_000 })
  const aufrufe = fs.readFileSync(env.ATTRAPPE_LOG, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
  fs.rmSync(ordner, { recursive: true, force: true })
  return { status: r.status, aus: r.stdout, err: r.stderr, aufrufe }
}
{
  const r = prozess(antworten(), ['7'])
  pruefe('Prozess: mergebar -> Exit 0, Zeile auf stdout', r.status === 0 && /^PR 7: mergebar, kein Konflikt mit main/m.test(r.aus), r)
  const optionen = r.aufrufe.map(([befehl, , o]) => `${befehl} ${o.encoding} ${o.windowsHide} ${o.maxBuffer}`)
  pruefe('Prozess: zwei Aufrufe, jeder gh, utf8, ohne Fenster, Puffer 64 MiB', optionen.length === 2 && optionen.every((o) => o === `gh utf8 true ${64 * 1024 * 1024}`), optionen)
}
{
  const r = prozess(antworten({ nr: 1602, pr: { ...PR, number: 1602, mergeable: 'CONFLICTING' } }), ['1602'])
  pruefe('Prozess: Nummer aus argv (1602), Konflikt -> Exit 2 mit Meldung', r.status === 2 && /^PR 1602 hat einen Konflikt mit main/m.test(r.aus) && r.aufrufe[0][1].join(' ').startsWith('pr view 1602 '), r)
}
{
  const r = prozess(antworten(), [])
  pruefe('Prozess: ohne Argument -> Exit 2, kein gh', r.status === 2 && r.aufrufe.length === 0 && /^Aufruf:/m.test(r.aus), r)
}
{
  // Start-Guard: ein Import (z. B. aus einem Test) startet main() nicht.
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-import-'))
  const lader = path.join(ordner, 'import.mjs')
  fs.writeFileSync(lader, `await import(${JSON.stringify(new URL('./pr-nachrechnen.mjs', import.meta.url).href)})\nconsole.log('geladen')\n`)
  const r = spawnSync(process.execPath, [lader], { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  fs.rmSync(ordner, { recursive: true, force: true })
  pruefe('Import startet main() nicht (Exit 0, nur „geladen“ auf stdout)', r.status === 0 && r.stdout.trim() === 'geladen', { status: r.status, aus: r.stdout, err: r.stderr })
}

// Bindung: der Rückfall von `nachziehen` startet die Kette über `reopened`; Wiederöffnen startet den CI-Prüfer nicht neu (A1, Prüfer 1597).
const kette = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefung.yml', import.meta.url), 'utf8'))
pruefe('pr-pruefung.yml: reopened startet die Kette', kette.on.pull_request.types.includes('reopened'), kette.on)
const pruefer = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
pruefe('pr-pruefer.yml: nur pull_request_target, ohne reopened', Object.keys(pruefer.on).join() === 'pull_request_target' && pruefer.on.pull_request_target.types.join() === 'opened,synchronize,ready_for_review', pruefer.on)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen.test: grün')
