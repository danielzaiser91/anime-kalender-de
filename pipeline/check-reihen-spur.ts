/**
 * Zusicherungen für die Reihen-Box als Cover-Karussell (Daniel, 20.10.2026, F54): Sprungweite, Pfeile, Startposition, Tooltip bei langem Namen,
 * Klick auf ein Cover (wählt den Teil) und die Zustände ohne Daten (Reihe mit einem Teil, Suche ohne Treffer, nur Teile ohne Synchro).
 * Gerendert wird mit `renderToStaticMarkup`; der Klick läuft über den echten `onClick` der Karte. Aufruf: `npm run check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { useLang } from '../web/src/lib/i18n.tsx'
import { Tooltip } from '../web/src/components/ui.tsx'
import { ReihenCover, type CoverProps } from '../web/src/components/detail/reihen-cover.tsx'
import { ReihenListe } from '../web/src/components/detail/reihen-liste.tsx'
import { PfeilPaar } from '../web/src/components/detail/reihen-spur.tsx'
import {
  brauchtTooltip,
  COVER_DICHTE,
  coverDichte,
  nachbarKarte,
  PANEL_KENNUNG,
  setzeStart,
  springeSpur,
  sprungZiel,
  pfeilZustand,
  sprungWeite,
  sprungVerhalten,
  startPosition,
  verfolgeSpur,
} from '../web/src/components/detail/reihen-spur-regeln.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}
const gleich = (name: string, ist: unknown, soll: unknown) => pruefe(name, JSON.stringify(ist) === JSON.stringify(soll), ist)

const { t } = useLang()

/* Sprungweite: so viele ganze Karten (120 + 8 Lücke), wie hineinpassen, mindestens eine. Handy 319 px → 2, Panel 456 px → 3. */
gleich('Handy: 319 px = 2 Karten', sprungWeite(319), 256)
gleich('Panel: 456 px = 3 Karten', sprungWeite(456), 384)
gleich('genau 3 Karten: 384 px', sprungWeite(384), 384)
gleich('knapp unter 3 Karten: 383 px = 2', sprungWeite(383), 256)
gleich('schmaler als eine Karte: mindestens eine', sprungWeite(100), 128)
gleich('Breite 0: mindestens eine', sprungWeite(0), 128)

/* Pfeile: ohne Überlauf fehlen sie (Toleranz 1 px), am Anfang ist „zurück“ aus, am Ende „weiter“. */
gleich('kein Überlauf: versteckt', pfeilZustand(0, 300, 300).versteckt, true)
gleich('Überlauf 1 px: noch versteckt', pfeilZustand(0, 300, 301).versteckt, true)
gleich('Überlauf 2 px: sichtbar', pfeilZustand(0, 300, 302).versteckt, false)
gleich('Anfang: zurück aus, weiter an', pfeilZustand(0, 300, 700), { versteckt: false, zurueckAus: true, weiterAus: false })
gleich('Mitte: beide an', pfeilZustand(50, 300, 700), { versteckt: false, zurueckAus: false, weiterAus: false })
gleich('1 px vom Ende: weiter aus', pfeilZustand(399, 300, 700).weiterAus, true)
gleich('2 px vom Ende: weiter an', pfeilZustand(398, 300, 700).weiterAus, false)
gleich('Ende: zurück an, weiter aus', pfeilZustand(400, 300, 700), { versteckt: false, zurueckAus: false, weiterAus: true })
gleich('1 px vom Anfang: zurück aus', pfeilZustand(1, 300, 700).zurueckAus, true)
gleich('2 px vom Anfang: zurück an', pfeilZustand(2, 300, 700).zurueckAus, false)

/* Startposition: die Sprungkante, die den gewählten Teil enthält. */
gleich('Teil am Anfang', startPosition(0, 256), 0)
gleich('Teil knapp vor der ersten Kante', startPosition(255, 256), 0)
gleich('Teil auf der ersten Kante', startPosition(256, 256), 256)
gleich('Teil weit hinten', startPosition(700, 256), 512)

