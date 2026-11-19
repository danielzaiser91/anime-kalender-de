/**
 * Test für tools/pr-pruefer-nach-kette.mjs und den Job `nach-kette` in pr-pruefer-nachtrag.yml: Entscheidung als Tabelle,
 * Ablauf mit eingespeistem gh (Kreislauf: „Kette offen“-Kommentar -> Kettenende -> Neustart -> zweites Mal -> Grenze),
 * Verdrahtung über die env-Namen der YAML. Keine echte Uhr: `warte` ist eine Attrappe.
 */
import fs from 'node:fs'
import { parse } from 'yaml'
import { MARKE_KETTE_OFFEN } from './pr-pruefer-kette-offen.mjs'
import { MARKE_OHNE_MODELL } from './pruefer-unfertig-wache.mjs'
import { MAX_NEUSTARTS, entscheide, letztesUrteil, main } from './pr-pruefer-nach-kette.mjs'

const fehler = []
const gleich = (name, ist, soll) => {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — Ist ${JSON.stringify(ist)}, Soll ${JSON.stringify(soll)}`)
}

const KOPF = 'd'.repeat(40)
const ALT = 'a'.repeat(40)
const BOT = 'github-actions[bot]'
const urteil = (kopf, titel, mitMarke, login = BOT) => ({
  user: { login },
  body: `**Prüfer-Review** für ${kopf.slice(0, 9)} - Urteil: **${titel}**\n\nText\n${mitMarke ? `\n${MARKE_KETTE_OFFEN}\n` : ''}\n<!-- pruefer-modus: voll -->\n`,
})
const OFFEN = (kopf = KOPF) => urteil(kopf, 'nicht beurteilt, Kette lief noch', true)
const AENDERN = (kopf = KOPF) => urteil(kopf, 'aendern', false)
const OK = (kopf = KOPF) => urteil(kopf, 'ok', false)
const pr = (a = {}) => ({ number: 7, state: 'open', draft: false, head: { sha: KOPF }, ...a })
const lauf = { id: 5, status: 'completed' }
const los = (e) => entscheide({ kommentare: [OFFEN()], kopf: KOPF, pr: pr(), lauf, ...e }).los

gleich('Basisfall: letztes Urteil „Kette offen“', los({}), true)
gleich('letztes Urteil aendern (echt, Kette fertig gesehen): kein Neustart', los({ kommentare: [OFFEN(), AENDERN()] }), false)
gleich('letztes Urteil ok: kein Neustart', los({ kommentare: [OFFEN(), OK()] }), false)
gleich('Kette-offen-Kommentar nach aendern: Neustart', los({ kommentare: [AENDERN(), OFFEN()] }), true)
gleich('Kommentar eines Menschen mit Marke und Urteilszeile ist kein Prüfer-Urteil: Kopf ohne Urteil, Neustart', los({ kommentare: [urteil(KOPF, 'nicht beurteilt, Kette lief noch', true, 'inhaber')] }), true)
gleich('Mensch schreibt Urteil „ok“ ab: zählt nicht, Neustart', los({ kommentare: [urteil(KOPF, 'ok', false, 'inhaber')] }), true)
gleich('Kette-offen-Kommentar nur zu altem Kopf: der aktuelle Kopf hat kein Urteil, Neustart', los({ kommentare: [OFFEN(ALT)] }), true)
gleich('Urteil zu altem Kopf, keins zum aktuellen: Neustart', los({ kommentare: [OK(ALT)] }), true)
gleich('Titel „nicht beurteilt“ ohne Marke: kein Neustart', los({ kommentare: [urteil(KOPF, 'nicht beurteilt, Kette lief noch', false)] }), false)
// Seit 19.11.2026 schweigt der Prüfer bei laufender Kette: kein Kommentar zum Kopf = Kopf ohne Urteil = genau ein Neustart nach Kettenende.
gleich('keine Kommentare (Prüfer schwieg): Neustart', los({ kommentare: [] }), true)
gleich('Kopf ohne Urteil, Prüfer-Lauf übersprungen (daten/-Zweig, Fork): kein Neustart', los({ kommentare: [], lauf: { id: 5, status: 'completed', conclusion: 'skipped' } }), false)
gleich('Kopf ohne Urteil, Lauf gescheitert (failure): Neustart', los({ kommentare: [], lauf: { id: 5, status: 'completed', conclusion: 'failure' } }), true)
gleich('Kopf ohne Urteil, Versuch 1 bis 3: Neustart', [1, 2, 3].map((v) => los({ kommentare: [], lauf: { ...lauf, run_attempt: v } })), [true, true, true])
gleich('Kopf ohne Urteil, Versuch 4: Schluss (Schleifenschutz; die Wache meldet den Kopf nach 60 min)', los({ kommentare: [], lauf: { ...lauf, run_attempt: 4 } }), false)
// Marken-Pfad („Basis offen“-Kommentar): erst nach grüner Kette neu (trennt `!== success` von `=== success`).
gleich('Marke, Basis offen, Kette rot: kein Neustart', los({ kommentare: [OFFEN()], basisOffen: true, kette: { conclusion: 'failure' } }), false)
gleich('Marke, Basis offen, Kette grün: Neustart', los({ kommentare: [OFFEN()], basisOffen: true, kette: { conclusion: 'success' } }), true)
gleich('Marke, Basis offen, Kette unbekannt (null): kein Neustart', los({ kommentare: [OFFEN()], basisOffen: true, kette: null }), false)
gleich('Marke, Basis nicht offen, Kette rot: Neustart', los({ kommentare: [OFFEN()], basisOffen: false, kette: { conclusion: 'failure' } }), true)
gleich('Kopf ohne Urteil, Basis offen und Kette rot: trotzdem Neustart (es folgt der Kommentar „Basis offen“)', los({ kommentare: [], basisOffen: true, kette: { conclusion: 'failure' } }), true)
gleich('PR geschlossen', los({ pr: pr({ state: 'closed' }) }), false)
gleich('PR Entwurf', los({ pr: pr({ draft: true }) }), false)
gleich('Kopf des PR inzwischen ein anderer', los({ pr: pr({ head: { sha: ALT } }) }), false)
gleich('kein PR', los({ pr: null }), false)
gleich('kein Prüfer-Lauf', los({ lauf: null }), false)
gleich('Grenze: Neustarts erlaubt bis zur Anzahl', MAX_NEUSTARTS, 2)
gleich('zweites Kette-offen: noch Neustart', los({ kommentare: [OFFEN(), OFFEN()] }), true)
gleich('drittes Kette-offen: Schluss (Schleifenschutz)', los({ kommentare: [OFFEN(), OFFEN(), OFFEN()] }), false)
// Läufe ohne Modell (Kette lief beim Start) verbrauchen die Neustart-Grenze nicht (Prüfer-Befund 13.11.2026), echte „Kette offen“ weiter.
const STUB = (kopf = KOPF) => ({ user: { login: BOT }, body: `${OFFEN(kopf).body}\n${MARKE_OHNE_MODELL}\n` })
gleich('drei Läufe ohne Modell: weiter Neustart', los({ kommentare: [STUB(), STUB(), STUB(), STUB()] }), true)
gleich('drei Läufe ohne Modell und drei echte Kette-offen: Schluss', los({ kommentare: [STUB(), STUB(), STUB(), OFFEN(), OFFEN(), OFFEN()] }), false)
gleich('letztesUrteil: neuester zum Kopf, nicht der zum alten Kopf', letztesUrteil([OFFEN(), AENDERN(ALT)], KOPF).body.includes('nicht beurteilt'), true)

// Ablauf mit eingespeistem gh. `laeufe`: Prüfer-Läufe neueste zuerst; `stand`: Status je Abfrage, danach der letzte Wert.
function laufe({ kommentare, laeufe = [lauf], pulls = [pr()], fehlerBei = null }) {
  const aufrufe = []
  const wartet = []
  let abfrage = 0
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    if (fehlerBei && args.join(' ').includes(fehlerBei)) throw new Error('boom')
    if (args[1] === `repos/o/r/commits/${KOPF}/pulls`) return JSON.stringify(pulls)
    if (args[1]?.includes('/workflows/pr-pruefer.yml/runs')) {
      const l = laeufe[Math.min(abfrage++, laeufe.length - 1)]
      return JSON.stringify(l ? [l] : [])
    }
    if (args.includes('--slurp')) return JSON.stringify([kommentare])
    return ''
  }
  const mute = console.log
  const zeilen = []
  console.log = (z) => zeilen.push(z)
  const code = main({ GITHUB_REPOSITORY: 'o/r', KOPF_SHA: KOPF }, { gh, warte: (ms) => wartet.push(ms) })
  console.log = mute
  return { code, aenderungen: aufrufe.filter((a) => a.startsWith('run ')), wartet, zeilen }
}

// Kreislauf: Prüfer sah Kette offen (Kommentar 1) -> Kette endet -> Neustart -> Prüfer sah sie wieder offen (Kommentar 2) -> Neustart -> Kommentar 3: Schluss.
gleich('Kreislauf 1: Kette endet, Marke da: rerun', laufe({ kommentare: [OFFEN()] }).aenderungen, ['run rerun 5'])
gleich('Kreislauf 2: zweiter Kommentar: rerun', laufe({ kommentare: [OFFEN(), OFFEN()] }).aenderungen, ['run rerun 5'])
gleich('Kreislauf 3: dritter Kommentar: kein rerun, Exit 0', (() => { const r = laufe({ kommentare: [OFFEN(), OFFEN(), OFFEN()] }); return [r.aenderungen, r.code] })(), [[], 0])
gleich('Kreislauf: nach Neustart ein echtes aendern: Kette endet erneut, kein rerun', laufe({ kommentare: [OFFEN(), AENDERN()] }).aenderungen, [])
gleich('Kreislauf: nach Neustart ok: kein rerun', laufe({ kommentare: [OFFEN(), OK()] }).aenderungen, [])
// Gegenfall zur Regel: das Prüfer-Urteil „aendern“ bei fertiger Kette bleibt stehen, auch wenn davor „Kette offen“ kam.
gleich('Kettenende ohne jedes Prüfer-Urteil (Prüfer schwieg): genau ein rerun', laufe({ kommentare: [] }).aenderungen, ['run rerun 5'])
// Der Job läuft bei success und failure (nicht bei cancelled; siehe Verdrahtung unten), die Entscheidung hängt nicht von der Konklusion ab: auch eine rote Kette bekommt ihr Urteil.
// Zweites Kettenende desselben Kopfes (Kette neu gestartet), während der Neustart schon läuft: wartet ab, sieht das Urteil, startet nichts mehr.
gleich('zweites Kettenende: Lauf noch offen, dann Urteil da: kein zweiter rerun', laufe({ kommentare: [OK()], laeufe: [{ id: 5, status: 'in_progress', run_attempt: 2 }, lauf] }).aenderungen, [])
gleich('Ausfall des Neustarts (gh-Fehler beim rerun): Exit 1, Zeile FEHLGESCHLAGEN, Kopf bleibt ohne Urteil (Wache nach 60 min)', (() => { const r = laufe({ kommentare: [], fehlerBei: 'run rerun' }); return [r.code, r.zeilen.some((z) => z.includes('FEHLGESCHLAGEN'))] })(), [1, true])
// Prüfer-Lauf läuft beim Kettenende noch: auf sein Ende warten (sein Kommentar entsteht zuletzt), dann entscheiden.
const wartend = laufe({ kommentare: [OFFEN()], laeufe: [{ id: 5, status: 'in_progress' }, { id: 5, status: 'in_progress' }, lauf] })
gleich('Prüfer-Lauf noch offen: zwei Pausen, dann rerun', [wartend.wartet.length, wartend.aenderungen], [2, ['run rerun 5']])
const haengt = laufe({ kommentare: [OFFEN()], laeufe: [{ id: 5, status: 'in_progress' }] })
const SPAET = [...Array(50).fill({ id: 5, status: 'in_progress' }), lauf]
const spaet = laufe({ kommentare: [OFFEN()], laeufe: SPAET })
// Anlass der Prüferauflage (PR 3002): das Kettenende fällt meist mitten in den Prüfer-Lauf (Kettenlog nach ~13 min, Modell danach bis 17 min).
gleich('Prüfer-Lauf endet erst nach 25 min (50 Pausen): trotzdem rerun, kein stiller Verlust', [spaet.wartet.length, spaet.aenderungen, spaet.code], [50, ['run rerun 5'], 0])
gleich('Prüfer-Lauf endet nie: Exit 1 mit Zeile FEHLGESCHLAGEN, kein rerun', [haengt.code, haengt.aenderungen, haengt.zeilen.some((z) => z.includes('FEHLGESCHLAGEN') && z.includes('nicht fertig'))], [1, [], true])
gleich('Prüfer-Lauf endet nie: 56 Pausen à 30 s (28 min)', [haengt.wartet.length, haengt.wartet[0]], [56, 30_000])
gleich('kein offener PR zum Kopf: nichts, Exit 0', (() => { const r = laufe({ kommentare: [OFFEN()], pulls: [] }); return [r.aenderungen, r.code] })(), [[], 0])
gleich('PR zum Kopf geschlossen: nichts', laufe({ kommentare: [OFFEN()], pulls: [pr({ state: 'closed' })] }).aenderungen, [])
const abbruch = laufe({ kommentare: [OFFEN()], fehlerBei: '/issues/7/comments' })
gleich('gh-Fehler beim Kommentar-Abruf: Exit 1, Zeile FEHLGESCHLAGEN', [abbruch.code, abbruch.zeilen.some((z) => z.includes('FEHLGESCHLAGEN Kopf ' + KOPF.slice(0, 9)))], [1, true])
gleich('Kopf fehlt: Exit 1', (() => { const m = console.log; console.log = () => {}; const c = main({ GITHUB_REPOSITORY: 'o/r' }, { gh: () => '', warte: () => {} }); console.log = m; return c })(), 1)

// Verdrahtung: Job, Auslöser und env-Namen aus der YAML.
const wf = parse(fs.readFileSync(new URL('../.github/workflows/pr-pruefer-nachtrag.yml', import.meta.url), 'utf8'))
const job = wf.jobs['nach-kette']
const schritt = job.steps.find((s) => s.name === 'Prüfer nach Kettenende neu starten')
gleich('Job nur beim Ende der Kette eines Pull-Request-Laufs, nicht bei cancelled', job.if, "github.event_name == 'workflow_run' && github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.conclusion != 'cancelled'")
gleich('Schritt ruft das Skript ohne Argumente', schritt.run, 'node tools/pr-pruefer-nach-kette.mjs')
gleich('Kopf kommt aus workflow_run.head_sha, nur über env', schritt.env.KOPF_SHA, '${{ github.event.workflow_run.head_sha }}')
gleich('run enthält keinen Ausdruck', schritt.run.includes('${{'), false)
const pausenMs = haengt.wartet.reduce((s, ms) => s + ms, 0)
gleich('Zeitbudget: Pausen plus 2 min Reserve unter timeout-minutes', pausenMs + 120_000 <= job['timeout-minutes'] * 60_000, true)
// Untergrenze: Prüfer-Job 30 min, Kettenlog nach 13 min -> mindestens 17 min Restdauer müssen abgedeckt sein.
gleich('Wartezeit deckt die Restdauer des Prüfer-Laufs (≥ 17 min)', pausenMs >= 17 * 60_000, true)
gleich('Gruppe trennt Nachtrag (PR-Nummer) und Kettenende (Kopf), cancelled eigene Gruppe', wf.concurrency.group, "pr-pruefer-nachtrag-${{ github.event_name == 'pull_request_target' && 'basis-' || '' }}${{ github.event.issue.number || github.event.workflow_run.head_sha || github.event.pull_request.number }}${{ github.event.workflow_run.conclusion == 'cancelled' && '-abgebrochen' || '' }}")
gleich('Rechte unverändert: Aktionen schreiben, sonst lesen', wf.permissions, { contents: 'read', 'pull-requests': 'read', actions: 'write' })

console.log(`Prüfer-Nachlauf: ${fehler.length === 0 ? 'alle Fälle grün' : fehler.length + ' Fälle rot'}`)
process.exit(fehler.length === 0 ? 0 : 1)
