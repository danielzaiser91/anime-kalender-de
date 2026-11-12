/**
 * Test für tools/basis-gemergt-neustart.mjs und den Job `basis-gemergt` in pr-pruefer-nachtrag.yml: Erkennung der Stapel-PRs,
 * Grenze, Fehlerpfade, Einstieg `main` mit Attrappen (Aufruf und Trockenschalter), Verdrahtung aus der YAML. Kein Netz, keine Uhr.
 * Aufruf: node tools/basis-gemergt-neustart.test.mjs
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { abhaengige, grundExit2, lauf, main, MAX_PRS, PRO_PR_SEK, VERSUCHE, PAUSE_MS } from './basis-gemergt-neustart.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const pr = (number, body, isDraft = false) => ({ number, body, isDraft })
const OFFENE = [
  pr(40, 'mergen nach #30'),
  pr(10, 'erst nach #30 (Teil 2)'),
  pr(30, 'der Basis-PR selbst, nennt sich: mergen nach #30'),
  pr(50, 'mergen nach #31'),
  pr(60, 'ohne Hinweis'),
  pr(70, 'mergen nach #30', true),
  pr(80, '> mergen nach #30 (nur Zitat)'),
  pr(90, null),
]

gleich('Erkennung: nur offene Nicht-Entwürfe mit Basis 30, aufsteigend, ohne den Basis-PR', abhaengige(OFFENE, 30), [10, 40])
gleich('Erkennung: andere Basis trifft nur ihren PR', abhaengige(OFFENE, 31), [50])
gleich('Erkennung: keine Treffer', abhaengige(OFFENE, 99), [])


// Meldungen, wie pr-nachrechnen sie schreibt (tools/pr-nachrechnen.mjs: hindernis, basisDesLaufs, main).
const KONFLIKT = 'PR 7 hat einen Konflikt mit main: erst main hineinmergen, das startet die Kette neu'
const UNKNOWN = 'PR 7: Mergebarkeit noch nicht berechnet (UNKNOWN), gleich erneut aufrufen'
const LAEUFT = 'PR 7: Job „Kette – Bau und Installation“ läuft noch (Lauf 5), sein Log gibt es erst nach Abschluss; später erneut aufrufen'
const FEHL = 'pr-nachrechnen: FEHLER gh: Zeitüberschreitung'
const ANGESTOSSEN = 'PR 7: Merge-Commit nicht neu gerechnet (SCHON ANGESTOSSEN: PR war geschlossen)'
const ERSETZT = 'PR 7 wird von PR 99 ersetzt: nicht mergen'
const ok = (code) => ({ code, text: `PR 7 Meldung ${code}` })
const nein = (code, text) => ({ code, text })

/** `folgen[nr]` = Antworten von pr-nachrechnen in Reihenfolge (die letzte gilt für jeden weiteren Aufruf). */
function fahre(basis, prs, folgen = {}) {
  const zeilen = []
  const aufrufe = []
  const pausen = []
  const rechne = (nr) => {
    aufrufe.push(nr)
    const f = folgen[nr] ?? [ok(0)]
    return f[Math.min(aufrufe.filter((a) => a === nr).length, f.length) - 1]
  }
  const code = lauf({ basis, holePrs: () => prs, rechne, warte: (ms) => pausen.push(ms), melde: (t) => zeilen.push(t) })
  return { code, aufrufe, zeilen, pausen }
}

gleich('Grenze: höchstens 4 Stapel-PRs je Merge', MAX_PRS, 4)
const viele = Array.from({ length: 6 }, (_, i) => pr(101 + i, 'mergen nach #30'))
gleich('Grenze: fünf und sechs bleiben liegen, die ersten vier laufen', fahre(30, viele).aufrufe, [101, 102, 103, 104])
gleich('Grenze: genau 4 PRs: alle laufen, keine Restmeldung', [fahre(30, viele.slice(0, 4)).aufrufe.length, fahre(30, viele.slice(0, 4)).zeilen[0].includes('nicht bearbeitet')], [4, false])
gleich('Grenze: 5 PRs: Restmeldung nennt den fünften', fahre(30, viele.slice(0, 5)).zeilen[0].includes('nicht bearbeitet (Grenze 4): #105'), true)

