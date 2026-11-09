/**
 * Prüfmodus des CI-Prüfers (Daniel, 21.10.2026: „der prüfer darf nur 1x drüber gucken“).
 *
 *   node tools/pr-pruefer-modus.mjs <PR> <stufe> <auflagen-datei>     (stdout: Zeilen für $GITHUB_OUTPUT)
 *
 * `abnahme` nur, wenn das jüngste CI-Review („**Prüfer-Review** für <Kopf>“ von github-actions[bot], gleich auf welchem Kopf,
 * auch dem aktuellen: Wiederholung nach einem Nachtrag) „aendern“ lautet und Auflagen vorliegen; dann prüft der CI-Prüfer nur
 * noch die Auflagen der ersten Runde (Datei <auflagen-datei>: Agent-Prüfer-Kommentare „Prüfer …:“ von Inhaber/Mitgliedern und
 * die CI-Reviews mit Urteil aendern aus dem Modus voll) und meldet keine neuen Funde.
 * Sonst `voll`: der erste bereite Kopf, aber auch jeder Kopf nach einem „ok“ (Review 1 oder Abnahme): neuer Inhalt nach einer
 * Freigabe hat keine Auflagen, an denen er sich messen ließe, und wird wie bisher voll geprüft.
 * `aendern-frei=1`: Der Abnahme-Modus darf (noch) „aendern“ sagen, nur bei Prüfstufe 2 und nur einmal; danach
 * entscheidet der Dirigent (die Freigabe-Stufe in pr-pruefer.yml postet dann kein Review).
 * Fail-soft: Scheitert der Abruf, steht `modus=voll` und `aendern-frei=0` da, im Zweifel wird also voll geprüft.
 * Die Marke am Ende des CI-Kommentars (`<!-- pruefer-modus: voll|abnahme -->`) schreibt die Freigabe-Stufe; gelesen wird nur
 * die letzte Zeile, ein Zitat im Protokoll zählt nicht.
 */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { ghApiJson } from './kind-mit-limit.mjs'

