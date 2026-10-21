/**
 * Pille und Folgenflaggen lesen denselben Bestand (Tempal, 18.10.2026: Pille „Fg. 1–3“, in der Folgenliste trug nur
 * Folge 1 die Flagge). Zwei Zusicherungen, läuft in `check:logic` (der Bestand: `check-folgenflaggen-bestand.ts`):
 * 1. Fixture: Wochenplan ergänzt Folge 2 und 3 — die Flagge folgt der Pille, Folge 4 bleibt ohne.
 * 2. Verdrahtung: Panel → Nachleger-Zeilen → Folgenbereich reichen die Bereiche der Wege wirklich durch.
 */
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import type { Release, Title } from '../shared/types.ts'
import { deutscheBereicheDerWege, folgeIstDeutsch, titelMitTerminBereichen } from '../web/src/components/detail/stream-bereiche.ts'

const KOMPONENTEN = new URL('../web/src/components/detail/', import.meta.url)
let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

function wochenplan(erschienen: number, gesamt: number): Release {
  const observed: Record<string, string> = {}
  for (let n = 1; n <= gesamt; n++) observed[String(n)] = n <= erschienen ? `2020-01-${String(n).padStart(2, '0')}` : '2099-01-01'
  return {
    slug: 'cr-test',
    titleId: 1,
    name: 'Testserie',
    platform: 'crunchyroll',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2020-01-01', time: '17:00', episodeCount: gesamt, observed },
    sources: [],
  } as unknown as Release
}

function pruefeFixture(): void {
  const roh = {
    id: 1,
    episodes: 12,
    format: 'TV',
    streams: [{ platform: 'crunchyroll', url: 'https://www.crunchyroll.com/de/series/T', dub: true, dubRanges: [{ from: 1, to: 1, dub: true }] }],
  } as unknown as Title
  const wege = deutscheBereicheDerWege(titelMitTerminBereichen(roh, [wochenplan(3, 12)]))
  const de: [number, number][] = [[1, 1]]
  const flaggen = [1, 2, 3, 4, 5].map((n) => folgeIstDeutsch(n, de, wege))
  pruefe('Fixture: Folgen 1–3 mit Flagge, 4 und 5 ohne', JSON.stringify(flaggen) === JSON.stringify([true, true, true, false, false]), flaggen)
  const ohnePlan = deutscheBereicheDerWege(titelMitTerminBereichen(roh, []))
  pruefe('Fixture: ohne Wochenplan bleibt es bei Folge 1', !folgeIstDeutsch(2, de, ohnePlan), ohnePlan)
  pruefe('Fixture: Bereich ohne Ton (dub false) flaggt nicht', !folgeIstDeutsch(9, [], deutscheBereicheDerWege({ streams: [{ platform: 'x', url: '', dubRanges: [{ from: 9, to: 9, dub: false }] }] } as unknown as Title)))
  const bereiche = (...r: [number, number][]) => ({ platform: 'x', url: '', dub: true, dubRanges: r.map(([from, to]) => ({ from, to, dub: true })) })
  const drei = { streams: [bereiche([50, 50]), bereiche([60, 60], [61, 61], [62, 62]), bereiche([70, 70])] } as unknown as Title
  const alle = deutscheBereicheDerWege(drei)
  pruefe('Fixture: drei Wege, fünf Bereiche — jeder flaggt, auch in der Mitte', [50, 60, 61, 62, 70].every((n) => folgeIstDeutsch(n, [], alle)), alle)
  pruefe('Fixture: Fernseh-Folgen der Liste flaggen ohne Weg', folgeIstDeutsch(7, [[5, 8]], []))
}

function quelltext(datei: string): ts.SourceFile {
  return ts.createSourceFile(datei, readFileSync(new URL(datei, KOMPONENTEN), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Alle Knoten der Art, die `prueft` annimmt. */
function sammle<T extends ts.Node>(wurzel: ts.Node, prueft: (n: ts.Node) => n is T): T[] {
  const raus: T[] = []
  const gehe = (n: ts.Node): void => {
    if (prueft(n)) raus.push(n)
    ts.forEachChild(n, gehe)
  }
  gehe(wurzel)
  return raus
}

function pruefeVerdrahtung(): void {
  const attribute = (datei: string, element: string): Record<string, string> => {
    const tags = sammle(quelltext(datei), (n): n is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(n) && n.tagName.getText() === element)
    pruefe(`Verdrahtung: ${datei} enthält genau ein <${element} />`, tags.length === 1, tags.length)
    const raus: Record<string, string> = {}
    for (const a of tags[0]?.attributes.properties ?? []) if (ts.isJsxAttribute(a)) raus[a.name.getText()] = a.initializer?.getText() ?? ''
    return raus
  }
  pruefe('Verdrahtung: Panel reicht die Bereiche der Wege des Titels weiter', attribute('antwort-bereich.tsx', 'FolgenMitNachlegern').wege === '{deutscheBereicheDerWege(title)}')
  pruefe('Verdrahtung: Nachleger-Zeilen reichen wege durch', attribute('nachleger-zeilen.tsx', 'FolgenBereich').wege === '{wege}')
  const aufrufe = sammle(quelltext('folgen-bereich.tsx'), (n): n is ts.CallExpression => ts.isCallExpression(n) && n.expression.getText() === 'folgeIstDeutsch')
  pruefe('Verdrahtung: Folgenbereich flaggt über folgeIstDeutsch(nr, liste.de, wege)', aufrufe.length === 1 && aufrufe[0]!.arguments.map((a) => a.getText()).join('|') === 'nr|liste?.de ?? []|wege', aufrufe.map((a) => a.getText()))
}

pruefeFixture()
pruefeVerdrahtung()
console.log(`check-folgenflaggen: ${fehler ? `${fehler} Fehler` : 'ok'}`)
process.exit(fehler ? 1 : 0)
