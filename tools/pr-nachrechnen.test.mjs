/** Tests für tools/pr-nachrechnen.mjs und .github/workflows/pr-nachrechnen.yml: wer wird neu angestoßen, mit welchem Token, wie der Workflow verdrahtet ist. */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { ausfuehren, nachrechnen, veraltete } from './pr-nachrechnen.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const PUSH = '2026-10-19T12:00:00.000Z'
const pr = (number, extra = {}) => ({ number, isDraft: false, headRefName: `fix/p${number}`, headRefOid: `sha${number}`, ...extra })
const lauf = (kopf, createdAt) => ({ headSha: kopf, createdAt })
// Kandidaten: 1 vor dem Push gestartet (veraltet), 2 danach (frisch), 3 genau zur Pushzeit (frisch), 4 Entwurf, 5 daten/, 6 Lauf zu altem Kopf, 7 ohne Lauf.
const PRS = [pr(1), pr(2), pr(3), pr(4, { isDraft: true }), pr(5, { headRefName: 'daten/x' }), pr(6), pr(7)]
const LAEUFE = {
  1: [lauf('sha1', '2026-10-19T11:59:59Z')],
  2: [lauf('sha2', '2026-10-19T12:00:01Z')],
  3: [lauf('sha3', '2026-10-19T12:00:00Z')],
  4: [lauf('sha4', '2026-10-19T08:00:00Z')],
  5: [lauf('sha5', '2026-10-19T08:00:00Z')],
  6: [lauf('alt', '2026-10-19T08:00:00Z')],
  7: [],
}
const laeufeVon = (p) => LAEUFE[p.number]
const nummern = (liste) => liste.map((p) => p.number)

pruefe('nur der vor dem Push gestartete Lauf ist veraltet', nummern(veraltete(PRS, PUSH, laeufeVon)).join() === '1', nummern(veraltete(PRS, PUSH, laeufeVon)))
const zwei = { ...LAEUFE, 2: [lauf('sha2', '2026-10-19T12:00:01Z'), lauf('sha2', '2026-10-19T09:00:00Z')] }
pruefe('mehrere Läufe: der neueste zählt, egal in welcher Reihenfolge', nummern(veraltete([pr(2)], PUSH, (p) => zwei[p.number])).length === 0)
const alterNeuer = [lauf('sha1', '2026-10-19T09:00:00Z'), lauf('sha1', '2026-10-19T08:00:00Z')]
const neuLetzter = [lauf('sha2', '2026-10-19T09:00:00Z'), lauf('sha2', '2026-10-19T12:00:01Z')]
pruefe('mehrere Läufe: der neueste steht hinten und ist frisch -> nicht veraltet', nummern(veraltete([pr(2)], PUSH, () => neuLetzter)).length === 0)
pruefe('mehrere veraltete Läufe -> weiter veraltet', nummern(veraltete([pr(1)], PUSH, () => alterNeuer)).join() === '1')
pruefe('Zeitzonen-Schreibweise (+02:00) wird als Zeitpunkt verglichen', nummern(veraltete([pr(1)], PUSH, () => [lauf('sha1', '2026-10-19T13:59:00+02:00')])).join() === '1')

function kulisse({ schliesseFehler = new Set(), oeffneFehlerBei = new Map() } = {}) {
  const log = []
  const meldungen = []
  return {
    log,
    meldungen,
    schliesse: (n) => {
      log.push(`close ${n}`)
      if (schliesseFehler.has(n)) throw new Error('zu')
    },
    oeffne: (n) => {
      log.push(`reopen ${n}`)
      const rest = oeffneFehlerBei.get(n) ?? 0
      if (rest > 0) {
        oeffneFehlerBei.set(n, rest - 1)
        throw new Error('auf')
      }
    },
    melde: (t) => meldungen.push(t),
  }
}

