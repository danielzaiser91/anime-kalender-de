/**
 * Prüft die Kapazitätsmessung (`tools/kapazitaet-messen.mjs`, `kapazitaet-bewertung.mjs`): jede Schwelle
 * genau an, eins darüber und eins darunter; die Zahlen aus der (nachgebildeten) GraphQL-Antwort; ein
 * nicht lesbarer Datensatz wird gemeldet, nicht als 0 gewertet; der Prozess ohne Token endet mit 0.
 * Aufruf: node tools/kapazitaet.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { GRENZE_ANFRAGEN, GRENZE_CRON_P99_MS, GRENZE_D1_GESCHRIEBEN, bewerteKapazitaet } from './kapazitaet-bewertung.mjs'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { berichtZeilen, lauf, messe } from './kapazitaet-messen.mjs'
import { stundenTabelle, stundenZeilen } from './kapazitaet-stunden.mjs'

/* Schwellen fest eingetragen, nicht aus dem Modul abgeleitet. */
assert.equal(GRENZE_ANFRAGEN, 70_000)
assert.equal(GRENZE_D1_GESCHRIEBEN, 70_000)
assert.equal(GRENZE_CRON_P99_MS, 8)

const tag = (felder) => ({ datum: '2026-10-22', anfragen: 0, geschrieben: 0, cronP99Ms: 0, ueberCpu: 0, ...felder })
const befunde = (felder) => bewerteKapazitaet([tag(felder)]).befunde

/* ---- Anfragen: 70.000 genau ist noch grün ---- */
assert.equal(befunde({ anfragen: 70_000 }).length, 0)
assert.equal(befunde({ anfragen: 70_001 }).length, 1)
assert.match(befunde({ anfragen: 70_001 })[0], /Worker-Anfragen im Skript \(gesamt\) am 2026-10-22/)
assert.equal(befunde({ anfragen: 69_999 }).length, 0)
/* ---- D1 geschrieben ---- */
assert.equal(befunde({ geschrieben: 70_000 }).length, 0)
assert.equal(befunde({ geschrieben: 70_001 }).length, 1)
assert.match(befunde({ geschrieben: 70_001 })[0], /D1-Zeilen geschrieben/)
/* ---- Cron-CPU p99 ---- */
assert.equal(befunde({ cronP99Ms: 8 }).length, 0)
assert.equal(befunde({ cronP99Ms: 8.1 }).length, 1)
assert.match(befunde({ cronP99Ms: 8.1 })[0], /Cron-CPU p99 8,1 ms|Cron-CPU p99 8\.1 ms/)
/* ---- exceededCpu: nur Warnung, genau 1 genügt ---- */
assert.equal(bewerteKapazitaet([tag({ ueberCpu: 1 })]).warnungen.length, 1)
assert.equal(bewerteKapazitaet([tag({ ueberCpu: 1 })]).befunde.length, 0)
assert.equal(bewerteKapazitaet([tag({ ueberCpu: 0 })]).warnungen.length, 0)
/* ---- Nicht gemessen (null) ist weder rot noch 0 ---- */
assert.deepEqual(bewerteKapazitaet([tag({ anfragen: null, geschrieben: null, cronP99Ms: null, ueberCpu: null })]), { befunde: [], warnungen: [] })
assert.deepEqual(bewerteKapazitaet([]), { befunde: [], warnungen: [] })
/* ---- Frische Tage: nur die letzten 2 UTC-Tage sind rot, ältere Überschreitungen eine Warnung mit Datum ---- */
const tage3 = (a, b, c, extra = {}) => [
  tag({ datum: '2026-10-20', ...a }),
  tag({ datum: '2026-10-21', ...b }),
  tag({ datum: '2026-10-22', ...c }),
].map((t) => ({ ...t, ...extra }))
const alt = bewerteKapazitaet(tage3({ anfragen: 80_000 }, {}, {}))
assert.equal(alt.befunde.length, 0, 'Spitze vor 3 Tagen ist nicht mehr rot')
assert.equal(alt.warnungen.length, 1)
assert.match(alt.warnungen[0], /80\.000 Worker-Anfragen im Skript \(gesamt\) am 2026-10-20.*älter als 2 Tage/)
assert.match(bewerteKapazitaet(tage3({}, { anfragen: 80_000 }, {})).befunde[0], /2026-10-21/, 'vorletzter Tag ist noch frisch')
assert.match(bewerteKapazitaet(tage3({}, {}, { anfragen: 80_000 })).befunde[0], /2026-10-22/)
assert.equal(bewerteKapazitaet(tage3({ anfragen: 70_000 }, {}, {})).warnungen.length, 0, 'genau 70.000 auch alt noch still')
assert.equal(bewerteKapazitaet(tage3({ anfragen: 70_001 }, {}, {})).warnungen.length, 1)
/* D1-Schreiben gilt genauso */
assert.equal(bewerteKapazitaet(tage3({ geschrieben: 80_000 }, {}, {})).befunde.length, 0)
assert.match(bewerteKapazitaet(tage3({ geschrieben: 80_000 }, {}, {})).warnungen[0], /D1-Zeilen geschrieben am 2026-10-20/)
assert.equal(bewerteKapazitaet(tage3({}, {}, { geschrieben: 80_000 })).befunde.length, 1)
/* Cron-CPU zählt weiter über das ganze Fenster */
assert.equal(bewerteKapazitaet(tage3({ cronP99Ms: 9 }, {}, {})).befunde.length, 1)
/* Ein einzelner Tag ist frisch; ohne Tage nichts */
assert.equal(bewerteKapazitaet([tag({ anfragen: 70_001 })]).befunde.length, 1)
/* Grenze je Skript und zusätzlich die Kontosumme: ein einzelnes Skript darüber ist rot und namentlich genannt (die Summe
   dann nicht doppelt), zwei Skripte je darunter mit Summe darüber sind rot als Summe */
