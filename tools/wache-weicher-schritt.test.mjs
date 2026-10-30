// Weicher Schritt mit FEHLER-Zeile: Auswahl, Logzeile, Fristen, Zwischenspeicher, Wiederholung, Sammelzeile bei Ausfall
// und die Verdrahtung in laeufe-aufraeumen als Prozess; dazu der parallele Stapel (tools/gh-stapel.mjs) mit echten Prozessen.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { alleAufrufe } from './gh-stapel.mjs'
import { ersteFehlerZeile, LAUF_ALTER_TAGE, stapelVon, weicheSchritte, weichWache, weichZeilen, workflowMitWeichemSchritt } from './wache-weicher-schritt.mjs'

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

const wegwerf = mkdtempSync(join(tmpdir(), 'weicher-schritt-'))
let zaehler = 0
const frischerSpeicher = () => join(wegwerf, `speicher-${++zaehler}.json`)

// gh-Kulisse mit Aufruflog; `ausfaelle`: Textstück des Aufrufs -> Zahl der Fehlschläge (HTTP 502), danach Erfolg.
const URL_LAUF = 'https://github.com/x/actions/runs/7'
function kulisse({ conclusion = 'success', createdAt = iso(JETZT - TAG), id = 7, jobs, logs, liste = true, ausfaelle = {} }) {
  const aufrufe = []
  const versuche = {}
  const gh = (...a) => {
    const k = a.join(' ')
    aufrufe.push(k)
    for (const [stueck, n] of Object.entries(ausfaelle)) if (k.includes(stueck) && (versuche[stueck] = (versuche[stueck] ?? 0) + 1) <= n) throw new Error('gh: Server Error (HTTP 502)\nzweite Zeile')
    if (k.startsWith('run list')) {
      assert.match(k, /--workflow \S+ --branch main --status completed --limit 1 /, 'nur der jüngste fertige Lauf auf main')
      return JSON.stringify(liste ? [{ databaseId: id, conclusion, createdAt, url: URL_LAUF }] : [])
    }
    if (k.includes(`/runs/${id}/jobs`)) {
      assert.match(k, /\/jobs\?per_page=100$/, 'ohne per_page liefert GitHub nur 30 Jobs')
      return JSON.stringify({ jobs })
    }
    const m = k.match(/\/jobs\/(\d+)\/logs/)
    if (m && logs[m[1]] !== undefined) return logs[m[1]]
    throw new Error(`gh unerwartet: ${k}`)
  }
  return { gh, aufrufe }
}
const jobs = [job(11, 'anilist', 'success', [schritt('Link-Check', 'failure')]), job(12, 'tmdb', 'success', [schritt('Abruf', 'failure')]), job(13, 'rtl', 'success', [schritt('Abruf', 'success')])]
const logs = { 11: '2026-10-30T10:00:02Z FEHLER: 3 Links tot', 12: '2026-10-30T10:00:02Z Abruf endete mit Code 1' }
const z = (opt, dateien = ['refresh-weekly.yml'], speicher = frischerSpeicher()) => weichZeilen(stapelVon(kulisse({ jobs, logs, ...opt }).gh), 'x/y', dateien, JETZT, speicher)
const EINE = [`WEICH refresh-weekly.yml / anilist / Link-Check: FEHLER: 3 Links tot (${URL_LAUF})`]
const AUSFALL = (n, von) => `WEICH? Schrittprüfung ausgefallen: ${n} von ${von} Workflows nicht lesbar, erster Grund: gh: Server Error (HTTP 502)`

