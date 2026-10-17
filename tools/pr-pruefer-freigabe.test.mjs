/**
 * Laufzeitprobe für den Schritt „Protokoll und Freigabe“ aus .github/workflows/pr-pruefer.yml: Der `run`-Block wird
 * aus der YAML gelesen und mit bash gegen eine gh-Attrappe ausgeführt. Geprüft wird, welche gh-Aufrufe entstehen
 * (Kommentar, --approve, --request-changes), nicht der Wortlaut des Skripts. Die Attrappe kennt nur die Aufrufe des
 * Schritts mit genauem Pfad und Parametern, jeder andere Aufruf endet mit Exit 99.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
const freigabe = wf.jobs.pruefen.steps.find((s) => s.name === 'Protokoll und Freigabe')
const KOPF = 'c'.repeat(40)
const ANDERER = 'd'.repeat(40)
const TOKEN = 'tok-geheim-123'
const BASH = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'

const ATTRAPPE = `#!/bin/bash
echo "$*" >> "$ATTRAPPE_LOG"
case "$1 $2" in
  "pr view")
    [ "$*" = "pr view 7 --repo o/r --json headRefOid -q .headRefOid" ] || exit 99
    echo "$ATTRAPPE_AKTUELL" ;;
  "pr comment")
    [ "$3 $4 $5 $6" = "7 --repo o/r --body-file" ] || exit 99
    cp "$7" "$ATTRAPPE_KOMMENTAR" ;;
  "pr review")
    [ "$3 $4 $5" = "7 --repo o/r" ] || exit 99
    [ "$6" = "--approve" ] || [ "$6" = "--request-changes" ] || exit 99 ;;
  *) exit 99 ;;
esac
`

/** Die env des Schritts aus der YAML; nur die beiden bekannten Ausdrücke werden eingesetzt. */
function werteEnv(zustand) {
  const ausdruecke = { 'steps.eingang.outputs.zustand': zustand, 'secrets.GITHUB_TOKEN': TOKEN }
  const setze = (_, a) => {
    if (!(a in ausdruecke)) throw new Error(`Ausdruck nicht nachgebildet: ${a}`)
    return ausdruecke[a]
  }
  return Object.fromEntries(Object.entries(freigabe.env ?? {}).map(([s, w]) => [s, String(w).replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, setze)]))
}

