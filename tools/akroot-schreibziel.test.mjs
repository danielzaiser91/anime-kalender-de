/**
 * Wächter: Was unter einer Kulisse (`AK_ROOT`) läuft, schreibt nichts in den Repo-Baum. Zwei Teile, beide mit cwd = Repo
 * (der Fall, der ein cwd-relatives Ziel verrät):
 * 1. Sonde `akroot-schreibziel-probe.ts` ruft die Schreiber des Baus einzeln auf; ihre Dateien müssen in der Kulisse entstehen.
 * 2. Jede `pipeline/check-*.ts`, die `AK_ROOT` selbst setzt, läuft einmal; danach ist kein Stand im Repo verändert. Ihr Exit-Code
 *    zählt nicht: eine rote Prüfung meldet `check:logic`, hier heißt sie nur „ungeprüft“ (sie kann vor dem Schreiben abgebrochen sein).
 * Verglichen wird Größe und Änderungszeit jeder getrackten und ungetrackten Datei, nicht nur `git diff`: ein Schreiber, der
 * denselben Inhalt noch einmal schreibt, bliebe im Diff unsichtbar (Anlass: Bauer 1590, `justwatch-widersprueche.md`).
 */
import { execFileSync, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const TSX = createRequire(join(WURZEL, 'package.json')).resolve('tsx/cli')

/** Größe und Änderungszeit aller Dateien, die Git kennt oder nicht ignoriert. */
export function repoStand(wurzel) {
  const liste = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28 })
  const stand = new Map()
  for (const datei of liste.split('\0').filter(Boolean)) {
    try {
      const s = statSync(join(wurzel, datei))
      stand.set(datei, `${s.size}:${s.mtimeMs}`)
    } catch {
      stand.set(datei, 'weg')
    }
  }
  return stand
}

export function unterschiede(vorher, nachher) {
  return [...new Set([...vorher.keys(), ...nachher.keys()])].filter((d) => vorher.get(d) !== nachher.get(d)).sort()
}

/** Ohne `kulisse` läuft der Prozess ohne `AK_ROOT` in der Umgebung, so wie `check:logic` die Prüfungen startet. */
function laufe(skript, kulisse) {
  const env = { ...process.env }
  delete env.AK_ROOT
  if (kulisse) env.AK_ROOT = kulisse
  const r = spawnSync(process.execPath, [TSX, skript], { cwd: WURZEL, env, encoding: 'utf8' })
  return { code: r.status ?? -1, aus: `${r.stdout}${r.stderr}` }
}

/** Läuft jede Prüfung einmal; Verstoß ist nur ein veränderter Repo-Stand, ein Exit ≠ 0 macht die Prüfung „ungeprüft“. */
export function schreibzielLauf(wurzel, skripte, starte) {
  const verstoesse = []
  const ungeprueft = []
  for (const f of skripte) {
    const davor = repoStand(wurzel)
    const { code } = starte(f)
    const geaendert = unterschiede(davor, repoStand(wurzel))
    if (geaendert.length) verstoesse.push(`${f} schreibt ins Repo: ${geaendert.join(', ')}`)
    if (code !== 0) ungeprueft.push(`${f}: ungeprüft (Exit ${code})`)
  }
  return { verstoesse, ungeprueft }
}