{
  const k = kulisse()
  const f = nachrechnen({ prs: PRS, pushZeit: PUSH, laeufeVon, ...k })
  pruefe('veralteter PR wird geschlossen, dann geöffnet, sonst keiner angefasst', k.log.join() === 'close 1,reopen 1', k.log)
  pruefe('Ergebniszeile nennt Zahlen', k.meldungen.at(-1) === 'pr-nachrechnen: 1 von 7 offenen PR neu angestoßen, 0 Fehler', k.meldungen)
  pruefe('ohne Fehler Rückgabe 0', f === 0)
}
{
  const alle = Object.fromEntries([1, 2, 3].map((n) => [n, [lauf(`sha${n}`, '2026-10-19T08:00:00Z')]]))
  const k = kulisse({ schliesseFehler: new Set([1]) })
  const f = nachrechnen({ prs: [pr(1), pr(2), pr(3)], pushZeit: PUSH, laeufeVon: (p) => alle[p.number], ...k })
  pruefe('Fehler beim Schließen von 1 hält 2 und 3 nicht auf, 1 wird nicht geöffnet', k.log.join() === 'close 1,close 2,reopen 2,close 3,reopen 3', k.log)
  pruefe('Fehler wird gezählt und gemeldet', f === 1 && k.meldungen.at(-1).endsWith('3 von 3 offenen PR neu angestoßen, 1 Fehler') && k.meldungen[0].includes('FEHLER'), k.meldungen)
}
{
  const k = kulisse({ oeffneFehlerBei: new Map([[1, 1]]) })
  const f = nachrechnen({ prs: [pr(1)], pushZeit: PUSH, laeufeVon, ...k })
  pruefe('Öffnen scheitert einmal -> zweiter Versuch, kein Fehler', k.log.join() === 'close 1,reopen 1,reopen 1' && f === 0, k.log)
}
{
  const k = kulisse({ oeffneFehlerBei: new Map([[1, 2]]) })
  const f = nachrechnen({ prs: [pr(1)], pushZeit: PUSH, laeufeVon, ...k })
  pruefe('Öffnen scheitert zweimal -> dritter Versuch, kein Fehler', k.log.join() === 'close 1,reopen 1,reopen 1,reopen 1' && f === 0, k.log)
}
{
  const k = kulisse({ oeffneFehlerBei: new Map([[1, 3]]) })
  const f = nachrechnen({ prs: [pr(1)], pushZeit: PUSH, laeufeVon, ...k })
  pruefe('Öffnen scheitert dreimal -> Fehler gezählt, Meldung nennt den geschlossenen PR', f === 1 && k.meldungen[0].includes('PR 1 BLEIBT GESCHLOSSEN'), k.meldungen)
}
{
  const k = kulisse()
  const f = nachrechnen({ prs: [pr(1, { autoMergeRequest: { enabledAt: 'x' } }), pr(2)], pushZeit: PUSH, laeufeVon: () => [lauf('sha1', '2026-10-19T08:00:00Z'), lauf('sha2', '2026-10-19T08:00:00Z')], ...k })
  pruefe('PR mit Auto-Merge bleibt unberührt und wird gemeldet, der andere wird neu angestoßen', k.log.join() === 'close 2,reopen 2' && f === 0 && k.meldungen[0].includes('PR 1: Auto-Merge aktiv'), { log: k.log, m: k.meldungen })
}