/* Tooltip ab 29 Zeichen; Pfeiltasten bleiben an den Enden stehen. */
pruefe('28 Zeichen: kein Tooltip', !brauchtTooltip('x'.repeat(28)))
pruefe('29 Zeichen: Tooltip', brauchtTooltip('x'.repeat(29)))
gleich('Pfeil rechts aus der Mitte', nachbarKarte(1, 3, 'ArrowRight'), 2)
gleich('Pfeil rechts am Ende bleibt', nachbarKarte(2, 3, 'ArrowRight'), 2)
gleich('Pfeil links aus der Mitte', nachbarKarte(2, 3, 'ArrowLeft'), 1)
gleich('Pfeil links am Anfang bleibt', nachbarKarte(0, 3, 'ArrowLeft'), 0)
gleich('andere Taste ändert nichts', nachbarKarte(1, 3, 'Enter'), undefined)
gleich('Cover-Dichte 2', COVER_DICHTE, 2)
gleich('Datensparen: Dichte 1', coverDichte(true, 1.5), 1)
gleich('sonst Dichte der Kacheln', coverDichte(false, 1.5), 1.5)
gleich('Pfeilsprung gleitet', sprungVerhalten(false), 'smooth')
gleich('weniger Bewegung: springt', sprungVerhalten(true), 'auto')

/* Pfeilsprung: Richtung bestimmt das Vorzeichen, „weniger Bewegung“ das Verhalten (Handy 319 px = 256, Panel 456 px = 384: verschiedene Werte). */
gleich('weiter, Panel 456 px', sprungZiel(1, 456, false), { left: 384, behavior: 'smooth' })
gleich('zurück: negatives left', sprungZiel(-1, 319, false), { left: -256, behavior: 'smooth' })
gleich('weniger Bewegung: auto', sprungZiel(1, 319, true), { left: 256, behavior: 'auto' })

/* Start: Spur steht an der Sprungkante des gewählten Teils (offsetLeft 700, 319 px breit → Kante 512); ohne gewählte Karte unverändert. */
const startSpur = { clientWidth: 319, scrollLeft: 77 }
setzeStart(startSpur, { offsetLeft: 700 })
gleich('Start bei offsetLeft 700 = 512', startSpur.scrollLeft, 512)
setzeStart(startSpur, null)
gleich('ohne gewählte Karte bleibt die Spur', startSpur.scrollLeft, 512)
setzeStart(startSpur, { offsetLeft: 0 })
gleich('Start bei offsetLeft 0 = 0', startSpur.scrollLeft, 0)

/* Die Panel-Kennung ist die Quelle für `useTitelwechsel` (Panel nach oben beim Titelwechsel, `pipeline/check-titelwechsel.ts`). */
gleich('Panel-Kennung wie in tools/ansicht-adressen.mjs', PANEL_KENNUNG, 'titel')

/* Die Karte: Klick wählt den Teil (das Hochscrollen macht der Titelwechsel im Panel); der gewählte Teil tut nichts. */
const teil = (id: number, name: string, mehr: Partial<FranchiseMember> = {}): FranchiseMember =>
  ({ id, name, format: 'TV', jpYear: 2020, episodes: 12, ...mehr }) as FranchiseMember
const kartenProps = (m: FranchiseMember, mehr: Partial<CoverProps> = {}): CoverProps => ({
  m,
  t,
  offen: false,
  gewaehlt: false,
  gemerkt: false,
  nr: undefined,
  namen: { voll: m.name, rest: m.name, kurz: m.name },
  angaben: '2020 · 12 Fg.',
  gesperrt: false,
  onWaehlen: () => {},
  ...mehr,
})
function klick(gewaehlt: boolean): number[] {
  const gewaehlte: number[] = []
  const element = ReihenCover(kartenProps(teil(900001, 'Kurz'), { gewaehlt, onWaehlen: (id) => gewaehlte.push(id) }))
  const onClick = (element.props as { onClick: () => void }).onClick
  onClick()
  return gewaehlte
}
gleich('Klick: der Teil wird gewählt', klick(false), [900001])
gleich('gewählter Teil: keine Wahl', klick(true), [])

