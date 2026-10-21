/**
 * Prozesstest für tools/pr-nachtraege.mjs: startet das Skript wie der Workflow, mit einem nachgebauten `gh` auf PATH.
 * Die Attrappe ist das Node-Programm selbst unter dem Namen `gh`; `gh api …` lädt so die Datei `api` im Arbeitsordner.
 * Sie blättert wie gh: ohne `--paginate` nur die erste Seite, `--slurp` ohne `--paginate` ist ein Fehler.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HINWEIS_NACHTRAEGE } from './pr-nachtraege.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const SKRIPT = fileURLToPath(new URL('./pr-nachtraege.mjs', import.meta.url))
const ATTRAPPE = `const fs = require('node:fs')
const args = process.argv.slice(2)
fs.appendFileSync(process.env.ATTRAPPE_LOG, JSON.stringify(args) + '\\n')
const daten = JSON.parse(fs.readFileSync(process.env.ATTRAPPE_DATEN, 'utf8'))
const pfad = args.at(-1)
const seiten = daten.listen[pfad]
const aus = (x) => process.stdout.write(JSON.stringify(x))
if (args.includes('--slurp') && !args.includes('--paginate')) {
  process.stderr.write('the --slurp option is only supported with --paginate')
  process.exit(1)
}
if (daten.abbruch.includes(pfad)) {
  aus(seiten)
  process.stderr.write('HTTP 502 nach der letzten Seite')
  process.exit(1)
}
if (seiten && args.includes('--paginate') && args.includes('--slurp')) aus(seiten)
else if (seiten && !args.includes('--paginate')) aus(seiten[0])
else if (daten.einzel[pfad] && args.length === 1) aus(daten.einzel[pfad])
else {
  process.stderr.write('HTTP 404: ' + args.join(' '))
  process.exit(1)
}
`
const k = (login, author_association, body) => ({ user: { login }, author_association, body })
const commit = (sha, betreff) => ({ sha, commit: { message: `${betreff}\n\nRumpf` } })
const KOMMENTARE = [
  [k('inhaber', 'OWNER', 'Prüfer: ändern'), k('inhaber', 'OWNER', '## Nachtrag eins'), k('claude[bot]', 'NONE', '## Nachtrag App')],
  [k('github-actions[bot]', 'CONTRIBUTOR', '## Nachtrag Bot'), k('inhaber', 'OWNER', '**Nachtrag zwei'), k('fremd', 'NONE', 'Nachtrag Fremd')],
]
const COMMITS = [[commit('s1', 'fix: eins'), commit('s2', 'refactor: zwei')], [commit('s3', 'test: drei')]]
const DATEN = {
  listen: {
    'repos/o/r/issues/7/comments': KOMMENTARE,
    'repos/o/r/pulls/7/commits': COMMITS,
    'repos/o/r/issues/8/comments': KOMMENTARE,
    'repos/o/r/pulls/8/commits': COMMITS,
  },
  // PR 8: gh gibt die Commit-Seiten aus und endet trotzdem mit Fehler (Abbruch beim Blättern).
  abbruch: ['repos/o/r/pulls/8/commits'],
  einzel: {
    'repos/o/r/commits/s1': { files: [{ filename: 'a.ts' }] },
    'repos/o/r/commits/s2': { files: [{ filename: 'lib/x.ts' }, { filename: 'lib/y.ts' }] },
    'repos/o/r/commits/s3': { files: [{ filename: 'a.test.ts' }] },
  },
}

const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachtraege-prozess-'))
const bin = path.join(ordner, 'bin')
fs.mkdirSync(bin)
// Windows sucht nur gh.com/gh.exe (kein Skript); ein harter Link nach Program Files ist dort verboten, also Kopie.
if (process.platform === 'win32') fs.copyFileSync(process.execPath, path.join(bin, 'gh.exe'))
else fs.symlinkSync(process.execPath, path.join(bin, 'gh'))
fs.writeFileSync(path.join(ordner, 'api'), ATTRAPPE)
fs.writeFileSync(path.join(ordner, 'daten.json'), JSON.stringify(DATEN))
const pfadSchluessel = Object.keys(process.env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'

/** Startet das Skript wie der Workflow; liefert Exit, Ausgabedatei und die gh-Aufrufe. */
function lauf(argumente, repo = 'o/r') {
  const datei = path.join(ordner, 'beschreibung.txt')
  const log = path.join(ordner, 'aufrufe.log')
  fs.writeFileSync(datei, 'Beschreibung')
  fs.writeFileSync(log, '')
  const env = { ...process.env, [pfadSchluessel]: bin + path.delimiter + process.env[pfadSchluessel], GITHUB_REPOSITORY: repo }
  Object.assign(env, { ATTRAPPE_LOG: log, ATTRAPPE_DATEN: path.join(ordner, 'daten.json') })
  const r = spawnSync(process.execPath, [SKRIPT, ...argumente.map((a) => (a === '<datei>' ? datei : a))], { cwd: ordner, env, encoding: 'utf8' })
  const aufrufe = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z).join(' '))
  return { status: r.status, text: fs.readFileSync(datei, 'utf8'), aufrufe }
}

