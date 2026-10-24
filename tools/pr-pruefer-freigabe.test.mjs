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
import { WORKFLOW, fuerSchnappschuss, leseSchnappschuss, meldung, schreibeSchnappschuss, unterschiede } from './pr-pruefer-schnappschuss.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const wf = parse(fs.readFileSync(WORKFLOW, 'utf8'))
if (process.argv.includes('--schnappschuss')) {
  schreibeSchnappschuss(wf)
  console.log('tools/pr-pruefer.schnappschuss.json neu geschrieben.')
  process.exit(0)
}
// Das ganze Dokument gegen den Schnappschuss: ein Zusatzschritt, ein anderer Wert oder ein neuer Schlüssel ist rot.
const abweichungen = unterschiede(leseSchnappschuss(), fuerSchnappschuss(wf))
if (abweichungen.length) {
  console.error(meldung(abweichungen))
  process.exit(1)
}
console.log('  ✓ Workflow stimmt mit dem Schnappschuss überein (alle Schlüssel und Werte außer dem Prompt-Text)')
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
function werteEnv(zustand, checks, modus = '', frei = '') {
  const ausdruecke = {
    'steps.modus.outputs.modus': modus,
    'steps.modus.outputs.aendern-frei': frei,
    'steps.eingang.outputs.zustand': zustand,
    'steps.checks.outputs.stand': checks,
    'secrets.GITHUB_TOKEN': TOKEN,
    'github.event.pull_request.number': '7',
    'github.event.pull_request.head.sha': KOPF,
    'github.event.pull_request.base.sha': ANDERER,
  }
  const setze = (_, a) => {
    if (!(a in ausdruecke)) throw new Error(`Ausdruck nicht nachgebildet: ${a}`)
    return ausdruecke[a]
  }
  return Object.fromEntries(Object.entries({ ...wf.jobs.pruefen.env, ...freigabe.env }).map(([s, w]) => [s, String(w).replace(/\$\{\{\s*([^}]+?)\s*\}\}/g, setze)]))
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
      GITHUB_REPOSITORY: 'o/r',
      RUNNER_TEMP: temp,
      ...werteEnv(f.zustand, f.checks ?? 'gruen', f.modus, f.frei),
      ATTRAPPE_LOG: log,
      ATTRAPPE_KOMMENTAR: kommentar,
      ATTRAPPE_AKTUELL: f.aktuell ?? KOPF,
    })
    const r = spawnSync(BASH, ['-e', skript], { cwd: ordner, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    const aufrufe = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : []
    return {
      status: r.status,
      aufrufe: aufrufe.map((a) => a.replace(/--body-file \S+/, '--body-file <datei>')),
      kommentar: fs.existsSync(kommentar) ? fs.readFileSync(kommentar, 'utf8') : '',
    }
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true })
  }
}

const urteil = (art, sha = KOPF) => JSON.stringify({ urteil: art, sha })
const basis = { urteil: urteil('ok'), protokoll: 'Alles gut.\n', zustand: 'ok' }
// Die gh-Aufrufe des guten Laufs, Wort für Wort: jeder zusätzliche Aufruf ist rot, auch wenn der Schritt grün endet.
const ANSICHT = 'pr view 7 --repo o/r --json headRefOid -q .headRefOid'
const KOMMENTAR = 'pr comment 7 --repo o/r --body-file <datei>'
const APPROVE = 'pr review 7 --repo o/r --approve --body Urteil: ok. Prüfprotokoll steht als Kommentar (Stand ccccccccc).'
const AENDERN = 'pr review 7 --repo o/r --request-changes --body Befunde im Prüfprotokoll-Kommentar (Stand ccccccccc).'
const FREIGABE = { status: 0, aufrufe: [ANSICHT, KOMMENTAR, APPROVE] }
const ABLEHNUNG = { status: 0, aufrufe: [ANSICHT, KOMMENTAR, AENDERN] }
const NICHTS = { status: 0, aufrufe: [ANSICHT] }
const KEIN_URTEIL = { status: 1, aufrufe: [] }

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
  pruefe(name, ist.status === soll.status && JSON.stringify(ist.aufrufe) === JSON.stringify(soll.aufrufe), { ist: ist.aufrufe, soll: soll.aufrufe })
}