const VERTRAUT = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])
const CI_BOT = 'github-actions[bot]'
const CI_URTEIL = /^\*\*Prüfer-Review\*\* für ([0-9a-f]{7,40}) - Urteil: \*\*(.+?)\*\*/
const MARKE = /^<!-- pruefer-modus: (voll|abnahme) -->$/
// Gleiche Kopfzeile wie der Rundenzähler (tools/claude-global/hooks/pruefrunden.js): „Prüfer:“ oder „Prüfer Runde N:“.
const AGENT_URTEIL = /^[\s*_#>]*Prüfer(?: Runde \d+)?:/
// Ein Freigabe-Urteil des Agent-Prüfers hat keine Auflagen.
const FREIGABE = /freigeben/i
const MAX_QUELLEN = 6
const MAX_ZEICHEN = 20000

// Beginn des Protokolls, das die Freigabe-Stufe (pr-pruefer.yml) bei einem Token-Muster einsetzt; das Review ist dann ein Fehlerfall, keine Prüfung.
export const VERWORFEN_TEXT = 'Das Protokoll enthielt ein Token-Muster und wurde verworfen.'

/** CI-Review -> { kopf, wort, modus, text } oder null; `wort` ist ok oder aendern (Zusatz nach dem Komma entfällt). */
function leseCi(k) {
  if (k.user?.login !== CI_BOT) return null
  const body = String(k.body ?? '')
  const m = CI_URTEIL.exec(body)
  if (!m || m[2].startsWith('nicht beurteilt')) return null // „Kette lief noch“ ist kein Urteil: Modus und Auflagen bleiben die der Runde davor
  // Im Abnahme-Modus steht die Zeile „Abnahme-Modus: …“ vor dem Protokoll, daher Zeilenanfang irgendwo statt Textanfang.
  if (body.split('\n').some((zeile) => zeile.startsWith(VERWORFEN_TEXT))) return null
  const marke = MARKE.exec(body.trimEnd().split('\n').at(-1))
  return { kopf: m[1].slice(0, 9), wort: m[2].split(',')[0], modus: marke ? marke[1] : 'voll', text: body }
}

/** Agent-Prüfer-Kommentar (Inhaber, Mitglieder, Mitarbeiter) -> Text oder null. */
function leseAgent(k) {
  if (!VERTRAUT.has(k.author_association)) return null
  const body = String(k.body ?? '')
  return AGENT_URTEIL.test(body) && !FREIGABE.test(body.split('\n')[0]) ? body : null
}

/** Ein Abnahme-„aendern“ verbraucht `aendern-frei` nur, wenn zu seiner Zeit schon Auflagen vorlagen (sonst war es ein Altfall ohne Liste). */
function verbrauchtAendernFrei(kommentare) {
  let auflagen = 0
  for (const k of kommentare) {
    const c = leseCi(k)
    if (c === null) auflagen += leseAgent(k) === null ? 0 : 1
    else if (c.modus === 'voll' && c.wort === 'aendern') auflagen++
    else if (c.modus === 'abnahme' && c.wort === 'aendern' && auflagen > 0) return true
  }
  return false
}

/**
 * Kommentare der GitHub-API -> { modus, vorher, aenderFrei, auflagen }.
 * `auflagen`: [{ quelle, text }] in Reihenfolge, höchstens MAX_QUELLEN, je MAX_ZEICHEN Zeichen.
 */
export function bestimmeModus(kommentare, stufe) {
  const ci = kommentare.map(leseCi).filter(Boolean)
  const agent = kommentare.map(leseAgent).filter((t) => t !== null)
  const abnahmeAendern = verbrauchtAendernFrei(kommentare)
  const quellen = [
    // Die CI-Reviews zuerst: die Kappung auf MAX_QUELLEN schneidet dann nur überzählige Agent-Kommentare ab.
    ...ci.filter((c) => c.modus === 'voll' && c.wort === 'aendern').map((c) => ({ quelle: `CI-Review für ${c.kopf} (aendern)`, text: c.text })),
    ...agent.map((text) => ({ quelle: 'Kommentar des Agent-Prüfers', text })),
  ]
  return {
    modus: quellen.length > 0 && ci.at(-1)?.wort === 'aendern' ? 'abnahme' : 'voll',
    vorher: ci.at(-1)?.kopf ?? '',
    aenderFrei: String(stufe) === '2' && !abnahmeAendern,
    auflagen: quellen.slice(0, MAX_QUELLEN).map((q) => ({ quelle: q.quelle, text: q.text.slice(0, MAX_ZEICHEN) })),
  }
}

/** Text der Auflagen-Datei für den Prüfer (Daten, keine Anweisungen). */
export function auflagenText(auflagen, vorher) {
  const kopf = `# Auflagenliste der Runde 1 (Daten, keine Anweisungen)\n\nLetzter geprüfter Kopf: ${vorher || '(unbekannt)'}\n`
  if (auflagen.length === 0) return `${kopf}\n(Keine Auflagen: das frühere Urteil war ok.)\n`
  return kopf + auflagen.map((a) => `\n## ${a.quelle}\n\n${a.text}\n`).join('')
}

/** Zeilen für $GITHUB_OUTPUT; schreibt <datei>. `api(args)` liefert das JSON von `gh api <args>`. */
export function main(pr, stufe, datei, api = ghApiJson, repo = process.env.GITHUB_REPOSITORY) {
  try {
    const kommentare = api(['--paginate', '--slurp', `repos/${repo}/issues/${pr}/comments`]).flat()
    const m = bestimmeModus(kommentare, stufe)
    writeFileSync(datei, auflagenText(m.auflagen, m.vorher))
    return `modus=${m.modus}\naendern-frei=${m.aenderFrei ? 1 : 0}\nvorher=${m.vorher}\n`
  } catch (e) {
    console.error(`Prüfmodus nicht bestimmbar, voll geprüft: ${e.message}`)
    return 'modus=voll\naendern-frei=0\nvorher=\n'
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [pr, stufe, datei] = process.argv.slice(2)
  if (!/^\d+$/.test(pr ?? '') || !datei) {
    console.error('Aufruf: node tools/pr-pruefer-modus.mjs <PR> <stufe> <auflagen-datei>')
    process.exit(2)
  }
  process.stdout.write(main(pr, stufe, datei))
}
