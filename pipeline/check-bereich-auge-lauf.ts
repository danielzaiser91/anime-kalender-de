/**
 * Das Auge an „Im Fernsehen" / „Im Handel" durch die echte Komponente `KalenderBereich` (Woche): Zustand (`aria-pressed`),
 * Klick (`augeUmschalten` → `navigate` / `setTvAn`), der Kopf bleibt bei ausgeblendeten Einträgen stehen (`zeigeTv`, `vorhanden`),
 * und der TV-Kasten zeigt dann keine „Keine Ausstrahlung". Erfundene Daten, Uhr fest. Aufruf: npx tsx pipeline/check-bereich-auge-lauf.ts
 */
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReleaseEvent } from '../shared/types.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const { KalenderBereich } = await import('../web/src/components/kalender/KalenderBereich.tsx')
const { EMPTY_FILTERS } = await import('../web/src/lib/filters.ts')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TAG = '2026-11-04'
const tv = { id: 'tv1', date: TAG, titleId: 900401, releaseSlug: 'tv-p', platform: 'tv', releaseType: 'weekly', name: 'Probe TV', time: '20:15' } as unknown as ReleaseEvent
const disc = { id: 'd1', date: TAG, titleId: 900402, releaseSlug: 'd-p', platform: 'crunchyroll', releaseType: 'disc', name: 'Probe Disc' } as unknown as ReleaseEvent
const daten = (events: ReleaseEvent[]) =>
  ({ titles: [], titleById: new Map(), releases: [], releaseBySlug: new Map(), events, eventsByDate: new Map(), releasesByTitle: new Map(), meta: {} }) as never

interface Aufruf {
  navigate: unknown[]
  setTvAn: boolean[]
}

/** Rendert die Woche; `roh` = alle Termine des Datensatzes, `sichtbar` = nach Filtern. */
async function rendere(roh: ReleaseEvent[], sichtbar: ReleaseEvent[], tvAn: boolean, filters = EMPTY_FILTERS) {
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({ src: '', srcset: '', sizes: '', decode: () => Promise.resolve() }))
  /* Sprung zu heute und Ziel-Tag suchen im Dokument; hier gibt es nichts zu finden (die Woche hängt nicht von der echten Uhr ab). */
  Object.assign(document, { querySelector: () => null, querySelectorAll: () => [] })
  Object.assign(window, { scrollTo: () => undefined, scrollY: 0 })
  const aufruf: Aufruf = { navigate: [], setTvAn: [] }
  const wurzel = createRoot(dom.wurzel as unknown as Element)
  await act(async () => {
    wurzel.render(
      h(KalenderBereich, {
        data: daten(roh),
        route: { view: 'woche', date: TAG, filters } as never,
        navigate: (n: unknown) => aufruf.navigate.push(n),
        events: sichtbar,
        favorites: new Set<number>(),
        hidden: new Set<number>(),
        onToggleFavorite: () => undefined,
        onToggleHidden: () => undefined,
        tvAn,
        setTvAn: (an: boolean) => aufruf.setTvAn.push(an),
        termine: { alle: [], sichtbar: [] },
      }),
    )
  })
  const augen = (bereich: string): MiniKnoten[] => dom.wurzel.finde((k) => k.attribute.get('data-bereich-auge') === bereich)
  const text = () => (dom.wurzel.textContent ?? '').replace(/\s+/g, ' ')
  const ende = async () => {
    await act(async () => wurzel.unmount())
    dom.entferne()
  }
  return { dom, aufruf, augen, text, ende }
}
const gedrueckt = (k: MiniKnoten | undefined) => k?.attribute.get('aria-pressed')

