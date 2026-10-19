/**
 * Wächter: Was unter einer Kulisse (`AK_ROOT`) läuft, schreibt nichts in den Repo-Baum. Zwei Teile, beide mit cwd = Repo
 * (der Fall, der ein cwd-relatives Ziel verrät):
 * 1. Sonde `akroot-schreibziel-probe.ts` ruft die Schreiber des Baus einzeln auf; ihre Dateien müssen in der Kulisse entstehen.
 * 2. Jede `pipeline/check-*.ts`, die `AK_ROOT` selbst setzt, läuft einmal; danach ist kein Stand im Repo verändert.
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
const kulisse = mkdtempSync(join(tmpdir(), 'akroot-schreibziel-'))
mkdirSync(join(kulisse, 'data'))
writeFileSync(join(kulisse, 'data', 'kino-ankuendigungen.yaml'), '[]')
try {
  const vorher = repoStand(WURZEL)
  const sonde = laufe(join(WURZEL, 'tools', 'akroot-schreibziel-probe.ts'), kulisse)
  assert.equal(sonde.code, 0, sonde.aus)
  assert.deepEqual(unterschiede(vorher, repoStand(WURZEL)), [], 'Sonde: Schreiber hat den Repo-Baum verändert')
  for (const ziel of ['data/meldungen-an-claude.jsonl', 'daniel-zum-abarbeiten/listen/23-nur-originalton.md', 'daniel-zum-abarbeiten/listen/22-belege-ohne-fundstelle.md']) {
    assert.ok(existsSync(join(kulisse, ziel)), `Sonde: ${ziel} fehlt in der Kulisse`)
  }
  const meldungen = readFileSync(join(kulisse, 'data', 'meldungen-an-claude.jsonl'), 'utf8').trim().split('\n')
  assert.equal(meldungen.length, 3, `Sonde: je Schreiber eine Meldung erwartet (der Zweitlauf vergleicht gegen die Kulisse), nicht ${meldungen.length}`)
  const { voicesDir } = JSON.parse(sonde.aus.trim().split('\n').at(-1))
  assert.ok(voicesDir.startsWith(kulisse), `Sonde: Stimmen-Ordner liegt nicht in der Kulisse: ${voicesDir}`)
  console.log('akroot-schreibziel: Sonde schreibt nur in die Kulisse')

  // Jede Prüfung, die AK_ROOT nennt, setzt ihre Kulisse selbst. Der Prozess startet ohne AK_ROOT: sonst verdeckt die Umgebung
  // Module, die vor dem eigenen Setzen laden und die Repo-Wurzel merken.
  const checks = readdirSync(join(WURZEL, 'pipeline'))
    .filter((f) => /^check-.*\.ts$/.test(f) && readFileSync(join(WURZEL, 'pipeline', f), 'utf8').includes('AK_ROOT'))
    .sort()
  assert.ok(checks.length > 0, 'keine Prüfung mit Kulisse gefunden')
  const gelaufen = []
  for (const f of checks) {
    gelaufen.push(f)
    const davor = repoStand(WURZEL)
    const lauf = laufe(join(WURZEL, 'pipeline', f))
    assert.equal(lauf.code, 0, `${f}: ${lauf.aus.slice(-600)}`)
    assert.deepEqual(unterschiede(davor, repoStand(WURZEL)), [], `${f} schreibt ins Repo`)
  }
  assert.deepEqual(gelaufen, checks, 'nicht jede Prüfung mit Kulisse ist gelaufen')
  console.log(`akroot-schreibziel: ${checks.length} Prüfungen mit Kulisse lassen den Repo-Baum unberührt`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
