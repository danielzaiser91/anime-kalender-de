/**
 * Ablauftest für die Listen-Zusicherung in `pipeline/check-episodentitel.ts`: das echte Skript in einem Wegwerf-Ordner (cwd) mit
 * kleiner Netflix-Liste und Regeldatei. Die Liste passt zum Schalter `erweitert` (Datei bzw. `PRUEFLISTE_ERWEITERT`), nicht zu einer
 * Mindestzahl — leer, ohne Cartoons, ausgeschaltet erzeugt und ausgeschaltet geprüft ist grün; ausgeschaltet erzeugt, eingeschaltet geprüft rot.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SKRIPT = resolve(import.meta.dirname, '../pipeline/check-episodentitel.ts')
const ordner = mkdtempSync(join(tmpdir(), 'episodentitel-liste-'))
let fehler = 0

/** Exit-Code und Listenzeile des Skripts bei dieser Liste, Regel und Umgebung. */
function lauf(liste, erweitert, env = {}) {
  mkdirSync(join(ordner, 'extension'), { recursive: true })
  mkdirSync(join(ordner, 'data'), { recursive: true })
  writeFileSync(join(ordner, 'extension/offene-netflix.js'), `globalThis.AK_OFFENE_TITEL = ${JSON.stringify(liste)}\n`)
  writeFileSync(join(ordner, 'data/pruefliste-regeln.json'), JSON.stringify({ erweitert }))
  writeFileSync(join(ordner, 'data/anbieter-staffeln.json'), '{}')
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), SKRIPT], { cwd: ordner, encoding: 'utf8', env: { ...process.env, PRUEFLISTE_ERWEITERT: '', ...env } })
  const zeile = r.stdout.split('\n').find((z) => z.includes('Netflix-Liste passt zur Prüfliste')) ?? `(keine Zeile) ${r.stderr.slice(-300)}`
  return { code: r.status, zeile: zeile.trim() }
}

function erwarte(name, ergebnis, code, anfang) {
  const ok = ergebnis.code === code && ergebnis.zeile.startsWith(anfang)
  if (!ok) fehler++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — Exit ${ergebnis.code}, ${ergebnis.zeile}`}`)
}

const mitAngaben = { '1': { vertrauen: 'ungeprueft', staffeln: [{ id: -9, folgen: 3 }] } }
const ohneAngaben = { '1': { staffeln: [{ id: 5, folgen: 12 }] }, '2': { staffeln: [{ id: 6, folgen: 12 }] } }
try {
  erwarte('eingeschaltet, Liste leer (alles beantwortet): grün', lauf({}, true), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: true)')
  erwarte('eingeschaltet erzeugt: grün', lauf(mitAngaben, true), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: true)')
  erwarte('ausgeschaltet erzeugt, Regel an: rot', lauf(ohneAngaben, true), 1, '✗ Netflix-Liste passt zur Prüfliste (erweitert: true) — ["1","2"]')
  erwarte('ausgeschaltet erzeugt, Regel aus: grün', lauf(ohneAngaben, false), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: false)')
  erwarte('PRUEFLISTE_ERWEITERT=0 schlägt die Regeldatei', lauf(ohneAngaben, true, { PRUEFLISTE_ERWEITERT: '0' }), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: false)')
  erwarte('PRUEFLISTE_ERWEITERT=1 schlägt die Regeldatei', lauf(ohneAngaben, false, { PRUEFLISTE_ERWEITERT: '1' }), 1, '✗ Netflix-Liste passt zur Prüfliste (erweitert: true)')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log(fehler ? `check-episodentitel-liste: ${fehler} rot.` : 'check-episodentitel-liste: grün.')
process.exit(fehler ? 1 : 0)
