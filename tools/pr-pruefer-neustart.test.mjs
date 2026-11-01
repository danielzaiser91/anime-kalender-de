/**
 * Test für tools/pr-pruefer-neustart.mjs und .github/workflows/pr-pruefer-nachtrag.yml: Entscheidung als Tabelle,
 * Ablauf (Abbruch eines laufenden Laufs, Neustart) mit eingespeistem gh, Verdrahtung über die env-Namen der YAML.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { entscheide, main } from './pr-pruefer-neustart.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const KOPF = 'd'.repeat(40)
const pr = (aendere = {}) => ({
  state: 'open',
  draft: false,
  user: { login: 'claude[bot]' },
  head: { sha: KOPF, ref: 'fix/x', repo: { full_name: 'o/r' } },
  base: { repo: { full_name: 'o/r' } },
  ...aendere,
})
const los = (e) => entscheide({ body: '## Nachtrag eins', kommentarLogin: 'inhaber', assoziation: 'OWNER', pr: pr(), ...e }).los

// Entscheidung: jede Prüfung kippt allein das Urteil, der Basisfall ist ja.
gleich('Basisfall: Nachtrag des Inhabers', los({}), true)
gleich('**Nachtrag', los({ body: '**Nachtrag zwei' }), true)
gleich('# Nachbesserung', los({ body: '# Nachbesserung R2' }), true)
gleich('Nachtrag klein, führender Leerraum', los({ body: '  nachtrag drei' }), true)
gleich('Abnahme des Dirigenten', los({ body: '## Nachtrag (Abnahme Dirigent)\nok' }), false)
gleich('Abnahme nur in der ersten Zeile zählt', los({ body: '## Nachtrag\nsiehe Abnahme Dirigent' }), true)
gleich('anderer Kommentar', los({ body: 'Prüfer: ändern' }), false)
gleich('fremder Autor ohne Recht', los({ kommentarLogin: 'fremd', assoziation: 'NONE' }), false)
gleich('PR-Autor ohne Assoziation', los({ kommentarLogin: 'claude[bot]', assoziation: 'NONE' }), true)
gleich('Mitglied', los({ kommentarLogin: 'anderer', assoziation: 'MEMBER' }), true)
gleich('Bot des Prüfers', los({ kommentarLogin: 'github-actions[bot]', assoziation: 'NONE' }), false)
gleich('Issue ohne PR', los({ pr: null }), false)
gleich('PR geschlossen', los({ pr: pr({ state: 'closed' }) }), false)
gleich('Entwurf', los({ pr: pr({ draft: true }) }), false)
gleich('Fork', los({ pr: pr({ head: { sha: KOPF, ref: 'x', repo: { full_name: 'f/r' } } }) }), false)
gleich('Zweig daten/', los({ pr: pr({ head: { sha: KOPF, ref: 'daten/x', repo: { full_name: 'o/r' } } }) }), false)

// Ablauf mit eingespeistem gh: Aufrufe werden protokolliert; die Läufe stehen neueste zuerst.
function laufe(env, laeufe, { pruefer = pr(), stand = ['in_progress', 'completed'] } = {}) {
  const aufrufe = []
  const wartet = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (args[1] === 'repos/o/r/pulls/7') return JSON.stringify(pruefer)
    if (args[1]?.includes('/workflows/pr-pruefer.yml/runs')) return JSON.stringify(laeufe)
    if (args[1] === 'repos/o/r/actions/runs/5') return JSON.stringify({ status: stand.shift() ?? 'completed' })
    return ''
  }
  const mute = console.log
  console.log = () => {}
  const code = main({ GITHUB_REPOSITORY: 'o/r', PR_NUMMER: '7', KOMMENTAR: '## Nachtrag', KOMMENTAR_LOGIN: 'inhaber', KOMMENTAR_ASSOZIATION: 'OWNER', ...env }, { gh, warte: (ms) => wartet.push(ms) })
  console.log = mute
  return { code, aufrufe: aufrufe.filter((a) => a.startsWith('run ')), wartet }
}
const abgeschlossen = [{ id: 5, status: 'completed' }, { id: 4, status: 'completed' }]
const laufend = [{ id: 5, status: 'in_progress' }, { id: 4, status: 'completed' }]

gleich('abgeschlossener Lauf: nur rerun des neuesten', laufe({}, abgeschlossen).aufrufe, ['run rerun 5'])
const l = laufe({}, laufend)
gleich('laufender Lauf: erst cancel, warten, dann rerun', l.aufrufe, ['run cancel 5', 'run rerun 5'])
gleich('laufender Lauf: gewartet bis completed (einmal)', l.wartet, [5000])
gleich('kein Lauf zum Kopf: nichts', laufe({}, []).aufrufe, [])
gleich('Abnahme-Kommentar: nichts', laufe({ KOMMENTAR: '## Nachtrag (Abnahme Dirigent)' }, abgeschlossen).aufrufe, [])
gleich('fremder Autor: nichts', laufe({ KOMMENTAR_LOGIN: 'x', KOMMENTAR_ASSOZIATION: 'NONE' }, abgeschlossen).aufrufe, [])
gleich('PR-Nummer fehlt: Exit 1', laufe({ PR_NUMMER: '' }, abgeschlossen).code, 1)
gleich('Absturz von gh: Exit 1, kein Neustart', (() => {
  const mute = console.log
  console.log = () => {}
  const code = main({ GITHUB_REPOSITORY: 'o/r', PR_NUMMER: '7' }, { gh: () => { throw new Error('boom') }, warte: () => {} })
  console.log = mute
  return code
})(), 1)

// Verdrahtung: die Namen aus der YAML speisen main; der Mutant „anderer env-Name“ bleibt so nicht grün.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer-nachtrag.yml', import.meta.url), 'utf8'))
const job = wf.jobs.neustart
const schritt = job.steps.find((s) => s.name === 'Prüfer neu starten')
gleich('Auslöser: nur issue_comment created', wf.on, { issue_comment: { types: ['created'] } })
gleich('Rechte: Aktionen schreiben, sonst lesen', wf.permissions, { contents: 'read', 'pull-requests': 'read', actions: 'write' })
gleich('Bedingung: nur PR-Kommentare, nicht vom Prüfer', job.if, "github.event.issue.pull_request != null && github.event.comment.user.login != 'github-actions[bot]'")
gleich('Schritt ruft das Skript ohne Argumente', schritt.run, 'node tools/pr-pruefer-neustart.mjs')
gleich('Kommentartext nur über env', Object.entries(schritt.env).filter(([, w]) => w.includes('comment.body')).map(([s]) => s), ['KOMMENTAR'])
gleich('run enthält keinen Ausdruck', schritt.run.includes('${{'), false)
const ausYaml = Object.fromEntries(Object.keys(schritt.env).map((s) => [s, { PR_NUMMER: '7', KOMMENTAR: '## Nachtrag', KOMMENTAR_LOGIN: 'inhaber', KOMMENTAR_ASSOZIATION: 'OWNER' }[s] ?? 'x']))
gleich('env-Namen der YAML lösen den Neustart aus', laufe({ ...ausYaml, KOMMENTAR: '## Nachtrag', GITHUB_REPOSITORY: 'o/r' }, abgeschlossen).aufrufe, ['run rerun 5'])

console.log(`Prüfer-Neustart: ${fehler.length === 0 ? 'alle Fälle grün' : fehler.length + ' Fälle rot'}`)
process.exit(fehler.length === 0 ? 0 : 1)
