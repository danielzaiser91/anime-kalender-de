/**
 * Test: Die Pfadliste (`PFADE`) im Job `aussehen` von pr-pruefung.yml nennt jede Datei, die `check:panel` und `check:ansichten`
 * ausführen. Ein PR, der nur die Trefferprobe ändert, muss den Job auslösen (Prüfer, 16.10.2026).
 * Die Menge kommt aus `package.json` (Aufrufe `node tools/…` und `npm run …`, rekursiv) samt den relativen Importen der Werkzeuge
 * (Syntaxbaum; dynamische Importe zählt der Test nicht), keine Handliste.
 * Aufruf: node tools/pr-aussehen-pfade.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { parse } from 'yaml'

const WURZEL = resolve(import.meta.dirname, '..')
export const WURZELN = ['check:panel', 'check:ansichten', 'check:einstellungen', 'check:suchhinweis', 'check:buehne-fenster', 'check:buehne-messen', 'check:buehne-panel', 'check:kasten', 'check:cls-wechsel', 'check:filter-tempo']

/** Führt die Zeilen `PFADE=` und `LISTE=` des Schritts in bash aus und liefert beide echten Ausdrücke als einen. */
export function pfadAusdruck(lauf) {
  const zeilen = lauf.split('\n').filter((z) => /^\s*(PFADE|LISTE)=/.test(z))
  const r = spawnSync('bash', ['-s'], { input: `${zeilen.join('\n')}\nprintf '%s\\n' "$PFADE" "$LISTE"\n`, cwd: WURZEL, encoding: 'utf8', timeout: 20000, windowsHide: true })
  assert.equal(r.status, 0, `Ausdrücke nicht berechenbar: ${r.stderr}`)
  const [pfade, liste] = r.stdout.split('\n')
  assert.ok(pfade && liste, 'PFADE und LISTE müssen beide gesetzt sein')
  return new RegExp(`${pfade}|${liste}`)
}