const skripte = (jeSkript) => bewerteKapazitaet([tag({ jeSkript, anfragen: Object.values(jeSkript).reduce((p, c) => p + c, 0) })])
const summeRot = skripte({ a: 60_000, b: 60_000 }).befunde
assert.equal(summeRot.length, 1, 'zwei Skripte je 60.000: Summe 120.000 ist rot')
assert.match(summeRot[0], /120\.000 Worker-Anfragen aller Skripte am 2026-10-22/)
assert.equal(skripte({ a: 35_000, b: 35_000 }).befunde.length, 0, 'Summe genau 70.000 grün')
assert.equal(skripte({ a: 35_000, b: 35_001 }).befunde.length, 1, 'Summe 70.001 rot')
assert.equal(skripte({ newsletter: 69_000, 'ak-adn-gw': 1_159 }).befunde.length, 1, 'Summe 70.159 rot, kein Skript einzeln darüber')
const aeltereSumme = bewerteKapazitaet([
  tag({ datum: '2026-10-20', jeSkript: { a: 60_000, b: 60_000 }, anfragen: 120_000 }),
  tag({ datum: '2026-10-21' }),
  tag({ datum: '2026-10-22' }),
])
assert.equal(aeltereSumme.befunde.length, 0, 'Summe vor 3 Tagen nicht mehr rot')
assert.match(aeltereSumme.warnungen[0], /aller Skripte am 2026-10-20.*älter als 2 Tage/)
const rot = skripte({ newsletter: 71_000, 'ak-adn-gw': 5 }).befunde
assert.equal(rot.length, 1)
assert.match(rot[0], /71\.000 Worker-Anfragen im Skript newsletter am 2026-10-22/)
assert.equal(skripte({ a: 70_001, b: 70_001 }).befunde.length, 2, 'jedes Skript über der Grenze einzeln')
assert.equal(skripte({ newsletter: 70_000 }).befunde.length, 0)
assert.equal(skripte({ newsletter: 70_001 }).befunde.length, 1)
/* Anlassfall 06./07.11.2026: Spitze 86.915 / 84.115 im Skript newsletter, am 09.11. nur noch 2.258 */
const spitze = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'].map((datum, i) => {
  const n = [8_000, 11_000, 9_000, 86_915, 84_115, 6_408, 2_258][i]
  return tag({ datum, anfragen: n + 300, jeSkript: { newsletter: n, 'ak-adn-gw': 300 } })
})
const anlass = bewerteKapazitaet(spitze)
assert.equal(anlass.befunde.length, 0, 'am 09.11. ist die Wache wieder grün')
assert.deepEqual(anlass.warnungen.map((w) => w.match(/am (\S+)/)[1]), ['2026-11-06', '2026-11-07'])
assert.equal(bewerteKapazitaet(spitze.slice(0, 6)).befunde.length, 1, 'am 08.11. war der 07.11. noch frisch und rot')