const ERWARTET = 'Beschreibung\n\n## Nachträge (gelten als Teil der Beschreibung, spätere gehen vor)'
  + '\n\n## Nachtrag eins\n\n## Nachtrag App\n\n**Nachtrag zwei'
  + '\n\n## Commits des PR (älteste zuerst, je Commit die geänderten Dateien)'
  + '\n- s1 fix: eins — a.ts\n- s2 refactor: zwei — lib/x.ts, lib/y.ts\n- s3 test: drei — a.test.ts'

const voll = lauf(['7', 'claude[bot]', '<datei>'])
pruefe('Prozess: Exit 0', voll.status === 0, voll.status)
pruefe('Prozess: Nachträge beider Seiten (Autor und Inhaber) und alle drei Commits mit Dateien', voll.text === ERWARTET, voll.text)
pruefe('Prozess: gh-Aufrufe mit --paginate --slurp und Pfaden aus GITHUB_REPOSITORY', voll.aufrufe.join('|') === [
  '--paginate --slurp repos/o/r/issues/7/comments',
  '--paginate --slurp repos/o/r/pulls/7/commits',
  'repos/o/r/commits/s1',
  'repos/o/r/commits/s2',
  'repos/o/r/commits/s3',
].join('|'), voll.aufrufe)

const fremdesRepo = lauf(['7', 'claude[bot]', '<datei>'], 'x/y')
pruefe('Prozess: gh scheitert -> Exit 0, Beschreibung nur mit Hinweis statt Nachträgen', fremdesRepo.status === 0 && fremdesRepo.text === 'Beschreibung' + HINWEIS_NACHTRAEGE, fremdesRepo)
const vertauscht = lauf(['claude[bot]', '7', '<datei>'])
pruefe('Prozess: falsche Argumentreihenfolge -> kein gh-Aufruf, Beschreibung unverändert',
  vertauscht.text === 'Beschreibung' && vertauscht.aufrufe.length === 0, vertauscht)
const appForm = lauf(['7', 'app/claude', '<datei>'])
pruefe('Prozess: Autor in GraphQL-Form (app/claude) -> kein gh-Aufruf, Beschreibung unverändert',
  appForm.text === 'Beschreibung' && appForm.aufrufe.length === 0, appForm)
const abbruch = lauf(['8', 'claude[bot]', '<datei>'])
pruefe('Prozess: gh endet mit Fehler trotz Ausgabe -> Commit-Teil fehlt, Nachträge bleiben',
  abbruch.status === 0 && abbruch.text === ERWARTET.slice(0, ERWARTET.indexOf('\n\n## Commits')), abbruch)

fs.rmSync(ordner, { recursive: true, force: true })
if (fehler.length) {
  console.error(`pr-nachtraege-prozess.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('pr-nachtraege-prozess.test: grün')
