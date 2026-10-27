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
import type { Suchhinweis } from '../web/src/lib/suchhinweis.ts'
import { aktiveEinheiten } from '../web/src/lib/suchhinweis-filter.ts'
ignoriereCss()
const { SuchHinweis } = await import('../web/src/components/SuchHinweis.tsx')
const { loeseHinweis } = await import('../web/src/components/DatenbankBereich.tsx')
const { useSuchhinweis } = await import('../web/src/lib/use-suchhinweis.ts')
const { DbKopfbereich } = await import('../web/src/components/filter/DbWerkzeug.tsx')

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

interface Eingabe {
  suche: string
  gruppiert: boolean
  ohneSynchro?: boolean
}
interface Bild {
  suche: string
  gruppiert: boolean
  gesamt: number | undefined
  blockade: boolean
}
const gefundenes: { bilder: Bild[]; geloest: Array<[FilterState | undefined, boolean]> } = { bilder: [], geloest: [] }

const keineFavoriten = new Set<number>()

/** Wie die App: Filter und Liste behalten ihre Identität, solange sich nichts ändert (sonst rechnet der Hook endlos neu). */
function Sonde({ suche, gruppiert, ohneSynchro = false }: Eingabe) {
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, search: suche }), [suche])
  const sichtbar = useMemo(() => (ohneSynchro ? fertig : mitSynchro).filter((t) => t.titleDe!.includes(suche)), [suche, ohneSynchro])
  const hinweis = useSuchhinweis({ data, suche, filters, ohneSynchro, gruppiert, sichtbar, favorites: keineFavoriten }, lade)
  gefundenes.bilder.push({ suche, gruppiert, gesamt: hinweis?.zusatz.gesamt, blockade: !!hinweis?.blockade })
  return h(SuchHinweis, { form: 'zeile', hinweis, filters, ohneSynchro, onLoesen: (f, an) => void gefundenes.geloest.push([f, an]) })
}

const knopf = (wurzel: MiniKnoten) => wurzel.finde((k) => k.tagName === 'BUTTON')[0]
const text = (wurzel: MiniKnoten) => wurzel.finde((k) => k.getAttribute('data-suchhinweis') !== null)[0]?.textContent ?? ''

/* Ein Mini-DOM und eine Attrappe-Uhr für alle Läufe; jeder Lauf baut seine Wurzel wieder ab. */
const uhr = attrappeUhr()
const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
const warte = (ms: number) => uhr.schiebe(ms, (f) => act(async () => f()))

async function lauf(eingabe: Eingabe, pauseMs: number) {
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  gefundenes.geloest = []
  gefundenes.bilder = []
  ladeAufrufe = 0
  await act(async () => wurzel.render(h(Sonde, eingabe)))
  const vorher = { text: text(dom.wurzel), geladen: ladeAufrufe }
  await warte(pauseMs)
  await act(async () => {})
  const jetzt = () => ({ text: text(dom.wurzel), geladen: ladeAufrufe, knopf: knopf(dom.wurzel), gesamt: gefundenes.bilder.at(-1)?.gesamt })
  return {
    vorher,
    nachher: jetzt(),
    jetzt,
    wurzel: dom.wurzel,
    /** Neue Eingabe an dieselbe Wurzel (Schalter umlegen, weitertippen). */
    neu: async (e: Eingabe) => {
      gefundenes.bilder = []
      await act(async () => wurzel.render(h(Sonde, e)))
      await act(async () => {})
    },
    abbau: () => act(async () => wurzel.unmount()),
  }
}

