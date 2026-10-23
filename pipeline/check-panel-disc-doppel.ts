/**
 * Zusicherungen (21.10.2026, Daniel, Your Forma und Saiyuki Reload: Zeroin):
 * (1) Die Einzelausgaben-Liste steht im Panel gleich unter dem Antwort-Kasten, nicht hinter Reihe und Handlung (Syntaxbaum), und
 *     zeigt jede Ausgabe, die der Zähler nennt.
 * (2) Ein Stream-Bezugsweg auf derselben Seite wie ein Verweis ist keine zweite Pille (Lauf durch `sortiereNachZugang`).
 * (3) Der Handbeleg „freenet meinVOD, Deutsch“ zu Your Forma steht in `data/watch-links.yaml`.
 * Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import type { DiscAusgabe, Title } from '../shared/types.ts'
import { DiscEinzelListe } from '../web/src/components/detail/pillen.tsx'
import { einzelneAusgaben } from '../web/src/components/detail/disc-regeln.ts'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { loadWatchLinks } from './lib/curated.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* (1) Reihenfolge der Geschwister im Panel: Antwort-Kasten, Einzelliste, UnterDerAntwort. */
const quelle = readFileSync(new URL('../web/src/components/DetailPanel.tsx', import.meta.url), 'utf8')
function geschwisterNamen(code: string): string[] {
  const baum = ts.createSourceFile('x.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let namen: string[] = []
  const besuche = (n: ts.Node): void => {
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const mine = n.children.flatMap((k) => {
        if (ts.isJsxSelfClosingElement(k)) return [k.tagName.getText(baum)]
        if (ts.isJsxExpression(k) && k.expression && k.getText(baum).includes('<DiscEinzelListe')) return ['DiscEinzelListe']
        return []
      })
      if (mine.includes('DiscEinzelListe')) namen = mine
    }
    ts.forEachChild(n, besuche)
  }
  besuche(baum)
  return namen
}
const namen = geschwisterNamen(quelle)
const i = namen.indexOf('DiscEinzelListe')
pruefe('Einzelliste steht direkt nach dem Antwort-Kasten', i > 0 && namen[i - 1] === 'AntwortBereichOderNichts', namen)
pruefe('Einzelliste steht vor „UnterDerAntwort“ (Reihe, Handlung)', i >= 0 && namen[i + 1] === 'UnterDerAntwort', namen)
pruefe('Quelle von „vorher“ (Liste hinter UnterDerAntwort) wird erkannt', geschwisterNamen('const a = <div><X /><U /> {o && <DiscEinzelListe a={b} />}</div>').join() === 'X,U,DiscEinzelListe')

/* Your Forma, Disc 2 Bände (Zähler 2): die aufgeklappte Liste nennt beide. */
const forma: DiscAusgabe[] = [
  ['Vol. 2/2', 'b', 't', '2026-04-24', 195983],
  ['Vol. 1/2: Limited Edition + Sammelschuber', 'b', 't', '2026-02-27', 196877],
]
const html = renderToStaticMarkup(createElement(DiscEinzelListe, { ausgaben: forma }))
pruefe('Zähler nennt 2 Ausgaben', einzelneAusgaben(forma).length === 2)
pruefe('Liste zeigt beide Ausgaben', html.includes('Vol. 2/2') && html.includes('Vol. 1/2: Limited Edition') && html.includes('195983') && html.includes('196877'), html)

/* (2) Saiyuki: Verweis „Prime Video (Aniverse)“ und Bezugsweg „Amazon Prime (Aniverse)“ auf derselben Seite. */
const prime = 'https://www.amazon.de/gp/video/detail/B0DMFV78H5'
function titel(streams: unknown[], watchLinks: unknown[]): Title {
  return { id: 900001, format: 'TV', streams, watchLinks } as unknown as Title
}
function pillen(t: Title): string[] {
  return sortiereNachZugang({ title: t }).flatMap((g) => [...g.plattformen.map((s) => `stream:${s.url}`), ...g.streamWege.map((w) => `weg:${w.eintraege[0].url}`)])
}
const verweis = { platform: 'primevideo', url: prime, kanal: 'Aniverse', zugang: 'abo' }
const weg = (url: string, kind = 'stream') => ({ name: 'Amazon Prime (Aniverse)', url, kind, zugang: 'abo' })
pruefe('gleiche Seite: eine Pille (der Verweis)', pillen(titel([verweis], [weg(prime)])).join() === `stream:${prime}`, pillen(titel([verweis], [weg(prime)])))
const gti = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.6ce997fe-4a0d-4851-ba34-116bdf1033e8'
pruefe(
  'Verweis mit `seite`: der Bezugsweg auf dieser Seite entfällt',
  pillen(titel([{ ...verweis, url: gti, seite: prime }], [weg(prime)])).join() === `stream:${gti}`,
  pillen(titel([{ ...verweis, url: gti, seite: prime }], [weg(prime)])),
)
const andere = 'https://www.amazon.de/gp/video/detail/B0CJ3GKPHF'
pruefe('andere Seite (andere Prime-Kennung): beide bleiben', pillen(titel([verweis], [weg(andere)])).length === 2, pillen(titel([verweis], [weg(andere)])))
const kauf = sortiereNachZugang({ title: titel([verweis], [{ name: 'Amazon', url: prime, kind: 'buy', zugang: 'kauf' }]) })
pruefe('Kauf-Weg (`buy`) auf derselben Seite bleibt in den Shops', kauf.some((g) => g.shops.length === 1), kauf.map((g) => g.shops.length))
/* Mehrstaffel-Serienadresse: zwei Verweise auf einer Adresse (Staffeln), ein Bezugsweg darauf entfällt, ein anderer Weg bleibt. */
const staffeln = [
  { ...verweis, teilBereich: { von: 1, bis: 12 } },
  { ...verweis, teilBereich: { von: 13, bis: 24 } },
]
const mehr = pillen(titel(staffeln, [weg(prime), weg(andere)]))
pruefe('Mehrstaffel: Bezugsweg auf der Serienadresse entfällt, andere Seite bleibt', mehr.filter((p) => p.startsWith('weg:')).join() === `weg:${andere}`, mehr)

/* (3) Handbeleg freenet. */
const eintrag = loadWatchLinks().find((e) => e.anilistId === 167142)
const freenet = eintrag?.links?.find((l) => /^freenet meinVOD$/.test(l.name))
pruefe('Your Forma: freenet meinVOD mit Deutsch (Folge 1) von Hand belegt', freenet?.dubRanges?.[0]?.dub === true && freenet.dubRanges[0].from === 1 && freenet.kind === 'buy', freenet)
pruefe('Handbeleg nennt seine Adresse als Quelle', Boolean(freenet && eintrag?.sources.includes(freenet.url)), eintrag?.sources)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-panel-disc-doppel: alle Zusicherungen erfüllt')
