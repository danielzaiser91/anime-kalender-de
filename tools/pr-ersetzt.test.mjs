/**
 * Tests für tools/pr-ersetzt.mjs und seine Verdrahtung in `nachrechnen` / `main` von pr-nachrechnen.mjs.
 * Anlass: PR 3318 (Beschreibung „**Ersetzt PR 3239 (CONFLICTING, 3239 schließen):**“) blieb offen, 3239 wurde gemergt (10.11.2026).
 */
import { findeErsetzer, ersetzer, ersetztMeldung } from './pr-ersetzt.mjs'
import { main, nachrechnen } from './pr-nachrechnen.mjs'

const fehler = []
let faelle = 0
const pruefe = (name, ok, info) => {
  faelle++
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

// Wortlaut aus PR 3318 (Beschreibung, gekürzt), Titel erfunden ohne Treffer.
const BODY_3318 = 'Täglicher Lauf des Patch-Notes-Autors. **Ersetzt PR 3239 (CONFLICTING, 3239 schließen):** dessen Commit ist per Cherry-Pick enthalten.'
const p = (number, title, body = '') => ({ number, title, body })
const OFFEN = [p(3300, 'fix: etwas'), p(3318, 'docs(patchnotes): 09.11.', BODY_3318), p(3320, 'feat: anderes', 'siehe PR 3239')]

pruefe('Beschreibung „Ersetzt PR 3239“ -> 3318', findeErsetzer(3239, OFFEN)?.number === 3318)
pruefe('Titel „ersetzt #3239“', findeErsetzer(3239, [p(5, 'x (ersetzt #3239)')])?.number === 5)
pruefe('Titel „ersetzt PR #3239“', findeErsetzer(3239, [p(5, 'ersetzt PR #3239')])?.number === 5)
pruefe('andere Nummer -> null', findeErsetzer(3240, OFFEN) === null)
pruefe('längere Zahl 32391 trifft nicht', findeErsetzer(3239, [p(5, 'ersetzt PR 32391')]) === null)
pruefe('kürzere Zahl 239 trifft nicht', findeErsetzer(239, [p(5, 'ersetzt PR 3239')]) === null)
pruefe('bloße Nennung ohne „ersetzt“ trifft nicht', findeErsetzer(3239, [p(5, 'siehe PR 3239', 'PR 3239 schließen')]) === null)
pruefe('PR ersetzt sich nicht selbst', findeErsetzer(3318, OFFEN) === null)
pruefe('PR schreibt „ersetzt PR <eigene Nummer>“: kein Ersetzer', findeErsetzer(3239, [p(3239, 'x', 'ersetzt PR 3239')]) === null)
pruefe('Selbstnennung wird übersprungen, der echte Ersetzer dahinter gefunden', findeErsetzer(3239, [p(3239, 'x', 'ersetzt PR 3239'), p(3318, 'y', 'ersetzt PR 3239')])?.number === 3318)
// Bewusst: Verneinung zählt als Treffer (Falschtreffer kostet eine Rückfrage, ein verpasster Treffer einen Konflikt-PR).
pruefe('„ersetzt PR 3239 nicht“ zählt bewusst als Treffer', findeErsetzer(3239, [p(5, 'x', 'Das ersetzt PR 3239 nicht.')])?.number === 5)
pruefe('Titel null/Body null stört nicht', findeErsetzer(3239, [{ number: 1, title: null, body: null }]) === null)
pruefe('Meldung im geforderten Wortlaut', ersetztMeldung(3239, { number: 3318 }) === 'PR 3239: ERSETZT durch PR 3318 — nicht mergen, schließen')

// gh-Aufruf: Argumente und Auswertung
{
  const aufrufe = []
  const gh = (args) => {
    aufrufe.push(args.join(' '))
    return JSON.stringify(OFFEN)
  }
  pruefe('ersetzer fragt nur offene PRs mit Titel und Beschreibung', ersetzer(3239, gh)?.number === 3318 && aufrufe.join() === 'pr list --state open --limit 200 --json number,title,body', aufrufe)
  let geworfen = false
  try {
    ersetzer(3239, () => { throw new Error('HTTP 502') })
  } catch {
    geworfen = true
  }
  pruefe('gh-Fehler wird nicht verschluckt', geworfen)
}

// Verdrahtung: nachrechnen / main mit eingespeistem gh, auch bei gemergtem PR (Gegenprobe 3239 am 10.11.2026)
function ghMit(state, offene) {
  const aufrufe = []
  const gh = (args) => {
    const s = args.join(' ')
    aufrufe.push(s)
    if (s.startsWith('pr view')) return JSON.stringify({ number: 3239, state, mergeable: 'UNKNOWN', headRefOid: 'a'.repeat(40), headRefName: 'x' })
    if (s.startsWith('pr list')) return JSON.stringify(offene)
    throw new Error(`unerwartet: ${s}`)
  }
  return { gh, aufrufe }
}
{
  const k = ghMit('MERGED', OFFEN)
  const m = []
  const code = nachrechnen(3239, k.gh, (t) => m.push(t), () => {})
  pruefe('nachrechnen: ersetzter (gemergter) PR -> Exit 3, Meldung', code === 3 && m.join() === 'PR 3239: ERSETZT durch PR 3318 — nicht mergen, schließen', { code, m })
  pruefe('nachrechnen: nichts geschlossen oder geöffnet', k.aufrufe.every((a) => a.startsWith('pr view') || a.startsWith('pr list')), k.aufrufe)
}
{
  const k = ghMit('OPEN', OFFEN)
  const code = main(['3239'], k.gh, () => {}, () => {})
  pruefe('main: ersetzter offener PR -> Exit 3', code === 3, code)
}
{
  const k = ghMit('MERGED', [p(3300, 'fix: etwas')])
  const m = []
  const code = nachrechnen(3239, k.gh, (t) => m.push(t), () => {})
  pruefe('nachrechnen: ohne Ersetzer läuft das alte Urteil (gemergt -> Exit 2, nicht offen)', code === 2 && /nicht offen \(MERGED\)/.test(m.join()), { code, m })
}
{
  const m = []
  const code = main(['3239'], (a) => {
    if (a[0] === 'pr' && a[1] === 'view') return JSON.stringify({ number: 3239, state: 'OPEN', mergeable: 'MERGEABLE', headRefOid: 'a'.repeat(40), headRefName: 'x' })
    throw new Error('HTTP 502')
  }, (t) => m.push(t), () => {})
  pruefe('main: Fehler der Listenabfrage -> Exit 2, nie still grün', code === 2 && /FEHLER/.test(m.join()), { code, m })
}

if (fehler.length > 0) {
  console.error(`pr-ersetzt.test: ${fehler.length} rot`)
  process.exit(1)
}
console.log(`pr-ersetzt.test: ${faelle} Fälle grün`)