console.log('\nSuchhinweis: Hook und Komponente')
{
  const l = await lauf({ suche: 'Attack on Titan', gruppiert: false }, 600)
  pruefe('vor der Pause: nichts geladen, kein Hinweis', l.vorher.geladen === 0 && l.vorher.text === '', l.vorher)
  pruefe('nach der Pause einmal geladen', l.nachher.geladen === 1, l.nachher.geladen)
  pruefe('ungruppiert: 3 Titel ohne Synchro, Knopf „Anzeigen“', l.nachher.text.startsWith('· 3 Treffer ohne Synchro') && l.nachher.knopf?.textContent === 'Anzeigen', l.nachher.text)
  klicke(l.wurzel, l.nachher.knopf!)
  pruefe('Knopf ohne Blockade: nur der Schalter, keine Filteränderung', gefundenes.geloest.length === 1 && gefundenes.geloest[0][0] === undefined && gefundenes.geloest[0][1] === true, gefundenes.geloest)
  await warte(3000)
  pruefe('die Mengen werden nur einmal geladen, auch Sekunden später', ladeAufrufe === 1, ladeAufrufe)
  await l.neu({ suche: 'Attack on Titan', gruppiert: true })
  pruefe('Schalter „Staffeln zusammenfassen“ umgelegt: Zählung wechselt auf Karten (3 → 0)', l.jetzt().gesamt === 0 && l.jetzt().text === '', l.jetzt())
  pruefe('nach dem Umlegen zeigt kein Bild mehr die alte Zahl', gefundenes.bilder.every((b) => b.gesamt !== 3), gefundenes.bilder)
  await l.neu({ suche: 'Attack on Titan', gruppiert: false })
  pruefe('und zurück: wieder 3 Titel', l.jetzt().gesamt === 3, l.jetzt())
  await l.neu({ suche: 'A', gruppiert: false })
  pruefe('weniger als zwei Zeichen: der Hinweis geht, auch im Zwischenbild', gefundenes.bilder.every((b) => b.gesamt === undefined) && l.jetzt().text === '', gefundenes.bilder)
  await l.abbau()
}
{
  const l = await lauf({ suche: 'Attack on Titan', gruppiert: true }, 600)
  pruefe('gruppiert: alle Treffer in der gezeigten Reihe — kein Hinweis, kein Knopf', l.nachher.text === '' && l.nachher.knopf === undefined && l.nachher.gesamt === 0, l.nachher)
  await l.abbau()
}
{
  const l = await lauf({ suche: 'Hajime no Ippo', gruppiert: true }, 600)
  pruefe('gruppiert: eine neue Karte, davon eine exakt', l.nachher.text.startsWith('· 1 Treffer ohne Synchro, davon 1 exakt') && l.nachher.gesamt === 1, l.nachher.text)
  await l.abbau()
}
{
  const l = await lauf({ suche: 'Hajime no Ippo', gruppiert: false }, 600)
  pruefe('ungruppiert: zwei Titel', l.nachher.gesamt === 2, l.nachher.gesamt)
  await l.abbau()
}
{
  for (const gruppiert of [true, false]) {
    const l = await lauf({ suche: 'Hajime no Ippo', gruppiert, ohneSynchro: true }, 600)
    pruefe(`Schalter „ohne Synchro“ an (gruppiert: ${gruppiert}): der exakte Treffer ist da, nichts zu erklären`, l.nachher.text === '' && l.nachher.knopf === undefined && gefundenes.bilder.at(-1)?.blockade === false, l.nachher)
    await l.abbau()
  }
}
{
  const l = await lauf({ suche: 'A', gruppiert: false }, 600)
  pruefe('ein Zeichen: nichts geladen', l.nachher.geladen === 0 && l.nachher.text === '', l.nachher)
  await l.abbau()
}
{
  const l = await lauf({ suche: 'Ab', gruppiert: false }, 600)
  pruefe('zwei Zeichen genügen: geladen', l.nachher.geladen === 1, l.nachher.geladen)
  await l.abbau()
}
{
  const l = await lauf({ suche: 'Attack on Titan', gruppiert: false }, 599)
  pruefe('kurz vor Ablauf der Pause: noch nichts geladen', l.nachher.geladen === 0, l.nachher.geladen)
  await l.abbau()
}

/** Die Komponente allein mit einem fertigen Hinweis: Text, Knopf und was er auslöst. */
async function zeige(hinweis: Suchhinweis, filters: FilterState, ohneSynchro: boolean) {
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  gefundenes.geloest = []
  await act(async () => wurzel.render(h(SuchHinweis, { form: 'darunter', hinweis, filters, ohneSynchro, onLoesen: (f, an) => void gefundenes.geloest.push([f, an]) })))
  const bild = { text: text(dom.wurzel), knopf: knopf(dom.wurzel) }
  if (bild.knopf) klicke(dom.wurzel, bild.knopf)
  await act(async () => wurzel.unmount())
  return { ...bild, geloest: gefundenes.geloest }
}

