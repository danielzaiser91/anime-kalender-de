import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { holeHistorie } from '../tools/check-logic-historie.mjs'
import { PATCHNOTES_ORDNER, STEMPEL_DATEI } from './lib/patchnotes.ts'

/**
 * Flacher PR-Checkout (17.10.2026, PR 1433): `check:logic` fährt Prüfungen parallel, und ein `git fetch` in einer davon scheitert an
 * `.git/shallow.lock` der nächsten; dann bekamen alle Einträge „heute“. Hier: Wegwerf-Repos mit Remote und flachem Klon.
 * Die Prüfungen holen nichts selbst; die Historie holt einmal `tools/check-logic-historie.mjs` vor dem Pool.
 */
let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = fileURLToPath(new URL('..', import.meta.url))
const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx/esm')).href
const skript = (name: string): string => fileURLToPath(new URL(name, import.meta.url))
const ORDNER = PATCHNOTES_ORDNER
const STEMPEL = `${ORDNER}/${STEMPEL_DATEI}`

const gitIn = (cwd: string, tag: string | undefined, ...a: string[]): string =>
  execFileSync('git', a, { cwd, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...(tag && { GIT_AUTHOR_DATE: `${tag}T12:00:00+02:00`, GIT_COMMITTER_DATE: `${tag}T12:00:00+02:00` }) } })

function schreibe(ordner: string, pfad: string, inhalt: string): void {
  if (pfad.includes('/')) mkdirSync(`${ordner}/${pfad.slice(0, pfad.lastIndexOf('/'))}`, { recursive: true })
  writeFileSync(`${ordner}/${pfad}`, inhalt)
}

function bucheIn(ordner: string, tag: string, dateien: Record<string, string>): void {
  for (const [pfad, inhalt] of Object.entries(dateien)) schreibe(ordner, pfad, inhalt)
  gitIn(ordner, tag, 'add', '-A')
  gitIn(ordner, tag, 'commit', '-q', '--allow-empty', '-m', `stand ${tag}`)
}

/** Drei Highlights ohne `datum`, an drei Tagen angelegt (12., 13., 14.10.), Stempel 12.; auf „heute“ fallen sie auf einen Tag und sprengen die Grenze von zwei. */
const eintrag = (text: string): string => `kategorie: bugfix\nhighlight: true\ntext: ${text}\n`

/** Origin mit Basis (drei Commits) und Zweig `pr` darauf; `aenderung` ist der PR-Commit (15.10.). Rückgabe: Origin und Basis-Hash. */
function baueOrigin(aenderung: Record<string, string> | null, eingriff?: (origin: string) => void): { origin: string; basis: string } {
  const origin = mkdtempSync(`${tmpdir()}/stempel-flach-o-`)
  gitIn(origin, undefined, 'init', '-q', '-b', 'main')
  gitIn(origin, undefined, 'config', 'user.email', 'x@x')
  gitIn(origin, undefined, 'config', 'user.name', 'x')
  bucheIn(origin, '2026-10-12', { [`${ORDNER}/e12.yaml`]: eintrag('Zwölf'), [STEMPEL]: '2026-10-12\n' })
  bucheIn(origin, '2026-10-13', { [`${ORDNER}/e13.yaml`]: eintrag('Dreizehn') })
  bucheIn(origin, '2026-10-14', { [`${ORDNER}/e14.yaml`]: eintrag('Vierzehn') })
  const basis = gitIn(origin, undefined, 'rev-parse', 'HEAD').trim()
  gitIn(origin, undefined, 'checkout', '-q', '-b', 'pr')
  if (aenderung) bucheIn(origin, '2026-10-15', aenderung)
  eingriff?.(origin)
  return { origin, basis }
}

/** Flacher Klon (Tiefe 1) des Zweigs `pr`, wie ihn `actions/checkout` in der PR-Kette anlegt, mit Ereignisdatei der Basis. */
function flacherKlon(origin: string, basis: string): string {
  const klon = mkdtempSync(`${tmpdir()}/stempel-flach-k-`)
  gitIn(klon, undefined, 'clone', '-q', '--depth=1', '--branch', 'pr', pathToFileURL(origin).href, '.')
  schreibe(klon, '.ereignis.json', JSON.stringify({ pull_request: { base: { sha: basis } } }))
  writeFileSync(`${klon}/.git/info/exclude`, '.ereignis.json\nnode_modules\n')
  return klon
}