/* Langer Name: der Tooltip trägt den vollen Namen; kurzer Name und kein Name ohne Tooltip. */
const MARKE_TOOLTIP = 'relative inline-flex items-center w-full min-w-0'
const lang = teil(900002, 'Reihe Staffel 4 Der lange Untertitel der Staffel')
const langMarkup = renderToStaticMarkup(
  createElement(() => ReihenCover(kartenProps(lang, { namen: { voll: lang.name, rest: 'Staffel 4 Der lange Untertitel der Staffel', kurz: 'Staffel 4 Der lange Untertitel der Staffel' } }))),
)
pruefe('langer Name: Tooltip-Hülle', langMarkup.includes(MARKE_TOOLTIP))
pruefe('langer Name: voller Name im Text lesbar', langMarkup.includes('Staffel 4 Der lange Untertitel der Staffel'))
const kurzMarkup = renderToStaticMarkup(createElement(() => ReihenCover(kartenProps(teil(900003, 'Kurz')))))
pruefe('kurzer Name: keine Tooltip-Hülle', !kurzMarkup.includes(MARKE_TOOLTIP))
pruefe('ohne Merken kein Stern', !kurzMarkup.includes('★'))
const gemerktMarkup = renderToStaticMarkup(createElement(() => ReihenCover(kartenProps(teil(900003, 'Kurz'), { gemerkt: true }))))
pruefe('gemerkt: Stern', gemerktMarkup.includes('★'))

/* Der Tooltip trägt den vollen Namen, nicht den gekürzten (Elementbaum der Karte). */
type Knoten = { type?: unknown; props?: { text?: unknown; children?: unknown } }
function tooltipText(knoten: unknown): unknown {
  if (Array.isArray(knoten)) return knoten.map(tooltipText).find((x) => x !== undefined)
  const k = knoten as Knoten | null
  if (!k || typeof k !== 'object' || !k.props) return undefined
  if (k.type === Tooltip) return k.props.text
  return tooltipText(k.props.children)
}
const langProps = kartenProps(lang, { namen: { voll: 'Der volle Name des Teils', rest: 'Staffel 4 Der lange Untertitel der Staffel', kurz: 'Staffel 4 Der lange Untertitel der Staffel' } })
gleich('Tooltip-Text ist der volle Name', tooltipText(ReihenCover(langProps)), 'Der volle Name des Teils')
gleich('kurzer Name: kein Tooltip-Knoten', tooltipText(ReihenCover(kartenProps(teil(900003, 'Kurz')))), undefined)

/* Während des Wechsels (`gesperrt`) sind die Karten aus; sonst nicht. */
const tabKnopf = (html: string) => html.match(/<button[^>]*role="tab"[^>]*>/)?.[0] ?? ''
const kartenHtml = (mehr: Partial<CoverProps>, m = teil(900003, 'Kurz')) => renderToStaticMarkup(createElement(() => ReihenCover(kartenProps(m, mehr))))
pruefe('gesperrt: Karte aus', tabKnopf(kartenHtml({ gesperrt: true })).includes('disabled=""'))
pruefe('nicht gesperrt: Karte an', !tabKnopf(kartenHtml({ gesperrt: false })).includes('disabled=""'))

/* „Ohne Synchro“ gilt nur für Erschienenes; ein kommender Teil trägt kein ✕ und ist nicht gedämpft. */
const ohneSynchro = teil(900004, 'Ohne', { ohneSynchro: true })
pruefe('erschienen ohne Synchro: Marke', kartenHtml({ offen: false }, ohneSynchro).includes('🇩🇪 ✕'))
pruefe('erschienen ohne Synchro: gedämpft', kartenHtml({ offen: false }, ohneSynchro).includes('opacity-55'))
pruefe('kommend ohne Synchro: keine Marke', !kartenHtml({ offen: true }, ohneSynchro).includes('🇩🇪 ✕'))
pruefe('kommend ohne Synchro: nicht gedämpft', !kartenHtml({ offen: true }, ohneSynchro).includes('opacity-55'))
pruefe('mit Synchro: weder Marke noch gedämpft', !kartenHtml({}, teil(900005, 'Mit')).includes('🇩🇪 ✕'))

