/**
 * Tests für tools/zug-freigabe.mjs (Tor der Zug-Reihe). Regeln stehen fest hier: Basis zug, offen, kein Entwurf, kein Konflikt,
 * Kette grün, Prüfer-Ok auf dem aktuellen Kopf; Schalter aus und Abruffehler sind Exit 2, nie „frei“.
 */
import { main, zugFreigabe } from './zug-freigabe.mjs'

const fehler = []
const pruefe = (name, ok, info) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${info === undefined ? '' : ` — ${JSON.stringify(info)}`}`)
}

const KOPF = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'
const ALT = 'ffffffffffffffffffffffffffffffffffffffff'
const T = Date.parse('2026-11-09T10:00:00Z')
const zeit = (min) => new Date(T + min * 60000).toISOString()
const urteil = (kopf, art, min) => ({ author: { login: 'github-actions' }, createdAt: zeit(min), body: `**Prüfer-Review** für ${kopf.slice(0, 9)} - Urteil: **${art}**\n\nText` })
const GRUEN = [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: zeit(0) }]
const ROT = [{ name: 'PR-Prüfkette', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: zeit(0) }]
const OFFEN = [{ name: 'PR-Prüfkette', status: 'IN_PROGRESS', conclusion: '', completedAt: '0001-01-01T00:00:00Z', startedAt: zeit(0) }]
const grundPr = { number: 9, state: 'OPEN', isDraft: false, mergeable: 'MERGEABLE', headRefOid: KOPF, baseRefName: 'zug', statusCheckRollup: GRUEN, comments: [urteil(KOPF, 'ok', 5)] }

function gh(pr) {
  const aufrufe = []
  const f = (args) => {
    aufrufe.push(args.join(' '))
    if (args[0] === 'pr' && args[1] === 'view') return JSON.stringify(pr)
    if (args[0] === 'api' && args[1].endsWith(`/commits/${KOPF}`)) return `${zeit(-60)}\n`
    throw new Error(`unerwarteter Aufruf ${args.join(' ')}`)
  }
  f.aufrufe = aufrufe
  return f
}
const frei = (pr) => zugFreigabe(9, gh({ ...grundPr, ...pr }))

console.log('zugFreigabe: jede Sperre allein')
pruefe('alles in Ordnung -> frei', frei({}).frei === true)
pruefe('Basis main -> nein, nennt die Basis', (() => { const r = frei({ baseRefName: 'main' }); return !r.frei && /Basis ist main/.test(r.gruende[0]) })())
pruefe('Basis fremder Zweig -> nein', frei({ baseRefName: 'feature/x' }).frei === false)
pruefe('geschlossen/gemergt -> nein', frei({ state: 'MERGED' }).frei === false)
pruefe('Entwurf -> nein', frei({ isDraft: true }).gruende.join() === 'Entwurf')
pruefe('Konflikt -> nein', frei({ mergeable: 'CONFLICTING' }).gruende.join() === 'Konflikt')
pruefe('Kette rot -> nein', frei({ statusCheckRollup: ROT }).gruende.join() === 'Kette rot')
pruefe('Kette läuft noch -> nein', frei({ statusCheckRollup: OFFEN }).gruende.join() === 'Kette offen')
pruefe('kein Urteil -> nein', frei({ comments: [] }).gruende.join() === 'kein Urteil auf dem Kopf')
pruefe('Urteil nur für alten Kopf -> nein', frei({ comments: [urteil(ALT, 'ok', 5)] }).frei === false)
pruefe('jüngstes Urteil ändern -> nein', frei({ comments: [urteil(KOPF, 'ok', 5), urteil(KOPF, 'aendern', 9)] }).gruende.join() === 'Prüfer: ändern')
pruefe('Nachtrag-Ok nach ändern -> frei', frei({ comments: [urteil(KOPF, 'aendern', 5), urteil(KOPF, 'ok', 9)] }).frei === true)

// Daniels Urteil ohne Kopf gilt nur, wenn es jünger ist als der Kopf-Commit (Kulisse: Commit bei zeit(-60)).
const danielOk = (min) => ({ author: { login: 'danielzaiser91' }, createdAt: zeit(min), body: 'Prüfer Runde 2: freigeben' })
pruefe('Urteil von Daniel ohne Kopf, älter als der Kopf-Commit -> nein', frei({ comments: [danielOk(-120)] }).frei === false)
pruefe('Urteil von Daniel ohne Kopf, jünger als der Kopf-Commit -> frei', frei({ comments: [danielOk(-30)] }).frei === true)

console.log('main: Exit-Codes und Meldungen')
const lauf = (argv, ghFn, aktiv) => {
  const m = []
  return { code: main(argv, ghFn, (t) => m.push(t), aktiv), m }
}
{
  const a = lauf(['9'], gh(grundPr), true)
  pruefe('frei -> Exit 0, Meldung', a.code === 0 && a.m.join() === 'PR 9: frei für zug', a)
  const b = lauf(['9'], gh({ ...grundPr, statusCheckRollup: ROT }), true)
  pruefe('nicht frei -> Exit 1, Grund in der Meldung', b.code === 1 && /nicht frei – Kette rot/.test(b.m.join()), b)
  const s = gh(grundPr)
  const c = lauf(['9'], s, false)
  pruefe('Schalter aus -> Exit 2, kein gh-Aufruf', c.code === 2 && s.aufrufe.length === 0 && /auf aus/.test(c.m.join()), c)
  const d = lauf(['9'], () => { throw new Error('HTTP 502') }, true)
  pruefe('Abruffehler -> Exit 2, Text enthält FEHLER', d.code === 2 && /FEHLER HTTP 502/.test(d.m.join()), d)
  const e = []
  pruefe('ohne vierten Parameter gilt der eingecheckte Schalter (aus) -> Exit 2', main(['9'], gh(grundPr), (t) => e.push(t)) === 2 && /auf aus/.test(e.join()), e)
  pruefe('kein Argument -> Exit 2', lauf([], gh(grundPr), true).code === 2)
  pruefe('Argument keine Zahl -> Exit 2', lauf(['9x'], gh(grundPr), true).code === 2)
  pruefe('zwei Argumente -> Exit 2', lauf(['9', '10'], gh(grundPr), true).code === 2)
}

if (fehler.length > 0) {
  console.error(`zug-freigabe.test: ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('zug-freigabe.test: alle Fälle grün')