function lauf(cwd: string, datei: string, args: string[] = [], env: Record<string, string> = {}): { status: number | null; aus: string } {
  const r = spawnSync(process.execPath, ['--import', tsx, datei, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}

/** Jeder Fall bekommt sein eigenes Paar Origin/Klon und räumt es auf. */
function imFlachenKlon<T>(aenderung: Record<string, string> | null, tun: (klon: string, origin: string, basis: string) => T, eingriff?: (origin: string) => void): T {
  const { origin, basis } = baueOrigin(aenderung, eingriff)
  const klon = flacherKlon(origin, basis)
  try {
    return tun(klon, origin, basis)
  } finally {
    rmSync(klon, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
}

const sperren = (klon: string): void => writeFileSync(`${klon}/.git/shallow.lock`, '')
const ereignis = (klon: string) => lauf(klon, skript('check-patchnotes-stempel-regel.ts'), ['ereignis'], { GITHUB_EVENT_PATH: `${klon}/.ereignis.json` })
const umschreiben = { [`${ORDNER}/e13.yaml`]: eintrag('Dreizehn überarbeitet') }

// Auflage 1: Die Stempel-Prüfung läuft im flachen Klon mit gehaltener Sperre grün (ohne Git-Datumsauflösung).
const stempelPruefung = imFlachenKlon(null, (klon) => {
  sperren(klon)
  return lauf(klon, skript('check-patchnotes-stempel.ts'))
})
pruefe('Flach: check-patchnotes-stempel läuft im flachen Klon bei gehaltenem shallow.lock grün', stempelPruefung.status === 0 && !stempelPruefung.aus.includes('Highlights, erlaubt'), stempelPruefung)

// Auflage 2: Die Regel holt nichts selbst; ohne Historie wird sie laut rot, mit und ohne Sperre.
for (const mitSperre of [true, false]) {
  const wo = mitSperre ? 'bei gehaltener Sperre' : 'ohne Sperre'
  const flach = imFlachenKlon(umschreiben, (klon) => {
    if (mitSperre) sperren(klon)
    return ereignis(klon)
  })
  pruefe(`Flach: die Regel im flachen Klon ${wo} → Exit 1, „Checkout ist flach“, kein Fetch-Versuch`, flach.status === 1 && flach.aus.includes('Checkout ist flach') && !flach.aus.includes('Unable to create'), flach)
}

// Auflage 3: Status M im Klon mit geholter Historie; der Anlagetag kommt aus der Historie, nie „heute“.
const geholt = imFlachenKlon(umschreiben, (klon) => ({ warnung: holeHistorie(klon), lauf: ereignis(klon) }))
pruefe('Historie: holeHistorie macht den flachen Klon vollständig (keine Warnung)', geholt.warnung === null, geholt.warnung)
pruefe('Historie: Text vom 13. umgeschrieben (M, ohne datum), Stempel 12 → Exit 1 mit dem Tag aus der Historie', geholt.lauf.status === 1 && geholt.lauf.aus.includes('bis 2026-10-13'), geholt.lauf)
const mitStempel = imFlachenKlon({ ...umschreiben, [STEMPEL]: '2026-10-13\n' }, (klon) => (holeHistorie(klon), ereignis(klon)))
pruefe('Historie: Text vom 13. umgeschrieben, Stempel 13 → Exit 0 (bei „alle heute“ wäre ein späterer Stempel nötig)', mitStempel.status === 0, mitStempel)
const mitteUmgeschrieben = imFlachenKlon({ ...umschreiben, [`${ORDNER}/e12.yaml`]: eintrag('Zwölf überarbeitet'), [STEMPEL]: '2026-10-12\n' }, (klon) => (holeHistorie(klon), ereignis(klon)))
pruefe('Historie: der 12. und der 13. umgeschrieben, Stempel 12 → Exit 1 (jüngster Tag zählt, nicht der erste)', mitteUmgeschrieben.status === 1 && mitteUmgeschrieben.aus.includes('bis 2026-10-13'), mitteUmgeschrieben)

// Gescheitertes Holen bleibt sichtbar: Sperre → Warnung mit Grund, danach rot in der Regel.
const gesperrt = imFlachenKlon(umschreiben, (klon) => {
  sperren(klon)
  return { warnung: holeHistorie(klon), lauf: ereignis(klon) }
})
pruefe('Historie: bei gehaltener Sperre gibt holeHistorie eine Warnung mit dem Grund zurück', gesperrt.warnung?.includes('Historie nicht geholt') === true && gesperrt.warnung.includes('shallow.lock'), gesperrt.warnung)
pruefe('Historie: danach bleibt der Klon flach und die Regel wird laut rot', gesperrt.lauf.status === 1 && gesperrt.lauf.aus.includes('Checkout ist flach'), gesperrt.lauf)

// Vollständiger Checkout ohne die Basis: laut rot.
const ohneBasis = imFlachenKlon(umschreiben, (klon) => {
  schreibe(klon, '.ereignis.json', JSON.stringify({ pull_request: { base: { sha: '0123456789abcdef0123456789abcdef01234567' } } }))
  holeHistorie(klon)
  return ereignis(klon)
})
pruefe('Basis: vollständiger Klon, aber die Basis fehlt → Exit 1 „fehlt im Checkout“', ohneBasis.status === 1 && ohneBasis.aus.includes('fehlt im Checkout'), ohneBasis)

// Unlesbare Historie eines umgeschriebenen Eintrags darf nicht als „heute“ durchgehen.
// Der Origin hat lose Objekte (der Klon nur ein Pack): dort fehlt der Wurzelbaum des 13., `git log` scheitert.
const kaputt = imFlachenKlon(umschreiben, (klon, origin) => {
  const wurzelbaum = gitIn(origin, undefined, 'rev-parse', 'HEAD~2^{tree}').trim()
  const objekt = `${origin}/.git/objects/${wurzelbaum.slice(0, 2)}/${wurzelbaum.slice(2)}`
  chmodSync(objekt, 0o666)
  rmSync(objekt)
  return lauf(origin, skript('check-patchnotes-stempel-regel.ts'), ['ereignis'], { GITHUB_EVENT_PATH: `${klon}/.ereignis.json` })
})
pruefe('Historie: ist der Anlagetag nicht lesbar (Objekt fehlt), meldet die Regel das statt „heute“ → Exit 1 mit dem Anlagetag-Text', kaputt.status === 1 && kaputt.aus.includes('Anlagetag eines umgeschriebenen'), kaputt)

// Verdrahtung: der Runner holt die Historie vor den Prüfungen. Kulisse: flacher Klon mit den Runner-Dateien und einer Prüfung, die bei flachem Klon rot ist.
const RUNNER = ['check-logic-alle', 'arbeiterpool', 'check-logic-vollstaendig', 'sperre-umgebung', 'git-stand-wache', 'check-logic-historie', 'bau-umgebung', 'liste-pruefen', 'pr-basis']
const PRUEFUNG = "import { execFileSync } from 'node:child_process'\nconst flach = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim()\nconsole.log('flach:', flach)\nprocess.exit(flach === 'true' ? 1 : 0)\n"
function runnerLauf(mitSperre: boolean, name = 'check:bestand'): { status: number | null; aus: string } {
  const runnerKulisse = mkdtempSync(`${tmpdir()}/stempel-flach-r-`)
  const runnerKlon = mkdtempSync(`${tmpdir()}/stempel-flach-rk-`)
  const aussen = mkdtempSync(`${tmpdir()}/stempel-flach-ra-`)
  try {
    gitIn(runnerKulisse, undefined, 'init', '-q', '-b', 'main')
    gitIn(runnerKulisse, undefined, 'config', 'user.email', 'x@x')
    gitIn(runnerKulisse, undefined, 'config', 'user.name', 'x')
    mkdirSync(`${runnerKulisse}/tools`)
    for (const datei of [...RUNNER.map((d) => `${d}.mjs`), 'bestand-sperre.cjs']) copyFileSync(`${wurzel}tools/${datei}`, `${runnerKulisse}/tools/${datei}`)
    bucheIn(runnerKulisse, '2026-10-12', { 'package.json': '{"name":"kulisse","type":"module","scripts":{}}\n', 'tools/pruefung.mjs': PRUEFUNG, 'tools/liste.txt': 'tools/pruefung.mjs\n' })
    bucheIn(runnerKulisse, '2026-10-13', { 'tools/zwei.txt': 'x\n' })
    bucheIn(runnerKulisse, '2026-10-14', { 'tools/drei.txt': 'x\n' })
    gitIn(runnerKlon, undefined, 'clone', '-q', '--depth=1', pathToFileURL(runnerKulisse).href, '.')
    writeFileSync(`${runnerKlon}/.git/info/exclude`, 'node_modules\n')
    symlinkSync(`${wurzel}node_modules`, `${runnerKlon}/node_modules`, 'junction')
    if (mitSperre) sperren(runnerKlon)
    const r = spawnSync(process.execPath, [`${runnerKlon}/tools/check-logic-alle.mjs`, 'tools/liste.txt', name], { cwd: aussen, encoding: 'utf8' })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  } finally {
    if (existsSync(`${runnerKlon}/node_modules`)) unlinkSync(`${runnerKlon}/node_modules`)
    for (const o of [runnerKulisse, runnerKlon, aussen]) rmSync(o, { recursive: true, force: true })
  }
}
const runner = runnerLauf(false)
pruefe('Runner: check-logic-alle holt die Historie vor den Prüfungen (Prüfung sieht keinen flachen Klon) → Exit 0', runner.status === 0 && runner.aus.includes('flach: false'), runner)
pruefe('Runner: die Ergebniszeile nennt das Holen der Historie', runner.aus.includes('check:bestand: Historie geholt (flach → vollständig)'), runner)
// Der Weg der CI heißt check:logic (mit Sperre): auch dort kommt die Historie vor dem Pool.
const runnerLogic = runnerLauf(false, 'check:logic')
pruefe('Runner als check:logic: Historie vor den Prüfungen, Ergebniszeile im Lauf → Exit 0', runnerLogic.status === 0 && runnerLogic.aus.includes('flach: false') && runnerLogic.aus.includes('check:logic: Historie geholt (flach → vollständig)'), runnerLogic)
const runnerGesperrt = runnerLauf(true)
pruefe('Runner: scheitert das Holen (Sperre), steht die Warnung mit Grund im Lauf und die Prüfung bleibt rot', runnerGesperrt.status === 1 && runnerGesperrt.aus.includes('Historie nicht geholt') && runnerGesperrt.aus.includes('flach: true'), runnerGesperrt)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
