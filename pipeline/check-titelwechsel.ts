/**
 * Zusicherungen (21.10.2026, Daniel): Wechselt im offenen Panel der Titel — über „Ähnliche Titel“, die Reihen-Spur, `wechsleZu` oder einen
 * Link —, steht das Panel oben und der Tab heißt wie der Titel (Format der Teilseite); Panel zu: Grundtitel. Der Hook läuft wirklich:
 * ein Mini-Dispatcher führt seine Effekte aus (React rendert ohne DOM nicht), `document` ist eine Attrappe. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import * as React from 'react'
import ts from 'typescript'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { useLang } from '../web/src/lib/i18n.tsx'
import { ReihenCover } from '../web/src/components/detail/reihen-cover.tsx'
import { GRUNDTITEL, tabTitel, useTitelwechsel } from '../web/src/components/detail/titelwechsel.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (name: string, ist: unknown, soll: unknown) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), ist)

/* Attrappe des Dokuments: Tab-Titel und der scrollende Panel-Container; `anfragen` zeigt, wonach gesucht wurde. */
const panel = { scrollTop: 0 }
const anfragen: string[] = []
const dok = {
  title: 'Start',
  querySelector: (a: string) => (anfragen.push(a), panel),
}
Object.assign(globalThis, { document: dok })

/* Mini-Dispatcher: führt useEffect bei geänderten Abhängigkeiten aus (vorher das Aufräumen), die übrigen Hooks gibt es hier nicht. */
type Slot = { deps?: readonly unknown[]; aufraeumen?: void | (() => void) }
const intern = (React as unknown as Record<string, { H: unknown }>).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
function hakenLauf<A extends unknown[]>(hook: (...a: A) => void) {
  const slots: Slot[] = []
  const render = (...args: A) => {
    let i = 0
    intern.H = {
      useEffect: (f: () => void | (() => void), deps: readonly unknown[]) => {
        const s = (slots[i] ??= {})
        i++
        const gleichDeps = s.deps !== undefined && deps.length === s.deps.length && deps.every((d, k) => Object.is(d, s.deps![k]))
        if (gleichDeps) return
        if (typeof s.aufraeumen === 'function') s.aufraeumen()
        s.deps = deps
        s.aufraeumen = f()
      },
    }
    try {
      hook(...args)
    } finally {
      intern.H = null
    }
  }
  const schliessen = () => slots.forEach((s) => typeof s.aufraeumen === 'function' && s.aufraeumen())
  return { render, schliessen }
}

const titel = (id: number, name: string, mehr: Partial<Title> = {}): Title =>
  ({ id, titleDe: name, format: 'TV', dubConfidence: 'very-high', streams: [{ platform: 'netflix', dub: true }], ...mehr }) as unknown as Title
const bebop = titel(900101, 'Cowboy Bebop')
const trigun = titel(900102, 'Trigun', { dubConfidence: 'low', streams: [] })

console.log('Titelwechsel im offenen Panel:')
const lauf = hakenLauf(useTitelwechsel)
lauf.render(900101, bebop, true)
gleich('geöffnet: Tab heißt wie der Titel (mit Termin)', dok.title, 'Cowboy Bebop auf Deutsch: Synchro, Streaming und Termine')
gleich('gesucht wird das Detail-Panel', anfragen[0], '[data-panel="titel"]')

panel.scrollTop = 480
lauf.render(900101, bebop, true)
gleich('gleicher Titel, neuer Durchlauf: nicht nach oben', panel.scrollTop, 480)

/* „Ähnliche Titel“, `wechsleZu`, Link: alle ändern nur die Adresse und damit `titleId`. */
lauf.render(900102, trigun, false)
gleich('Wechsel (Ähnliche Titel): Panel oben', panel.scrollTop, 0)
gleich('Wechsel: Tab heißt wie der neue Titel (Format der Teilseite, ohne Termin)', dok.title, 'Trigun: Stand der deutschen Synchro')
gleich('Tab-Titel = Teilseiten-Format', dok.title, tabTitel(trigun, false))

/* Reihen-Spur: der echte Klick der Karte; der Wechsel kommt über die Adresse wie im Betrieb. */
const { t } = useLang()
panel.scrollTop = 300
const teil = { id: 900103, name: 'Bebop Film', format: 'MOVIE', jpYear: 2001 } as unknown as FranchiseMember
const karte = ReihenCover({
  m: teil,
  t,
  offen: false,
  gewaehlt: false,
  gemerkt: false,
  nr: undefined,
  namen: { voll: teil.name, rest: teil.name, kurz: teil.name },
  angaben: '2001',
  gesperrt: false,
  onWaehlen: () => lauf.render(900103, titel(900103, 'Bebop Film'), true),
})
const klickHandler = (karte.props as { onClick: (e: unknown) => void }).onClick
klickHandler({ currentTarget: { closest: () => null } })
gleich('Wechsel (Reihen-Spur): Panel oben', panel.scrollTop, 0)
gleich('Wechsel (Reihen-Spur): Tab heißt wie der Teil', dok.title, 'Bebop Film auf Deutsch: Synchro, Streaming und Termine')

/* Titel noch nicht geladen: Tab bleibt, Panel steht trotzdem oben. */
panel.scrollTop = 200
lauf.render(900104, undefined, false)
gleich('Titel lädt: Panel oben', panel.scrollTop, 0)
gleich('Titel lädt: Tab ist der Grundtitel, nicht der vorige Titel', dok.title, GRUNDTITEL)

lauf.render(900101, bebop, false)
gleich('ohne Termin: kein „und Termine“', dok.title, 'Cowboy Bebop auf Deutsch: Synchro und Streaming')

lauf.schliessen()
gleich('Panel zu: Grundtitel der Ansicht', dok.title, GRUNDTITEL)
const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8')
gleich('Grundtitel = <title> der Startseite', /<title>([^<]*)<\/title>/.exec(html)?.[1], GRUNDTITEL)

/* Verdrahtung: `DetailPanel` ruft den Hook mit der Titelkennung (Syntaxbaum, nicht Text). */
const quelle = readFileSync(new URL('../web/src/components/DetailPanel.tsx', import.meta.url), 'utf8')
function ruft(code: string, name: string): string[][] {
  const treffer: string[][] = []
  const baum = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name) treffer.push(n.arguments.map((a) => a.getText(baum)))
    ts.forEachChild(n, besuche)
  }
  besuche(baum)
  return treffer
}
const aufrufe = ruft(quelle, 'useTitelwechsel')
gleich(
  'DetailPanel ruft useTitelwechsel genau einmal mit titleId, title und „hat Termine“',
  [aufrufe.length, aufrufe[0]],
  [1, ['titleId', 'title', '(data.releasesByTitle.get(titleId)?.length ?? 0) > 0']],
)
const hookQuelle = readFileSync(new URL('../web/src/components/detail/titelwechsel.ts', import.meta.url), 'utf8')
gleich('der Hook behält die Teilen-Adresse des Titels (zog aus DetailPanel um)', ruft(hookQuelle, 'useTeilenAdresse'), [['title']])
gleich('kein zweiter Weg im Panel setzt den Tab-Titel', /document\.title\s*=/.test(quelle), false)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-titelwechsel: ok')
