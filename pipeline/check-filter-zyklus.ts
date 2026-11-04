/**
 * Filter-Pillen schalten reihum nichts → ausgewählt → ausgeschlossen → nichts (Daniel, 04.11.2026; der Klick-Modus entfällt).
 * Die reine Reihenfolge (`naechsterZustand`) und die echte Komponente `FilterDetailsFeld` im Mini-DOM: Genre, Schlagwort, Anbieter,
 * Plattform, Jahr (Listen-Pillen), Schnell-Chips (Favoriten, Cartoon, Disc, TV), Zweitanbieter (kennt nur „ausschließen“),
 * Plattform-Pille TV im Kalender (Schalter: nichts ↔ ausgeschlossen), Gleichstand von Schnell-Chip und Gruppen-Pille,
 * Zustandswort für Screenreader. Aufruf: `npm run check:logic`.
 */
import { act, createElement as h, useState } from 'react'
import type { DataMeta } from '../shared/types.ts'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import { naechsterZustand, type FilterZustand } from '../web/src/lib/filter-zyklus.ts'
import { attrappeUhr, ignoriereCss, installiereMiniDom, klicke, type MiniKnoten } from '../tools/mini-dom.ts'
ignoriereCss()
const vorlauf = installiereMiniDom({ setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as never, () => ({}))
const vorlaufDokument = (globalThis as unknown as { document: Record<string, unknown> }).document
vorlaufDokument.oninput = null
const { createRoot } = await import('react-dom/client')
vorlauf.entferne()
const { FilterDetailsFeld } = await import('../web/src/components/FilterDetails.tsx')

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nReihenfolge (reine Funktion)')
const ALLE: FilterZustand[] = ['nichts', 'ja', 'nein']
pruefe('alle drei: nichts → ja → nein → nichts', naechsterZustand('nichts') === 'ja' && naechsterZustand('ja') === 'nein' && naechsterZustand('nein') === 'nichts')
pruefe('ohne „ja“: nichts → nein → nichts', naechsterZustand('nichts', ['nichts', 'nein']) === 'nein' && naechsterZustand('nein', ['nichts', 'nein']) === 'nichts')
pruefe('ohne „nein“: nichts → ja → nichts', naechsterZustand('nichts', ['nichts', 'ja']) === 'ja' && naechsterZustand('ja', ['nichts', 'ja']) === 'nichts')
pruefe('kein Zustand ist Fixpunkt (drei Tipps führen zurück)', ALLE.every((z) => naechsterZustand(naechsterZustand(naechsterZustand(z))) === z && naechsterZustand(z) !== z))

const meta = {
  genres: ['Action', 'Comedy'],
  platforms: ['netflix', 'tv'],
  keywords: ['Cartoon', 'Magie'],
  years: [2024],
  providers: ['maxdome'],
} as unknown as DataMeta

const stand: { f: FilterState; tvAn: boolean } = { f: EMPTY_FILTERS, tvAn: true }

/** Die echte Filteransicht mit Zustand wie in der App; `mitTv` gibt ihr den Fernseh-Schalter des Kalenders. */
async function rendere(mitTv: boolean) {
  stand.f = EMPTY_FILTERS
  stand.tvAn = true
  const uhr = attrappeUhr()
  const dom = installiereMiniDom({ ...uhr, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }, () => ({}))
  function Halter() {
    const [f, setF] = useState(EMPTY_FILTERS)
    const [tvAn, setTvAn] = useState(true)
    stand.f = f
    stand.tvAn = tvAn
    return h(FilterDetailsFeld, { meta, filters: f, onChange: setF, showConfidence: false, ...(mitTv ? { tvAn, setTvAn } : {}) })
  }
  await act(async () => createRoot(dom.wurzel as unknown as Element).render(h(Halter)))
  const knoepfe = () => dom.wurzel.finde((k) => k.tagName === 'BUTTON')
  const mehr = knoepfe().find((k) => k.textContent.includes('mehr Filter'))
  if (mehr) await act(async () => klicke(dom.wurzel, mehr))
  return {
    dom,
    schnell: (name: string) => knoepfe().find((k) => (k.getAttribute('aria-label') ?? '').startsWith(`${name}: `))!,
    pille: (name: string) => knoepfe().find((k) => k.getAttribute('aria-label') === null && k.textContent.includes(name))!,
    klick: (k: MiniKnoten) => act(async () => klicke(dom.wurzel, k)),
    nameVon: (k: MiniKnoten) => k.getAttribute('aria-label') ?? k.textContent,
    alleTexte: () => dom.wurzel.textContent,
  }
}
const gedrueckt = (k: MiniKnoten) => k.getAttribute('aria-pressed')

type Ansicht = Awaited<ReturnType<typeof rendere>>

/** Tippt dreimal und liest nach jedem Tipp den Filterzustand; `wert` bildet ihn auf nichts/ja/nein ab. */
async function dreiTipps(a: Ansicht, tippe: () => MiniKnoten, wert: () => FilterZustand): Promise<FilterZustand[]> {
  const folge: FilterZustand[] = [wert()]
  for (let i = 0; i < 3; i++) {
    await a.klick(tippe())
    folge.push(wert())
  }
  return folge
}
const liste = (l: readonly unknown[], x: unknown, ex: readonly unknown[]): FilterZustand => (l.includes(x) ? 'ja' : ex.includes(x) ? 'nein' : 'nichts')
const soll = 'nichts,ja,nein,nichts'

console.log('\nListen-Pillen (Gruppen im Fenster): drei Zustände')
{
  const a = await rendere(false)
  const fall: Array<[string, string, () => FilterZustand]> = [
    ['Genre', 'Action', () => liste(stand.f.genres, 'Action', stand.f.excluded.genres)],
    ['Schlagwort', 'Magie', () => liste(stand.f.keywords, 'Magie', stand.f.excluded.keywords)],
    ['Anbieter', 'maxdome', () => liste(stand.f.providers, 'maxdome', stand.f.excluded.providers)],
    ['Plattform', 'Netflix', () => liste(stand.f.platforms, 'netflix', stand.f.excluded.platforms)],
    ['Jahr', '2024', () => liste(stand.f.years, 2024, stand.f.excluded.years)],
  ]
  for (const [art, text, wert] of fall) {
    const folge = await dreiTipps(a, () => a.pille(text), wert)
    pruefe(`${art}: nichts → ausgewählt → ausgeschlossen → nichts`, folge.join() === soll, folge)
  }
  /* Genre: zusätzlich Zustand an der Pille selbst (aria-pressed und Zustandswort für Screenreader). */
  const aria: string[] = []
  const worte: string[] = []
  for (let i = 0; i < 4; i++) {
    aria.push(String(gedrueckt(a.pille('Comedy'))))
    worte.push(a.pille('Comedy').textContent.replace('Comedy', '').replace('⊘', '').trim())
    await a.klick(a.pille('Comedy'))
  }
  pruefe('Genre: aria-pressed false → true → mixed → false', aria.join() === 'false,true,mixed,false', aria)
  pruefe('Genre: Zustandswort „“ → ausgewählt → ausgeschlossen → „“', worte.join('|') === '|ausgewählt|ausgeschlossen|', worte)
  pruefe('Genre: ausgewählt und ausgeschlossen schließen sich nie zugleich ein', !stand.f.genres.some((g) => stand.f.excluded.genres.includes(g)))
  a.dom.entferne()
}

console.log('\nSchnell-Chips')
{
  const a = await rendere(true)
  const feld = (f: () => FilterState['favoritesOnly'], ex: () => FilterState['favoritesExcluded']): FilterZustand => (f() ? 'ja' : ex() ? 'nein' : 'nichts')
  const fav = await dreiTipps(a, () => a.schnell('Favoriten'), () => feld(() => stand.f.favoritesOnly, () => stand.f.favoritesExcluded))
  pruefe('Favoriten: nichts → ausgewählt → ausgeschlossen → nichts', fav.join() === soll, fav)
  const namen: string[] = []
  for (let i = 0; i < 4; i++) {
    namen.push(a.nameVon(a.schnell('Favoriten')))
    await a.klick(a.schnell('Favoriten'))
  }
  pruefe('Favoriten: der Name nennt den Zustand', namen.join() === 'Favoriten: nicht gewählt,Favoriten: ausgewählt,Favoriten: ausgeschlossen,Favoriten: nicht gewählt', namen)
  const tv = await dreiTipps(a, () => a.schnell('TV'), () => (!stand.tvAn ? 'nein' : stand.f.platforms.includes('tv') ? 'ja' : 'nichts'))
  pruefe('TV (Schnell-Chip): nichts → ausgewählt → ausgeschlossen → nichts', tv.join() === soll, tv)
  const zweit = await dreiTipps(a, () => a.schnell('Zweitanbieter'), () => (stand.f.zweitanbieterExcluded ? 'nein' : 'nichts'))
  pruefe('Zweitanbieter kennt nur ausschließen: nichts → ausgeschlossen → nichts → ausgeschlossen', zweit.join() === 'nichts,nein,nichts,nein', zweit)
  /* Der Zweitanbieter-Chip ist immer da (früher nur im Modus „Ausschließen“). */
  pruefe('Zweitanbieter-Chip ohne Modus-Umschalter sichtbar', !!a.schnell('Zweitanbieter'))
  a.dom.entferne()
}

console.log('\nPlattform-Pille „TV“ im Kalender (Fernseh-Schalter): nichts ↔ ausgeschlossen')
{
  const a = await rendere(true)
  const folge: string[] = []
  for (let i = 0; i < 3; i++) {
    folge.push(stand.tvAn ? 'nichts' : 'nein')
    await a.klick(a.pille('TV'))
  }
  folge.push(stand.tvAn ? 'nichts' : 'nein')
  pruefe('kein „ausgewählt“: nichts → ausgeschlossen → nichts → ausgeschlossen', folge.join() === 'nichts,nein,nichts,nein' && stand.f.platforms.length === 0, folge)
  a.dom.entferne()
}

console.log('\nGleiche Pille an zwei Stellen bleibt synchron')
{
  const a = await rendere(false)
  const zeigt = (k: MiniKnoten) => gedrueckt(k)
  const sync: string[] = []
  for (let i = 0; i < 4; i++) {
    sync.push(`${zeigt(a.schnell('Cartoon'))}/${zeigt(a.pille('Cartoon'))}`)
    await a.klick(i % 2 === 0 ? a.schnell('Cartoon') : a.pille('Cartoon'))
  }
  pruefe('Cartoon: Schnell-Chip und Schlagwort-Pille zeigen nach jedem Tipp an beiden Stellen dasselbe', sync.join() === 'false/false,true/true,mixed/mixed,false/false', sync)
  a.dom.entferne()
}

console.log('\nKein Klick-Modus mehr')
{
  const a = await rendere(true)
  const t = a.alleTexte()
  pruefe('weder Leiste „Klick-Modus“ noch Knöpfe „Auswählen“/„Ausschließen“', !/Klick-Modus|Auswählen|Ausschließen/.test(t), t.slice(0, 120))
  a.dom.entferne()
}

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt`)
  process.exit(1)
}
console.log('\nFilter-Zyklus: Reihenfolge, Listen-Pillen, Schnell-Chips, TV, Zweitanbieter, Gleichstand und Zustandswort halten; kein Klick-Modus mehr')
