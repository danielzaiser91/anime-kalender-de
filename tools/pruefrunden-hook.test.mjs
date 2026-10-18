/**
 * Test für `tools/claude-global/hooks/pruefrunden.js` (PreToolUse auf Agent): ab 3 Agent-Prüfer-Urteilen auf dem PR wird der Start
 * eines weiteren Prüfers verweigert. gh ist eine Attrappe, die Unterbefehl, PR-Nummer, Repo und --json auswertet.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'pruefrunden.js')
const { pruefe, antwort, findePr } = createRequire(import.meta.url)(hook)

const AGENT = (r) => ({ author: { login: 'danielzaiser91' }, body: `Prüfer: ändern  Kopf: abc (Runde ${r}, Stufe 2)` })
const AGENT_R = (r) => ({ author: { login: 'danielzaiser91' }, body: `Prüfer Runde ${r}: ändern` })
const CI = { author: { login: 'github-actions' }, body: '**Prüfer-Review** für abc - Urteil: **ok**\n\nProtokoll Prüfer' }
const NACHTRAG = { author: { login: 'danielzaiser91' }, body: '## Nachtrag Runde 2\nAuflage des Prüfer: erfüllt' }
const STUFE = { author: { login: 'github-actions' }, body: '<!-- pr-stufe --> **Prüfstufe 2**' }

// Attrappe: liefert nur für `pr view 1400 --repo anime-kalender-de --json comments` die Kommentare. Jeder andere Aufruf wird gemerkt
// (der Hook fängt Fehler der Attrappe ab, ein assert darin bliebe sonst unsichtbar) und scheitert wie ein echtes gh.
const falscheAufrufe = []
function gh(kommentare) {
  return (args) => {
    const soll = ['pr', 'view', '1400', '--repo', 'danielzaiser91/anime-kalender-de', '--json', 'comments']
    if (args.join(' ') !== soll.join(' ')) {
      falscheAufrufe.push(args.join(' '))
      throw new Error('unerwarteter gh-Aufruf')
    }
    return JSON.stringify({ comments: kommentare })
  }
}
const auftrag = (prompt, typ = 'pruefer') => ({ tool_input: { subagent_type: typ, prompt } })
const lauf = (kommentare, prompt = 'Prüfe PR 1400 in danielzaiser91/anime-kalender-de (Stufe 2)', typ) => {
  const warnungen = []
  const grund = pruefe(auftrag(prompt, typ), { gh: gh(kommentare), warne: (t) => warnungen.push(t) })
  return { grund, warnungen }
}

// Urteile 0 / 2 / 3 / 5, der Treffer-Typ steht jeweils in der Mitte der Kommentarliste.
assert.equal(lauf([STUFE, CI, NACHTRAG]).grund, null, '0 Urteile')
assert.equal(lauf([STUFE, AGENT(1), CI, NACHTRAG, AGENT_R(2), CI]).grund, null, '2 Urteile lassen durch (Runde 3 ist erlaubt)')
const drei = lauf([STUFE, AGENT(1), CI, AGENT_R(2), NACHTRAG, AGENT(3), CI]).grund
assert.match(drei, /^R4 gibt es nicht \(Daniel 18\.10\.2026\)\. Dirigent entscheidet: Teilmerge mit Folgeauftrag oder neuer Schnitt\./, '3 Urteile sperren')
assert.ok(lauf([AGENT(1), AGENT(2), AGENT(3), AGENT(4), AGENT(5)]).grund, '5 Urteile sperren')
// CI-Urteile und Nachträge zählen nicht, auch wenn es viele sind.
assert.equal(lauf([CI, NACHTRAG, CI, CI, NACHTRAG, CI, NACHTRAG, AGENT(1)]).grund, null, 'CI-Urteile zählen nicht')
assert.equal(lauf([{ author: { login: 'x' }, body: null }, AGENT(1), AGENT(2)]).grund, null, 'Kommentar ohne Text zählt nicht und bricht nichts')
assert.ok(lauf([{ body: '**Prüfer Runde 2:** ändern' }, AGENT(1), { body: 'Prüfer: ändern' }]).grund, 'fett geschriebene Kopfzeile zählt')

// Ausnahme-Marke: mit Grund lässt durch, ohne Grund oder nur ähnlich nicht.
const voll = [AGENT(1), AGENT(2), AGENT(3)]
const mitPr = 'Prüfe PR 1400 (Stufe 2). '
assert.equal(lauf(voll, `${mitPr}[runde-ausnahme: Dirigent erlaubt R4 wegen Rebase]`).grund, null, 'Ausnahme mit Grund')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: ]`).grund, 'Ausnahme ohne Grund sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme]`).grund, 'Marke ohne Doppelpunkt sperrt')
assert.ok(lauf(voll, `${mitPr}runde-ausnahme: Grund`).grund, 'ohne eckige Klammern sperrt')
assert.ok(lauf(voll, `${mitPr}runde-ausnahme: Grund]`).grund, 'ohne öffnende Klammer sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: Grund`).grund, 'ohne schließende Klammer sperrt')

// Repo und Nummer aus einer Adresse im Auftrag landen im gh-Aufruf.
const aufrufe = []
const fremdesRepo = (args) => {
  aufrufe.push(args.join(' '))
  return JSON.stringify({ comments: voll })
}
assert.ok(pruefe(auftrag('Prüfe PR https://github.com/danielzaiser91/ticket-board/pull/7'), { gh: fremdesRepo }))
assert.deepEqual(aufrufe, ['pr view 7 --repo danielzaiser91/ticket-board --json comments'])

// Fremde Agententypen und fehlender Typ werden nicht angefasst, auch bei vollem PR.
assert.equal(lauf(voll, undefined, 'general-purpose').grund, null, 'fremder Typ')
assert.equal(pruefe({ tool_input: { prompt: 'Prüfe PR 1400' } }, { gh: () => assert.fail('gh darf nicht laufen') }), null, 'ohne Typ')
assert.equal(pruefe({}, { gh: () => assert.fail('gh darf nicht laufen') }), null, 'ohne tool_input')

// Keine PR-Nummer: durchlassen und nach stderr warnen, gh läuft nicht.
const ohnePr = []
assert.equal(pruefe(auftrag('Prüfe die Änderung im Worktree, kein PR genannt'), { gh: () => assert.fail('gh darf nicht laufen'), warne: (t) => ohnePr.push(t) }), null)
assert.equal(ohnePr.length, 1)
assert.match(ohnePr[0], /^pruefrunden: keine PR-Nummer/)

// gh scheitert (Attrappe schreibt nichts Brauchbares): durchlassen mit Warnung. Auch kaputtes JSON gilt als Fehler.
const fehler = []
const werfe = () => {
  throw new Error('gh: Netz weg')
}
assert.equal(pruefe(auftrag('Prüfe PR 1400'), { gh: werfe, warne: (t) => fehler.push(t) }), null)
assert.match(fehler[0], /^pruefrunden: gh nicht erreichbar.*Netz weg/)
assert.equal(pruefe(auftrag('Prüfe PR 1400'), { gh: () => 'kein json', warne: (t) => fehler.push(t) }), null)
assert.equal(fehler.length, 2)
assert.equal(pruefe(auftrag('Prüfe PR 1400'), { gh: () => '{}', warne: (t) => fehler.push(t) }), null, 'Antwort ohne comments')
assert.equal(fehler.length, 3)

// PR-Nummer aus dem Auftrag: Nummer und Repo, auch aus fremdem Repo.
assert.deepEqual(findePr('Prüfe PR 991 in danielzaiser91/anime-kalender-de'), { nummer: '991', repo: 'danielzaiser91/anime-kalender-de' })
assert.deepEqual(findePr('Prüfe PR #1244 im Repo'), { nummer: '1244', repo: 'danielzaiser91/anime-kalender-de' })
assert.deepEqual(findePr('Prüfe PR https://github.com/danielzaiser91/ticket-board/pull/7 (Repo)'), { nummer: '7', repo: 'danielzaiser91/ticket-board' })
assert.equal(findePr('Prüfe PR 7'), null, 'einstellige Nummer ist keine PR-Nummer im Muster')
assert.equal(findePr('ohne Nummer'), null)

// Prozess: Verweigerung als JSON mit deny, Exit 0; kaputte Eingabe lässt durch.
const attrappe = join(import.meta.dirname, 'pruefrunden-gh-attrappe.mjs')
const sprozess = (eingabe) => spawnSync(process.execPath, [hook], { input: eingabe, encoding: 'utf8', env: { ...process.env, PRUEFRUNDEN_GH_SKRIPT: attrappe } })
const kaputt = sprozess('kein json')
assert.equal(kaputt.status, 0)
assert.equal(kaputt.stdout, '')
const fremd = sprozess(JSON.stringify(auftrag('Prüfe PR 1400', 'general-purpose')))
assert.equal(fremd.status, 0)
assert.equal(fremd.stdout, '', 'fremder Typ im Prozess: keine Ausgabe')
const gesperrt = sprozess(JSON.stringify(auftrag('Prüfe PR 1400')))
assert.equal(gesperrt.status, 0)
assert.equal(JSON.parse(gesperrt.stdout).hookSpecificOutput.permissionDecision, 'deny', 'Prozess mit Attrappen-gh: 3 Urteile sperren')
const antwortText =antwort(JSON.stringify(auftrag('Prüfe PR 1400')), { gh: gh(voll) })
const antwortJson = JSON.parse(antwortText).hookSpecificOutput
assert.equal(antwortJson.hookEventName, 'PreToolUse')
assert.equal(antwortJson.permissionDecision, 'deny')
assert.match(antwortJson.permissionDecisionReason, /^R4 gibt es nicht/)
assert.equal(antwort(JSON.stringify(auftrag('Prüfe PR 1400')), { gh: gh([AGENT(1)]) }), '', 'unter der Grenze: leer')

assert.deepEqual(falscheAufrufe, [], 'nur der erwartete gh-Aufruf')

console.log('pruefrunden-hook.test: ok (Urteile 0/2/3/5, CI, Ausnahme, Typ, PR-Nummer, gh-Fehler, Prozess)')
