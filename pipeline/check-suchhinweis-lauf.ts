/**
 * Lässt den echten Hook `use-suchhinweis.ts` und die Komponente `SuchHinweis.tsx` laufen (react-dom/client auf dem Mini-DOM aus
 * `tools/mini-dom.ts`, Attrappe-Uhr, Attrappe-Lader statt Netz) und den Knopf-Weg `loeseHinweis` aus `DatenbankBereich.tsx`.
 * Die Zählregel selbst prüft `tools/suchhinweis-karten.test.ts`; hier geht es um die Anbindung: Pause vor dem Laden,
 * Zählung in der Einheit der Liste mit beiden Stellungen von „Staffeln zusammenfassen“, Knopf. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import type { Title } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import type { Dataset } from '../web/src/lib/data.ts'
ignoriereCss()
const { SuchHinweis } = await import('../web/src/components/SuchHinweis.tsx')
const { loeseHinweis } = await import('../web/src/components/DatenbankBereich.tsx')
const { useSuchhinweis } = await import('../web/src/lib/use-suchhinweis.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, name: string, franchiseId?: number, ohneSynchro = false): Title =>
  ({ id, franchiseId, titleDe: name, titleEn: name, jpYear: 2000 + id, format: 'TV', genres: [], keywords: [], streams: [], dubConfidence: 'high', ohneSynchro }) as unknown as Title

/* Attack: zwei Staffeln mit Synchro gezeigt, drei ohne (alle in derselben Reihe). Ippo: nur ohne Synchro, eigene Reihe. */
const mitSynchro = [titel(1, 'Attack on Titan', 100), titel(2, 'Attack on Titan Season 2', 100)]
const attackOhne = [3, 4, 5].map((i) => titel(i, `Attack on Titan Teil ${i}`, 100, true))
const ippoOhne = [titel(6, 'Hajime no Ippo', 200, true), titel(7, 'Hajime no Ippo Rising', 200, true)]
const fertig: Title[] = [...mitSynchro, ...attackOhne, ...ippoOhne]
const data = { titles: mitSynchro, titleById: new Map(fertig.map((t) => [t.id, t])), releasesByTitle: new Map(), releases: [], events: [] } as unknown as Dataset

let ladeAufrufe = 0
const lade = async () => {
  ladeAufrufe++
  return { alle: mitSynchro, ohne: [...attackOhne, ...ippoOhne] }
}

interface Antwort {
  gesamt?: number
  genau?: number
}
const gefundenes: { stand?: Antwort; geloest: Array<[FilterState | undefined, boolean]> } = { geloest: [] }

const keineFavoriten = new Set<number>()

/** Wie die App: Filter und Liste behalten ihre Identität, solange sich nichts ändert (sonst rechnet der Hook endlos neu). */
function Sonde({ suche, gruppiert }: { suche: string; gruppiert: boolean }) {
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, search: suche }), [suche])
  const sichtbar = useMemo(() => mitSynchro.filter((t) => t.titleDe!.includes(suche)), [suche])
  const hinweis = useSuchhinweis({ data, suche, filters, ohneSynchro: false, gruppiert, sichtbar, favorites: keineFavoriten }, lade)
  gefundenes.stand = hinweis?.zusatz
  return h(SuchHinweis, { form: 'zeile', hinweis, filters, ohneSynchro: false, onLoesen: (f, an) => void gefundenes.geloest.push([f, an]) })
}

const knopf = (wurzel: MiniKnoten) => wurzel.finde((k) => k.tagName === 'BUTTON')[0]
const text = (wurzel: MiniKnoten) => wurzel.finde((k) => k.getAttribute('data-suchhinweis') !== null)[0]?.textContent ?? ''

/* Ein Mini-DOM und eine Attrappe-Uhr für alle Läufe; jeder Lauf baut seine Wurzel wieder ab. */
const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))