// Verdrahtung: ausfuehren liest mit dem Lese-Token, schreibt mit dem Schreib-Token, fragt je PR den Lauf des Branches ab.
{
  const aufrufe = []
  const gh = (args, token) => {
    aufrufe.push({ args, token })
    if (args[0] === 'pr' && args[1] === 'list') return JSON.stringify([pr(1), pr(2), pr(3)])
    if (args[0] === 'run') {
      const zeit = args.includes('fix/p2') ? '2026-10-19T08:00:00Z' : '2026-10-19T13:00:00Z'
      const n = args.at(args.indexOf('--branch') + 1).slice(5)
      return JSON.stringify([lauf(`sha${n}`, zeit)])
    }
    return ''
  }
  const f = ausfuehren(PUSH, gh, { lesen: 'LESEN', schreiben: 'SCHREIBEN' }, () => {})
  const schreibend = aufrufe.filter((a) => a.args[0] === 'pr' && a.args[1] !== 'list')
  pruefe('nur PR 2 (Lauf vor dem Push) wird geschlossen und geöffnet', schreibend.map((a) => a.args.slice(1).join(' ')).join() === 'close 2,reopen 2', schreibend)
  pruefe('Schreiben mit Schreib-Token', schreibend.every((a) => a.token === 'SCHREIBEN'))
  pruefe('Lesen mit Lese-Token', aufrufe.filter((a) => !schreibend.includes(a)).every((a) => a.token === 'LESEN'))
  const lesen = aufrufe.find((a) => a.args[0] === 'run')
  pruefe('Lauf-Abfrage gilt der Kette und dem Ereignis pull_request', lesen.args.includes('pr-pruefung.yml') && lesen.args.includes('pull_request'), lesen.args)
  pruefe('ausfuehren gibt 0 zurück', f === 0)
  pruefe('PR-Liste fragt autoMergeRequest ab', aufrufe[0].args.at(-1).split(',').includes('autoMergeRequest'), aufrufe[0].args)
  const kaputt = (args, token) => {
    if (args[1] === 'close') throw new Error('403')
    return gh(args, token)
  }
  pruefe('ausfuehren gibt 1 zurück, wenn ein PR scheitert', ausfuehren(PUSH, kaputt, { lesen: 'L', schreiben: 'S' }, () => {}) === 1)
}

// Aufruf als eigener Prozess ohne gh im PATH: scheitert geschlossen (Exit ungleich 0), nie still grün.
{
  const leer = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-nachrechnen-'))
  const env = { ...process.env }
  env[Object.keys(env).find((s) => s.toUpperCase() === 'PATH') ?? 'PATH'] = leer
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./pr-nachrechnen.mjs', import.meta.url))], { encoding: 'utf8', windowsHide: true, env })
  fs.rmSync(leer, { recursive: true, force: true })
  pruefe('Aufruf ohne gh -> Exit ungleich 0', r.status !== 0 && r.status !== null, r.status)
}

// Workflow: Form des geparsten Dokuments.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-nachrechnen.yml', import.meta.url), 'utf8'))
const job = wf.jobs.nachrechnen
const schritt = job.steps.at(-1)
pruefe('Trigger: nur push auf main, Daten-Pushes ausgenommen', JSON.stringify(Object.keys(wf.on)) === '["push"]' && wf.on.push.branches.join() === 'main' && wf.on.push['paths-ignore'].includes('public/data/**'), wf.on)
pruefe('genau ein Job, Rechte nur lesen', Object.keys(wf.jobs).join() === 'nachrechnen' && JSON.stringify(wf.permissions) === '{"contents":"read","pull-requests":"read","actions":"read"}', wf.permissions)
pruefe('Nebenläufigkeit bricht nicht ab', wf.concurrency['cancel-in-progress'] === false)
pruefe('letzter Schritt ruft das Skript ohne Argument (Zeitpunkt = Start des Laufs, nicht Commit-Zeit)', schritt.run === 'node tools/pr-nachrechnen.mjs' && Object.keys(schritt.env).sort().join() === 'GH_TOKEN,GH_TOKEN_SCHREIBEN', schritt)
pruefe('Schreib-Token kommt aus dem App-Token, Lese-Token aus github.token',
  schritt.env.GH_TOKEN_SCHREIBEN === '${{ steps.app.outputs.token }}' && schritt.env.GH_TOKEN === '${{ github.token }}')
const app = job.steps.find((s) => s.id === 'app')
pruefe('App-Token verlangt pull-requests: write und sonst nichts', Object.keys(app.with).filter((k) => k.startsWith('permission-')).join() === 'permission-pull-requests' && app.with['permission-pull-requests'] === 'write', app.with)

if (fehler.length > 0) {
  console.error(`pr-nachrechnen.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log('pr-nachrechnen.test: grün')