try {
  assert.deepEqual(z({}), EINE, 'Sammel-Workflow: der Job steht in der Zeile')
  // Jede Nichtauskunft und jede Entwarnung: keine Zeile.
  assert.deepEqual(z({ conclusion: 'failure' }), [], 'roter Lauf gehört dem Rot-Alarm')
  assert.deepEqual(z({ liste: false }), [], 'noch nie gelaufen')
  assert.deepEqual(z({ jobs: [job(13, 'rtl', 'success', [schritt('Abruf', 'success')])] }), [], 'kein weicher Fehlschlag')
  assert.deepEqual(z({ logs: { 11: 'nur Text', 12: logs[12] } }), [], 'ohne FEHLER-Zeile')
  // Frist: genau 14 Tage zählt noch, eine Sekunde mehr nicht.
  assert.equal(z({ createdAt: iso(JETZT - LAUF_ALTER_TAGE * TAG) }).length, 1)
  assert.deepEqual(z({ createdAt: iso(JETZT - LAUF_ALTER_TAGE * TAG - 1000) }), [])
  assert.equal(LAUF_ALTER_TAGE, 14)
  // Mehrere Workflows: jeder einzeln, in Dateireihenfolge.
  assert.equal(z({}, ['a.yml', 'b.yml']).length, 2)

  // A1 Zwischenspeicher: derselbe Lauf ruft Jobs und Logs nicht noch einmal ab, ein neuer Lauf schon.
  const speicher = frischerSpeicher()
  const k1 = kulisse({ jobs, logs })
  assert.deepEqual(weichZeilen(stapelVon(k1.gh), 'x/y', ['refresh-weekly.yml'], JETZT, speicher), EINE)
  assert.equal(k1.aufrufe.length, 4, 'kalt: Liste, Jobs, zwei Logs')
  const k2 = kulisse({ jobs, logs })
  assert.deepEqual(weichZeilen(stapelVon(k2.gh), 'x/y', ['refresh-weekly.yml'], JETZT, speicher), EINE, 'aus dem Speicher')
  assert.equal(k2.aufrufe.length, 1, 'warm: nur die Liste')
  const k3 = kulisse({ jobs, logs, id: 8 })
  assert.deepEqual(weichZeilen(stapelVon(k3.gh), 'x/y', ['refresh-weekly.yml'], JETZT, speicher), EINE, 'neue Lauf-ID: neu abgerufen')
  assert.equal(k3.aufrufe.length, 4)
  // Lauf ohne Fall wird auch gespeichert (leere Zeilen), sonst ruft ihn jede Wachphase neu ab.
  const leer = frischerSpeicher()
  weichZeilen(stapelVon(kulisse({ jobs: [], logs }).gh), 'x/y', ['a.yml'], JETZT, leer)
  const k5 = kulisse({ jobs: [], logs })
  assert.deepEqual(weichZeilen(stapelVon(k5.gh), 'x/y', ['a.yml'], JETZT, leer), [])
  assert.equal(k5.aufrufe.length, 1)
  // Der Speicher ersetzt nie die Fristprüfung: ein gespeicherter, inzwischen alter Lauf bleibt still.
  const k6 = kulisse({ jobs, logs, id: 8, createdAt: iso(JETZT - 15 * TAG) })
  assert.deepEqual(weichZeilen(stapelVon(k6.gh), 'x/y', ['refresh-weekly.yml'], JETZT, speicher), [])
  // Kaputte oder fremde Speicherdatei: Kosten, kein Befund.
  for (const inhalt of ['kein json', '[1,2]', '{"7":"text"}']) {
    const kaputt = frischerSpeicher()
    writeFileSync(kaputt, inhalt)
    assert.deepEqual(weichZeilen(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', ['refresh-weekly.yml'], JETZT, kaputt), EINE, inhalt)
  }
  // Nicht beschreibbarer Speicherort (Elternpfad ist eine Datei) bricht nichts ab.
  const datei = join(wegwerf, 'ist-datei')
  writeFileSync(datei, 'x')
  assert.deepEqual(weichZeilen(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', ['refresh-weekly.yml'], JETZT, join(datei, 'unter', 's.json')), EINE)

  // A2 Wiederholung und Sammelzeile.
  const einmal = kulisse({ jobs, logs, ausfaelle: { 'run list': 1 } })
  assert.deepEqual(weichZeilen(stapelVon(einmal.gh), 'x/y', ['refresh-weekly.yml'], JETZT, frischerSpeicher()), EINE, 'erster Abruf 502, zweiter ok: keine WEICH?-Zeile')
  assert.equal(einmal.aufrufe.filter((a) => a.startsWith('run list')).length, 2)
  const jobEinmal = kulisse({ jobs, logs, ausfaelle: { '/jobs?': 1, '/jobs/12/logs': 1 } })
  assert.deepEqual(weichZeilen(stapelVon(jobEinmal.gh), 'x/y', ['refresh-weekly.yml'], JETZT, frischerSpeicher()), EINE, 'auch Jobs und Logs werden einmal wiederholt')
  const immer = kulisse({ jobs, logs, ausfaelle: { 'run list': Infinity } })
  assert.deepEqual(weichZeilen(stapelVon(immer.gh), 'x/y', ['a.yml', 'b.yml', 'c.yml'], JETZT, frischerSpeicher()), [AUSFALL(3, 3)], 'eine Sammelzeile statt dreier')
  assert.equal(immer.aufrufe.length, 6, 'genau eine Wiederholung je Abruf')
  // Teilausfall: der lesbare Workflow liefert weiter seine Zeile, der andere steht in der Sammelzeile.
  const teil = kulisse({ jobs, logs, ausfaelle: { '--workflow b.yml': Infinity } })
  assert.deepEqual(weichZeilen(stapelVon(teil.gh), 'x/y', ['a.yml', 'b.yml'], JETZT, frischerSpeicher()), [EINE[0].replace('refresh-weekly.yml', 'a.yml'), AUSFALL(1, 2)])
  // Ausfall im Log: Sammelzeile, und der Lauf kommt nicht in den Speicher (der nächste Versuch holt ihn nach).
  const logSpeicher = frischerSpeicher()
  const logAus = kulisse({ jobs, logs, ausfaelle: { '/jobs/12/logs': Infinity } })
  assert.deepEqual(weichZeilen(stapelVon(logAus.gh), 'x/y', ['refresh-weekly.yml'], JETZT, logSpeicher), [AUSFALL(1, 1)])
  assert.deepEqual(JSON.parse(readFileSync(logSpeicher, 'utf8')), {})
  assert.deepEqual(weichZeilen(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', ['refresh-weekly.yml'], JETZT, logSpeicher), EINE)
  // Mehrere Fehlschläge desselben Workflows zählen einmal; ein Jobs-Ausfall wird weder als „kein Fall“ gemeldet noch gespeichert.
  const zwei = kulisse({ jobs, logs, ausfaelle: { '/logs': Infinity } })
  assert.deepEqual(weichZeilen(stapelVon(zwei.gh), 'x/y', ['refresh-weekly.yml'], JETZT, frischerSpeicher()), [AUSFALL(1, 1)])
  const jobsSpeicher = frischerSpeicher()
  const jobsAus = kulisse({ jobs, logs, ausfaelle: { '/jobs?': Infinity } })
  assert.deepEqual(weichZeilen(stapelVon(jobsAus.gh), 'x/y', ['refresh-weekly.yml'], JETZT, jobsSpeicher), [AUSFALL(1, 1)])
  assert.deepEqual(JSON.parse(readFileSync(jobsSpeicher, 'utf8')), {})
  // Speicherdatei mit JSON null.
  const nullSpeicher = frischerSpeicher()
  writeFileSync(nullSpeicher, 'null')
  assert.deepEqual(weichZeilen(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', ['refresh-weekly.yml'], JETZT, nullSpeicher), EINE)
  // Ganzer Stapel wirft oder liefert Unsinn: eine Zeile.
  const wirft = () => {
    throw new Error('Kindprozess tot\nzweite')
  }
  assert.deepEqual(weichZeilen(wirft, 'x/y', ['a.yml', 'b.yml'], JETZT, frischerSpeicher()), ['WEICH? Schrittprüfung ausgefallen: 2 von 2 Workflows nicht lesbar, erster Grund: Kindprozess tot'])
  assert.deepEqual(weichZeilen(() => 'Unsinn', 'x/y', ['a.yml'], JETZT, frischerSpeicher()), ['WEICH? Schrittprüfung ausgefallen: 1 von 1 Workflows nicht lesbar, erster Grund: Stapelantwort unlesbar'])
  // Unlesbare Antwort eines Abrufs (kein JSON) zählt wie ein Abruffehler.
  assert.match(weichZeilen(stapelVon(() => '<html>'), 'x/y', ['a.yml'], JETZT, frischerSpeicher())[0], /^WEICH\? Schrittprüfung ausgefallen: 1 von 1 /)

  // Dateiliste und weichWache.
  mkdirSync(join(wegwerf, '.github', 'workflows'), { recursive: true })
  const w = (f, text) => writeFileSync(join(wegwerf, '.github', 'workflows', f), text)
  w('b.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n        continue-on-error: true\n')
  w('a.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n    continue-on-error:   true\n')
  w('c.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n# continue-on-error: true\n')
  w('d.yml', 'jobs:\n  a:\n    steps:\n      - run: x\n        continue-on-error: false\n')
  w('e.txt', 'continue-on-error: true\n')
  assert.deepEqual(workflowMitWeichemSchritt(wegwerf), ['a.yml', 'b.yml'])
  assert.equal(weichWache(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', wegwerf, JETZT, frischerSpeicher()).length, 2)
  assert.match(weichWache(stapelVon(kulisse({ jobs, logs }).gh), 'x/y', join(wegwerf, 'fehlt'), JETZT, frischerSpeicher())[0], /^WEICH\? Workflows nicht lesbar: /)

  // Stapel mit echten Prozessen (Node als „gh“): Reihenfolge, Fehler als Ergebnis.
  const stapel = await alleAufrufe(process.execPath, [['-p', '40+2'], ['-e', 'console.error("gh: Server Error (HTTP 502)\\nmehr");process.exit(3)'], ['-p', '"b"']])
  assert.deepEqual(stapel, [{ ok: true, aus: '42\n' }, { ok: false, fehler: 'gh: Server Error (HTTP 502)' }, { ok: true, aus: 'b\n' }])
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('./gh-stapel.mjs', import.meta.url))], { input: JSON.stringify([['-p', '1+1'], ['-e', 'process.exit(1)']]), encoding: 'utf8', windowsHide: true, env: { ...process.env, GH_BEFEHL: process.execPath } })
  assert.equal(cli.status, 0, cli.stderr)
  assert.equal(JSON.parse(cli.stdout)[0].aus, '2\n')
  assert.equal(JSON.parse(cli.stdout)[1].ok, false)

  // Verdrahtung: der echte Aufrufer (laeufe-aufraeumen --trocken). Die Kulisse ersetzt den Kindprozess des Stapels und
  // beantwortet dessen Eingabe (stdin) Aufruf für Aufruf.
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const stubCode =
    'import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";' +
    'cp.execFileSync=(c,a,o)=>{const t=JSON.parse(process.env.GH_KULISSE);' +
    'if(o&&o.input)return JSON.stringify(JSON.parse(o.input).map((x)=>{const k=x.join(" ");for(const m of Object.keys(t))if(k.includes(m))return{ok:true,aus:t[m]};return{ok:false,fehler:"gh: "+k}}));' +
    'throw new Error("gh weg")};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const lauf = (createdAt) => JSON.stringify([{ databaseId: 7, conclusion: 'success', createdAt, url: URL_LAUF }])
  const tabelle = { '--workflow refresh-weekly.yml': lauf('2999-12-31T00:00:00Z'), 'actions/runs/7/jobs': JSON.stringify({ jobs }), '/jobs/11/logs': logs[11], '/jobs/12/logs': logs[12] }
  const fahre = (kulissenTabelle, datei) =>
    spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(stubCode)}`, aufraeumen, '--trocken', '--weich-speicher', join(wegwerf, datei)], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      env: { ...process.env, LAUF_TOKEN: '', GH_KULISSE: JSON.stringify(kulissenTabelle) },
    })
  const treffer = new RegExp(`^WEICH refresh-weekly\\.yml / anilist / Link-Check: FEHLER: 3 Links tot \\(${URL_LAUF.replace(/\./g, '\\.')}\\)$`, 'm')
  const r = fahre(tabelle, 'prozess.json')
  assert.match(r.stdout, /^WACHE /m, `der Prozess lief bis zur Wache: ${r.stderr}`)
  assert.match(r.stdout, treffer, r.stdout)
  assert.doesNotMatch(r.stdout, /tmdb/, 'Job ohne FEHLER-Zeile bleibt still')
  // Zweiter Lauf ohne Jobs-/Log-Antworten: die Zeile kommt aus dem Speicher (Ort per Kommandozeile), ohne ihn fehlen die Antworten.
  const nurListe = { '--workflow refresh-weekly.yml': tabelle['--workflow refresh-weekly.yml'] }
  assert.match(fahre(nurListe, 'prozess.json').stdout, treffer, 'aus dem Zwischenspeicher')
  const ohne = fahre(nurListe, 'anderer.json').stdout
  assert.doesNotMatch(ohne, treffer)
  assert.match(ohne, /^WEICH\? Schrittprüfung ausgefallen: \d+ von \d+ Workflows nicht lesbar/m, 'Sammelzeile, nicht eine Zeile je Workflow')
  assert.equal(ohne.split('\n').filter((l) => l.startsWith('WEICH?')).length, 1)
  // Echte Uhr: ein Lauf von 2020 ist längst über 14 Tage alt.
  const alt = fahre({ ...tabelle, '--workflow refresh-weekly.yml': lauf('2020-01-01T00:00:00Z') }, 'alt.json')
  assert.doesNotMatch(alt.stdout, /^WEICH refresh-weekly/m, 'alter Lauf bleibt still')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-weicher-schritt: ok (Auswahl, Logzeile, 14-Tage-Grenze, per_page, Zwischenspeicher, Wiederholung, Sammelzeile, Stapel mit Prozessen, laeufe-aufraeumen als Prozess)')
