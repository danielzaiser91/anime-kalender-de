/**
 * Zusicherungen zum Einstieg in „Entdecken“: Reiter nur ab `md` und fünf feste Plätze am Handy, Knopf der Datenbank
 * (führt in die Ansicht, ist in `DatenbankBereich` eingebaut) und Zeile „Empfehlungen zurücksetzen“ in den Einstellungen
 * (ruft das echte Zurücksetzen). Die Handler werden aus dem gerenderten Baum geholt und ausgeführt.
 * Aufruf: `npm run check:logic`.
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
const { WasGuckenKnopf } = await import('../web/src/components/WasGuckenKnopf.tsx')
const { EmpfehlungZeile } = await import('../web/src/components/Einstellungen.tsx')
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
pruefe('Reiter „Entdecken“ erst ab xl', wasGucken !== null && wasGucken[1].includes('hidden xl:block'), reiter)
pruefe('die vier anderen Reiter ab md (nicht versteckt)', (reiter.match(/hidden xl:block/g) ?? []).length === 1, reiter)
pruefe('bereichVon(entdecken)', bereichVon('entdecken') === 'entdecken')
pruefe('bereichVon(impressum) leer', bereichVon('impressum') === undefined)

const handy = renderToStaticMarkup(h(HandyNavigation, { aktiv: 'entdecken', onView: () => {}, kalender: 'woche', einstellungen: () => {} }))
pruefe('Handy-Leiste: genau fünf Plätze', (handy.match(/<button/g) ?? []).length === 5, handy)
pruefe('Handy-Leiste: kein „Entdecken“', !handy.includes('Entdecken'))

const ziele: unknown[] = []
const knopf = finde(baumVon(() => WasGuckenKnopf({ navigate: (n) => ziele.push(n) })), (e) => e.type === 'button')
knopf?.props.onClick?.()
pruefe('Datenbank-Knopf führt nach entdecken', JSON.stringify(ziele) === '[{"view":"entdecken"}]', ziele)

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
const eingebaut = finde(bereich, (e) => e.type === WasGuckenKnopf)
const eingebautNavigate = eingebaut?.props.navigate as ((n: unknown) => void) | undefined
eingebautNavigate?.({ view: 'entdecken' })
pruefe('Datenbank-Bereich baut den Knopf mit seinem navigate ein', JSON.stringify(dbZiele) === '[{"view":"entdecken"}]', dbZiele)

const zeile = finde(baumVon(() => EmpfehlungZeile({ neuLaden: () => abgerufen.push('NEULADEN') })), (e) => e.type === 'button')
zeile?.props.onClick?.()
pruefe('Einstellungen-Zeile löscht alle drei Schlüssel, danach Neuladen', JSON.stringify(abgerufen) === '["empfehlung:gesehen","empfehlung:verworfen","empfehlung:anbieter","NEULADEN"]', abgerufen)

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

console.log(`empfehlung-sichtbar:${verletzt === 0 ? 'alle Zusicherungen erfüllt' : `${verletzt} verletzt`}`)
process.exit(verletzt === 0 ? 0 : 1)