/** Gegenprobe: ein Schreiber ins Repo bleibt ein Verstoß, eine rote Prüfung ohne Schreiben wird keiner. */
function pruefeGegenprobe() {
  const dir = mkdtempSync(join(tmpdir(), 'akroot-gegenprobe-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, 'schreibt.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('ins-repo.txt', 'x')\n")
    writeFileSync(join(dir, 'rot.mjs'), 'process.exit(1)\n')
    const starte = (f) => ({ code: spawnSync(process.execPath, [f], { cwd: dir }).status ?? -1 })
    const { verstoesse, ungeprueft } = schreibzielLauf(dir, ['schreibt.mjs', 'rot.mjs'], starte)
    assert.deepEqual(verstoesse, ['schreibt.mjs schreibt ins Repo: ins-repo.txt'], 'Gegenprobe: Schreiber ins Repo muss auffallen')
    assert.deepEqual(ungeprueft, ['rot.mjs: ungeprüft (Exit 1)'], 'Gegenprobe: rote Prüfung ohne Schreiben ist nur ungeprüft')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Der Vergleich sieht eine Datei, die mit gleichem Inhalt neu geschrieben wurde (nur die Änderungszeit ändert sich). */
function pruefeVergleich() {
  const dir = mkdtempSync(join(tmpdir(), 'akroot-vergleich-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir })
    writeFileSync(join(dir, 'a.txt'), 'gleich')
    const vorher = repoStand(dir)
    assert.deepEqual(unterschiede(vorher, repoStand(dir)), [], 'Vergleich: ohne Änderung kein Unterschied')
    writeFileSync(join(dir, 'a.txt'), 'gleich')
    utimesSync(join(dir, 'a.txt'), 1577836800, 1577836800)
    assert.deepEqual(unterschiede(vorher, repoStand(dir)), ['a.txt'], 'Vergleich: gleicher Inhalt, neue Änderungszeit muss auffallen')
    writeFileSync(join(dir, 'b.txt'), 'neu')
    assert.deepEqual(unterschiede(vorher, repoStand(dir)), ['a.txt', 'b.txt'], 'Vergleich: neue Datei muss auffallen')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

pruefeVergleich()
pruefeGegenprobe()
const kulisse = mkdtempSync(join(tmpdir(), 'akroot-schreibziel-'))
mkdirSync(join(kulisse, 'data'))
writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '[]')
try {
  const vorher = repoStand(WURZEL)
  const sonde = laufe(join(WURZEL, 'tools', 'akroot-schreibziel-probe.ts'), kulisse)
  assert.equal(sonde.code, 0, `Sonde: ${sonde.aus}`)
  assert.deepEqual(unterschiede(vorher, repoStand(WURZEL)), [], 'Sonde: Schreiber hat den Repo-Baum verändert')
  for (const ziel of ['data/meldungen-an-claude.jsonl', 'daniel-zum-abarbeiten/listen/23-nur-originalton.md', 'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md']) {
    assert.ok(existsSync(join(kulisse, ziel)), `Sonde: ${ziel} fehlt in der Kulisse`)
  }
  const meldungen = readFileSync(join(kulisse, 'data', 'meldungen-an-claude.jsonl'), 'utf8').trim().split('\n')
  assert.equal(meldungen.length, 3, `Sonde: je Schreiber eine Meldung erwartet (der Zweitlauf vergleicht gegen die Kulisse), nicht ${meldungen.length}`)
  const { voicesDir } = JSON.parse(sonde.aus.trim().split('\n').at(-1))
  assert.ok(voicesDir.startsWith(kulisse), `Sonde: Stimmen-Ordner liegt nicht in der Kulisse: ${voicesDir}`)
  console.log('akroot-schreibziel: Sonde schreibt nur in die Kulisse')

  // Jede Prüfung, die AK_ROOT nennt oder eine schreibWurzel vorgibt, setzt ihre Kulisse selbst. Der Prozess startet ohne AK_ROOT: sonst verdeckt die Umgebung
  // Module, die vor dem eigenen Setzen laden und die Repo-Wurzel merken.
  const checks = readdirSync(join(WURZEL, 'pipeline'))
    .filter((f) => /^check-.*\.ts$/.test(f) && /AK_ROOT|schreibWurzel/.test(readFileSync(join(WURZEL, 'pipeline', f), 'utf8')))
    .sort()
  assert.ok(checks.length > 0, 'keine Prüfung mit Kulisse gefunden')
  const { verstoesse, ungeprueft } = schreibzielLauf(WURZEL, checks, (f) => laufe(join(WURZEL, 'pipeline', f)))
  for (const zeile of ungeprueft) console.log(`akroot-schreibziel: ${zeile}`)
  assert.equal(verstoesse.length, 0, verstoesse.join('\n'))
  console.log(`akroot-schreibziel: ${checks.length} Prüfungen mit Kulisse, ${ungeprueft.length} ungeprüft, 0 schreiben ins Repo`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