async function lauf(suche: string, gruppiert: boolean, pauseMs: number) {
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  gefundenes.geloest = []
  ladeAufrufe = 0
  await act(async () => wurzel.render(h(Sonde, { suche, gruppiert })))
  const vorher = { text: text(dom.wurzel), geladen: ladeAufrufe }
  await uhr.schiebe(pauseMs, (f) => act(async () => f()))
  await act(async () => {})
  const nachher = { text: text(dom.wurzel), geladen: ladeAufrufe, knopf: knopf(dom.wurzel), stand: gefundenes.stand }
  return { vorher, nachher, wurzel: dom.wurzel, abbau: () => act(async () => wurzel.unmount()) }
}

console.log('\nSuchhinweis: Hook und Komponente')
{
  const l = await lauf('Attack on Titan', false, 600)
  pruefe('vor der Pause: nichts geladen, kein Hinweis', l.vorher.geladen === 0 && l.vorher.text === '', l.vorher)
  pruefe('nach der Pause einmal geladen', l.nachher.geladen === 1, l.nachher.geladen)
  pruefe('ungruppiert: 3 Titel ohne Synchro, Knopf „Anzeigen“', l.nachher.text.startsWith('· 3 Treffer ohne Synchro') && l.nachher.knopf?.textContent === 'Anzeigen', l.nachher.text)
  klicke(l.wurzel, l.nachher.knopf!)
  pruefe('Knopf ohne Blockade: nur der Schalter, keine Filteränderung', gefundenes.geloest.length === 1 && gefundenes.geloest[0][0] === undefined && gefundenes.geloest[0][1] === true, gefundenes.geloest)
  await l.abbau()
}
{
  const l = await lauf('Attack on Titan', true, 600)
  pruefe('gruppiert: alle Treffer in der gezeigten Reihe — kein Hinweis, kein Knopf', l.nachher.text === '' && l.nachher.knopf === undefined && l.nachher.stand?.gesamt === 0, l.nachher)
  await l.abbau()
}
{
  const l = await lauf('Hajime no Ippo', true, 600)
  pruefe('gruppiert: eine neue Karte, davon eine exakt', l.nachher.text.startsWith('· 1 Treffer ohne Synchro, davon 1 exakt') && l.nachher.stand?.gesamt === 1, l.nachher.text)
  await l.abbau()
}
{
  const l = await lauf('Hajime no Ippo', false, 600)
  pruefe('ungruppiert: zwei Titel', l.nachher.stand?.gesamt === 2, l.nachher.stand)
  await l.abbau()
}
{
  const l = await lauf('A', false, 600)
  pruefe('ein Zeichen: nichts geladen', l.nachher.geladen === 0 && l.nachher.text === '', l.nachher)
  await l.abbau()
}
{
  const l = await lauf('Attack on Titan', false, 599)
  pruefe('kurz vor Ablauf der Pause: noch nichts geladen', l.nachher.geladen === 0, l.nachher.geladen)
  await l.abbau()
}

console.log('\nSuchhinweis: Knopf in der Datenbank (loeseHinweis)')
{
  const aufrufe: unknown[] = []
  const p = {
    route: { filters: { ...EMPTY_FILTERS, search: 'Ippo' } },
    navigate: (n: unknown) => void aufrufe.push(['navigate', n]),
    onOhneSynchroChange: (an: boolean) => void aufrufe.push(['ohne', an]),
  } as unknown as Parameters<typeof loeseHinweis>[0]
  const jahr2003 = { ...EMPTY_FILTERS, years: [2003], search: 'alt' }
  loeseHinweis(p, undefined, true)
  loeseHinweis(p, jahr2003, true)
  loeseHinweis(p, jahr2003, false)
  pruefe('ohne Filter: nur der Schalter', JSON.stringify(aufrufe[0]) === JSON.stringify(['ohne', true]), aufrufe[0])
  pruefe('Filter und Schalter in einem Adresswechsel, die Suche bleibt', JSON.stringify(aufrufe[1]) === JSON.stringify(['navigate', { filters: { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' }, ohne: true }]), aufrufe[1])
  pruefe('nur Filter: der Schalter bleibt unberührt', JSON.stringify(aufrufe[2]) === JSON.stringify(['navigate', { filters: { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' } }]), aufrufe[2])
}

dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-suchhinweis-lauf: ok (Pause, Zählung gruppiert/ungruppiert, Knopf, Adresswechsel)')
