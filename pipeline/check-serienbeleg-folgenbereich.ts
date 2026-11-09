/**
 * Serienbeleg ohne Folgenbeleg (Hamtaro [508] und 94 weitere, MyDubList high ohne Weg): Der Folgenbereich der echten Komponente sagt dann,
 * dass die Synchro für die Serie belegt ist, nicht je Folge — und schweigt, wo eine Folge geflaggt ist oder die Serie nicht belegt ist.
 * Dazu die Zählung des Bestandswächters (`lib/serienbeleg-ohne-folgenflagge.ts`) über Fixtures. Läuft in `check:logic`.
 * Aufruf: npx tsx pipeline/check-serienbeleg-folgenbereich.ts
 */
import { readFileSync } from 'node:fs'
import { act, createElement as h } from 'react'
import ts from 'typescript'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
import { serienbelegOhneFlagge, type FolgenListe } from './lib/serienbeleg-ohne-folgenflagge.ts'
ignoriereCss()
const { FolgenBereich } = await import('../web/src/components/detail/folgen-bereich.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const SATZ = 'Die Synchro ist für die Serie belegt, nicht je Folge.'
const folgen = (ids: number[]): [number, string][] => ids.map((nr) => [nr, `Folge ${nr}`])
const LISTEN: Record<string, FolgenListe> = {
  900401: { f: folgen([1, 2, 3]), de: [] },
  900402: { f: folgen([1, 2, 3]), de: [[2, 2]] },
  900403: { f: [], de: [] },
}
globalThis.fetch = (async (adresse: unknown) => {
  const url = String(adresse)
  const treffer = /folgen\/(\d+)\.json/.exec(url)
  const daten = url.includes('folgen/index.json') ? Object.keys(LISTEN).map(Number) : treffer ? LISTEN[treffer[1]!] : undefined
  return { ok: Boolean(daten), status: daten ? 200 : 404, json: async () => daten }
}) as unknown as typeof fetch

/** Rendert den Folgenbereich, klappt ihn auf und liefert seinen Text. */
async function bereichText(id: number, wege: { from: number; to: number }[], serieBelegt: boolean): Promise<string> {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => wurzel.render(h(FolgenBereich, { titleId: id, wege, serieBelegt })))
  await act(async () => Promise.resolve())
  const knopf: MiniKnoten | undefined = dom.wurzel.finde((k) => k.tagName === 'BUTTON')[0]
  if (knopf) await act(async () => klicke(dom.wurzel, knopf))
  const text = (dom.wurzel.textContent ?? '').replace(/\s+/g, ' ')
  await act(async () => wurzel.unmount())
  dom.entferne()
  return text
}

pruefe('Serie belegt, keine Folge geflaggt: der Satz steht da', (await bereichText(900401, [], true)).includes(SATZ))
pruefe('Kontrolle: Serie nicht belegt: kein Satz', !(await bereichText(900401, [], false)).includes(SATZ))
pruefe('Eine Folge geflaggt (Liste `de`): kein Satz', !(await bereichText(900402, [], true)).includes(SATZ))
pruefe('Eine Folge geflaggt (Bereich des Wegs): kein Satz', !(await bereichText(900401, [{ from: 3, to: 3 }], true)).includes(SATZ))
pruefe('Leere Folgenliste: kein Satz', !(await bereichText(900403, [], true)).includes(SATZ))

/* Zählung des Wächters: Kennung des Prüflings, nicht eine Platzhalterzahl. */
const titel = (id: number, dubConfidence: string, extra: object = {}): Title => ({ id, dubConfidence, streams: [], ...extra }) as unknown as Title
const liste = (id: number): FolgenListe | undefined => LISTEN[String(id)]
const ids = serienbelegOhneFlagge(
  [
    titel(900401, 'high'),
    titel(900402, 'high'),
    titel(900403, 'high'),
    titel(900404, 'high'),
    titel(900405, 'very-high', { streams: [{ platform: 'x', url: '', dub: true, dubRanges: [{ from: 1, to: 3, dub: true }] }] }),
    titel(900406, 'low'),
  ],
  (id) => (id === 900405 ? { f: folgen([1, 2, 3]), de: [] } : id === 900406 ? { f: folgen([1]), de: [] } : liste(id)),
)
pruefe('Wächter: nur der belegte Titel ohne jede Flagge zählt (900401); 900402/900405 geflaggt, 900403 leer, 900404 ohne Datei, 900406 nicht belegt', JSON.stringify(ids) === '[900401]', ids)

/* Verdrahtung: Panel → Nachleger-Zeilen → Folgenbereich reichen die Angabe durch (Syntaxbaum, wie check-folgenflaggen.ts). */
function attribute(datei: string, element: string): Record<string, string> {
  const quelle = ts.createSourceFile(datei, readFileSync(new URL(`../web/src/components/detail/${datei}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const tags: ts.JsxSelfClosingElement[] = []
  const gehe = (n: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText() === element) tags.push(n)
    ts.forEachChild(n, gehe)
  }
  gehe(quelle)
  const raus: Record<string, string> = {}
  for (const a of tags.length === 1 ? tags[0]!.attributes.properties : []) if (ts.isJsxAttribute(a)) raus[a.name.getText()] = a.initializer?.getText() ?? ''
  return raus
}
pruefe('Verdrahtung: Panel reicht synchroBelegt(title) weiter', attribute('antwort-bereich.tsx', 'FolgenMitNachlegern').serieBelegt === '{synchroBelegt(title)}')
pruefe('Verdrahtung: Nachleger-Zeilen reichen serieBelegt durch', attribute('nachleger-zeilen.tsx', 'FolgenBereich').serieBelegt === '{serieBelegt}')

console.log(`check-serienbeleg-folgenbereich: ${verletzt ? `${verletzt} Fehler` : 'ok'}`)
process.exit(verletzt ? 1 : 0)