/* Bilder: ohne IntersectionObserver stehen sie sofort da, mit Beobachter erst nach dem Sichtbarwerden; ohne Cover nie. */
const mitBild = teil(900006, 'Bild', { cover: 'https://ak.test/cover/medium/x.jpg' })
pruefe('ohne Beobachter: Bild sofort', kartenHtml({}, mitBild).includes('<img'))
pruefe('ohne Cover: kein Bild', !kartenHtml({}, teil(900007, 'Leer')).includes('<img'))
globalThis.IntersectionObserver = class {} as unknown as typeof IntersectionObserver
pruefe('mit Beobachter, noch nicht sichtbar: kein Bild', !kartenHtml({}, mitBild).includes('<img'))
Reflect.deleteProperty(globalThis, 'IntersectionObserver')

/* Pfeile: ohne Überlauf fehlen beide; sichtbar sind sie je nach Ende ausgegraut. */
const paar = (z: ReturnType<typeof pfeilZustand>) => renderToStaticMarkup(createElement(PfeilPaar, { zustand: z, spurId: 's', t, springe: () => {} }))
const knoepfe = (html: string) => html.match(/<button[^>]*>/g) ?? []
gleich('ohne Überlauf: keine Pfeile', paar(pfeilZustand(0, 300, 300)), '')
const anfang = knoepfe(paar(pfeilZustand(0, 300, 700)))
gleich('Anfang: zwei Pfeile', anfang.length, 2)
pruefe('Pfeile nur mit feinem Zeiger (Handy wischt)', /class="hidden [^"]*pointer-fine:flex"/.test(paar(pfeilZustand(0, 300, 700))), paar(pfeilZustand(0, 300, 700)).slice(0, 80))
pruefe('Anfang: „Vorherige Teile“ ausgegraut', /aria-label="Vorherige Teile"[^>]*disabled=""/.test(anfang[0] ?? ''), anfang[0])
pruefe('Anfang: „Weitere Teile“ aktiv', /aria-label="Weitere Teile"/.test(anfang[1] ?? '') && !(anfang[1] ?? '').includes('disabled=""'), anfang[1])
const ende = knoepfe(paar(pfeilZustand(400, 300, 700)))
pruefe('Ende: „Vorherige Teile“ aktiv', !(ende[0] ?? '').includes('disabled=""'), ende[0])
pruefe('Ende: „Weitere Teile“ ausgegraut', /aria-label="Weitere Teile"[^>]*disabled=""/.test(ende[1] ?? ''), ende[1])

/* Pfeilklick: der Knopf ruft `springe` mit seiner Richtung; `springeSpur` scrollt die Spur um die Sprungweite, `matchMedia` bestimmt das Gleiten. */
const gerufen: number[] = []
const pfeile = PfeilPaar({ zustand: pfeilZustand(0, 300, 700), spurId: 's', t, springe: (r) => gerufen.push(r) })
const knoepfeProps = (pfeile?.props.children ?? []) as { props: { onClick: () => void } }[]
gleich('Pfeilpaar: zwei Knöpfe', knoepfeProps.length, 2)
knoepfeProps[0]?.props.onClick()
gleich('Zurück-Knopf ruft springe(-1)', gerufen, [-1])
knoepfeProps[1]?.props.onClick()
gleich('Weiter-Knopf ruft springe(1)', gerufen, [-1, 1])
const scrollSonde = (clientWidth: number, richtung: 1 | -1, weniger: boolean, abfragen: string[] = []) => {
  const aufrufe: ScrollToOptions[] = []
  const mm = (a: string) => (abfragen.push(a), { matches: weniger })
  springeSpur({ clientWidth, scrollBy: (z) => aufrufe.push(z) }, richtung, mm)
  return aufrufe
}
const abgefragt: string[] = []
gleich('Spur zurück: scrollBy -256 bei 319 px', scrollSonde(319, -1, false, abgefragt), [{ left: -256, behavior: 'smooth' }])
gleich('Spur weiter: scrollBy 384 bei 456 px', scrollSonde(456, 1, false), [{ left: 384, behavior: 'smooth' }])
gleich('Spur mit weniger Bewegung: auto', scrollSonde(319, 1, true), [{ left: 256, behavior: 'auto' }])
gleich('Spur fragt „weniger Bewegung“ ab', abgefragt, ['(prefers-reduced-motion: reduce)'])