const unvollstaendig = laufe({ ...basis, zustand: 'unvollstaendig' })
pruefe('Unvollständiger Diff: Kommentar nennt Urteil aendern und den Hinweis',
  unvollstaendig.kommentar.includes('Urteil: **aendern**') && unvollstaendig.kommentar.includes('nicht vollständig geprüft'), unvollstaendig.kommentar)
const freigegeben = laufe(basis)
pruefe('Freigabe: Kommentar nennt Urteil ok, ohne Hinweis',
  freigegeben.kommentar.includes('Urteil: **ok**') && !freigegeben.kommentar.includes('nicht vollständig geprüft'), freigegeben.kommentar)
// Check-Stand des Kopfes: „ok“ ohne Zusatz nur bei gruen, sonst steht der Stand in der ersten Zeile und im Review.
const ersteZeile = (r) => r.kommentar.split('\n')[0]
const mitChecks = (checks, art = 'ok') => laufe({ ...basis, urteil: urteil(art), checks })
const genehmigt = (titel) => [ANSICHT, KOMMENTAR,
  `pr review 7 --repo o/r --approve --body Urteil: ${titel}. Prüfprotokoll steht als Kommentar (Stand ccccccccc).`]
const checkFaelle = [
  ['gruen', 'ok'],
  ['Checks rot: Kette – Workflows, PR-Prüfkette', 'ok, Checks rot: Kette – Workflows, PR-Prüfkette'],
  ['Checks laufen noch: PR-Prüfkette', 'ok, Checks laufen noch: PR-Prüfkette'],
  ['Checks-Stand unbekannt: API: HTTP 502', 'ok, Checks-Stand unbekannt: API: HTTP 502'],
  ['', 'ok, Checks-Stand unbekannt'],
  ['gruen2', 'ok, gruen2'],
]
for (const [checks, titel] of checkFaelle) {
  const r = mitChecks(checks)
  pruefe(`Checks "${checks}", Urteil ok: erste Zeile "${titel}", Review nennt es`,
    ersteZeile(r) === `**Prüfer-Review** für ccccccccc - Urteil: **${titel}**` && JSON.stringify(r.aufrufe) === JSON.stringify(genehmigt(titel)),
    { erste: ersteZeile(r), aufrufe: r.aufrufe })
}
const aendernRot = mitChecks('Checks rot: Kette – Logik', 'aendern')
pruefe('Checks rot, Urteil aendern: bleibt aendern ohne Zusatz',
  ersteZeile(aendernRot) === '**Prüfer-Review** für ccccccccc - Urteil: **aendern**' && JSON.stringify(aendernRot.aufrufe) === JSON.stringify(ABLEHNUNG.aufrufe), aendernRot)
const unvollRot = laufe({ ...basis, zustand: 'unvollstaendig', checks: 'Checks rot: X' })
pruefe('Diff unvollständig und Checks rot: aendern', ersteZeile(unvollRot).endsWith('Urteil: **aendern**'), ersteZeile(unvollRot))

// Abnahme-Modus (21.10.2026): „aendern“ sperrt nur, wenn es frei ist (Stufe 2, einmal); sonst Kommentar ohne Review.
const marke = (r) => r.kommentar.trimEnd().split('\n').at(-1)
const abnahme = (art, frei, extra = {}) => laufe({ ...basis, urteil: urteil(art), modus: 'abnahme', frei, ...extra })
const OFFEN = '**Prüfer-Review** für ccccccccc - Urteil: **aendern, Auflagen offen: Dirigent entscheidet**'
const nurKommentar = (r) => JSON.stringify(r.aufrufe) === JSON.stringify([ANSICHT, KOMMENTAR])
const aOk = abnahme('ok', '0')
pruefe('Abnahme, Urteil ok (auch ohne Freigabe zum Ändern): Approve, Marke abnahme, Hinweiszeile',
  JSON.stringify(aOk.aufrufe) === JSON.stringify(FREIGABE.aufrufe) && marke(aOk) === '<!-- pruefer-modus: abnahme -->' && aOk.kommentar.includes('Abnahme-Modus: nur die Auflagen'), aOk)
