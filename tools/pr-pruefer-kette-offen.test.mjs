/**
 * Test für tools/pr-pruefer-kette-offen.mjs. Die Fixtures sind die echten Kopfzeilen von tools/pr-kettenlog.mjs
 * (`baueDateien`), nicht nachgebaut: der Satz muss zum Erzeuger passen. Der Prozesstest fährt das CLI wie der Workflow.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import { baueDateien } from './pr-kettenlog.mjs'
import { MARKE_OHNE_MODELL } from './pruefer-unfertig-wache.mjs'
import { kettenLaeuft, kettenOffen, main } from './pr-pruefer-kette-offen.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const KOPF = 'a'.repeat(40)
const jobs = (status) => [{ name: 'Kette – Logik', status, conclusion: status === 'completed' ? 'success' : '', log: 'x: ok (3 Fälle)' }]
const datei = (lauf, js, fehlerText = '') => baueDateien({ kopf: KOPF, lauf, jobs: js, fehler: fehlerText }).uebersicht
const text = (t) => (Array.isArray(t) ? t.join('\n') : t)

const offen = text(datei({ id: 7, status: 'in_progress', conclusion: '' }, jobs('in_progress')))
const fertig = text(datei({ id: 7, status: 'completed', conclusion: 'success' }, jobs('completed')))
const rot = text(datei({ id: 7, status: 'completed', conclusion: 'failure' }, [{ name: 'Kette – Logik', status: 'completed', conclusion: 'failure', log: 'FEHL x' }]))
const keiner = text(datei(null, []))

gleich('Lauf läuft: Kette offen', kettenOffen(offen), true)
gleich('Lauf fertig und grün: nicht offen', kettenOffen(fertig), false)
gleich('Lauf fertig und rot: nicht offen (Gegenfall, bleibt „aendern“)', kettenOffen(rot), false)
gleich('Kein Kettenlauf gefunden: nicht offen', kettenOffen(keiner), false)
gleich('leerer Text: nicht offen', kettenOffen(''), false)
gleich('undefined: nicht offen', kettenOffen(undefined), false)
// Ausgabe des PR-Codes unter dem Kopf darf den Satz nicht vortäuschen (sonst würde aus „aendern“ ein „nicht beurteilt“).
const vorgetaeuscht = `${rot}\n=== Kette – Logik (failure) ===\nLauf 7 der PR-Prüfkette für ${KOPF}: NOCH NICHT ABGESCHLOSSEN (in_progress)`
gleich('Satz tief im Log (PR-Ausgabe): nicht offen', kettenOffen(vorgetaeuscht), false)
gleich('Satz mitten in einer Zeile: nicht offen', kettenOffen(`HINWEIS\nx Lauf 7 der PR-Prüfkette für ${KOPF}: NOCH NICHT ABGESCHLOSSEN (queued)`), false)
gleich('Lauf wartet (queued): offen', kettenOffen(text(datei({ id: 8, status: 'queued', conclusion: '' }, jobs('queued')))), true)

// Prozess wie im Workflow: Exit 0 = offen, 1 = nicht offen, 1 auch ohne Datei oder Argument.
const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kette-offen-'))
try {
  const f = (name, inhalt) => {
    const p = path.join(ordner, name)
    fs.writeFileSync(p, inhalt)
    return p
  }
  const lauf = (arg) => spawnSync(process.execPath, [new URL('./pr-pruefer-kette-offen.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ...(arg ? [arg] : [])], { encoding: 'utf8', timeout: 30_000, windowsHide: true }).status
  gleich('Prozess: offene Kette Exit 0', lauf(f('offen.txt', offen)), 0)
  gleich('Prozess: fertige Kette Exit 1', lauf(f('fertig.txt', fertig)), 1)
  gleich('Prozess: Datei fehlt Exit 1', lauf(path.join(ordner, 'gibtsnicht.txt')), 1)
  gleich('Prozess: ohne Argument Exit 1', lauf(null), 1)
  gleich('main(): offene Kette', main([f('offen2.txt', offen)]), 0)
  // --nur-lauf (Prüfer startet bei laufender Kette gar nicht): „Basis offen“ zählt hier nicht, der Prüfer urteilt dann echt.
  const basis = `HINWEIS x\nBASIS OFFEN: PR #5 ist noch offen und die Kette ist rot\n${fertig}`
  gleich('kettenLaeuft: laufende Kette', kettenLaeuft(offen), true)
  gleich('kettenLaeuft: fertige Kette', kettenLaeuft(fertig), false)
  gleich('kettenLaeuft: Basis offen bei fertiger Kette nicht', kettenLaeuft(basis), false)
  gleich('kettenOffen: Basis offen bleibt offen', kettenOffen(basis), true)
  gleich('main(--nur-lauf): laufende Kette', main(['--nur-lauf', f('offen3.txt', offen)]), 0)
  gleich('main(--nur-lauf): fertige Kette', main(['--nur-lauf', f('fertig3.txt', fertig)]), 1)
  gleich('main(--nur-lauf): Datei fehlt', main(['--nur-lauf', path.join(ordner, 'gibtsnicht.txt')]), 1)

  // Der run-Text des Schritts „Kette läuft noch“ aus pr-pruefer.yml, wirklich in bash ausgeführt (Prüfer-Befund 13.11.2026).
  const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer.yml', import.meta.url), 'utf8'))
  const schritt = wf.jobs.pruefen.steps.find((s) => s.name === 'Kette läuft noch')
  const KOPF_SHA = 'b'.repeat(40)
  const schrittLauf = (name, kettenlog) => {
    const temp = path.join(ordner, `schritt-${name}`)
    fs.mkdirSync(path.join(temp, 'pruefer'), { recursive: true })
    if (kettenlog !== null) fs.writeFileSync(path.join(temp, 'pruefer', 'kettenlog.txt'), kettenlog)
    const ausgabe = path.join(temp, 'ausgabe.txt')
    fs.writeFileSync(ausgabe, '')
    const r = spawnSync('bash', ['-e', '-c', schritt.run], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', timeout: 30_000, env: { ...process.env, RUNNER_TEMP: temp, HEAD_SHA: KOPF_SHA, GITHUB_OUTPUT: ausgabe } })
    const lies = (n) => (fs.existsSync(path.join(temp, 'pruefer', n)) ? fs.readFileSync(path.join(temp, 'pruefer', n), 'utf8') : null)
    return { status: r.status, ausgabe: fs.readFileSync(ausgabe, 'utf8'), urteil: lies('urteil.json'), protokoll: lies('protokoll.md') }
  }
  const laeuft = schrittLauf('laeuft', offen)
  gleich('Schritt, Kette läuft: Exit 0 und Ausgabe laeuft=ja', [laeuft.status, laeuft.ausgabe], [0, 'laeuft=ja\n'])
  gleich('Schritt, Kette läuft: urteil.json gültig, aendern für den Kopf', JSON.parse(laeuft.urteil ?? 'null'), { urteil: 'aendern', sha: KOPF_SHA })
  gleich('Schritt, Kette läuft: protokoll.md nicht leer, mit Marke der Wache', Boolean(laeuft.protokoll?.includes(MARKE_OHNE_MODELL)), true)
  for (const [name, text] of [['fertig', fertig], ['rot', rot], ['basis-offen', basis], ['fehlt', null]]) {
    const r = schrittLauf(name, text)
    gleich(`Schritt, Kette ${name}: Exit 0, keine Ausgabe, keine Dateien (Modell läuft)`, [r.status, r.ausgabe, r.urteil, r.protokoll], [0, '', null, null])
  }
} finally {
  fs.rmSync(ordner, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`pr-pruefer-kette-offen.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-pruefer-kette-offen.test: grün')
