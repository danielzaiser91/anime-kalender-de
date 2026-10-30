// Weicher Schritt mit FEHLER-Zeile: Auswahl, Logzeile, Fristen, Fehlerpfade und die Verdrahtung in laeufe-aufraeumen als Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ersteFehlerZeile, LAUF_ALTER_TAGE, weicheSchritte, weichWache, weichZeilen, workflowMitWeichemSchritt } from './wache-weicher-schritt.mjs'

const JETZT = Date.parse('2026-10-30T20:00:00Z')
const TAG = 86_400_000
const iso = (ms) => new Date(ms).toISOString()
const schritt = (name, conclusion) => ({ name, conclusion })
const job = (id, name, conclusion, steps) => ({ id, name, conclusion, steps })

// weicheSchritte: nur ein fehlgeschlagener Schritt in einem Job, der trotzdem grün ist.
const weich = weicheSchritte({ jobs: [job(1, 'anilist', 'success', [schritt('Setup', 'success'), schritt('Link-Check', 'failure'), schritt('Spaeter', 'skipped')]), job(2, 'tmdb', 'failure', [schritt('Abruf', 'failure')]), job(3, 'rtl', 'success', [schritt('Abruf', 'success')])] })
assert.deepEqual(weich, [{ jobId: 1, job: 'anilist', schritt: 'Link-Check' }])
assert.deepEqual(weicheSchritte({}), [])
assert.deepEqual(weicheSchritte([{ id: 1 }]), [], 'falsche Form (Array statt Objekt) ist keine Auskunft')
assert.equal(weicheSchritte({ jobs: [job(1, 'a', 'success', [schritt('x', 'failure'), schritt('y', 'failure')])] }).length, 2, 'jeder Schritt einzeln')

// ersteFehlerZeile: Zeitstempel weg, eingerückte env-Zeile und leere Zeile zählen nicht, die erste echte gewinnt.
const log = ['2026-10-30T10:00:00.1234567Z ##[group]Run node check.mjs', '2026-10-30T10:00:00.2000000Z env:', '2026-10-30T10:00:00.2100000Z   FEHLER: ', '2026-10-30T10:00:00.2200000Z   FEHLER: aus env', '2026-10-30T10:00:01.0000000Z FEHLER:', '2026-10-30T10:00:02.0000000Z FEHLER: 3 Links tot, z. B. https://x.de', '2026-10-30T10:00:03.0000000Z FEHLER: zweite'].join('\r\n')
assert.equal(ersteFehlerZeile(log), 'FEHLER: 3 Links tot, z. B. https://x.de')
assert.equal(ersteFehlerZeile('FEHLER: ohne Zeitstempel'), 'FEHLER: ohne Zeitstempel')
assert.equal(ersteFehlerZeile('2026-10-30T10:00:00Z kein FEHLER: am Anfang'), undefined)
assert.equal(ersteFehlerZeile(''), undefined)

// weichZeilen mit gh-Kulisse: Sammel-Workflow mit zwei Jobs, nur der weiche mit FEHLER-Zeile wird genannt.
const URL_LAUF = 'https://github.com/x/actions/runs/7'
const kulisse = ({ conclusion = 'success', createdAt = iso(JETZT - TAG), jobs, logs, liste = true }) => (...a) => {
  const k = a.join(' ')
  if (k.startsWith('run list')) assert.match(k, /--workflow \S+ --branch main --status completed --limit 1 /, 'nur der jüngste fertige Lauf auf main')
  if (k.startsWith('run list')) return JSON.stringify(liste ? [{ databaseId: 7, conclusion, createdAt, url: URL_LAUF }] : [])
  if (k.includes('/runs/7/jobs')) return JSON.stringify({ jobs })
  const m = k.match(/\/jobs\/(\d+)\/logs/)
  if (m && logs[m[1]] !== undefined) return logs[m[1]]
  throw new Error(`gh unerwartet: ${k}`)
}
const jobs = [job(11, 'anilist', 'success', [schritt('Link-Check', 'failure')]), job(12, 'tmdb', 'success', [schritt('Abruf', 'failure')]), job(13, 'rtl', 'success', [schritt('Abruf', 'success')])]
const logs = { 11: '2026-10-30T10:00:02Z FEHLER: 3 Links tot', 12: '2026-10-30T10:00:02Z Abruf endete mit Code 1' }
const z = (opt, datei = 'refresh-weekly.yml') => weichZeilen(kulisse({ jobs, logs, ...opt }), 'x/y', [datei], JETZT)
assert.deepEqual(z({}), [`WEICH refresh-weekly.yml / anilist / Link-Check: FEHLER: 3 Links tot (${URL_LAUF})`])
// Jede Nichtauskunft und jede Entwarnung: keine Zeile.
assert.deepEqual(z({ conclusion: 'failure' }), [], 'roter Lauf gehört dem Rot-Alarm')
assert.deepEqual(z({ liste: false }), [], 'noch nie gelaufen')
assert.deepEqual(z({ jobs: [job(13, 'rtl', 'success', [schritt('Abruf', 'success')])] }), [], 'kein weicher Fehlschlag')
assert.deepEqual(z({ logs: { 11: 'nur Text', 12: logs[12] } }), [], 'ohne FEHLER-Zeile')
// Frist: genau 14 Tage zählt noch, eine Sekunde mehr nicht.
assert.equal(z({ createdAt: iso(JETZT - LAUF_ALTER_TAGE * TAG) }).length, 1)
assert.deepEqual(z({ createdAt: iso(JETZT - LAUF_ALTER_TAGE * TAG - 1000) }), [])
assert.equal(LAUF_ALTER_TAGE, 14)
// Abruffehler (HTTP 502, Log nicht lesbar) ist selbst eine Zeile.
const kaputt = () => {
  throw new Error('gh: Server Error (HTTP 502)\nzweite Zeile')
}
assert.deepEqual(weichZeilen(kaputt, 'x/y', ['a.yml', 'b.yml'], JETZT), ['WEICH? a.yml nicht lesbar: gh: Server Error (HTTP 502)', 'WEICH? b.yml nicht lesbar: gh: Server Error (HTTP 502)'])
const ohneLog = kulisse({ jobs, logs: {} })
assert.match(weichZeilen(ohneLog, 'x/y', ['a.yml'], JETZT)[0], /^WEICH\? a\.yml nicht lesbar: gh unerwartet/)
// Mehrere Workflows: jeder einzeln, in Dateireihenfolge.
assert.equal(weichZeilen(kulisse({ jobs, logs }), 'x/y', ['a.yml', 'b.yml'], JETZT).length, 2)

