/**
 * Prozess-Test für die Verdrahtung in `erneut-melden.mjs`: Das echte Skript läuft in einem Wegwerf-Repo (Kulisse mit
 * Fake-Erzeugern, Fake-`npm run check:vor-commit` und Fake-`pr-einreichen.sh`); geprüft wird, dass im Arbeitsbaum
 * gearbeitet wird, der Hauptordner unberührt bleibt und nach jedem Ausgang (auch `process.exit(1)`, Wurf) aufgeräumt ist.
 * Wegwerf-Ordner unter `os.tmpdir()`.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'

const tools = import.meta.dirname
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const persoenlich = ['-c', 'user.name=t', '-c', 'user.email=t@t']
const wurzel = mkdtempSync(join(tmpdir(), 'erneut-lauf-'))
const ursprung = join(wurzel, 'ursprung.git')
const haupt = join(wurzel, 'haupt')
const sonde = join(wurzel, 'sonde')
mkdirSync(sonde)

const datei = (rel, inhalt) => {
  mkdirSync(dirname(join(haupt, rel)), { recursive: true })
  writeFileSync(join(haupt, rel), inhalt)
}

/* Kulisse: nur die Teile, die `erneut-melden.mjs` im Einreichen-Weg anfasst. */
git(wurzel, 'init', '-q', '--bare', '-b', 'main', ursprung)
git(wurzel, 'clone', '-q', ursprung, haupt)
mkdirSync(join(haupt, 'tools'))
copyFileSync(join(tools, 'erneut-melden.mjs'), join(haupt, 'tools', 'erneut-melden.mjs'))
copyFileSync(join(tools, 'erneut-melden-worktree.mjs'), join(haupt, 'tools', 'erneut-melden-worktree.mjs'))
datei('tools/verdacht.mjs', 'export const verdachtsfaelle = () => []\n')
/* Der Netflix-Erzeuger übernimmt die YAML in die Liste; `AK_LEER` lässt ihn nichts eintragen (Weg „FEHL“). */
datei('tools/extension-offene-liste.mjs', `import { readFileSync, writeFileSync } from 'node:fs'\nwriteFileSync('extension/offene-netflix.js', process.env.AK_LEER ? '' : 'liste ' + readFileSync('data/erneut-melden.yaml', 'utf8'))\n`)
datei('tools/extension-offene-amazon.mjs', '')
datei('tools/extension-offene-disney.mjs', '')
datei('tools/pruefstand.mjs', `import { appendFileSync } from 'node:fs'\nappendFileSync(process.env.AK_SONDE + '/pruefstand.txt', process.cwd() + '\\n')\n`)
datei('tools/vor-commit-attrappe.mjs', `import { appendFileSync } from 'node:fs'\nappendFileSync(process.env.AK_SONDE + '/vorcommit.txt', process.cwd() + '\\n')\nprocess.exit(process.env.AK_VC_ROT ? 1 : 0)\n`)
datei('tools/pr-attrappe.mjs', `import { execFileSync } from 'node:child_process'\nimport { writeFileSync } from 'node:fs'\nconst g = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim()\nwriteFileSync(process.env.AK_SONDE + '/pr.txt', [process.cwd(), g('rev-parse', '--abbrev-ref', 'HEAD'), process.argv[2], g('show', '--name-only', '--format=', 'HEAD')].join('\\n'))\n`)
datei('tools/pr-einreichen.sh', '#!/usr/bin/env bash\nexec node tools/pr-attrappe.mjs "$@"\n')
datei('package.json', JSON.stringify({ name: 'kulisse', private: true, scripts: { 'check:vor-commit': 'node tools/vor-commit-attrappe.mjs' } }))
datei('public/data/titles.json', JSON.stringify([{ id: 900001, titleDe: 'Testtitel', streams: [{ platform: 'netflix', url: 'https://www.netflix.com/title/900001' }] }]))
datei('public/data/pruefstand.json', JSON.stringify({ anbieter: [{ plattform: 'netflix', ziele: [{ url: 'https://www.netflix.com/title/900001' }] }] }))
datei('public/data/pruefliste-stand.json', '{}')
datei('data/erneut-melden.yaml', '[]\n')
datei('data/dub-confirmed.yaml', '[]\n')
for (const d of ['offene-netflix.js', 'offene-amazon.js', 'offene-amazon-stand.js', 'offene-disney.js']) datei(`extension/${d}`, '')
datei('.gitignore', 'node_modules\n_wt-*\n')
git(haupt, 'add', '-A')
git(haupt, ...persoenlich, 'commit', '-q', '-m', 'kulisse')
git(haupt, 'push', '-q', 'origin', 'HEAD:main')
git(haupt, 'branch', '-q', '-u', 'origin/main')
symlinkSync(join(tools, '..', 'node_modules'), join(haupt, 'node_modules'), 'junction')