/* ---- Messung gegen eine nachgebildete API ---- */
function api({ ohne = [], stundenFehlt = false } = {}) {
  const log = []
  const holen = async (url, init) => {
    const { query, variables } = JSON.parse(init.body)
    log.push({ url, auth: init.headers.Authorization, variables })
    if (query.includes('datetimeHour')) {
      if (stundenFehlt) return { ok: true, json: async () => ({ errors: [{ message: 'unknown field datetimeHour' }] }) }
      const std = [['newsletter', '2026-10-22T03:00:00Z', 3600], ['newsletter', '2026-10-22T04:00:00Z', 3500], ['board', '2026-10-22T03:00:00Z', 7]]
      const zeilen = std.map(([scriptName, datetimeHour, requests]) => ({ dimensions: { scriptName, datetimeHour }, sum: { requests } }))
      return { ok: true, json: async () => ({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: zeilen }] } } }) }
    }
    const name = ['workersInvocationsAdaptive', 'workersInvocationsScheduled', 'd1AnalyticsAdaptiveGroups'].find((n) => query.includes(n))
    if (ohne.includes(name)) return { ok: true, json: async () => ({ errors: [{ message: `unknown field ${name}` }] }) }
    const daten = {
      workersInvocationsAdaptive: [
        { dimensions: { scriptName: 'newsletter', status: 'success' }, sum: { requests: 1000, errors: 3 }, quantiles: { cpuTimeP50: 2000, cpuTimeP99: 7500 } },
        { dimensions: { scriptName: 'newsletter', status: 'exceededCpu' }, sum: { requests: 2, errors: 2 }, quantiles: { cpuTimeP50: 9000, cpuTimeP99: 12000 } },
        { dimensions: { scriptName: 'board', status: 'success' }, sum: { requests: 40, errors: 0 }, quantiles: { cpuTimeP50: 1000, cpuTimeP99: 3000 } },
      ],
      workersInvocationsScheduled: [1000, 2000, 3000, 4000, 8200].map((us) => ({ scriptName: 'newsletter', cron: '0 * * * *', status: 'success', cpuTimeUs: us })),
      d1AnalyticsAdaptiveGroups: [{ dimensions: { databaseId: 'x' }, sum: { rowsRead: 5000, rowsWritten: 321 } }],
    }[name]
    return { ok: true, json: async () => ({ data: { viewer: { accounts: [{ [name]: daten }] } } }) }
  }
  return { holen, log }
}
const JETZT = new Date('2026-10-23T12:00:00Z')

const a = api()
const m = await messe({ token: 'T', konto: 'K', jetzt: JETZT, tage: 7, holen: a.holen })
assert.equal(m.tage.length, 7)
assert.equal(m.tage[0].datum, '2026-10-17')
assert.equal(m.tage[6].datum, '2026-10-23')
assert.equal(a.log.length, 22, '3 Datensätze je Tag und eine Stundenabfrage über das ganze Fenster')
const stundenAufruf = a.log.at(-1).variables
assert.equal(stundenAufruf.von, '2026-10-17T00:00:00.000Z')
assert.equal(stundenAufruf.bis, '2026-10-24T00:00:00.000Z')
assert.equal(m.stundenFehler, null)
assert.equal(m.stunden.newsletter['2026-10-22'][3], 3600)
assert.equal(m.stunden.newsletter['2026-10-22'][4], 3500)
assert.equal(m.stunden.board['2026-10-22'][3], 7)
assert.ok(a.log.every((l) => l.auth === 'Bearer T' && l.variables.konto === 'K'))
const t = m.tage[6]
assert.equal(t.anfragen, 1042)
assert.deepEqual(t.jeSkript, { newsletter: 1002, board: 40 })
assert.equal(t.fehler, 5)
assert.equal(t.ueberCpu, 2, 'nur die Gruppe mit Status exceededCpu')
assert.equal(t.cpuP99Ms, 12, 'Mikrosekunden → Millisekunden, größter Gruppenwert')
assert.equal(t.cronP50Ms, 3)
assert.equal(t.cronP99Ms, 8.2, 'Cron getrennt von allen Aufrufen')
assert.equal(t.gelesen, 5000)
assert.equal(t.geschrieben, 321)
assert.equal(m.nichtLesbar.length, 0)
assert.equal(bewerteKapazitaet(m.tage).befunde.length, 1, 'nur Cron p99 8,2 ms ist über der Schwelle')
assert.match(berichtZeilen(m).join('\n'), /Skript newsletter: 1\.002 Anfragen am 2026-10-23/)