// Dateiliste und weichWache im Wegwerf-Ordner.
const wegwerf = mkdtempSync(join(tmpdir(), 'weicher-schritt-'))
try {
  mkdirSync(join(wegwerf, '.github', 'workflows'), { recursive: true })
  const w = (f, text) => writeFileSync(join(wegwerf, '.github', 'workflows', f), text)
  w('b.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n        continue-on-error: true\n')
  w('a.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n    continue-on-error:   true\n')
  w('c.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n# continue-on-error: true\n')
  w('d.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n        continue-on-error: false\n')
  w('e.txt', 'continue-on-error: true\n')
  assert.deepEqual(workflowMitWeichemSchritt(wegwerf), ['a.yml', 'b.yml'])
  assert.deepEqual(weichWache(kulisse({ jobs, logs }), 'x/y', wegwerf, JETZT).length, 2)
  assert.match(weichWache(kulisse({ jobs, logs }), 'x/y', join(wegwerf, 'fehlt'), JETZT)[0], /^WEICH\? Workflows nicht lesbar: /)

  // Verdrahtung: der echte Aufrufer (laeufe-aufraeumen --trocken) druckt die Zeile aus der gh-Kulisse.
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const stubCode =
    'import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";' +
    'cp.execFileSync=(c,a)=>{const k=a.join(" ");const t=JSON.parse(process.env.GH_KULISSE);for(const m of Object.keys(t))if(k.includes(m))return t[m];throw new Error("gh: "+k)};' +
    'syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const tabelle = {
    '--workflow refresh-weekly.yml': JSON.stringify([{ databaseId: 7, conclusion: 'success', createdAt: '2999-12-31T00:00:00Z', url: URL_LAUF }]),
    'actions/runs/7/jobs': JSON.stringify({ jobs }),
    '/jobs/11/logs': logs[11],
    '/jobs/12/logs': logs[12],
  }
  const fahre = (kulissenTabelle) =>
    spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(stubCode)}`, aufraeumen, '--trocken'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      env: { ...process.env, LAUF_TOKEN: '', GH_KULISSE: JSON.stringify(kulissenTabelle) },
    })
  const r = fahre(tabelle)
  assert.match(r.stdout, /Läufe nicht lesbar|Worker|WACHE/, `der Prozess lief bis zur Wache: ${r.stderr}`)
  assert.match(r.stdout, new RegExp(`^WEICH refresh-weekly\\.yml / anilist / Link-Check: FEHLER: 3 Links tot \\(${URL_LAUF.replace(/\./g, '\\.')}\\)$`, 'm'), r.stdout)
  assert.doesNotMatch(r.stdout, /tmdb/, 'Job ohne FEHLER-Zeile bleibt still')
  // Echte Uhr: ein Lauf von 2020 ist längst über 14 Tage alt.
  const alt = fahre({ ...tabelle, '--workflow refresh-weekly.yml': JSON.stringify([{ databaseId: 7, conclusion: 'success', createdAt: '2020-01-01T00:00:00Z', url: URL_LAUF }]) })
  assert.doesNotMatch(alt.stdout, /^WEICH refresh-weekly/m, 'alter Lauf bleibt still')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-weicher-schritt: ok (Auswahl, Logzeile, 14-Tage-Grenze, Abruffehler, Dateiliste, laeufe-aufraeumen als Prozess)')
