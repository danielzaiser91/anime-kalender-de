/**
 * Wächter: Was unter einer Kulisse (`AK_ROOT`) läuft, schreibt nichts in den Repo-Baum. Zwei Teile, beide mit cwd = Repo
 * (der Fall, der ein cwd-relatives Ziel verrät):
 * 1. Sonde `akroot-schreibziel-probe.ts` ruft die Schreiber des Baus einzeln auf; ihre Dateien müssen in der Kulisse entstehen.
 * 2. Jede `pipeline/check-*.ts`, die `AK_ROOT` selbst setzt, läuft einmal; danach ist kein Stand im Repo verändert. Ihr Exit-Code
 *    zählt nicht: eine rote Prüfung meldet `check:logic`, hier heißt sie nur „ungeprüft“ (sie kann vor dem Schreiben abgebrochen sein).
 * Verglichen wird Größe und Änderungszeit jeder getrackten und ungetrackten Datei, nicht nur `git diff`: ein Schreiber, der
 * denselben Inhalt noch einmal schreibt, bliebe im Diff unsichtbar (Anlass: Bauer 1590, `justwatch-widersprueche.md`).
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { availableParallelism, tmpdir } from 'node:os'
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
function umgebung(kulisse) {
  const env = { ...process.env }
  delete env.AK_ROOT
  if (kulisse) env.AK_ROOT = kulisse
  return env
}

function laufe(skript, kulisse) {
  const r = spawnSync(process.execPath, [TSX, skript], { cwd: WURZEL, env: umgebung(kulisse), encoding: 'utf8' })
  return { code: r.status ?? -1, aus: `${r.stdout}${r.stderr}` }
}

/** Wie `laufe`, aber ohne Warten und ohne Ausgabe (nur der Exit-Code zählt). */
function laufeAsync(skript) {
  return new Promise((fertig) => {
    const kind = spawn(process.execPath, [TSX, skript], { cwd: WURZEL, env: umgebung(), stdio: 'ignore', windowsHide: true, timeout: 600000 })
    kind.on('error', () => fertig({ code: -1 }))
    kind.on('close', (code) => fertig({ code: code ?? -1 }))
  })
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

/**
 * Wie `schreibzielLauf`, aber die Prüfungen laufen gleichzeitig (höchstens `breite`): nacheinander brauchten 119 Prozesse 277 s (CI, 03.11.2026) und waren
 * der längste Test der Kette. Verglichen wird der Repo-Stand vor und nach dem ganzen Stapel; ändert sich etwas, benennt ein Einzellauf den Verursacher.
 */
export async function schreibzielStapel(wurzel, skripte, starteParallel, starteEinzeln, breite) {
  if (!(breite >= 1)) throw new Error(`schreibzielStapel: Breite ${breite} lässt keine Prüfung laufen`)
  const davor = repoStand(wurzel)
  const codes = new Array(skripte.length)
  let naechster = 0
  const arbeiter = async () => {
    while (naechster < skripte.length) {
      const i = naechster++
      codes[i] = (await starteParallel(skripte[i])).code
    }
  }
  await Promise.all(Array.from({ length: Math.min(breite, skripte.length) }, arbeiter))
  const ungeprueft = skripte.flatMap((f, i) => (codes[i] === 0 ? [] : [`${f}: ungeprüft (Exit ${codes[i]})`]))
  const geaendert = unterschiede(davor, repoStand(wurzel))
  if (geaendert.length === 0) return { verstoesse: [], ungeprueft }
  const einzeln = schreibzielLauf(wurzel, skripte, starteEinzeln)
  const unbekannt = [`Der Stapel hat das Repo verändert: ${geaendert.join(', ')} (im Einzellauf keine Prüfung als Verursacher gefunden)`]
  return { verstoesse: einzeln.verstoesse.length > 0 ? einzeln.verstoesse : unbekannt, ungeprueft }
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

/** Gegenprobe des Stapels: gleiches Urteil wie nacheinander (still, Schreiber, rote Prüfung), auch bei Breite 1 und breiter als die Liste. */
async function pruefeStapel() {
  const dir = mkdtempSync(join(tmpdir(), 'akroot-stapel-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir, timeout: 60000 })
    const still = ['still1.mjs', 'still2.mjs', 'still3.mjs', 'still4.mjs', 'still5.mjs']
    for (const f of still) writeFileSync(join(dir, f), "console.log('still')\n")
    writeFileSync(join(dir, 'schreibt.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('ins-repo.txt', 'x')\n")
    writeFileSync(join(dir, 'rot.mjs'), 'process.exit(1)\n')
    const einzeln = (f) => ({ code: spawnSync(process.execPath, [f], { cwd: dir, timeout: 60000 }).status ?? -1 })
    const parallel = (f) => new Promise((fertig) => spawn(process.execPath, [f], { cwd: dir, stdio: 'ignore', timeout: 60000 }).on('close', (code) => fertig({ code: code ?? -1 })))
    for (const breite of [1, 3, 50]) {
      const ruhig = await schreibzielStapel(dir, [...still, 'rot.mjs'], parallel, einzeln, breite)
      assert.deepEqual(ruhig, { verstoesse: [], ungeprueft: ['rot.mjs: ungeprüft (Exit 1)'] }, `Stapel (Breite ${breite}): nur eine rote Prüfung, nichts geschrieben`)
      const mitSchreiber = await schreibzielStapel(dir, ['still1.mjs', 'schreibt.mjs', ...still.slice(1)], parallel, einzeln, breite)
      assert.deepEqual(mitSchreiber.verstoesse, ['schreibt.mjs schreibt ins Repo: ins-repo.txt'], `Stapel (Breite ${breite}): der Schreiber wird mit Namen gefunden`)
      rmSync(join(dir, 'ins-repo.txt'), { force: true })
    }
    await assert.rejects(schreibzielStapel(dir, still, parallel, einzeln, 0), /Breite 0 lässt keine Prüfung laufen/, 'Stapel: Breite 0 wird abgewiesen, kein stiller Leerlauf')
    // Verursacher nicht auffindbar (ein Zweitlauf schreibt nicht mehr): der Stapel meldet die Dateien trotzdem.
    const einmal = einzeln
    writeFileSync(join(dir, 'einmalig.mjs'), "import { existsSync, writeFileSync } from 'node:fs'\nif (!existsSync('einmal.txt')) writeFileSync('einmal.txt', 'x')\n")
    const unbekannt = await schreibzielStapel(dir, ['einmalig.mjs'], parallel, einmal, 2)
    assert.match(unbekannt.verstoesse.join('\n'), /Der Stapel hat das Repo verändert: einmal\.txt/, 'Stapel: Änderung ohne auffindbaren Verursacher bleibt ein Verstoß')
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
await pruefeStapel()
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
  const { verstoesse, ungeprueft } = await schreibzielStapel(WURZEL, checks, (f) => laufeAsync(join(WURZEL, 'pipeline', f)), (f) => laufe(join(WURZEL, 'pipeline', f)), availableParallelism())
  for (const zeile of ungeprueft) console.log(`akroot-schreibziel: ${zeile}`)
  // Ein Leerlauf (Stapel fährt nichts) meldet lauter „ungeprüft“ und bliebe sonst grün; gemessen 03.11.2026: 1 von 119.
  assert.ok(ungeprueft.length * 2 < checks.length, `Stapel fuhr kaum Prüfungen: ${ungeprueft.length} von ${checks.length} ungeprüft`)
  assert.equal(verstoesse.length, 0, verstoesse.join('\n'))
  console.log(`akroot-schreibziel: ${checks.length} Prüfungen mit Kulisse, ${ungeprueft.length} ungeprüft, 0 schreiben ins Repo`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