gleich('Kein Stapel-PR: Exit 0, nichts gerechnet, eine Zeile mit Grund', [fahre(30, [pr(60, 'x')]).code, fahre(30, [pr(60, 'x')]).aufrufe, fahre(30, [pr(60, 'x')]).zeilen], [0, [], ['Basis-Neustart: kein offener PR nennt #30 als Basis']])
const gut = fahre(30, OFFENE, { 10: [ok(1)], 40: [ok(0)] })
gleich('Exit 0 und 1 von pr-nachrechnen: Exit 0, beide Zeilen mit Code, keine Pause', [gut.code, gut.aufrufe, gut.zeilen.slice(1), gut.pausen], [0, [10, 40], ['Basis-Neustart: PR 10 Exit 1 (Kette neu gestartet)', 'Basis-Neustart: PR 40 Exit 0 (aktuell)'], []])
gleich('Basis fehlt (NaN): Exit 1, nichts gerechnet', [fahre(NaN, OFFENE).code, fahre(NaN, OFFENE).aufrufe], [1, []])
gleich('Basis 0: Exit 1', fahre(0, OFFENE).code, 1)
const kaputt = []
gleich('Abruffehler der PR-Liste: Exit 1, Zeile FEHLGESCHLAGEN mit Grund', [lauf({ basis: 30, holePrs: () => { throw new Error('HTTP 502\nzweite Zeile') }, rechne: () => ok(0), warte: () => {}, melde: (t) => kaputt.push(t) }), kaputt], [1, ['Basis-Neustart: FEHLGESCHLAGEN PR-Liste nicht lesbar (HTTP 502)']])

// A2/A3/A4: je Grund eines Exit 2 und Exit 3; rot ist nur ein echter Fehler.
gleich('Konstanten: ein Neuversuch, 20 s Pause', [VERSUCHE, PAUSE_MS], [2, 20000])
gleich('Grund: Konflikt', grundExit2(KONFLIKT), 'konflikt')
gleich('Grund: UNKNOWN', grundExit2(UNKNOWN), 'spaeter')
gleich('Grund: Kette läuft noch', grundExit2(LAEUFT), 'spaeter')
gleich('Grund: Fehler', grundExit2(FEHL), 'fehler')
gleich('Grund: SCHON ANGESTOSSEN ist Fehler, auch wenn „noch nicht“ im Text steht', grundExit2(`${ANGESTOSSEN}; noch nicht berechnet`), 'fehler')
gleich('Grund: unbekannter Text ist Fehler', grundExit2('irgendwas'), 'fehler')
const unknown = fahre(30, [pr(10, 'mergen nach #30')], { 10: [nein(2, UNKNOWN), ok(1)] })
gleich('UNKNOWN, beim zweiten Versuch rechenbar: zwei Aufrufe, eine Pause, Exit 0, Neustart gemeldet', [unknown.code, unknown.aufrufe, unknown.pausen, unknown.zeilen[1]], [0, [10, 10], [20000], 'Basis-Neustart: PR 10 Exit 1 (Kette neu gestartet)'])
const laeuft = fahre(30, [pr(10, 'mergen nach #30')], { 10: [nein(2, LAEUFT)] })
gleich('Kette läuft noch, bleibt so: nach dem Neuversuch Exit 0, Zeile mit Handgriff, genau zwei Aufrufe', [laeuft.code, laeuft.aufrufe.length, laeuft.zeilen[1].includes('NICHT NEU GERECHNET') && laeuft.zeilen[1].includes('von Hand: node tools/pr-nachrechnen.mjs 10')], [0, 2, true])
const konflikt = fahre(30, [pr(10, 'mergen nach #30')], { 10: [nein(2, KONFLIKT)] })
gleich('Konflikt: Exit 0, ein Aufruf, keine Pause, Zeile KONFLIKT', [konflikt.code, konflikt.aufrufe, konflikt.pausen, konflikt.zeilen[1].includes('KONFLIKT mit main')], [0, [10], [], true])
const ersetzt = fahre(30, [pr(10, 'mergen nach #30')], { 10: [nein(3, ERSETZT)] })
gleich('Exit 3 (ersetzt): Exit 0, ein Aufruf, Zeile ERSETZT mit Text', [ersetzt.code, ersetzt.aufrufe, ersetzt.zeilen[1]], [0, [10], `Basis-Neustart: PR 10 ERSETZT (Exit 3), nichts angestoßen: ${ERSETZT}`])
const echt = fahre(30, OFFENE, { 10: [nein(2, FEHL)] })
gleich('Echter Fehler: Exit 1, kein Neuversuch, der nächste PR läuft trotzdem, Zeile FEHLER', [echt.code, echt.aufrufe, echt.zeilen[1].startsWith('Basis-Neustart: PR 10 FEHLER (Exit 2)')], [1, [10, 40], true])
const angest = fahre(30, [pr(10, 'mergen nach #30')], { 10: [nein(2, ANGESTOSSEN)] })
gleich('SCHON ANGESTOSSEN: rot, kein Neuversuch', [angest.code, angest.aufrufe], [1, [10]])
const gemischt = fahre(30, OFFENE, { 10: [nein(2, KONFLIKT)], 40: [nein(3, ERSETZT)] })
gleich('Konflikt und ersetzt zusammen: Exit 0', gemischt.code, 0)