/* ---- Stundentabelle: Zeilen ohne Stunde/Skript übergangen, gleiche Stunde summiert, Zeilen nur bei Anfragen ---- */
const tab = stundenTabelle([
  { dimensions: { scriptName: 'x', datetimeHour: '2026-11-06T15:00:00Z' }, sum: { requests: 5 } },
  { dimensions: { scriptName: 'x', datetimeHour: '2026-11-06T15:00:00Z' }, sum: { requests: 2 } },
  { dimensions: { scriptName: 'x', datetimeHour: '2026-11-06T00:00:00Z' }, sum: { requests: 1 } },
  { dimensions: { scriptName: 'x' }, sum: { requests: 99 } },
  { dimensions: { datetimeHour: '2026-11-06T01:00:00Z' }, sum: { requests: 99 } },
  { dimensions: { scriptName: 'y', datetimeHour: '2026-11-07T23:00:00Z' }, sum: { requests: 0 } },
])
assert.equal(tab.x['2026-11-06'][15], 7)
assert.equal(tab.x['2026-11-06'][0], 1)
assert.equal(tab.x['2026-11-06'].reduce((p, c) => p + c, 0), 8)
assert.equal(tab.y['2026-11-07'][23], 0)
assert.deepEqual(stundenZeilen(tab), ['Anfragen je Skript und UTC-Stunde:', '  Stunden x 2026-11-06 (00–23 UTC, gesamt 8): 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 7 0 0 0 0 0 0 0 0'])
assert.deepEqual(stundenZeilen({}), [])
assert.deepEqual(stundenTabelle(null), {})

/* ---- Ein Datensatz fehlt: gemeldet, nicht als 0 gewertet ---- */
const b = api({ ohne: ['workersInvocationsScheduled'] })
const n = await messe({ token: 'T', konto: 'K', jetzt: JETZT, tage: 2, holen: b.holen })
assert.equal(n.tage[1].cronP99Ms, null)
assert.equal(n.tage[1].anfragen, 1042)
assert.equal(n.nichtLesbar.length, 1)
assert.equal(bewerteKapazitaet(n.tage).befunde.length, 0)

/* ---- Prozess ohne Token: Exit 0 mit Hinweis ---- */
const env = { ...process.env }
delete env.CLOUDFLARE_API_TOKEN
delete env.CLOUDFLARE_ACCOUNT_ID
const prozess = spawnSync(process.execPath, [fileURLToPath(new URL('./kapazitaet-messen.mjs', import.meta.url))], { env, encoding: 'utf8', windowsHide: true })
assert.equal(prozess.status, 0)
assert.match(prozess.stdout, /übersprungen/)


