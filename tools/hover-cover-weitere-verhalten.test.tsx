// Verhalten: Zeiger auf News-Kachel, Saison-Karte und Ähnliche-Titel-Kachel → nach der Frist erscheint die Vorschau mit dem richtigen Bild.
// Ohne DOM: die Komponente läuft mit einem kleinen Hook-Verteiler, die Frist mit gefälschtem setTimeout.
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import * as React from 'react'
import type { ReactNode } from 'react'
import type { NewsEintrag, Title } from '../shared/types.ts'
import type { Vorschlag } from '../shared/aehnlich.ts'
import type { SaisonZeile } from '../web/src/lib/saison.ts'
import type { Dataset } from '../web/src/lib/data.ts'
import { VORSCHAU_FRIST_MS } from '../web/src/lib/hover-cover.ts'
import { NewsCover } from '../web/src/components/news-kachel.tsx'
import { SaisonKarte } from '../web/src/components/SaisonKarte.tsx'
import { AehnlicheKachel } from '../web/src/components/detail/weitere.tsx'

mock.timers.enable({ apis: ['setTimeout'] })
const keinEreignis = () => {}
Object.assign(globalThis, {
  window: { setTimeout: (...a: Parameters<typeof setTimeout>) => setTimeout(...a), clearTimeout: (id: Parameters<typeof clearTimeout>[0]) => clearTimeout(id), addEventListener: keinEreignis, removeEventListener: keinEreignis, innerHeight: 800 },
  document: { body: { nodeType: 1 }, hidden: false, addEventListener: keinEreignis, removeEventListener: keinEreignis, documentElement: { getBoundingClientRect: () => ({ width: 1200 }) } },
})

type Knoten = { props?: { children?: unknown; [k: string]: unknown }; children?: unknown; $$typeof?: symbol }
const INTERN = (React as unknown as Record<string, { H: unknown }>).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

/** Ein Wurzel-Bauteil mit Zustand über mehrere Aufrufe: `zeichne()` liefert jeweils den aktuellen Baum. */
function wurzel<P>(bauteil: (p: P) => unknown, props: P): () => unknown {
  const speicher: unknown[] = []
  let platz = 0
  const verteiler = {
    useState: (start: unknown) => {
      const k = platz++
      if (!(k in speicher)) speicher[k] = typeof start === 'function' ? (start as () => unknown)() : start
      return [speicher[k], (neu: unknown) => void (speicher[k] = typeof neu === 'function' ? (neu as (v: unknown) => unknown)(speicher[k]) : neu)]
    },
    useRef: (start: unknown) => (speicher[platz] ??= { current: start }, speicher[platz++]),
    useEffect: () => void platz++,
    useContext: (c: { _currentValue: unknown }) => c._currentValue,
    useMemo: (f: () => unknown) => (platz++, f()),
    useCallback: (f: unknown) => (platz++, f),
  }
  return () => {
    platz = 0
    INTERN.H = verteiler
    try {
      return bauteil(props)
    } finally {
      INTERN.H = null
    }
  }
}

/** Alle Knoten des Baums, auch hinter Portalen. */
function alle(baum: unknown, fund: Knoten[] = []): Knoten[] {
  if (Array.isArray(baum)) baum.forEach((k) => alle(k, fund))
  else if (baum && typeof baum === 'object') {
    const k = baum as Knoten
    fund.push(k)
    alle(k.props?.children, fund)
    alle(k.children, fund)
  }
  return fund
}

const zeigerKnoten = (baum: unknown) => alle(baum).find((k) => k.props && 'data-hover-zeile' in k.props)
const portal = (baum: unknown) => alle(baum).find((k) => k.$$typeof === Symbol.for('react.portal'))
/** Die Bild-Adresse der Vorschau-Karte: das Bauteil hinter dem Portal wird ausgeführt und sein `img` gelesen. */
function vorschauBild(baum: unknown): string | undefined {
  const p = portal(baum)
  if (!p) return undefined
  const karte = (p.children as { type: (x: unknown) => unknown; props: unknown }).type((p.children as { props: unknown }).props)
  const dahinter = alle(karte)
  assert.ok(dahinter.some((k) => k.props && 'data-hover-cover' in k.props), 'Karte trägt data-hover-cover')
  return dahinter.find((k) => k.props && typeof k.props.src === 'string')?.props?.src as string
}

const zeigerEreignis = (art: string) => ({ pointerType: art, clientX: 50, currentTarget: { getBoundingClientRect: () => ({ top: 100, bottom: 200 }) } })

function pruefe(name: string, zeichne: () => unknown, cover: string): void {
  let baum = zeichne()
  const z = zeigerKnoten(baum)
  assert.ok(z, `${name}: Zeiger-Knoten fehlt`)
  const props = z.props as { onPointerEnter: (e: unknown) => void; onPointerLeave: () => void }
  assert.equal(portal(baum), undefined, `${name}: vor dem Zeigen keine Karte`)
  props.onPointerEnter(zeigerEreignis('touch'))
  mock.timers.tick(VORSCHAU_FRIST_MS * 2)
  assert.equal(portal(zeichne()), undefined, `${name}: Touch zeigt keine Karte`)
  props.onPointerEnter(zeigerEreignis('mouse'))
  mock.timers.tick(VORSCHAU_FRIST_MS - 1)
  assert.equal(portal(zeichne()), undefined, `${name}: vor der Frist keine Karte`)
  mock.timers.tick(1)
  baum = zeichne()
  assert.equal(vorschauBild(baum), cover, `${name}: nach der Frist die Karte mit dem Bild des Titels`)
  props.onPointerLeave()
  assert.equal(portal(zeichne()), undefined, `${name}: Zeiger weg, Karte weg`)
  props.onPointerEnter(zeigerEreignis('mouse'))
  props.onPointerLeave()
  mock.timers.tick(VORSCHAU_FRIST_MS * 2)
  assert.equal(portal(zeichne()), undefined, `${name}: Verlassen vor der Frist hebt den Timer auf`)
}

pruefe('News', wurzel(NewsCover, { e: { cover: 'https://x.test/news.jpg' } as NewsEintrag }), 'https://x.test/news.jpg')

const titel = { id: 900001, titleDe: 'Testtitel', coverImage: 'https://x.test/titel.jpg' } as unknown as Title
const zeile = { titel, id: 900001, deutsch: true, stufe: 'auf-deutsch', erschienen: true } as SaisonZeile
const daten = { releasesByTitle: new Map() } as unknown as Dataset
pruefe('Saison', wurzel(SaisonKarte, { z: zeile, data: daten, favorit: false, oeffne: keinEreignis }), 'https://x.test/titel.jpg')

const vorschlag = { title: titel, gemeinsam: ['g:Action'] } as unknown as Vorschlag
pruefe('Ähnliche', wurzel(AehnlicheKachel, { v: vorschlag, onOpenTitle: keinEreignis, merkmalName: (m: string): ReactNode => m } as never), 'https://x.test/titel.jpg')

const ohneCover = wurzel(AehnlicheKachel, { v: { ...vorschlag, title: { ...titel, coverImage: undefined } }, onOpenTitle: keinEreignis, merkmalName: (m: string) => m } as never)()
assert.equal(zeigerKnoten(ohneCover), undefined, 'ohne Cover kein Zeiger')

console.log('hover-cover-weitere-verhalten: ok (News, Saison, Ähnliche)')
