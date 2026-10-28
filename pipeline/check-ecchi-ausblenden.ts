/**
 * Zusicherungen zum Ausblenden von Ecchi-Titeln (Daniel, 28.10.2026): Vorgabe aus, Schalter in den Einstellungen,
 * Genre-Filter fehlt, Hinweis in der Datenbank nur bei Treffern, Direktaufruf bleibt möglich.
 * Die Daten kommen über eine Attrappe von `fetch` (Schlüssel = Dateiname) durch die echten Ladefunktionen.
 */
import { createElement as h, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const g = globalThis as Record<string, unknown>
const speicher = new Map<string, string>()
const ereignisse: string[] = []
g.localStorage = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
  removeItem: (k: string) => void speicher.delete(k),
}
g.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: (e: { type: string }) => void ereignisse.push(e.type),
}

const kopf = (id: number, name: string, genres: string[], extra: object = {}) =>
  ({ id, slug: `t-${id}`, titleRomaji: name, titleEn: name, genres, keywords: [], streams: [], ...extra })
const TITEL = [
  kopf(900001, 'Frostwind Seduction', ['Ecchi', 'Comedy']),
  kopf(900002, 'Frostwind Chronicle', ['Fantasy']),
  kopf(900003, 'Salzmond Seduction', ['Ecchi'], { ohneSynchro: true }),
]
const dateien: Record<string, unknown> = {
  'titles-core.json': TITEL.slice(0, 2),
  'titles.json': TITEL.slice(0, 2),
  'releases.json': [
    { slug: 'r-1', titleId: 900001, name: 'Frostwind Seduction' },
    { slug: 'r-2', titleId: 900002, name: 'Frostwind Chronicle' },
  ],
  'events.json': [
    { id: 'e1', releaseSlug: 'r-1', titleId: 900001, date: '2999-01-01' },
    { id: 'e2', releaseSlug: 'r-2', titleId: 900002, date: '2999-01-01' },
  ],
  'meta.json': { genres: ['Comedy', 'Ecchi', 'Fantasy'] },
  'ohne-synchro-namen.json': [TITEL[2]],
  'empfehlung.json': {
    pool: 2,
    genres: ['Fantasy', 'Ecchi'],
    keywords: [],
    reihe: {},
    einstiege: [
      { id: 1, n: 'A', g: [0], k: [], p: [] },
      { id: 2, n: 'B', g: [0, 1], k: [], p: [] },
    ],
  },
}
g.fetch = async (url: string) => {
  const datei = String(url).split('?')[0].split('/').pop() ?? ''
  const inhalt = dateien[datei]
  return { ok: inhalt !== undefined, status: inhalt === undefined ? 404 : 200, json: async () => inhalt }
}