/* Die Liste: Gruppen als Zeilen; Zustände ohne Daten. */
const reihe: FranchiseMember[] = [
  teil(900011, 'Reihe', { jpYear: 2019 }),
  teil(900012, 'Reihe Staffel 2', { jpYear: 2020 }),
  teil(900013, 'Reihe Staffel 3', { jpYear: 2021 }),
  teil(900014, 'Reihe: Der Film', { jpYear: 2022, format: 'MOVIE', episodes: 1 }),
  teil(900015, 'Reihe Special', { jpYear: 2021, format: 'SPECIAL', episodes: 1, beiwerk: true }),
]
const titel = (id: number) => ({ id }) as Title
function liste(teile: FranchiseMember[], gewaehlt: number, mehr: { suche?: string; ohneOffen?: boolean } = {}): string {
  return renderToStaticMarkup(
    createElement(ReihenListe, {
      reihenTeile: teile,
      t,
      reihenName: 'Reihe',
      title: titel(gewaehlt),
      favorites: new Set<number>(),
      wechselt: false,
      wechsleZu: () => {},
      reiheOhneOffen: mehr.ohneOffen ? 1 : null,
      reihenSchluessel: 1,
      reiheSuche: { reihe: 1, text: mehr.suche ?? '' },
      setReiheOhneOffen: () => {},
      setReiheSuche: () => {},
    }),
  )
}
const zaehle = (html: string, muster: string) => html.split(muster).length - 1
const voll = liste(reihe, 900012)
gleich('drei Gruppen = drei Zeilen', zaehle(voll, 'role="tablist"'), 3)
gleich('fünf Teile = fünf Karten', zaehle(voll, 'role="tab"'), 5)
gleich('genau ein gewählter Teil', zaehle(voll, 'aria-selected="true"'), 1)
pruefe('Zeilen tragen die Überschrift als Beschriftung', zaehle(voll, 'aria-labelledby=') === 3)
pruefe('keine Reiter mehr', !voll.includes('min-h-11 cursor-pointer rounded-full'))
pruefe('Pfeile erscheinen erst nach der Messung', !voll.includes('Weitere Teile'))
const einTeil = liste([reihe[0]!], 900011)
gleich('Reihe mit einem Teil: nichts', einTeil, '')
const nurFilm = liste([reihe[3]!, teil(900016, 'Reihe: Film 2', { format: 'MOVIE', jpYear: 2023 })], 900014)
gleich('Reihe aus zwei Filmen: eine Zeile', zaehle(nurFilm, 'role="tablist"'), 1)
gleich('Reihe aus zwei Filmen: zwei Karten', zaehle(nurFilm, 'role="tab"'), 2)
pruefe('Reihe aus zwei Filmen: keine Pfeile', !nurFilm.includes('Weitere Teile'))
const keinTreffer = liste(reihe, 900012, { suche: 'zzzz' })
gleich('Suche ohne Treffer: keine Zeile', zaehle(keinTreffer, 'role="tablist"'), 0)
const alleOhne = liste([teil(900021, 'Reihe', { ohneSynchro: true }), teil(900022, 'Reihe Staffel 2', { ohneSynchro: true }), teil(900023, 'Reihe Staffel 3', { ohneSynchro: true })], 900099)
gleich('nur Teile ohne Synchro, keiner gewählt: keine Zeile', zaehle(alleOhne, 'role="tablist"'), 0)
pruefe('nur Teile ohne Synchro: Hinweis auf den Schalter', alleOhne.includes('Schalter'), alleOhne.slice(0, 200))
const alleOhneOffen = liste([teil(900021, 'Reihe', { ohneSynchro: true }), teil(900022, 'Reihe Staffel 2', { ohneSynchro: true })], 900099, { ohneOffen: true })
gleich('Schalter an: beide Teile da', zaehle(alleOhneOffen, 'role="tab"'), 2)

