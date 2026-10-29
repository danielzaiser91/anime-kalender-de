/**
 * Zusicherungen zum Einstieg in „Entdecken“: Reiter ab `md` in jeder Breite, fünf feste Plätze am Handy (Entdecken statt Optionen),
 * kein Knopf mehr in der Datenbank.
 * Die Handler werden aus dem gerenderten Baum geholt und ausgeführt.
 */
import { createElement as h, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const g = globalThis as Record<string, unknown>
const abgerufen: string[] = []
g.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
g.localStorage = { getItem: () => null, setItem() {}, removeItem: (k: string) => void abgerufen.push(k) }

const { BEREICHE, bereichVon } = await import('../web/src/lib/bereiche.ts')
const { KopfNavigation } = await import('../web/src/components/KopfNavigation.tsx')
const { HandyNavigation } = await import('../web/src/components/HandyNavigation.tsx')
const { DatenbankBereich } = await import('../web/src/components/DatenbankBereich.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

type Baum = ReactElement<{ children?: ReactNode; onClick?: () => void; [k: string]: unknown }>
function finde(baum: ReactNode, passt: (e: Baum) => boolean): Baum | undefined {
  if (!baum || typeof baum !== 'object') return undefined
  if (Array.isArray(baum)) return baum.map((k) => finde(k, passt)).find((e) => e !== undefined)
  const e = baum as Baum
  if (passt(e)) return e
  return finde(e.props?.children, passt)
}
/** Rendert die Komponente einmal (damit ihre Hooks laufen) und gibt den Baum zurück, den sie geliefert hat. */
function baumVon(komponente: () => ReactNode): ReactNode {
  let baum: ReactNode = null
  const Sonde = () => {
    baum = komponente()
    return null
  }
  renderToStaticMarkup(h(Sonde))
  return baum
}

const reiter = renderToStaticMarkup(h(KopfNavigation, { view: 'woche', aktiv: 'kalender', onView: () => {}, hrefFuer: (z: string) => `#/${z}` }))
pruefe('Reiterliste fest', JSON.stringify(BEREICHE) === JSON.stringify([
  { id: 'kalender', ziel: 'woche' }, { id: 'datenbank', ziel: 'datenbank' }, { id: 'news', ziel: 'news' },
  { id: 'saison', ziel: 'saison' }, { id: 'entdecken', ziel: 'entdecken' },
]), BEREICHE)
pruefe('fünf Reiter', (reiter.match(/<a /g) ?? []).length === 5, reiter)
pruefe('Reiter „Entdecken“ mit Ziel', reiter.includes('href="#/entdecken"') && reiter.includes('Entdecken'))
pruefe('Reiter nur ab md', /<nav[^>]*class="hidden [^"]*md:flex[ "]/.test(reiter), reiter.slice(0, 120))
const wasGucken = /<a [^>]*class="([^"]*)"[^>]*>Entdecken<\/a>/.exec(reiter)
pruefe('Reiter „Entdecken“ in jeder Breite ab md (nicht versteckt)', wasGucken !== null && !wasGucken[1].includes('hidden'), reiter)
pruefe('kein Reiter ist ab xl beschränkt', !reiter.includes('xl:block'), reiter)
pruefe('bereichVon(entdecken)', bereichVon('entdecken') === 'entdecken')
pruefe('bereichVon(impressum) leer', bereichVon('impressum') === undefined)

const handyZiele: unknown[] = []
const handyBaum = baumVon(() => HandyNavigation({ aktiv: 'entdecken', onView: (v) => handyZiele.push(v), kalender: 'woche' }))
const handy = renderToStaticMarkup(h(HandyNavigation, { aktiv: 'entdecken', onView: () => {}, kalender: 'woche' }))
pruefe('Handy-Leiste: genau fünf Plätze', (handy.match(/<button/g) ?? []).length === 5, handy)
pruefe('Handy-Leiste: „Entdecken“ ist der aktive Platz', /aria-current="page"[^>]*>.*?Entdecken/.test(handy), handy)
pruefe('Handy-Leiste: keine „Optionen“', !handy.includes('Optionen'), handy)
finde(handyBaum, (e) => e.type === 'button' && JSON.stringify(e.props.children).includes('Entdecken'))?.props.onClick?.()
pruefe('Handy-Leiste: Entdecken führt nach entdecken', JSON.stringify(handyZiele) === '["entdecken"]', handyZiele)

const route = { filters: { search: '' }, sort: undefined }
const dbZiele: unknown[] = []
const dbProps = {
  data: { meta: { titleCount: 0 } },
  route,
  navigate: (n: unknown) => dbZiele.push(n),
  titles: { liste: [], fundstellen: new Map() },
  quelle: [],
  geladen: false,
  favorites: new Set(),
}
const bereich = baumVon(() => DatenbankBereich(dbProps as unknown as Parameters<typeof DatenbankBereich>[0]))
/** Klickt jeden Knopf im Baum (auch in Unterkomponenten, die sich rendern lassen) und meldet, ob dabei nach „entdecken“ navigiert wurde. */
function fuehrtNachEntdecken(baum: ReactNode, ziele: unknown[], tiefe = 0): boolean {
  const ergebnis = finde(baum, (e) => {
    if (typeof e.props.onClick === 'function') e.props.onClick()
    if (ziele.some((z) => JSON.stringify(z).includes('entdecken'))) return true
    if (typeof e.type !== 'function' || tiefe > 3) return false
    try {
      return fuehrtNachEntdecken(baumVon(() => (e.type as (p: unknown) => ReactNode)(e.props)), ziele, tiefe + 1)
    } catch {
      return false
    }
  })
  return ergebnis !== undefined
}
const Fremd = ({ navigate }: { navigate: (n: unknown) => void }) => h('button', { onClick: () => navigate({ view: 'entdecken' }) }, 'Entdecken')
const fremdZiele: unknown[] = []
pruefe('Prüfung erkennt einen wieder eingebauten Entdecken-Knopf (Gegenprobe)', fuehrtNachEntdecken(h('div', null, h(Fremd, { navigate: (n) => fremdZiele.push(n) })), fremdZiele), fremdZiele)
pruefe('Datenbank-Bereich hat keinen Knopf, der nach entdecken führt', !fuehrtNachEntdecken(bereich, dbZiele), dbZiele)



const { parseHash, hashAufraeumen } = await import('../web/src/lib/router.ts')
pruefe('#/entdecken öffnet die Ansicht', parseHash('#/entdecken').view === 'entdecken')
pruefe('alter geteilter Link #/empfehlung führt dorthin', parseHash('#/empfehlung').view === 'entdecken')
const ersetzt: string[] = []
hashAufraeumen(parseHash('#/empfehlung'), {
  ort: { pathname: '/', search: '', hash: '#/empfehlung' },
  verlauf: { state: null, replaceState: (_s: unknown, _t: string, url?: string | URL | null) => void ersetzt.push(String(url)), pushState() {}, back() {} },
  base: '',
})
pruefe('die Adressleiste zeigt danach #/entdecken', ersetzt.length === 1 && ersetzt[0].endsWith('#/entdecken'), ersetzt)

console.log(`empfehlung-sichtbar: ${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