const { ecchiZeigen, ecchiSetzen, istEcchi, ohneEcchi, versteckteEcchi, vergissVersteckte, istAusgeblendet } = await import('../web/src/lib/ecchi.ts')
const { loadDataset, loadAllTitles, loadOhneSynchroNamen } = await import('../web/src/lib/data.ts')
const { zaehleVersteckteEcchiTreffer } = await import('../web/src/lib/ecchi-hinweis.ts')
const { hoereAufEinstellungen } = await import('../web/src/lib/einstellungen-offen.ts')
const { EMPTY_FILTERS } = await import('../web/src/lib/filters.ts')
const { nachZahlGeordnet, genreAnzeige } = await import('../web/src/lib/filter-liste.ts')
const { ohneEcchiEinstiege } = await import('../web/src/lib/empfehlung-daten.ts')
const { EcchiZeile } = await import('../web/src/components/Einstellungen.tsx')
const { EcchiHinweis } = await import('../web/src/components/EcchiHinweis.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const ids = (liste: { id: number }[]) => liste.map((t) => t.id).join(',')

type Baum = ReactElement<{ children?: ReactNode; [k: string]: unknown }>
function finde(baum: ReactNode, passt: (e: Baum) => boolean): Baum | undefined {
  if (!baum || typeof baum !== 'object') return undefined
  if (Array.isArray(baum)) return baum.map((k) => finde(k, passt)).find((e) => e !== undefined)
  const e = baum as Baum
  if (passt(e)) return e
  return finde(e.props?.children, passt)
}
function baumVon(komponente: () => ReactNode): ReactNode {
  let baum: ReactNode = null
  renderToStaticMarkup(h(() => ((baum = komponente()), null)))
  return baum
}

// Vorgabe und Schalter
pruefe('Vorgabe: ausblenden', ecchiZeigen() === false)
ecchiSetzen(true)
pruefe('Schalter an: zeigen', ecchiZeigen() === true)
ecchiSetzen(false)
pruefe('Schalter wieder aus: Schlüssel gelöscht, Vorgabe gilt', ecchiZeigen() === false && speicher.size === 0, [...speicher])
pruefe('istEcchi: nur das Genre, nicht der Name', istEcchi(TITEL[0] as never) && !istEcchi(TITEL[1] as never) && !istEcchi(kopf(900009, 'Ecchi', ['Fantasy']) as never))

// Filter der Titelliste
vergissVersteckte()
pruefe('ohneEcchi blendet aus', ids(ohneEcchi(TITEL as never[], false)) === '900002', ids(ohneEcchi(TITEL as never[], false)))
pruefe('ohneEcchi merkt die ausgeblendeten', ids(versteckteEcchi()) === '900001,900003', ids(versteckteEcchi()))
vergissVersteckte()
pruefe('ohneEcchi mit Schalter an: alle, nichts gemerkt', ids(ohneEcchi(TITEL as never[], true)) === '900001,900002,900003' && versteckteEcchi().length === 0)
pruefe('istAusgeblendet folgt dem Schalter', istAusgeblendet(TITEL[0] as never) && !istAusgeblendet(TITEL[1] as never) && !istAusgeblendet(undefined))

// Datensatz: Listen ohne Ecchi, Nachschlagen mit
vergissVersteckte()
const data = await loadDataset()
pruefe('Datensatz: Titelliste ohne Ecchi', ids(data.titles) === '900002', ids(data.titles))
pruefe('Datensatz: Termine ohne Ecchi', data.events.map((e) => e.id).join() === 'e2' && data.releases.map((r) => r.slug).join() === 'r-2')
pruefe('Datensatz: Termine nach Datum ohne Ecchi', (data.eventsByDate.get('2999-01-01') ?? []).map((e) => e.id).join() === 'e2')
pruefe('Direktaufruf: Titel, Release und Termine des Ecchi-Titels bleiben nachschlagbar', data.titleById.has(900001) && data.releaseBySlug.has('r-1') && (data.releasesByTitle.get(900001) ?? []).length === 1)
pruefe('Genre-Filter „Ecchi“ fehlt', data.meta.genres.join() === 'Comedy,Fantasy', data.meta.genres)
ecchiSetzen(true)
const offen = await loadDataset()
pruefe('Schalter an: alle Titel, Termine und der Genre-Filter', ids(offen.titles) === '900001,900002' && offen.events.length === 2 && offen.meta.genres.includes('Ecchi'))
const zaehlung = new Map<string, number>([['Ecchi', 9], ['Comedy', 1]])
const genreAnsichten = (d: typeof data) => {
  const geordnet = nachZahlGeordnet(d.meta.genres, zaehlung)
  return [genreAnzeige(geordnet, [], false, false), genreAnzeige(geordnet, [], true, false), genreAnzeige(geordnet, [], false, true)]
}
pruefe('Genre-Liste (Filter aus 2297): Ecchi weder in Vorschlägen noch bei „alle anzeigen“ noch in der Suche', genreAnsichten(data).every((a) => !a.sichtbar.includes('Ecchi')), genreAnsichten(data))
pruefe('Genre-Liste mit Schalter an: Ecchi steht als häufigstes vorn, auch in „alle“ und der Suche', genreAnsichten(offen).every((a) => a.sichtbar[0] === 'Ecchi'), genreAnsichten(offen))
ecchiSetzen(false)

// Datenbank-Liste und Namensindex
const alle = await loadAllTitles(data)
pruefe('Datenbank-Liste ohne Ecchi', ids(alle) === '900002', ids(alle))
const namen = await loadOhneSynchroNamen()
pruefe('Namensindex ohne Synchro ohne Ecchi', namen.length === 0, ids(namen))

// Suchhinweis
const heute = '2026-10-28'
const suche = (s: string) => ({ ...EMPTY_FILTERS, search: s })
const zaehle = (s: string, ohne = false) => zaehleVersteckteEcchiTreffer(data, suche(s), heute, new Set<number>(), ohne)
pruefe('Hinweis: Suche trifft einen versteckten Titel → 1', zaehle('seduction') === 1, zaehle('seduction'))
pruefe('Hinweis: ohne Suchbegriff → 0', zaehle('') === 0 && zaehle('   ') === 0)
pruefe('Hinweis: Suche ohne Ecchi-Treffer → 0', zaehle('chronicle') === 0)
pruefe('Hinweis: versteckter Titel ohne Synchro zählt erst mit dem Schalter', zaehle('salzmond') === 0 && zaehle('salzmond', true) === 1)
const ohneSuche = h(EcchiHinweis, { data, filters: suche(''), favorites: new Set<number>(), ohneSynchro: false, titles: alle })
pruefe('Hinweis: ohne Treffer steht nichts da', renderToStaticMarkup(ohneSuche) === '')
const mitSuche = renderToStaticMarkup(h(EcchiHinweis, { data, filters: suche('seduction'), favorites: new Set<number>(), ohneSynchro: false, titles: alle }))
pruefe('Hinweis: Satz mit Zahl und Sprung zu den Einstellungen', mitSuche.includes('Ein Ecchi-Titel ausgeblendet') && mitSuche.includes('>Einstellungen<'), mitSuche)
const mehr = renderToStaticMarkup(h(EcchiHinweis, { data, filters: suche('seduction'), favorites: new Set<number>(), ohneSynchro: true, titles: alle }))
pruefe('Hinweis: Mehrzahl mit Zahl', mehr.includes('2 Ecchi-Titel ausgeblendet'), mehr)
const knopf = finde(baumVon(() => EcchiHinweis({ data, filters: suche('seduction'), favorites: new Set<number>(), ohneSynchro: false, titles: alle })), (e) => e.type === 'button')
const klickeHinweis = knopf?.props.onClick as (() => void) | undefined
klickeHinweis?.()
pruefe('Hinweis: der Knopf löst das Öffnen der Einstellungen aus', ereignisse.join() === 'ak-einstellungen', ereignisse)

// Schalter in den Einstellungen
const neu: string[] = []
const zeile = baumVon(() => EcchiZeile({ neuLaden: () => neu.push('NEULADEN') }))
const kasten = finde(zeile, (e) => e.type === 'input')
pruefe('Einstellungen: Kästchen ist aus (Vorgabe)', kasten?.props.defaultChecked === false, kasten?.props)
const umlegen = kasten?.props.onChange as (e: unknown) => void
umlegen({ target: { checked: true } })
pruefe('Einstellungen: Anlegen speichert und lädt neu', ecchiZeigen() && neu.join() === 'NEULADEN')
umlegen({ target: { checked: false } })
pruefe('Einstellungen: Ausschalten blendet wieder aus', !ecchiZeigen() && neu.length === 2)
pruefe('Einstellungen: Beschriftung', renderToStaticMarkup(h(() => EcchiZeile({}))).includes('Ecchi-Titel zeigen'))

// Entdecken
const emp = dateien['empfehlung.json'] as Parameters<typeof ohneEcchiEinstiege>[0]
pruefe('Entdecken: Einstiege mit Ecchi-Genre fehlen', ohneEcchiEinstiege(emp, false).einstiege.map((k) => k.id).join() === '1')
pruefe('Entdecken: mit Schalter an alle', ohneEcchiEinstiege(emp, true).einstiege.length === 2)
pruefe('Entdecken: Datei ohne Ecchi-Genre bleibt gleich', ohneEcchiEinstiege({ ...emp, genres: ['Fantasy'] }, false).einstiege.length === 2)

// Das Öffnen der Einstellungen aus der Ansicht heraus (App.tsx nutzt denselben Hörer)
const hoerer: Record<string, () => void> = {}
const abgemeldet: string[] = []
const abmelden = hoereAufEinstellungen(
  { addEventListener: (art: string, f: () => void) => void (hoerer[art] = f), removeEventListener: (art: string) => void abgemeldet.push(art) } as never,
  () => ereignisse.push('GEOEFFNET'),
)
hoerer['ak-einstellungen']?.()
pruefe('Einstellungen öffnen sich auf das Ereignis', ereignisse.at(-1) === 'GEOEFFNET', ereignisse)
abmelden()
pruefe('Abmelden entfernt den Hörer', abgemeldet.join() === 'ak-einstellungen')

if (verletzt) {
  console.error(`✖ Ecchi ausblenden: ${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('Ecchi ausblenden: Vorgabe aus, Schalter, Genre-Filter, Direktaufruf, Hinweis nur bei Treffern, Entdecken — alle Zusicherungen erfüllt')