// Frist (A7): Worst Case = MAX_PRS Stapel-PRs je PRO_PR_SEK plus 60 s Checkout gegen timeout-minutes; je PR zwei Versuche am
// gh-Limit (30 s) plus Pause bleiben unter PRO_PR_SEK.
gleich('Worst Case je PR: Versuche mal 30 s plus Pausen ≤ 100 s', [PRO_PR_SEK, VERSUCHE * 30 + (VERSUCHE - 1) * (PAUSE_MS / 1000) <= PRO_PR_SEK], [100, true])

// Einstieg `main`: Umgebung -> Basis, Aufruf von nachrechnen (Argumente), Trockenschalter nur bei TROCKEN=true, Meldungstext fließt in den Grund.
function einstieg(env, antwort = 0) {
  const aufrufe = []
  const zeilen = []
  const pausen = []
  const nachrechnen = (argv, _gh, melde) => {
    aufrufe.push(argv)
    melde(antwort === 2 ? KONFLIKT : 'ok')
    return antwort
  }
  const code = main(env, { holePrs: () => OFFENE, nachrechnen, warte: (ms) => pausen.push(ms), melde: (t) => zeilen.push(t) })
  return { code, aufrufe, zeilen }
}
gleich('main: Basis aus BASIS_PR, nachrechnen ohne --trocken', einstieg({ BASIS_PR: '30', TROCKEN: 'false' }), { code: 0, aufrufe: [['10'], ['40']], zeilen: ['Basis-Neustart: #30 gemergt, Stapel-PRs #10, #40', 'ok', 'Basis-Neustart: PR 10 Exit 0 (aktuell)', 'ok', 'Basis-Neustart: PR 40 Exit 0 (aktuell)'] })
gleich('main: TROCKEN=true reicht --trocken durch', einstieg({ BASIS_PR: '30', TROCKEN: 'true' }).aufrufe, [['--trocken', '10'], ['--trocken', '40']])
gleich('main: TROCKEN fehlt: nicht trocken (Standardwert)', einstieg({ BASIS_PR: '31' }).aufrufe, [['50']])
gleich('main: BASIS_PR fehlt: Exit 1', einstieg({}).code, 1)
gleich('main: Meldung von nachrechnen kommt als Grund an (Konflikt: Exit 0, eine Zeile KONFLIKT)', [einstieg({ BASIS_PR: '31' }, 2).code, einstieg({ BASIS_PR: '31' }, 2).zeilen.some((z) => z.includes('KONFLIKT mit main'))], [0, true])
// Verdrahtung aus der YAML: Auslöser, Bedingung, Rechte, Token, Aufruf.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer-nachtrag.yml', import.meta.url), 'utf8'))
const job = wf.jobs['basis-gemergt']
const schritt = job.steps.find((s) => s.name === 'Stapel-PRs nachrechnen')
gleich('Auslöser: pull_request_target closed', wf.on.pull_request_target, { types: ['closed'] })
gleich('Job nur bei gemergtem PR (geschlossen ohne Merge startet nichts)', job.if, "github.event_name == 'pull_request_target' && github.event.pull_request.merged == true")
gleich('Schritt ruft das Werkzeug ohne Argumente, ohne Ausdruck in run', [schritt.run, schritt.run.includes('${{')], ['node tools/basis-gemergt-neustart.mjs', false])
gleich('Basis-Nummer aus dem Ereignis, nur über env', schritt.env.BASIS_PR, '${{ github.event.pull_request.number }}')
gleich('Token: PAT, sonst GITHUB_TOKEN; ohne PAT Trockenlauf', [schritt.env.GH_TOKEN, schritt.env.TROCKEN], ['${{ secrets.NACHT_MERGER_TOKEN || secrets.GITHUB_TOKEN }}', "${{ secrets.NACHT_MERGER_TOKEN == '' }}"])
gleich('Rechte des Jobs nur lesend, Frist unter 10 min', [job.permissions, job['timeout-minutes'] < 10], [{ contents: 'read', 'pull-requests': 'read', actions: 'read' }, true])
const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout'))
gleich('Checkout mit voller Historie (pr-nachrechnen liest git log) ohne gespeicherte Zugangsdaten', [checkout.with['fetch-depth'], checkout.with['persist-credentials']], [0, false])
gleich('Zeitbudget: 4 PRs mal 100 s plus 60 s Checkout unter der Job-Frist von 9 min', [job['timeout-minutes'], MAX_PRS * PRO_PR_SEK + 60 <= job['timeout-minutes'] * 60], [9, true])
gleich('Zeitbudget: ein fünfter PR sprengte die Frist (Grenze nicht ohne Frist anheben)', (MAX_PRS + 1) * PRO_PR_SEK + 60 > job['timeout-minutes'] * 60, true)

console.log(`Basis-Neustart: ${fehler.length === 0 ? 'alle Fälle grün' : fehler.length + ' Fälle rot'}`)
process.exit(fehler.length === 0 ? 0 : 1)