/* Pfeile nach Inhaltsänderung (Daniel, 24.10.2026): schrumpft nur der Inhalt, meldet der ResizeObserver nichts — die Messung hängt am MutationObserver. */
type Fake = { rueckruf: () => void; ziel?: unknown; optionen?: unknown; getrennt: boolean }
function spurBeobachter(): { Klasse: new (rueckruf: () => void) => { observe: (el: Element, o?: ResizeObserverOptions & MutationObserverInit) => void; disconnect: () => void }; alle: Fake[] } {
  const alle: Fake[] = []
  class Klasse {
    f: Fake
    constructor(rueckruf: () => void) {
      this.f = { rueckruf, getrennt: false }
      alle.push(this.f)
    }
    observe(el: Element, o?: ResizeObserverOptions & MutationObserverInit) {
      this.f.ziel = el
      this.f.optionen = o
    }
    disconnect() {
      this.f.getrennt = true
    }
  }
  return { Klasse, alle }
}
type Lauf = { gemessen: number; abgebrochen: number[] }
/** `rahmen.an` vergibt Ids ab 1 und hält die Rückrufe vor; `ab` nimmt sie heraus. Ohne `flushVorAufraeumen` bleibt der letzte Rahmen beim Aufräumen offen. */
function messeNachAenderung(ausloeser: ('mutation' | 'resize' | 'scroll')[], flushVorAufraeumen = true): Lauf {
  const hoerer: Record<string, () => void> = {}
  const el = { addEventListener: (n: string, f: () => void) => (hoerer[n] = f), removeEventListener: () => undefined } as unknown as HTMLElement
  const mut = spurBeobachter()
  const res = spurBeobachter()
  const lauf: Lauf = { gemessen: 0, abgebrochen: [] }
  const offen = new Map<number, () => void>()
  let naechste = 1
  const rahmen = {
    an: (f: () => void) => {
      offen.set(naechste, f)
      return naechste++
    },
    ab: (id: number) => {
      lauf.abgebrochen.push(id)
      offen.delete(id)
    },
  }
  const aufraeumen = verfolgeSpur(el, () => lauf.gemessen++, { mutation: mut.Klasse, resize: res.Klasse }, rahmen)
  for (const art of ausloeser) {
    if (art === 'mutation') mut.alle[0]?.rueckruf()
    if (art === 'resize') res.alle[0]?.rueckruf()
    if (art === 'scroll') hoerer.scroll?.()
  }
  if (flushVorAufraeumen) for (const f of [...offen.values()]) f()
  aufraeumen()
  for (const f of [...offen.values()]) f()
  pruefe('Aufräumen trennt beide Beobachter', Boolean(mut.alle[0]?.getrennt && res.alle[0]?.getrennt))
  pruefe('Mutation beobachtet die Karten der Spur (childList)', JSON.stringify(mut.alle[0]?.optionen) === '{"childList":true}' && mut.alle[0]?.ziel === el)
  pruefe('Resize beobachtet die Spur selbst', res.alle[0]?.ziel === el)
  return lauf
}
gleich('Karten fallen weg (MutationObserver): eine Messung', messeNachAenderung(['mutation']).gemessen, 1)
gleich('Breite ändert sich (ResizeObserver): eine Messung', messeNachAenderung(['resize']).gemessen, 1)
gleich('Scrollen: eine Messung', messeNachAenderung(['scroll']).gemessen, 1)
gleich('Drei Auslöser vor dem Rahmen: eine Messung', messeNachAenderung(['scroll', 'resize', 'mutation']).gemessen, 1)
gleich('Zweiter Auslöser bricht den offenen Rahmen ab', messeNachAenderung(['scroll', 'resize'], false).abgebrochen.slice(0, 2), [0, 1])
gleich('Aufräumen mit offenem Rahmen: Rahmen 1 abgebrochen, danach keine Messung', messeNachAenderung(['scroll'], false), { gemessen: 0, abgebrochen: [0, 1] })

if (verletzt > 0) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\ncheck-reihen-spur: Sprung, Pfeile, Start, Tooltip, Klick, Zustände ohne Daten, Messung nach Inhaltsänderung ✓')
