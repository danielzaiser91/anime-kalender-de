/**
 * Test für `tools/claude-global/hooks/pruefrunden.js` (PreToolUse auf Agent): ab 3 Runden des Agent-Prüfers auf dem PR wird der Start
 * eines weiteren Prüfers verweigert. gh ist eine Attrappe, die Unterbefehl, PR-Nummer, Repo und --json auswertet; ihr Urteil über
 * falsche Aufrufe steht außerhalb des Hooks (Liste bzw. Protokolldatei), weil der Hook Fehler der Attrappe abfängt.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'claude-global', 'hooks', 'pruefrunden.js')
const { pruefe, antwort, findePr, zaehleUrteile, leseStufe, grenzeFuer } = createRequire(import.meta.url)(hook)

const AGENT = (r) => ({ author: { login: 'danielzaiser91' }, body: `Prüfer: ändern  Kopf: abc (Runde ${r}, Stufe 2)` })
const AGENT_R = (r) => ({ author: { login: 'danielzaiser91' }, body: `Prüfer Runde ${r}: ändern` })
const CI = { author: { login: 'github-actions' }, body: '**Prüfer-Review** für abc - Urteil: **ok**\n\nProtokoll Prüfer' }
const NACHTRAG = { author: { login: 'danielzaiser91' }, body: '## Nachtrag Runde 2\nAuflage des Prüfer: erfüllt' }
const STUFE = { author: { login: 'github-actions' }, body: '<!-- pr-stufe --> **Prüfstufe 2**' }
const P = (body) => ({ author: { login: 'danielzaiser91' }, body })
// Zwischen zwei Runden steht ein Kommentar des Bauers (sein Nachtrag).
const runden = (...urteile) => urteile.flatMap((u) => [u, NACHTRAG])

// Attrappe: liefert nur für `pr view 1400 --repo anime-kalender-de --json comments` die Kommentare. Jeder andere Aufruf wird gemerkt
// und scheitert wie ein echtes gh.
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
  const ausnahmen = []
  const grund = pruefe(auftrag(prompt, typ), { gh: gh(kommentare), warne: (t) => warnungen.push(t), ausnahme: (e) => ausnahmen.push(e) })
  return { grund, warnungen, ausnahmen }
}

// Urteile 0 / 1 / 2 / 3 / 5 bei Stufe 2, der Treffer-Typ steht jeweils in der Mitte der Kommentarliste.
assert.equal(lauf([STUFE, CI, NACHTRAG]).grund, null, '0 Urteile')
assert.equal(lauf([STUFE, AGENT(1), CI]).grund, null, 'Stufe 2: 1 Urteil lässt durch (zweite, letzte Runde)')
const zwei = lauf([STUFE, AGENT(1), CI, NACHTRAG, AGENT_R(2), CI]).grund
assert.match(zwei, /^Eine Prüfrunde \(Stufe 2: zwei\)\. PR 1400 hat schon 2 Prüfer-Urteil\(e\) bei Stufe 2\./, 'Stufe 2: 2 Urteile sperren')
assert.match(zwei, /Nachbesserung nimmt der Dirigent gegen die Auflagenliste ab\./, 'Meldung nennt den Weg')
assert.match(zwei, /\[runde-ausnahme: <Grund>\].*protokolliert.*keine Selbstfreigabe/, 'Meldung nennt die Ausnahme samt Protokoll')
assert.doesNotMatch(zwei, /R4/, 'kein R4 mehr')
assert.ok(lauf([STUFE, AGENT(1), CI, NACHTRAG, AGENT_R(2), NACHTRAG, AGENT(3), CI]).grund, '3 Urteile sperren')
assert.ok(lauf(runden(AGENT(1), AGENT(2), AGENT(3), AGENT(4), AGENT(5))).grund, '5 Urteile sperren')
// CI-Urteile und Nachträge zählen nicht, auch wenn es viele sind.
assert.equal(lauf([CI, NACHTRAG, CI, CI, NACHTRAG, CI, NACHTRAG, AGENT(1)]).grund, null, 'CI-Urteile zählen nicht')
assert.equal(lauf(runden(P('**Prüfer-Review** für abc - Urteil: **ok**'), P('**Prüfer-Review** für def'), P('Prüfer-Review: ok'))).grund, null, 'CI-Kopfzeile zählt auch ohne Bot-Autor nicht')
assert.equal(lauf([{ author: { login: 'x' }, body: null }, AGENT(1), NACHTRAG]).grund, null, 'Kommentar ohne Text zählt nicht und bricht nichts')
assert.ok(lauf(runden({ body: '**Prüfer Runde 2:** ändern' }, AGENT(1), { body: 'Prüfer: ändern' })).grund, 'fett geschriebene Kopfzeile zählt')

// Nachtrag des Prüfers zur selben Runde zählt nicht mit (echte Kopfzeilen: PR 1407, 1435, 1440).
const pr1435 = [STUFE, CI, P('Prüfer: ändern  Kopf `d5de195a6`, mergeable'), P('Prüfer: Nachtrag zum Kommentar oben: Die Zeile'), P('**Nachtrag Runde 2**'), CI, P('Prüfer: ändern (Runde 2, Kopf 7947abec2) – nur wegen Merge-Konflikt'), P('## Nachtrag'), CI]
assert.equal(zaehleUrteile(pr1435), 2, '1435: zwei Runden, drei Prüfer-Kommentare')
assert.ok(lauf(pr1435, 'Prüfer Runde 3: PR 1400 in danielzaiser91/anime-kalender-de').grund, '1435: zwei Runden sperren die dritte')
assert.equal(zaehleUrteile([STUFE, CI, P('Prüfer: ändern  Runde 1, Kopf 37db84597'), P('Prüfer: ändern (Nachtrag zur Zählung) — gefahren waren 22 Mutationen'), P('**Nachtrag nach dem Merge:**')]), 1, '1407: eine Runde')
assert.equal(zaehleUrteile([P('Prüfer: ändern'), CI, P('Prüfer: Nachtrag zur Zeilenangabe')]), 1, 'CI-Kommentar dazwischen trennt keine Runde')
assert.equal(zaehleUrteile([P('Prüfer: ändern'), CI, P('Nachtrag des Bauers'), P('Prüfer: ändern')]), 2, 'Kommentar des Bauers trennt Runden')

// Prüfstufe (21.10.2026): Stufe 2 erlaubt zwei Urteile, jede andere Stufe eines; die Stufe steht im CI-Kommentar.
const STUFE_N = (n, login = 'github-actions') => ({ author: { login }, body: `<!-- pr-stufe -->\n**Prüfstufe ${n}** für abcdef123\n\n- Grund` })
const sperrt = (kommentare) => Boolean(lauf(kommentare).grund)
assert.equal(sperrt([STUFE_N(1), AGENT(1), CI]), true, 'Stufe 1: 1 Urteil sperrt')
assert.equal(sperrt([STUFE_N(0), AGENT(1), CI]), true, 'Stufe 0: 1 Urteil sperrt')
assert.equal(sperrt([STUFE_N(1), CI, NACHTRAG]), false, 'Stufe 1: 0 Urteile lassen durch')
assert.equal(sperrt([STUFE_N(2), AGENT(1), CI]), false, 'Stufe 2: 1 Urteil lässt durch')
assert.equal(sperrt([STUFE_N(2), AGENT(1), CI, NACHTRAG, AGENT_R(2)]), true, 'Stufe 2: 2 Urteile sperren')
assert.equal(sperrt([AGENT(1), CI]), false, 'ohne Stufen-Kommentar gilt Stufe 2: 1 Urteil lässt durch')
assert.equal(sperrt([AGENT(1), CI, NACHTRAG, AGENT_R(2)]), true, 'ohne Stufen-Kommentar: 2 Urteile sperren')
assert.match(lauf([STUFE_N(1), AGENT(1), CI]).grund, /hat schon 1 Prüfer-Urteil\(e\) bei Stufe 1\./, 'Meldung nennt Zahl und Stufe')
// Die Stufe kommt nur vom Bot, der jüngste Kommentar gilt, Stufe 3 oder mehr ist keine Stufe 2.
assert.equal(sperrt([STUFE_N(1, 'danielzaiser91'), AGENT(1), CI]), false, 'Stufen-Kommentar eines Menschen zählt nicht: Stufe 2')
assert.equal(sperrt([STUFE_N(2), AGENT(1), CI, STUFE_N(1)]), true, 'der jüngste Stufen-Kommentar gilt (2 -> 1)')
assert.equal(sperrt([STUFE_N(1), AGENT(1), CI, STUFE_N(2)]), false, 'der jüngste Stufen-Kommentar gilt (1 -> 2)')
assert.equal(sperrt([STUFE_N(3), AGENT(1), CI]), true, 'Stufe 3 ist nicht Stufe 2')
assert.equal(leseStufe([{ author: { login: 'github-actions' }, body: null }]), 2, 'Kommentar ohne Text: Stufe 2')
assert.deepEqual([0, 1, 2, 3].map(grenzeFuer), [1, 1, 2, 1], 'Grenze je Stufe')
// Auch die Stufen-Kommentare des CI trennen keine Runden und zählen nicht als Urteil.
assert.equal(zaehleUrteile([STUFE_N(2), AGENT(1), STUFE_N(2)]), 1, 'Stufen-Kommentar ist kein Urteil')

// Ausnahme wird mitgezählt: nur wenn sie wirklich greift, mit Grund, PR, Urteilen und Stufe.
const mitGrund = 'Prüfe PR 1400 (Stufe 1). [runde-ausnahme: Dirigent erlaubt Schlussrunde]'
const gegriffen = lauf([STUFE_N(1), AGENT(1), CI], mitGrund)
assert.equal(gegriffen.grund, null, 'Ausnahme lässt durch')
assert.deepEqual(gegriffen.ausnahmen, [{ pr: '1400', repo: 'danielzaiser91/anime-kalender-de', urteile: 1, stufe: 1, grund: 'Dirigent erlaubt Schlussrunde' }], 'wirksame Ausnahme steht im Protokoll')
assert.deepEqual(lauf([STUFE_N(2), AGENT(1), CI], mitGrund).ausnahmen, [], 'Ausnahme unter der Grenze greift nicht und wird nicht gezählt')
assert.deepEqual(lauf([STUFE_N(1), AGENT(1), CI], 'Prüfe PR 1400 [runde-ausnahme: kurz]').ausnahmen, [], 'ungültiger Grund wird nicht gezählt')
assert.ok(lauf([STUFE_N(1), AGENT(1), CI], 'Prüfe PR 1400 [runde-ausnahme: kurz]').grund, 'ungültiger Grund sperrt')

// Ausnahme-Marke: mit Grund lässt durch, ohne Grund oder nur ähnlich nicht.
const voll = runden(AGENT(1), AGENT(2), AGENT(3))
const mitPr = 'Prüfe PR 1400 (Stufe 2). '
assert.equal(lauf(voll, `${mitPr}[runde-ausnahme: Dirigent erlaubt R4 wegen Rebase]`).grund, null, 'Ausnahme mit Grund')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: ]`).grund, 'Ausnahme ohne Grund sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme]`).grund, 'Marke ohne Doppelpunkt sperrt')
assert.ok(lauf(voll, `${mitPr}runde-ausnahme: Dirigent erlaubt es`).grund, 'ohne eckige Klammern sperrt')
assert.ok(lauf(voll, `${mitPr}runde-ausnahme: Dirigent erlaubt es]`).grund, 'ohne öffnende Klammer sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: Dirigent erlaubt es`).grund, 'ohne schließende Klammer sperrt')
// Der Platzhalter aus der Verweigerung ist kein Grund; zu kurze Gründe auch nicht (Grenze 8 Zeichen).
const verweigerung = lauf(voll).grund
assert.ok(lauf(voll, `PR 1400 ${verweigerung}`).grund, 'der Satz der Verweigerung öffnet die Sperre nicht')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: <Grund>]`).grund, 'Platzhalter sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: <Dirigent erlaubt es>]`).grund, 'Grund in spitzen Klammern sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: x]`).grund, 'ein Zeichen sperrt')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: abcdefg]`).grund, 'sieben Zeichen sperren')
assert.ok(lauf(voll, `${mitPr}[runde-ausnahme: abcdefg ]`).grund, 'sieben Zeichen mit Leerzeichen sperren')
assert.equal(lauf(voll, `${mitPr}[runde-ausnahme: abcdefgh]`).grund, null, 'acht Zeichen lassen durch')

// Mehrere PR-Nummern im Auftrag: die erste ist das Ziel, die Attrappe kennt nur 1400.
assert.ok(lauf(voll, 'Prüfer Runde 2: PR 1400 in danielzaiser91/anime-kalender-de (Lehre aus PR 1427 und PR 1389)').grund, 'erste PR-Nummer gilt')

// Repo und Nummer aus einer Adresse im Auftrag landen im gh-Aufruf.
const aufrufe = []
const fremdesRepo = (args) => {
  aufrufe.push(args.join(' '))
  return JSON.stringify({ comments: voll })
}
assert.ok(pruefe(auftrag('Prüfe PR https://github.com/danielzaiser91/ticket-board/pull/7'), { gh: fremdesRepo }))
assert.ok(pruefe(auftrag('Prüfe PR 12 im privaten Repo danielzaiser91/ticket-board'), { gh: fremdesRepo }))
assert.deepEqual(aufrufe, ['pr view 7 --repo danielzaiser91/ticket-board --json comments', 'pr view 12 --repo danielzaiser91/ticket-board --json comments'])

// Nur der Typ „pruefer“ genau; ähnliche Typen lassen durch, ohne dass gh läuft.
const ghAufrufe = []
for (const typ of ['pruefer-schlank', 'Pruefer', 'xpruefer', 'pruefer ']) {
  assert.equal(pruefe(auftrag('Prüfe PR 1400', typ), { gh: (a) => ghAufrufe.push(a) }), null, typ)
}
assert.deepEqual(ghAufrufe, [], 'ähnliche Typen starten kein gh')

// Fremde Agententypen und fehlender Typ werden nicht angefasst, auch bei vollem PR.
assert.equal(lauf(voll, undefined, 'general-purpose').grund, null, 'fremder Typ')
assert.equal(pruefe({ tool_input: { prompt: 'Prüfe PR 1400' } }, { gh: () => assert.fail('gh darf nicht laufen') }), null, 'ohne Typ')
assert.equal(pruefe({}, { gh: () => assert.fail('gh darf nicht laufen') }), null, 'ohne tool_input')

// Keine PR-Nummer: durchlassen und nach stderr warnen, gh läuft nicht.
const ohnePr = []
assert.equal(pruefe(auftrag('Prüfe die Änderung im Worktree, kein PR genannt'), { gh: () => assert.fail('gh darf nicht laufen'), warne: (t) => ohnePr.push(t) }), null)
assert.equal(ohnePr.length, 1)
assert.match(ohnePr[0], /^pruefrunden: keine PR-Nummer/)

// Mehrere Repos im Auftrag: durchlassen und warnen, gh läuft nicht.
const mehrere = []
const zweiRepos = 'Prüfe PR 1400 in danielzaiser91/ticket-board, Vergleich mit danielzaiser91/anime-kalender-de'
assert.equal(pruefe(auftrag(zweiRepos), { gh: () => assert.fail('gh darf nicht laufen'), warne: (t) => mehrere.push(t) }), null)
assert.equal(mehrere.length, 1)
assert.match(mehrere[0], /^pruefrunden: Auftrag nennt mehrere Repos, PR 1400/)

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

// PR-Nummer und Repo aus dem Auftrag.
const AK = 'danielzaiser91/anime-kalender-de'
const TB = 'danielzaiser91/ticket-board'
assert.deepEqual(findePr('Prüfe PR 991 in danielzaiser91/anime-kalender-de'), { nummer: '991', repo: AK })
assert.deepEqual(findePr('Prüfe PR #1244 im Repo'), { nummer: '1244', repo: AK })
assert.deepEqual(findePr('Prüfe PR https://github.com/danielzaiser91/ticket-board/pull/7 (Repo)'), { nummer: '7', repo: TB })
assert.equal(findePr('Prüfe PR 7'), null, 'einstellige Nummer ist keine PR-Nummer im Muster')
assert.equal(findePr('ohne Nummer'), null)
// Fremdes Repo ohne Adresse (echte Auftragssätze).
assert.deepEqual(findePr('Prüfe PR 12 im privaten Repo danielzaiser91/ticket-board'), { nummer: '12', repo: TB })
assert.deepEqual(findePr('Prüfe PR 16 in danielzaiser91/ticket-board'), { nummer: '16', repo: TB })
assert.deepEqual(findePr('Prüfe PR 14 im Repo C:/code/ai/ticket-board'), { nummer: '14', repo: TB })
assert.deepEqual(findePr('Prüfe im Repo C:/code/ai/ticket-board: PR 19 (Lehre aus PR 13) und PR 11'), { nummer: '19', repo: TB })
// Worktree-Pfade und das eigene Repo in zwei Schreibweisen sind keine zweite Nennung.
assert.deepEqual(findePr('Prüfe PR 991 in danielzaiser91/anime-kalender-de, Worktree C:/code/ai/_wt-pruef-991'), { nummer: '991', repo: AK })
assert.deepEqual(findePr('Prüfe PR 55 im Repo C:/code/ai/anime-kalender-de (danielzaiser91/anime-kalender-de.)'), { nummer: '55', repo: AK })
assert.deepEqual(findePr('Prüfe PR 56, Worktree C:/code/ai/ak-herkunftsfilter'), { nummer: '56', repo: AK })
assert.deepEqual(findePr('Prüfe PR 57 im Repo C:/code/ai/_wt-pruef-57'), { nummer: '57', repo: AK }, 'ein Worktree-Ordner ist kein Repo')
assert.deepEqual(findePr('Prüfe https://github.com/fremd/projekt/pull/31'), { nummer: '31', repo: 'fremd/projekt' }, 'Adresse mit fremdem Eigentümer')
// Zwei verschiedene Repos: keine Entscheidung.
assert.deepEqual(findePr('Prüfe PR 12 in danielzaiser91/ticket-board und danielzaiser91/anime-kalender-de'), { nummer: '12', repo: null })

// Prozess: Verweigerung als JSON mit deny, Exit 0; kaputte Eingabe lässt durch. Die gh-Attrappe protokolliert in eine Datei.
const attrappe = join(import.meta.dirname, 'pruefrunden-gh-attrappe.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'pruefrunden-'))
const protokoll = join(ordner, 'attrappe.log')
const ausnahmeLog = join(ordner, 'ausnahmen', 'log.jsonl')
const sprozess = (eingabe) => spawnSync(process.execPath, [hook], { input: eingabe, encoding: 'utf8', env: { ...process.env, PRUEFRUNDEN_GH_SKRIPT: attrappe, PRUEFRUNDEN_ATTRAPPE_LOG: protokoll, PRUEFRUNDEN_AUSNAHME_LOG: ausnahmeLog } })
const kaputt = sprozess('kein json')
assert.equal(kaputt.status, 0)
assert.equal(kaputt.stdout, '')
const fremd = sprozess(JSON.stringify(auftrag('Prüfe PR 1400', 'general-purpose')))
assert.equal(fremd.status, 0)
assert.equal(fremd.stdout, '', 'fremder Typ im Prozess: keine Ausgabe')
const gesperrt = sprozess(JSON.stringify(auftrag('Prüfe PR 1400')))
assert.equal(gesperrt.status, 0)
assert.equal(JSON.parse(gesperrt.stdout).hookSpecificOutput.permissionDecision, 'deny', 'Prozess mit Attrappen-gh: 3 Runden sperren')
assert.equal(readFileSync(protokoll, 'utf8'), 'richtig: pr view 1400 --repo danielzaiser91/anime-kalender-de --json comments\n', 'genau ein richtiger gh-Aufruf')
// Ausnahme im Prozess: lässt durch (keine Ausgabe) und hält Grund, PR, Urteile und Stufe in der Protokolldatei fest; ohne Ausnahme entsteht keine.
assert.equal(existsSync(ausnahmeLog), false, 'vor der Ausnahme gibt es kein Protokoll')
const mitAusnahme = sprozess(JSON.stringify(auftrag('Prüfe PR 1400 [runde-ausnahme: Dirigent erlaubt Schlussrunde]')))
assert.equal(mitAusnahme.status, 0)
assert.equal(mitAusnahme.stdout, '', 'Ausnahme im Prozess: keine Sperre')
const zeilen = readFileSync(ausnahmeLog, 'utf8').trimEnd().split('\n').map((z) => JSON.parse(z))
assert.equal(zeilen.length, 1, 'genau ein Protokolleintrag')
assert.deepEqual({ ...zeilen[0], zeit: undefined }, { zeit: undefined, pr: '1400', repo: 'danielzaiser91/anime-kalender-de', urteile: 3, stufe: 2, grund: 'Dirigent erlaubt Schlussrunde' })
assert.match(zeilen[0].zeit, /^\d{4}-\d\d-\d\dT/, 'Zeitstempel')
rmSync(ordner, { recursive: true })
const antwortText = antwort(JSON.stringify(auftrag('Prüfe PR 1400')), { gh: gh(voll) })
const antwortJson = JSON.parse(antwortText).hookSpecificOutput
assert.equal(antwortJson.hookEventName, 'PreToolUse')
assert.equal(antwortJson.permissionDecision, 'deny')
assert.match(antwortJson.permissionDecisionReason, /^Eine Prüfrunde/)
assert.equal(antwort(JSON.stringify(auftrag('Prüfe PR 1400')), { gh: gh([AGENT(1)]) }), '', 'unter der Grenze: leer')

assert.deepEqual(falscheAufrufe, [], 'nur der erwartete gh-Aufruf')

console.log('pruefrunden-hook.test: ok (Urteile 0/1/2/3/5, Stufe 0-3, Ausnahme mit Protokoll, Nachtrag, CI, Ausnahme, Typ, PR-Nummer, Repo, gh-Fehler, Prozess)')