/** Führt den run-Block aus; `f.urteil`: Text von urteil.json oder null, `f.protokoll` ebenso. */
function laufe(f) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-freigabe-'))
  try {
    const bin = path.join(ordner, 'bin')
    const temp = path.join(ordner, 'runner').replaceAll('\\', '/')
    fs.mkdirSync(bin)
    fs.mkdirSync(path.join(temp, 'pruefer'), { recursive: true })
    fs.writeFileSync(path.join(bin, 'gh'), ATTRAPPE, { mode: 0o755 })
    if (f.urteil !== null) fs.writeFileSync(path.join(temp, 'pruefer', 'urteil.json'), f.urteil)
    if (f.protokoll !== null) fs.writeFileSync(path.join(temp, 'pruefer', 'protokoll.md'), f.protokoll)
    const skript = path.join(ordner, 'schritt.sh')
    fs.writeFileSync(skript, freigabe.run)
    const log = path.join(ordner, 'aufrufe.log')
    const kommentar = path.join(ordner, 'kommentar.md')
    const env = Object.fromEntries(Object.entries(process.env).filter(([s]) => !/^(GITHUB_|RUNNER_|GH_)/.test(s)))
    const pfad = Object.keys(env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'
    env[pfad] = bin + path.delimiter + env[pfad]
    Object.assign(env, {
      PR: '7',
      HEAD_SHA: KOPF,
      GITHUB_REPOSITORY: 'o/r',
      RUNNER_TEMP: temp,
      ...werteEnv(f.zustand),
      ATTRAPPE_LOG: log,
      ATTRAPPE_KOMMENTAR: kommentar,
      ATTRAPPE_AKTUELL: f.aktuell ?? KOPF,
    })
    const r = spawnSync(BASH, ['-e', skript], { cwd: ordner, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const aufrufe = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []
    return {
      status: r.status,
      approve: aufrufe.filter((a) => a.startsWith('pr review') && a.includes('--approve')).length,
      aendern: aufrufe.filter((a) => a.startsWith('pr review') && a.includes('--request-changes')).length,
      kommentare: aufrufe.filter((a) => a.startsWith('pr comment')).length,
      kommentar: fs.existsSync(kommentar) ? fs.readFileSync(kommentar, 'utf8') : '',
    }
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}

const urteil = (art, sha = KOPF) => JSON.stringify({ urteil: art, sha })
const basis = { urteil: urteil('ok'), protokoll: 'Alles gut.\n', zustand: 'ok' }
const FREIGABE = { status: 0, approve: 1, aendern: 0, kommentare: 1 }
const ABLEHNUNG = { status: 0, approve: 0, aendern: 1, kommentare: 1 }
const NICHTS = { status: 0, approve: 0, aendern: 0, kommentare: 0 }
const KEIN_URTEIL = { status: 1, approve: 0, aendern: 0, kommentare: 0 }

pruefe('Schritt: nur name, if, env, run; läuft immer (if: always())',
  JSON.stringify(Object.keys(freigabe)) === JSON.stringify(['name', 'if', 'env', 'run']) && freigabe.if === 'always()', freigabe)
const faelle = [
  ['Zustand ok, Urteil ok: Freigabe', basis, FREIGABE],
  ['Zustand unvollstaendig, Urteil ok: keine Freigabe, Änderungswunsch', { ...basis, zustand: 'unvollstaendig' }, ABLEHNUNG],
  ['Zustand leer, Urteil ok: keine Freigabe', { ...basis, zustand: '' }, ABLEHNUNG],
  ['Zustand unbekannt, Urteil ok: keine Freigabe', { ...basis, zustand: 'ok2' }, ABLEHNUNG],
  ['Zustand ok, Urteil aendern: Änderungswunsch', { ...basis, urteil: urteil('aendern') }, ABLEHNUNG],
  ['Zustand unvollstaendig, Urteil aendern: Änderungswunsch', { ...basis, zustand: 'unvollstaendig', urteil: urteil('aendern') }, ABLEHNUNG],
  ['Token-Muster im Protokoll, Zustand ok: keine Freigabe', { ...basis, protokoll: 'x ghp_abcdef y\n' }, ABLEHNUNG],
  ['Eigenes Token im Protokoll, Zustand ok: keine Freigabe', { ...basis, protokoll: `Wert ${TOKEN}\n` }, ABLEHNUNG],
  ['Urteil weder ok noch aendern, Zustand ok: keine Freigabe', { ...basis, urteil: urteil('vielleicht') }, ABLEHNUNG],
  ['Urteil für anderen Stand: nichts gepostet', { ...basis, urteil: urteil('ok', ANDERER) }, NICHTS],
  ['Kopf des PR inzwischen ein anderer: nichts gepostet', { ...basis, aktuell: ANDERER }, NICHTS],
  ['Urteil fehlt: Abbruch ohne Freigabe', { ...basis, urteil: null }, KEIN_URTEIL],
  ['Protokoll leer: Abbruch ohne Freigabe', { ...basis, protokoll: '' }, KEIN_URTEIL],
  ['Urteil unlesbar: Abbruch ohne Freigabe', { ...basis, urteil: '{kaputt' }, KEIN_URTEIL],
]
for (const [name, eingabe, soll] of faelle) {
  const ist = laufe(eingabe)
  pruefe(name, ['status', 'approve', 'aendern', 'kommentare'].every((s) => ist[s] === soll[s]), ist)
}

const unvollstaendig = laufe({ ...basis, zustand: 'unvollstaendig' })
pruefe('Unvollständiger Diff: Kommentar nennt Urteil aendern und den Hinweis',
  unvollstaendig.kommentar.includes('Urteil: **aendern**') && unvollstaendig.kommentar.includes('nicht vollständig geprüft'), unvollstaendig.kommentar)
const freigegeben = laufe(basis)
pruefe('Freigabe: Kommentar nennt Urteil ok, ohne Hinweis',
  freigegeben.kommentar.includes('Urteil: **ok**') && !freigegeben.kommentar.includes('nicht vollständig geprüft'), freigegeben.kommentar)
const token = laufe({ ...basis, protokoll: 'x ghp_abcdef y\n' })
pruefe('Token im Protokoll: Kommentar enthält das Token nicht', !token.kommentar.includes('ghp_abcdef') && token.kommentar.includes('verworfen'), token.kommentar)

if (fehler.length) {
  console.error(`pr-pruefer-freigabe.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-freigabe.test: grün')