const aFrei = abnahme('aendern', '1')
pruefe('Abnahme, aendern, frei (Stufe 2, erstes Mal): Änderungswunsch wie bisher',
  JSON.stringify(aFrei.aufrufe) === JSON.stringify(ABLEHNUNG.aufrufe) && ersteZeile(aFrei) === '**Prüfer-Review** für ccccccccc - Urteil: **aendern**', aFrei)
const aGesperrt = abnahme('aendern', '0')
pruefe('Abnahme, aendern, nicht frei (Stufe < 2 oder schon einmal): nur Kommentar, kein Review, Titel nennt Dirigent',
  nurKommentar(aGesperrt) && ersteZeile(aGesperrt) === OFFEN, aGesperrt)
pruefe('Abnahme, aendern, Freigabe-Ausgabe leer (Modus-Schritt ohne Ausgabe): nur Kommentar', nurKommentar(abnahme('aendern', '')), abnahme('aendern', ''))
pruefe('Abnahme, aendern, frei = 2 (kein exakter Wert 1): nur Kommentar', nurKommentar(abnahme('aendern', '2')))
const aUnvoll = abnahme('ok', '0', { zustand: 'unvollstaendig' })
pruefe('Abnahme, Diff unvollständig, nicht frei: kein Approve, nur Kommentar', nurKommentar(aUnvoll) && ersteZeile(aUnvoll) === OFFEN, aUnvoll)
const aToken = abnahme('ok', '0', { protokoll: 'x ghp_abcdef y\n' })
pruefe('Abnahme, Token im Protokoll, nicht frei: kein Approve', nurKommentar(aToken) && !aToken.kommentar.includes('ghp_abcdef'), aToken)
const aChecks = abnahme('ok', '0', { checks: 'Checks rot: Kette' })
pruefe('Abnahme, ok bei roten Checks: Approve mit Zusatz wie im Modus voll', ersteZeile(aChecks).endsWith('Urteil: **ok, Checks rot: Kette**') && JSON.stringify(aChecks.aufrufe) === JSON.stringify(genehmigt('ok, Checks rot: Kette')), aChecks)
const vFrei = laufe({ ...basis, urteil: urteil('aendern'), modus: 'voll', frei: '0' })
pruefe('Modus voll, aendern, nicht frei: bleibt Änderungswunsch (die Sperre gilt nur im Abnahme-Modus), Marke voll',
  JSON.stringify(vFrei.aufrufe) === JSON.stringify(ABLEHNUNG.aufrufe) && marke(vFrei) === '<!-- pruefer-modus: voll -->' && !vFrei.kommentar.includes('Abnahme-Modus'), vFrei)
const vLeer = laufe({ ...basis, urteil: urteil('aendern') })
pruefe('Modus-Ausgabe fehlt ganz, aendern: Änderungswunsch (fail closed)', JSON.stringify(vLeer.aufrufe) === JSON.stringify(ABLEHNUNG.aufrufe) && marke(vLeer) === '<!-- pruefer-modus: voll -->', vLeer)
const aAnderer = abnahme('aendern', '0', { urteil: urteil('aendern', ANDERER) })
pruefe('Abnahme, Urteil für anderen Stand: nichts gepostet', JSON.stringify(aAnderer.aufrufe) === JSON.stringify(NICHTS.aufrufe), aAnderer)

const token = laufe({ ...basis, protokoll: 'x ghp_abcdef y\n' })
pruefe('Token im Protokoll: Kommentar enthält das Token nicht', !token.kommentar.includes('ghp_abcdef') && token.kommentar.includes('verworfen'), token.kommentar)

if (fehler.length) {
  console.error(`pr-pruefer-freigabe.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-pruefer-freigabe.test: grün')