const kopf = git(haupt, 'rev-parse', 'HEAD')
const yamlVorher = readFileSync(join(haupt, 'data', 'erneut-melden.yaml'), 'utf8')
const lauf = (args, umgebung = {}) => {
  rmSync(join(sonde, 'pr.txt'), { force: true })
  rmSync(join(sonde, 'vorcommit.txt'), { force: true })
  rmSync(join(sonde, 'pruefstand.txt'), { force: true })
  const env = { ...process.env, AK_SONDE: sonde, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', ...umgebung }
  return spawnSync(process.execPath, ['tools/erneut-melden.mjs', ...args], { cwd: haupt, env, encoding: 'utf8' })
}
const hauptUnberuehrt = (fall) => {
  assert.equal(git(haupt, 'rev-parse', 'HEAD'), kopf, `${fall}: Hauptordner ohne neuen Commit`)
  assert.equal(git(haupt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', `${fall}: Hauptordner bleibt auf main`)
  assert.equal(git(haupt, 'status', '--porcelain'), '', `${fall}: Hauptordner ohne Änderung`)
  assert.equal(readFileSync(join(haupt, 'data', 'erneut-melden.yaml'), 'utf8'), yamlVorher, `${fall}: YAML des Hauptordners unverändert`)
}
const aufgeraeumt = (fall) => {
  assert.deepEqual(readdirSync(haupt).filter((n) => n.startsWith('_wt-erneut-melden-')), [], `${fall}: Arbeitsbaum entfernt`)
  assert.equal(git(haupt, 'branch', '--list', 'erneut-melden/*'), '', `${fall}: Zweig entfernt`)
  assert.equal(git(haupt, 'worktree', 'list', '--porcelain').split('\n').filter((z) => z.startsWith('worktree ')).length, 1, `${fall}: kein Arbeitsbaum registriert`)
  assert.ok(existsSync(join(haupt, 'node_modules', 'js-yaml')), `${fall}: node_modules des Hauptordners bleibt voll`)
}
const imArbeitsbaum = (pfad, fall) => {
  const erwartet = haupt + sep + '_wt-erneut-melden-'
  assert.ok(pfad.trim().startsWith(erwartet), `${fall}: lief im Arbeitsbaum, nicht im Hauptordner (${pfad})`)
}

try {
  /* 1. Erfolg: Commit im Arbeitsbaum, PR-Aufruf von dort, danach aufgeräumt. */
  const ok = lauf(['900001', '--grund', 'Probe'])
  assert.equal(ok.status, 0, `Erfolgslauf: ${ok.stdout}${ok.stderr}`)
  const pr = readFileSync(join(sonde, 'pr.txt'), 'utf8').split('\n')
  imArbeitsbaum(pr[0], 'Erfolg (PR)')
  imArbeitsbaum(readFileSync(join(sonde, 'vorcommit.txt'), 'utf8'), 'Erfolg (check:vor-commit)')
  imArbeitsbaum(readFileSync(join(sonde, 'pruefstand.txt'), 'utf8'), 'Erfolg (pruefstand)')
  assert.match(pr[1], /^erneut-melden\/\d{14}$/, 'Erfolg: Zweig erneut-melden/<Stempel>')
  assert.match(pr[2], /^Prüfliste: Testtitel \(netflix\) erneut melden$/, 'Erfolg: PR-Titel')
  assert.deepEqual(pr.slice(3).sort(), ['data/erneut-melden.yaml', 'extension/offene-netflix.js'], 'Erfolg: Commit enthält YAML und Liste')
  hauptUnberuehrt('Erfolg')
  aufgeraeumt('Erfolg')

  /* 2. Wurf im Skript (kein Verweis bei Prime): Arbeitsbaum existiert schon, Exit-Handler räumt auf. */
  const wurf = lauf(['900001:primevideo'])
  assert.notEqual(wurf.status, 0, 'Wurf: Exit ungleich 0')
  assert.match(wurf.stderr, /kein Verweis/, 'Wurf: Skript war bis zur Kennungsprüfung gelaufen')
  assert.ok(!existsSync(join(sonde, 'pr.txt')), 'Wurf: kein PR')
  hauptUnberuehrt('Wurf')
  aufgeraeumt('Wurf')

  /* 3. process.exit(1) nach Erzeugen (Liste ohne Eintrag): Rücknahme im Arbeitsbaum, aufgeräumt. */
  const fehl = lauf(['900001'], { AK_LEER: '1' })
  assert.equal(fehl.status, 1, 'FEHL: Exit 1')
  assert.match(fehl.stdout, /FEHL Testtitel/, 'FEHL: Meldung')
  assert.ok(!existsSync(join(sonde, 'pr.txt')), 'FEHL: kein PR')
  hauptUnberuehrt('FEHL')
  aufgeraeumt('FEHL')

  /* 3b. Wie 3, aber mit nicht committeter Änderung im Hauptordner: die Rücknahme darf sie nicht verwerfen. */
  const lokal = join(haupt, 'extension', 'offene-netflix.js')
  writeFileSync(lokal, 'lokale Änderung\n')
  const fehl2 = lauf(['900001'], { AK_LEER: '1' })
  assert.equal(fehl2.status, 1, 'FEHL mit lokaler Änderung: Exit 1')
  assert.equal(readFileSync(lokal, 'utf8'), 'lokale Änderung\n', 'FEHL mit lokaler Änderung: Hauptordner-Datei bleibt erhalten')
  git(haupt, 'checkout', '-q', '--', 'extension/offene-netflix.js')
  hauptUnberuehrt('FEHL mit lokaler Änderung')
  aufgeraeumt('FEHL mit lokaler Änderung')

  /* 4. check:vor-commit rot: kein Commit-Versuch bis zum PR, aufgeräumt. */
  const rot = lauf(['900001'], { AK_VC_ROT: '1' })
  assert.notEqual(rot.status, 0, 'vor-commit rot: Exit ungleich 0')
  imArbeitsbaum(readFileSync(join(sonde, 'vorcommit.txt'), 'utf8'), 'vor-commit rot')
  assert.ok(!existsSync(join(sonde, 'pr.txt')), 'vor-commit rot: kein PR')
  hauptUnberuehrt('vor-commit rot')
  aufgeraeumt('vor-commit rot')

  /* 5. Ohne Einreichen (--ohne-push) und ohne Kennung: kein Arbeitsbaum. */
  const hilfe = lauf([])
  assert.equal(hilfe.status, 1, 'ohne Kennung: Aufrufhinweis, Exit 1')
  hauptUnberuehrt('ohne Kennung')
  aufgeraeumt('ohne Kennung')
} finally {
  unlinkSync(join(haupt, 'node_modules'))
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('erneut-melden (Prozess): alle Fälle grün (Erfolg im Arbeitsbaum, Wurf, process.exit(1), FEHL mit lokaler Änderung, check:vor-commit rot, pruefstand im Arbeitsbaum, ohne Kennung)')