/* ---- lauf(): Exit-Code und Ausgabe ---- */
const sammle = () => {
  const zeilen = []
  return { zeilen, ausgabe: (z) => zeilen.push(z) }
}
const gut = sammle()
assert.equal(await lauf({ token: 'T', konto: 'K', jetzt: JETZT, tage: 2, holen: api().holen, ausgabe: gut.ausgabe }), 1, 'Cron p99 8,2 ms ist über 8 ms')
assert.ok(gut.zeilen.some((z) => z.startsWith('  Stunden newsletter 2026-10-22 (00–23 UTC, gesamt 7100): ')), 'Stundenzeilen stehen im Protokoll')
assert.ok(!gut.zeilen.some((z) => z.startsWith('::warning::Kapazität: Stundenabfrage')))
assert.ok(gut.zeilen.some((z) => z.startsWith('::error::Kapazität: Cron-CPU p99')))
const fehlt = sammle()
assert.equal(await lauf({ token: 'T', konto: 'K', jetzt: JETZT, tage: 2, holen: api({ ohne: ['workersInvocationsScheduled'] }).holen, ausgabe: fehlt.ausgabe }), 1, 'nicht lesbarer Datensatz = rot')
assert.ok(fehlt.zeilen.some((z) => /^::error::Kapazität: Datensatz nicht lesbar \(cron: unknown field/.test(z)))
/* ---- Stundenabfrage scheitert: nur Warnung, Exit-Code wie ohne sie ---- */
const sf = sammle()
const codeSf = await lauf({ token: 'T', konto: 'K', jetzt: JETZT, tage: 2, holen: api({ stundenFehlt: true }).holen, ausgabe: sf.ausgabe })
assert.equal(codeSf, 1, 'Cron p99 8,2 ms bleibt der einzige Befund')
assert.ok(sf.zeilen.some((z) => /^::warning::Kapazität: Stundenabfrage nicht lesbar \(unknown field datetimeHour\)/.test(z)))
assert.ok(!sf.zeilen.some((z) => /^::error::.*Stunden/.test(z)))
assert.equal(sf.zeilen.filter((z) => z.startsWith('::error::')).length, 1)

const ohneToken = sammle()
assert.equal(await lauf({ token: '', konto: 'K', jetzt: JETZT, holen: () => assert.fail('kein Abruf ohne Token'), ausgabe: ohneToken.ausgabe }), 0)
assert.equal(await lauf({ token: 'T', konto: '', jetzt: JETZT, holen: () => assert.fail('kein Abruf ohne Konto'), ausgabe: ohneToken.ausgabe }), 0)
const ruhig = sammle()
const ruhigeApi = async () => ({ ok: true, json: async () => ({ data: { viewer: { accounts: [{ x: [] }] } } }) })
assert.equal(await lauf({ token: 'T', konto: 'K', jetzt: JETZT, tage: 2, holen: ruhigeApi, ausgabe: ruhig.ausgabe }), 0)
assert.equal(ruhig.zeilen.at(-1), 'Kapazität: alles im Rahmen.')

/* ---- Workflow: der Schritt läuft mit pipefail, sonst verschluckt `tee` den Exit-Code ---- */
const wf = parse(readFileSync(fileURLToPath(new URL('../.github/workflows/d1-verbrauch.yml', import.meta.url)), 'utf8'))
const schritt = wf.jobs.verbrauch.steps.find((s) => s.id === 'kapazitaet')
assert.equal(schritt.shell, 'bash')
assert.equal(schritt.run, 'node tools/kapazitaet-messen.mjs | tee kapazitaet.txt')
assert.equal(schritt['continue-on-error'], true)
/* Rot wird der Lauf nur durch die beiden Folgeschritte: beide hinter dem Messschritt und mit dessen Ergebnis in der Bedingung. */
const schritte = wf.jobs.verbrauch.steps
const pos = (id) => schritte.findIndex((s) => s.id === id)
const melden = schritte.find((s) => s.name === 'Befund melden')
const rotwerden = schritte.find((s) => s.name === 'Rot werden, wenn etwas auffällt')
assert.ok(pos('pruefung') >= 0 && pos('kapazitaet') > pos('pruefung'))
for (const folge of [melden, rotwerden]) {
  assert.ok(schritte.indexOf(folge) > pos('kapazitaet'), `${folge.name} steht hinter dem Messschritt`)
  assert.equal(folge.if, "steps.pruefung.outcome != 'success' || steps.kapazitaet.outcome != 'success'")
}
console.log('Kapazität: lauf() rot bei Schwelle und bei nicht lesbarem Datensatz, grün ohne Befund, still ohne Token; Workflow-Schritt mit pipefail.')