try {
  /* Beide Bereiche an: Augen offen; ein Tipp aufs TV-Auge schaltet nur den TV-Schalter, ein Tipp aufs Handels-Auge nur den Filter. */
  const a = await rendere([tv, disc], [tv, disc], true)
  pruefe('TV-Auge steht offen (aria-pressed=true)', gedrueckt(a.augen('Im Fernsehen')[0]) === 'true', gedrueckt(a.augen('Im Fernsehen')[0]))
  pruefe('Handels-Auge steht offen', gedrueckt(a.augen('Im Handel')[0]) === 'true')
  await act(async () => klicke(a.dom.wurzel, a.augen('Im Fernsehen')[0]))
  pruefe('Tipp aufs TV-Auge: Schalter aus', a.aufruf.setTvAn.length === 1 && a.aufruf.setTvAn[0] === false, a.aufruf.setTvAn)
  pruefe('Tipp aufs TV-Auge: Disc-Filter bleibt', JSON.stringify(a.aufruf.navigate).includes('"disc"') === false, a.aufruf.navigate)
  await act(async () => klicke(a.dom.wurzel, a.augen('Im Handel')[0]))
  pruefe('Tipp aufs Handels-Auge: Disc ausgeblendet', JSON.stringify(a.aufruf.navigate[1]).includes('"excluded":{') && JSON.stringify(a.aufruf.navigate[1]).includes('"disc"'), a.aufruf.navigate[1])
  pruefe('Tipp aufs Handels-Auge: TV-Schalter unberührt', a.aufruf.setTvAn.length === 1, a.aufruf.setTvAn)
  await a.ende()

  /* TV aus: der Kopf bleibt (Tag hat Fernsehtermine), ohne „Keine Ausstrahlung", Auge geschlossen; Tipp schaltet TV wieder an. */
  const b = await rendere([tv, disc], [disc], false)
  pruefe('TV aus: Kopf und Auge bleiben stehen', b.augen('Im Fernsehen').length === 1)
  pruefe('TV aus: Auge geschlossen (aria-pressed=false)', gedrueckt(b.augen('Im Fernsehen')[0]) === 'false', gedrueckt(b.augen('Im Fernsehen')[0]))
  pruefe('TV aus: kein „Keine Ausstrahlung"', !b.text().includes('Keine Ausstrahlung'))
  await act(async () => klicke(b.dom.wurzel, b.augen('Im Fernsehen')[0]))
  pruefe('Tipp aufs geschlossene TV-Auge: Schalter an', b.aufruf.setTvAn.length === 1 && b.aufruf.setTvAn[0] === true, b.aufruf.setTvAn)
  await b.ende()

  /* TV an, aber nichts gesendet: Kasten mit Hinweis (Gegenfall zu „TV aus"). */
  const c = await rendere([disc], [disc], true)
  pruefe('TV an ohne Sendung: „Keine Ausstrahlung" steht', c.text().includes('Keine Ausstrahlung'))
  await c.ende()

  /* TV aus und der Tag hat gar kein Fernsehen: kein Kasten, kein Auge. */
  const d = await rendere([disc], [disc], false)
  pruefe('TV aus, kein Fernsehtermin am Tag: kein Auge', d.augen('Im Fernsehen').length === 0)
  await d.ende()

  /* Disc ausgeblendet: Kopf bleibt, Auge geschlossen, kein Eintrag; Tipp hebt die Ausblendung auf. */
  const gefiltert = { ...EMPTY_FILTERS, excluded: { ...EMPTY_FILTERS.excluded, releaseTypes: ['disc'] } }
  const e = await rendere([tv, disc], [tv], true, gefiltert as never)
  pruefe('Disc ausgeblendet: Kopf und Auge bleiben', e.augen('Im Handel').length === 1)
  pruefe('Disc ausgeblendet: Auge geschlossen', gedrueckt(e.augen('Im Handel')[0]) === 'false', gedrueckt(e.augen('Im Handel')[0]))
  pruefe('Disc ausgeblendet: Eintrag fehlt', !e.text().includes('Probe Disc'))
  await act(async () => klicke(e.dom.wurzel, e.augen('Im Handel')[0]))
  pruefe('Tipp aufs geschlossene Handels-Auge: Ausblendung aufgehoben', !JSON.stringify(e.aufruf.navigate[0]).includes('"disc"'), e.aufruf.navigate[0])
  await e.ende()
} catch (fehler) {
  verletzt++
  console.error(fehler)
}

if (verletzt) process.exit(1)
console.log('Bereich-Auge-Lauf: alle Zusicherungen halten.')