/** Fährt den ganzen Schritt in einem Wegwerf-Repo: Liste und eine Änderung `geaendert` im zweiten Commit; liefert, ob er `betroffen=1` schreibt. */
export function jobSagtBetroffen(lauf, listeText, geaendert) {
  const ordner = mkdtempSync(join(tmpdir(), 'pfade-union-'))
  const git = (...a) => {
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, encoding: 'utf8', timeout: 20000, windowsHide: true })
    assert.equal(r.status, 0, `git ${a[0]}: ${r.stderr}`)
  }
  try {
    mkdirSync(join(ordner, 'tools'))
    writeFileSync(join(ordner, 'tools/pr-aussehen-pfade.txt'), listeText)
    git('init', '-q')
    git('add', '.')
    git('commit', '-q', '-m', 'a')
    mkdirSync(dirname(join(ordner, geaendert)), { recursive: true })
    writeFileSync(join(ordner, geaendert), geaendert === 'tools/pr-aussehen-pfade.txt' ? `${listeText}tools/neu.mjs\n` : 'x\n')
    git('add', '.')
    git('commit', '-q', '-m', 'b')
    const ausgabe = join(ordner, 'ausgabe')
    writeFileSync(ausgabe, '')
    const r = spawnSync('bash', ['-s'], { input: lauf, cwd: ordner, env: { ...process.env, GITHUB_OUTPUT: ausgabe }, encoding: 'utf8', timeout: 20000, windowsHide: true })
    assert.equal(r.status, 0, `Schritt endete mit ${r.status}: ${r.stderr}`)
    return readFileSync(ausgabe, 'utf8').includes('betroffen=1')
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

/** Alle Skriptdateien (`tools/….mjs`), die das npm-Skript `name` und seine `npm run`-Aufrufe starten. */
export function skripteVon(scripts, name, gesehen = new Set()) {
  const dateien = new Set()
  if (gesehen.has(name)) return dateien
  gesehen.add(name)
  /* Auch verschachtelt: `node tools/schwer.mjs node tools/x.mjs` und `node tools/schwer.mjs npm run y` starten beide Ziele. */
  for (const schritt of scripts[name].split('&&')) {
    for (const m of schritt.matchAll(/\bnpm run (\S+)/g)) skripteVon(scripts, m[1], gesehen).forEach((d) => dateien.add(d))
    for (const m of schritt.matchAll(/\bnode (tools\/\S+\.mjs)/g)) dateien.add(m[1])
  }
  return dateien
}

/** Relative Importe und Re-Exporte einer Datei als Pfade ab der Wurzel. */
export function importeVon(datei, lies = (p) => readFileSync(join(WURZEL, p), 'utf8')) {
  const baum = ts.createSourceFile(datei, lies(datei), ts.ScriptTarget.Latest)
  const ziele = []
  for (const knoten of baum.statements) {
    const spez = (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) && knoten.moduleSpecifier
    if (spez && spez.text.startsWith('.')) ziele.push(join(dirname(datei), spez.text).replaceAll('\\', '/'))
  }
  return ziele
}

/** Skripte samt allem, was sie aus `tools/` importieren (abgeschlossene Hülle; `shared/` ist Anwendungscode, den löst `web/src` aus). */
export function huelle(start, lies) {
  const alle = new Set(start)
  for (const datei of alle) importeVon(datei, lies).filter((z) => z.startsWith('tools/')).forEach((z) => alle.add(z))
  return alle
}

/** Fehler der Werkzeugliste: nur `tools/<name>.mjs`-Zeilen (und Kommentare), C-sortiert, ohne Doppelte. */
export function listenFehler(text) {
  const zeilen = text.split('\n').filter((z) => z && !z.startsWith('#'))
  const fehler = zeilen.filter((z) => !/^tools\/[a-z0-9-]+\.mjs$/.test(z)).map((z) => `Zeile nicht von der Form tools/<name>.mjs: ${z}`)
  if (new Set(zeilen).size !== zeilen.length) fehler.push('doppelte Zeile')
  if (zeilen.join('\n') !== [...zeilen].sort().join('\n')) fehler.push('nicht sortiert (LC_ALL=C sort)')
  return fehler
}

/** Der Schritt liest die Datei wirklich (Lauf im Wegwerf-Repo) und die Listenprüfung schlägt bei jedem Formfehler an. */
function pruefeSelbst(lauf, liste) {
  const klein = '# k (offene Klammer\ntools/a-b.mjs\ntools/c.mjs\n'
  assert.equal(jobSagtBetroffen(lauf, klein, 'tools/c.mjs'), true, 'Werkzeug aus der Liste löst den Job aus')
  assert.equal(jobSagtBetroffen(lauf, klein, 'tools/cx.mjs'), false, 'Werkzeug außerhalb der Liste löst ihn nicht aus')
  assert.equal(jobSagtBetroffen(lauf, klein, 'tools/aXb.mjs'), false, 'Punkt und Bindestrich werden wörtlich genommen')
  assert.equal(jobSagtBetroffen(lauf, klein, 'tools/c-mjs'), false, 'Punkt im Pfad wird maskiert')
  assert.equal(jobSagtBetroffen(lauf, klein, 'tools/pr-aussehen-pfade.txt'), true, 'Änderung der Liste löst den Job aus')
  assert.equal(jobSagtBetroffen(lauf, klein, 'web/src/x.tsx'), true, 'Oberfläche löst den Job aus')
  assert.deepEqual(listenFehler(liste), [])
  assert.deepEqual(listenFehler('tools/b.mjs\ntools/a.mjs\n'), ['nicht sortiert (LC_ALL=C sort)'])
  assert.deepEqual(listenFehler('tools/a.mjs\ntools/a.mjs\n'), ['doppelte Zeile'])
  assert.equal(listenFehler('tools/a.sh\n').length, 1)
  assert.equal(listenFehler('tools/a.mjs\n').length, 0)
}

function main() {
  const doc = parse(readFileSync(resolve(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8'))
  const lauf = doc.jobs.aussehen.steps.find((s) => s.id === 'pfad').run
  const liste = readFileSync(resolve(WURZEL, 'tools/pr-aussehen-pfade.txt'), 'utf8')
  assert.deepEqual(listenFehler(liste), [], 'tools/pr-aussehen-pfade.txt')
  pruefeSelbst(lauf, liste)
  const ausdruck = pfadAusdruck(lauf)
  const scripts = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8')).scripts
  const namen = Object.keys(scripts).filter((n) => WURZELN.some((w) => n === w || n.startsWith(`${w}-`)))
  const dateien = huelle(namen.flatMap((n) => [...skripteVon(scripts, n)]))
  const muss = [...dateien, 'package.json', 'web/src/main.tsx', '.github/workflows/pr-pruefung.yml']
  const fehlen = muss.filter((d) => !ausdruck.test(d))
  assert.deepEqual(fehlen, [], `lösen den Job aussehen nicht aus: ${fehlen.join(', ')}`)
  assert.ok(dateien.size >= 15, `zu wenige Werkzeuge erkannt (${dateien.size})`)
  assert.doesNotMatch('tools/andere-datei.mjs', ausdruck, 'Pfadliste ist zu weit')
  console.log(`pr-aussehen-pfade.test: grün (${muss.length} Dateien)`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
