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

/** Exit-Code und Listenzeile des Skripts bei dieser Liste, Regel, Umgebung und Strukturdatei (null: Datei fehlt). */
function lauf(liste, erweitert, env = {}, struktur = {}) {
  mkdirSync(join(ordner, 'extension'), { recursive: true })
  mkdirSync(join(ordner, 'data'), { recursive: true })
  writeFileSync(join(ordner, 'extension/offene-netflix.js'), `globalThis.AK_OFFENE_TITEL = ${JSON.stringify(liste)}\n`)
  writeFileSync(join(ordner, 'data/pruefliste-regeln.json'), JSON.stringify({ erweitert }))
  const strukturDatei = join(ordner, 'data/anbieter-staffeln.json')
  if (struktur === null) rmSync(strukturDatei, { force: true })
  else writeFileSync(strukturDatei, JSON.stringify(struktur))
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
const anbieterListe = { '1': { staffeln: [{ id: 5, folgen: 12 }] } }
const gruen = '✓ Netflix-Liste passt zur Prüfliste (erweitert: true)'
const rot1 = '✗ Netflix-Liste passt zur Prüfliste (erweitert: true) — ["1"]'
try {
  erwarte('eingeschaltet, Liste leer (alles beantwortet): grün', lauf({}, true), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: true)')
  erwarte('eingeschaltet erzeugt: grün', lauf(mitAngaben, true), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: true)')
  erwarte('ausgeschaltet erzeugt, Regel an: rot', lauf(ohneAngaben, true), 1, '✗ Netflix-Liste passt zur Prüfliste (erweitert: true) — ["1","2"]')
  erwarte('ausgeschaltet erzeugt, Regel aus: grün', lauf(ohneAngaben, false), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: false)')
  erwarte('PRUEFLISTE_ERWEITERT=0 schlägt die Regeldatei', lauf(ohneAngaben, true, { PRUEFLISTE_ERWEITERT: '0' }), 0, '✓ Netflix-Liste passt zur Prüfliste (erweitert: false)')
  erwarte('PRUEFLISTE_ERWEITERT=1 schlägt die Regeldatei', lauf(ohneAngaben, false, { PRUEFLISTE_ERWEITERT: '1' }), 1, '✗ Netflix-Liste passt zur Prüfliste (erweitert: true)')
  erwarte('eingeschaltet, Anbieter-Staffeln statt Angaben: grün', lauf(anbieterListe, true, {}, { '1': { staffeln: [{}] } }), 0, gruen)
  erwarte('eingeschaltet, Anbieter-Eintrag ohne Staffeln: rot', lauf(anbieterListe, true, {}, { '1': { staffeln: [] } }), 1, rot1)
  erwarte('eingeschaltet, Eintrag fehlt in der Strukturdatei: rot', lauf(anbieterListe, true, {}, { '2': { staffeln: [{}] } }), 1, rot1)
  erwarte('eingeschaltet, Strukturdatei fehlt, Liste leer: grün', lauf({}, true, {}, null), 0, gruen)
  erwarte('eingeschaltet, Strukturdatei fehlt, Eintrag ohne Angaben: rot', lauf(anbieterListe, true, {}, null), 1, rot1)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log(fehler ? `check-episodentitel-liste: ${fehler} rot.` : 'check-episodentitel-liste: grün.')
process.exit(fehler ? 1 : 0)