console.log('\nSuchhinweis: Komponente mit versteckendem Filter')
{
  const jahr = { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' }
  const blockade = (synchro: boolean) => ({ titel: ippoOhne[0], einheiten: aktiveEinheiten(jahr), synchro })
  const nurFilter = await zeige({ zusatz: { gesamt: 0, genau: 0 }, blockade: blockade(false) }, jahr, true)
  pruefe('versteckender Filter: Satz nennt Titel und Filter, Knopf „Filter entfernen“', nurFilter.text.includes('ist ausgeblendet durch: Jahr 2003') && !nurFilter.text.includes('Synchro') && nurFilter.knopf?.textContent === 'Filter entfernen', nurFilter.text)
  pruefe('Knopf: Filter weg, Schalter bleibt', nurFilter.geloest.length === 1 && nurFilter.geloest[0][0]?.years.length === 0 && nurFilter.geloest[0][1] === false, nurFilter.geloest)
  const beides = await zeige({ zusatz: { gesamt: 0, genau: 0 }, blockade: blockade(true) }, jahr, false)
  pruefe('Filter und Schalter: Satz nennt auch die Synchro', beides.text.includes('Jahr 2003, ohne deutsche Synchro'), beides.text)
  pruefe('Knopf: Filter weg und Schalter an', beides.geloest.length === 1 && beides.geloest[0][0]?.years.length === 0 && beides.geloest[0][1] === true, beides.geloest)
  const nurSchalter = await zeige({ zusatz: { gesamt: 1, genau: 1 }, blockade: { titel: ippoOhne[0], einheiten: [], synchro: true } }, EMPTY_FILTERS, false)
  pruefe('nur der Schalter fehlt: „Anzeigen“, der Filter bleibt unberührt', nurSchalter.knopf?.textContent === 'Anzeigen' && nurSchalter.geloest.length === 1 && nurSchalter.geloest[0][0] === undefined && nurSchalter.geloest[0][1] === true, nurSchalter)
  const eine = await zeige({ zusatz: { gesamt: 1, genau: 0 } }, EMPTY_FILTERS, false)
  pruefe('genau eine Karte dazu: der Hinweis steht', eine.text.includes('1 Treffer ohne Synchro'), eine.text)
  const keine = await zeige({ zusatz: { gesamt: 0, genau: 0 } }, EMPTY_FILTERS, false)
  pruefe('keine Karte dazu: kein Hinweis, kein Knopf', keine.text === '' && keine.knopf === undefined, keine)
  const schonAn = await zeige({ zusatz: { gesamt: 4, genau: 0 } }, EMPTY_FILTERS, true)
  pruefe('Schalter schon an: kein Hinweis auf Treffer ohne Synchro', schonAn.text === '' && schonAn.knopf === undefined, schonAn)
}

/** Der Kopf der Datenbank mit fertigem Hinweis: am Rechner in der Zählzeile, am Handy darunter. */
async function kopf(mobil: boolean) {
  const matchMedia = () => ({ matches: mobil, addEventListener() {}, removeEventListener() {} })
  const alt = (window as unknown as { matchMedia: unknown }).matchMedia
  Object.assign(window, { matchMedia })
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  const jahr = { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' }
  const hinweis = { zusatz: { gesamt: 4, genau: 0 }, blockade: { titel: ippoOhne[0], einheiten: aktiveEinheiten(jahr), synchro: false } }
  const nichts = () => {}
  const geloest: Array<[FilterState | undefined, boolean]> = []
  const props = { meta: {}, filters: jahr, onFiltersChange: nichts, favoriteCount: 0, ergebnisse: 2, mitSynchro: 2, suche: 'Attack', sort: 'relevanz', onSortChange: nichts, ohneSynchro: false, onOhneSynchroChange: nichts, laedt: false, grouped: false, onGroupedChange: nichts, hinweis, onHinweisLoesen: (f: FilterState | undefined, an: boolean) => void geloest.push([f, an]) }
  await act(async () => wurzel.render(h(DbKopfbereich, props as unknown as Parameters<typeof DbKopfbereich>[0])))
  const fund = dom.wurzel.finde((k) => k.getAttribute('data-suchhinweis') !== null)
  const bild = { formen: fund.map((k) => k.getAttribute('data-suchhinweis')), text: fund[0]?.textContent ?? '', geloest }
  const taste = fund[0]?.finde((k) => k.tagName === 'BUTTON')[0]
  if (taste) klicke(dom.wurzel, taste)
  await act(async () => wurzel.unmount())
  Object.assign(window, { matchMedia: alt })
  return bild
}

console.log('\nSuchhinweis: Platz im Kopf der Datenbank')
{
  const rechner = await kopf(false)
  pruefe('Rechner: ein Hinweis, in der Zählzeile', rechner.formen.join() === 'zeile' && rechner.text.includes('4 Treffer ohne Synchro') && rechner.text.includes('durch: Jahr 2003'), rechner)
  pruefe('Rechner: der Knopf reicht Filter und Schalter nach oben', rechner.geloest.length === 1 && rechner.geloest[0][0]?.years.length === 0 && rechner.geloest[0][1] === false, rechner.geloest)
  const handy = await kopf(true)
  pruefe('Handy: ein Hinweis, darunter', handy.formen.join() === 'darunter' && handy.text.includes('4 Treffer ohne Synchro') && handy.text.includes('durch: Jahr 2003'), handy)
  pruefe('Handy: der Knopf reicht Filter und Schalter nach oben', handy.geloest.length === 1 && handy.geloest[0][0]?.years.length === 0 && handy.geloest[0][1] === false, handy.geloest)
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
  const loesen = loeseHinweis(p)
  loesen(undefined, true)
  loesen(jahr2003, true)
  loesen(jahr2003, false)
  pruefe('ohne Filter: nur der Schalter', JSON.stringify(aufrufe[0]) === JSON.stringify(['ohne', true]), aufrufe[0])
  pruefe('Filter und Schalter in einem Adresswechsel, die Suche bleibt', JSON.stringify(aufrufe[1]) === JSON.stringify(['navigate', { filters: { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' }, ohne: true }]), aufrufe[1])
  pruefe('nur Filter: der Schalter bleibt unberührt', JSON.stringify(aufrufe[2]) === JSON.stringify(['navigate', { filters: { ...EMPTY_FILTERS, years: [2003], search: 'Ippo' } }]), aufrufe[2])
}

dom.entferne()
if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\ncheck-suchhinweis-lauf: ok (Pause, Zählung gruppiert/ungruppiert, Umlegen, Knopf je Fall, Adresswechsel)')
