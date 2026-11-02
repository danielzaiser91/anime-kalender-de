/**
 * Beleg „check:workflows war für diesen Inhalt grün“ (tools/workflows-beleg.mjs): Abdruck aus echtem git in einem Wegwerf-Repo, Wahl des
 * Belegs mit eingespritzter gh-Antwort (Treffer, anderer Abdruck, `pruefen` rot, Fehler), Kommandozeile und Verdrahtung in deploy.yml (geparst).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { ohneKommentare } from './pr-nachrechnen-leser.mjs'
import { ECHT, JOBS_HOECHSTENS, LAEUFE_HOECHSTENS, ZAEHLT, abdruckAusBaum, gueltigkeit, main, pruefenGruen, sucheBeleg } from './workflows-beleg.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wegwerf = mkdtempSync(join(tmpdir(), 'workflows-beleg-'))
let faelle = 0
const gleich = (ist, soll, name) => {
  assert.deepEqual(ist, soll, name)
  faelle += 1
}
const ok = (bedingung, name) => {
  assert.ok(bedingung, name)
  faelle += 1
}

// Datenpfad-Namen zusammengesetzt: der Schreibziel-Scanner liest data/-Literale als Ziele.
const DATEN = ['public', 'data'].join('/')
const HAND = ['data', 'dub-confirmed.yaml'].join('/')
const CACHE = ['data', 'cache', 'x.json'].join('/')
const LISTE = ['daniel-zum-abarbeiten', 'stand.md'].join('/')
const BOT = ['data', 'source-health.json'].join('/')
const CACHE_REG = ['data', 'cache-register.json'].join('/')
const ZUGANG_REG = ['data', 'zugangs-register.json'].join('/')
const STICHPROBE = ['data', 'cartoon-jw-stichprobe.json'].join('/')

// 1. Echtes git: Datenpfade sind egal, alles andere zählt.
let nummer = 0
function repo() {
  const ordner = join(wegwerf, `r${(nummer += 1)}`)
  mkdirSync(ordner, { recursive: true })
  const git = (...a) => execFileSync('git', a, { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 })
  git('init', '-q', '-b', 'main')
  git('config', 'core.autocrlf', 'false')
  const commit = (dateien, name = 'c') => {
    for (const [pfad, text] of Object.entries(dateien)) {
      mkdirSync(dirname(join(ordner, pfad)), { recursive: true })
      writeFileSync(join(ordner, pfad), text)
    }
    git('add', '-A')
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', name)
    return git('rev-parse', 'HEAD').trim()
  }
  const abdruck = (sha) => abdruckAusBaum(git('ls-tree', '-r', '-z', sha))
  return { commit, abdruck }
}
{
  const r = repo()
  const a = r.commit({ 'tools/x.mjs': '1', [`${DATEN}/titles.json`]: '[]', [BOT]: 'a', [HAND]: 'a', [CACHE_REG]: 'a', [ZUGANG_REG]: 'a', [STICHPROBE]: 'a', [LISTE]: 'a' })
  const daten = r.commit({ [`${DATEN}/titles.json`]: '[1]', [BOT]: 'b', [CACHE]: 'c' })
  gleich(r.abdruck(daten), r.abdruck(a), 'nur Datenpfade bewegt (public/data, Cache, Bot-Datei): gleicher Abdruck')
  for (const datei of [HAND, CACHE_REG, ZUGANG_REG, STICHPROBE, LISTE]) {
    const gelesen = r.commit({ [datei]: 'geaendert' })
    ok(r.abdruck(gelesen) !== r.abdruck(daten), `nur ${datei} bewegt: anderer Abdruck (check:workflows liest sie)`)
  }
  const code = r.commit({ 'tools/x.mjs': '2' })
  ok(r.abdruck(code) !== r.abdruck(a), 'Code bewegt: anderer Abdruck')
  const wf = r.commit({ '.github/workflows/deploy.yml': 'on: push' })
  ok(r.abdruck(wf) !== r.abdruck(code), 'Workflow-Datei neu: anderer Abdruck')
  const neu = r.commit({ 'tools/neu.mjs': 'n' })
  const weg = r.commit({ 'tools/neu.mjs': 'n', 'tools/x.mjs': '2' })
  gleich(r.abdruck(weg), r.abdruck(neu), 'Commit ohne Änderung: gleicher Abdruck')
  const og = r.commit({ 'public/og/default.jpg': 'bild' })
  ok(r.abdruck(og) !== r.abdruck(weg), 'public/og/default.* zählt (andere Vorschaubilder sind Bot-Daten ohne Leser)')
  const aehnlich = r.commit({ 'datax/y.txt': '1', 'public/database.json': '1' })
  ok(r.abdruck(aehnlich) !== r.abdruck(og), 'Namen mit gleichem Anfang (datax/, public/database.json) sind keine Datenpfade')
  const tief = r.commit({ 'tools/data/x.txt': '1', 'tools/public/data/y.txt': '1', 'tools/daniel-zum-abarbeiten/z.txt': '1' })
  ok(r.abdruck(tief) !== r.abdruck(aehnlich), 'Datenpfade gelten nur am Anfang des Pfads (tools/data/… zählt)')
  const ur = r.commit({ 'tools/x.mjs': '3', 'tools/y.mjs': '1' })
  const ur2 = r.commit({ 'tools/x.mjs': '2' })
  ok(r.abdruck(ur2) !== r.abdruck(ur), 'anderer Inhalt: anderer Abdruck')
}
{
  const fehler = (roh, muster, name) => assert.throws(() => abdruckAusBaum(roh), muster, name)
  fehler('', /leerer Baum/, 'leerer Baum wirft')
  fehler('Müll\0', /unbekanntes Zeilenformat/, 'unbekanntes Format wirft')
  fehler(`100644 blob ${'a'.repeat(40)}\ta\nb\0`, /Zeilenumbruch/, 'Pfad mit Zeilenumbruch wirft')
  faelle += 3
  const nur = `100644 blob ${'a'.repeat(40)}\t${DATEN}/titles.json\0`
  ok(/^[0-9a-f]{64}$/.test(abdruckAusBaum(nur)), 'Baum nur aus Datenpfaden: Abdruck berechenbar (leere Menge)')
}

// 1b. Die echten Aufrufe: ECHT.baum liest den ganzen Baum (-r) im Arbeitsordner; Grenzen sind festgenagelt.
{
  const r = repo()
  const kopfSha = r.commit({ 'tools/a/b.mjs': '1', [`${DATEN}/titles.json`]: '[]' })
  const vorher = process.cwd()
  process.chdir(join(wegwerf, `r${nummer}`))
  try {
    gleich(ECHT.kopf(), kopfSha, 'ECHT.kopf: voller Hash des Checkouts ohne Zeilenende')
    const roh = ECHT.baum('HEAD')
    ok(roh.includes('tools/a/b.mjs\0'), 'ECHT.baum: Dateien in Unterordnern stehen im Baum (-r, -z)')
    gleich(abdruckAusBaum(roh), r.abdruck('HEAD'), 'ECHT.baum: gleicher Abdruck wie ls-tree im Ordner')
  } finally {
    process.chdir(vorher)
  }
  gleich([LAEUFE_HOECHSTENS, JOBS_HOECHSTENS], [50, 6], 'Grenzen: 50 Läufe gelesen, höchstens 6 Jobabfragen')
}

// 1c. Prüfer 2687 A1: Was `check:workflows` liest, zählt im Abdruck. Die Tests aus tests-alle deckt der Leser-Wächter von pr-nachrechnen-bot-pfade ab;
// hier die Skripte der Kette selbst: kein Datei-Literal der Daten darf in der Ausnahme (istDatenpfad) stehen.
{
  const kette = [...readFileSync(join(tools, '..', 'package.json'), 'utf8').matchAll(/check:workflows": "([^"]+)"/g)][0][1]
  const skripte = [...kette.matchAll(/node (tools\/[\w.-]+\.mjs)/g)].map((m) => m[1]).filter((s) => !s.endsWith('tests-alle.mjs'))
  ok(skripte.length === 4, `check:workflows: 4 Skripte neben tests-alle (${skripte.join(', ')})`)
  // Meldungstext, keine Lesung (tools/check-workflows.mjs: Hinweis auf die Prüfliste).
  const NUR_GENANNT = new Set([`tools/check-workflows.mjs|${['data', 'anbieter-vorschlaege.json'].join('/')}`])
  const literal = new RegExp(`${['data', ''].join('/')}[\\w./-]+\\.(?:json|jsonl|yaml|md)`, 'g')
  const treffer = skripte.flatMap((s) => [...ohneKommentare(readFileSync(join(tools, '..', s), 'utf8')).matchAll(literal)].map((m) => `${s}|${m[0]}`))
  ok(treffer.length >= 10, `Wächter findet die Literale der Skripte (${treffer.length})`)
  const ausgenommen = treffer.filter((t) => !ZAEHLT(t.split('|')[1]) && !NUR_GENANNT.has(t))
  gleich(ausgenommen, [], 'kein Datei-Literal der check:workflows-Skripte liegt in der Ausnahme des Abdrucks')
  for (const [name, datei] of [['Cache-Register', CACHE_REG], ['Zugangs-Register', ZUGANG_REG], ['Handbeleg', HAND], ['Stichprobe', STICHPROBE]]) {
    ok(ZAEHLT(datei), `${name} (${datei}) zählt im Abdruck`)
  }
  gleich([CACHE_REG, ZUGANG_REG].map((d) => treffer.some((t) => t.endsWith(d))), [true, true], 'Wächter sieht beide Register als Literal der Skripte')
  // Ausnahme bleibt für Bot-Dateien (sonst gäbe es nie einen Beleg nach einem Datenlauf).
  for (const datei of [BOT, DATEN + '/titles.json', CACHE]) ok(!ZAEHLT(datei), `${datei} zählt nicht`)
}

// 2. Wahl des Belegs (eingespritzte Antworten).
const lauf = (id, sha) => ({ id, head_sha: sha })
const jobs = (name, conclusion) => [{ name: 'herkunft', conclusion: 'success' }, { name, conclusion }]
const stand = { A: 'abdruck-A', B: 'abdruck-B', C: 'abdruck-A', D: 'abdruck-A' }
const abdruckVonSha = (sha) => {
  if (!(sha in stand)) throw new Error('unlesbar')
  return stand[sha]
}
const suche = (laeufe, jobsVon, eigeneId = 9999, abdruck = 'abdruck-A') => sucheBeleg({ laeufe, eigeneId, abdruck, abdruckVonSha, jobsVon })?.id ?? null
{
  const gruen = () => jobs('pruefen', 'success')
  gleich(suche([lauf(5, 'C')], gruen), 5, 'Treffer: gleicher Abdruck, pruefen grün')
  gleich(suche([lauf(5, 'B')], gruen), null, 'anderer Abdruck: kein Beleg')
  gleich(suche([lauf(5, 'C')], () => jobs('pruefen', 'failure')), null, 'pruefen rot: kein Beleg')
  gleich(suche([lauf(5, 'C')], () => jobs('pruefen', 'skipped')), null, 'pruefen übersprungen: kein Beleg')
  gleich(suche([lauf(5, 'C')], () => jobs('pruefen', 'cancelled')), null, 'pruefen abgebrochen: kein Beleg')
  gleich(suche([lauf(5, 'C')], () => jobs('build', 'success')), null, 'anderer Job grün, pruefen fehlt: kein Beleg')
  gleich(suche([lauf(5, 'C')], () => []), null, 'keine Jobs: kein Beleg')
  gleich(suche([], gruen), null, 'keine Läufe: kein Beleg')
  gleich(suche(undefined, gruen), null, 'Läufe fehlen in der Antwort: kein Beleg')
  gleich(suche([lauf(5, 'X')], gruen), null, 'Stand nicht lesbar (außerhalb der Tiefe): kein Beleg')
  gleich(suche([lauf(5, 'C'), lauf(6, 'B'), lauf(7, 'X')], gruen), 5, 'unlesbarer und fremder Stand stören den Treffer nicht')
  gleich(suche([lauf(5, 'C')], gruen, 5), null, 'der eigene Lauf belegt sich nicht')
  gleich(suche([lauf(5, 'C')], gruen, '5'), null, 'eigene Kennung als Text')
  gleich(suche([{ id: 5 }], gruen), null, 'Lauf ohne Stand: kein Beleg')
  // Reihenfolge: neuester zuerst; der neuere Lauf mit rotem Job fällt durch, der ältere grüne belegt.
  const nachLauf = { 8: jobs('pruefen', 'failure'), 6: jobs('pruefen', 'success'), 4: jobs('pruefen', 'success') }
  gleich(suche([lauf(4, 'D'), lauf(8, 'C'), lauf(6, 'A')], (id) => nachLauf[id]), 6, 'neuester grüner Lauf, rote werden übergangen')
  const gefragt = []
  suche([lauf(8, 'C'), lauf(7, 'B'), lauf(6, 'D')], (id) => (gefragt.push(id), jobs('pruefen', 'failure')))
  gleich(gefragt, [8, 6], 'Jobs nur für Läufe mit gleichem Abdruck gefragt')
  const viele = Array.from({ length: 20 }, (_, i) => lauf(100 - i, 'C'))
  const n = []
  gleich(suche(viele, (id) => (n.push(id), jobs('pruefen', 'failure'))), null, 'nur rote: kein Beleg')
  gleich(n.length, JOBS_HOECHSTENS, 'Jobabfragen sind begrenzt')
  gleich(suche(viele, (id) => (id === 100 - JOBS_HOECHSTENS ? jobs('pruefen', 'success') : jobs('pruefen', 'failure'))), null, 'Grenze: der Lauf hinter der Grenze zählt nicht')
  gleich(suche(viele, (id) => (id === 101 - JOBS_HOECHSTENS ? jobs('pruefen', 'success') : jobs('pruefen', 'failure'))), 101 - JOBS_HOECHSTENS, 'Grenze: der letzte erlaubte Lauf zählt')
  ok(pruefenGruen(jobs('pruefen', 'success')) && !pruefenGruen(jobs('pruefen', 'neutral')), 'pruefenGruen: nur success')
}

// 3. gueltigkeit mit Kulisse (baum + api), jeder Fehler heißt "nicht gültig".
const ROH = (name) => `100644 blob ${name.padEnd(40, 'a')}\ttools/x.mjs\0`
const kulisse = (opt = {}) => ({
  baum: (sha) => {
    if (opt.baumFehler) throw new Error('git kaputt\nzweite Zeile')
    return sha === 'HEAD' || sha === 'gleich' ? ROH('1') : ROH('2')
  },
  kopf: () => opt.kopf ?? 'KOPF',
  api: (pfad) => {
    if (opt.apiFehler) throw new Error('HTTP 403: rate limit')
    if (pfad.includes('/jobs')) return { jobs: jobs('pruefen', opt.jobs ?? 'success') }
    if (/\/runs\/\d+$/.test(pfad)) return { head_sha: opt.eigenSha ?? 'KOPF' }
    return { workflow_runs: opt.laeufe ?? [{ id: 41, head_sha: 'gleich' }, { id: 40, head_sha: 'fremd' }] }
  },
})
const ENV = { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '99' }
{
  const g = gueltigkeit(ENV, kulisse())
  ok(g.gueltig && g.grund.startsWith('Beleg: Lauf 41 '), 'Kulisse Treffer: Beleg: Lauf 41')
  ok(!gueltigkeit(ENV, kulisse({ jobs: 'failure' })).gueltig, 'Kulisse pruefen rot: nicht gültig')
  const fremd = gueltigkeit(ENV, kulisse({ eigenSha: 'ANDERER' }))
  ok(!fremd.gueltig && fremd.grund.includes('ANDERER') && fremd.grund.includes('KOPF'), 'head_sha des eigenen Laufs weicht vom Checkout ab: voll prüfen, beide Werte im Grund')
  ok(!gueltigkeit(ENV, kulisse({ kopf: 'X' })).gueltig, 'Checkout anders als head_sha des Laufs: nicht gültig')
  ok(!gueltigkeit({ ...ENV, GITHUB_RUN_ID: undefined }, kulisse()).gueltig, 'ohne Lauf-Kennung: head_sha fehlt, nicht gültig')
  ok(!gueltigkeit(ENV, kulisse({ laeufe: [{ id: 40, head_sha: 'fremd' }] })).gueltig, 'Kulisse anderer Abdruck: nicht gültig')
  const gh = gueltigkeit(ENV, kulisse({ apiFehler: true }))
  ok(!gh.gueltig && gh.grund.includes('HTTP 403: rate limit'), 'gh-Fehler: voll prüfen, erste Fehlerursache im Grund')
  const git = gueltigkeit(ENV, kulisse({ baumFehler: true }))
  ok(!git.gueltig && git.grund.includes('git kaputt') && !git.grund.includes('zweite Zeile'), 'git-Fehler: voll prüfen, nur die erste Zeile')
  ok(!gueltigkeit({}, kulisse()).gueltig, 'ohne GITHUB_REPOSITORY: nicht gültig')
  ok(!gueltigkeit({ ...ENV, GITHUB_RUN_ID: '41' }, kulisse()).gueltig, 'Lauf 41 ist der eigene: nicht gültig')
  const abfragen = []
  gueltigkeit(ENV, { ...kulisse(), api: (p) => (abfragen.push(p), kulisse().api(p)) })
  gleich(abfragen[0], 'repos/o/r/actions/runs/99', 'Eigener Lauf: head_sha gelesen')
  gleich(abfragen[1], 'repos/o/r/actions/workflows/deploy.yml/runs?branch=main&per_page=50', 'Läufe: nur Deploy-Läufe auf main, 50 neueste')
  gleich(abfragen[2], 'repos/o/r/actions/runs/41/jobs?per_page=100', 'Jobs: des Treffer-Laufs')
}

// 4. main: Ausgabe, Datei, Exit-Code.
{
  const ausgabe = join(wegwerf, 'ausgabe.txt')
  const zeilen = []
  gleich(main(['gueltig'], { ...ENV, GITHUB_OUTPUT: ausgabe }, (z) => zeilen.push(z), kulisse(), (p, t) => writeFileSync(p, t)), 0, 'gueltig mit Beleg: Exit 0')
  gleich(readFileSync(ausgabe, 'utf8'), 'gueltig=1\n', 'Beleg: gueltig=1 in GITHUB_OUTPUT')
  ok(/Beleg: Lauf 41 /.test(zeilen[0]), 'Logzeile nennt "Beleg: Lauf 41"')
  rmSync(ausgabe)
  const leer = []
  gleich(main(['gueltig'], { ...ENV, GITHUB_OUTPUT: ausgabe }, (z) => leer.push(z), kulisse({ apiFehler: true }), () => assert.fail('darf nicht schreiben')), 0, 'gh-Fehler: Exit 0')
  ok(/^check:workflows läuft: /.test(leer[0]), 'ohne Beleg: "check:workflows läuft" mit Grund')
  gleich(main(['gueltig'], { ...ENV }, () => {}, kulisse(), () => assert.fail('ohne GITHUB_OUTPUT nichts schreiben')), 0, 'ohne GITHUB_OUTPUT: kein Schreiben')
  gleich(main(['unsinn'], ENV, () => {}), 2, 'unbekannter Befehl: Exit 2')
  // Prozess: ohne Repo-Kennung kein Beleg, Exit 0, keine Ausgabedatei.
  const p = spawnSync(process.execPath, [join(tools, 'workflows-beleg.mjs'), 'gueltig'], { encoding: 'utf8', windowsHide: true, timeout: 60_000, env: { ...process.env, GITHUB_REPOSITORY: '', GITHUB_OUTPUT: ausgabe } })
  gleich(p.status, 0, 'Prozess ohne Repo-Kennung: Exit 0')
  ok(/check:workflows läuft: GITHUB_REPOSITORY fehlt/.test(p.stdout), 'Prozess: Grund steht im Log')
  gleich(spawnSync(process.execPath, [join(tools, 'workflows-beleg.mjs')], { encoding: 'utf8', windowsHide: true, timeout: 60_000 }).status, 2, 'Prozess ohne Befehl: Exit 2')
}

// 5. Verdrahtung in deploy.yml (geparst): der Schritt läuft vor der Prüfung, die Prüfung hängt an seinem Ausgang.
{
  const deploy = yaml.load(readFileSync(join(tools, '..', '.github/workflows/deploy.yml'), 'utf8'))
  const schritte = deploy.jobs.pruefen.steps
  const beleg = schritte.find((s) => s.id === 'wbeleg')
  gleich(beleg.run, 'node tools/workflows-beleg.mjs gueltig', 'deploy.yml: Beleg-Schritt ruft workflows-beleg gueltig')
  gleich(beleg.env, { GH_TOKEN: '${{ github.token }}' }, 'deploy.yml: gh bekommt das Token, sonst nichts')
  ok(beleg['continue-on-error'] === undefined && beleg.if === undefined, 'deploy.yml: Beleg-Schritt läuft immer (Fehler stecken im Skript)')
  const pruefung = schritte.find((s) => s.name === 'Workflow-Dateien prüfen')
  gleich(pruefung.run, 'npm run check:workflows', 'deploy.yml: die Prüfung bleibt npm run check:workflows')
  gleich(pruefung.if, "steps.wbeleg.outputs.gueltig != '1'", 'deploy.yml: Prüfung nur ohne Beleg')
  ok(schritte.indexOf(beleg) < schritte.indexOf(pruefung), 'deploy.yml: Beleg vor der Prüfung')
  gleich(schritte[0].with, { 'fetch-depth': 30, filter: 'blob:none' }, 'deploy.yml: Checkout holt Verlauf und Bäume ohne Blobs')
  gleich(deploy.permissions.actions, 'read', 'deploy.yml: Workflow darf Läufe lesen')
  gleich(schritte.filter((s) => String(s.run ?? '').includes('check:workflows')).length, 1, 'deploy.yml: genau ein Schritt fährt check:workflows')
}

rmSync(wegwerf, { recursive: true, force: true })
console.log(`workflows-beleg: ${faelle} Fälle grün.`)
