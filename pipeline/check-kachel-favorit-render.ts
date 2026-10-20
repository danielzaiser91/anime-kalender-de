/**
 * Favoriten-Rand als gerenderte Kachel (Daniel, 17.10.2026): Woche, Monats-Cover, Tagesliste und Punkt am Handy, je mit Favorit,
 * Finale, beidem, Start+Favorit, Katalog+Favorit und (Woche) Kino-Saal+Favorit. Gerendert wird mit `renderToStaticMarkup`; geprüft
 * werden die Klassen am Cover. Lehre: Im Stylesheet schlug `ring-white/10` (Saal) die später gesetzte Klasse `ring-ak-favorit-rand`,
 * der Kino-Favorit blieb ohne Gold — ein Quelltext-Test sah das nicht. Deshalb gilt je Kachel die Regel „genau eine Ringbreite,
 * genau eine Ringfarbe": zwei Klassen derselben Eigenschaft entscheidet sonst die Reihenfolge im gebauten CSS.
 * Läuft in `check:logic`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReleaseEvent, Title } from '@shared/types.ts'
import type { KartenArt } from '../web/src/lib/kachel-folgen.ts'
import { PosterKarte } from '../web/src/components/kalender/PosterKarte.tsx'
import { CoverKnopf, PunkteReihe, TerminZeile, type MonatProps } from '../web/src/components/MonthView.tsx'

let fehler = 0
function pruefe(name: string, ok: boolean, info?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}${info === undefined ? '' : ` — gefunden: ${JSON.stringify(info)}`}`)
}

const TITEL_ID = 900001
const termin = (platform: ReleaseEvent['platform']): ReleaseEvent =>
  ({ id: `t-${platform}`, releaseSlug: 'x', titleId: TITEL_ID, name: 'Anime X', date: '2026-10-20', time: '18:00', releaseType: 'weekly', platform }) as ReleaseEvent
const titel = { id: TITEL_ID, coverImage: 'https://ak.test/c.jpg' } as unknown as Title

/** Die Klassen des einzigen Elements, dessen Klassenliste `muster` enthält (kein Treffer = leer; mehr als einer = Fehler, die Wahl wäre sonst Glück). */
function klassen(html: string, muster: string): string[] {
  const treffer = [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1]!.split(' ')).filter((k) => k.includes(muster))
  pruefe(`höchstens ein Element mit „${muster}“`, treffer.length <= 1, treffer.length)
  return treffer[0] ?? []
}
const ringe = (k: string[]) => ({
  breiten: k.filter((c) => /^ring-(\d|inset)/.test(c) && c !== 'ring-inset'),
  farben: k.filter((c) => /^ring-(ak-|white|transparent|black)/.test(c)),
})

function woche(art: KartenArt | undefined, favorite: boolean, platform: ReleaseEvent['platform'] = 'netflix'): string {
  const props = { event: termin(platform), title: titel, art, favorite, hidden: false, onOpen: () => {} }
  return renderToStaticMarkup(createElement(PosterKarte, props))
}

function monatsProps(art: KartenArt | undefined, favorit: boolean): MonatProps {
  const ev = termin('netflix')
  return {
    data: { titleById: new Map([[TITEL_ID, titel]]), releaseBySlug: new Map() } as unknown as MonatProps['data'],
    events: [ev],
    anchorDate: ev.date,
    hidden: new Set(),
    favorites: favorit ? new Set([TITEL_ID]) : new Set(),
    onOpen: () => {},
    onPickDay: () => {},
    arten: art ? new Map([[ev.id, art]]) : undefined,
  }
}

const FAELLE: { name: string; art: KartenArt | undefined; favorit: boolean; aussen: string; innen: string; breit: boolean }[] = [
  { name: 'schlicht', art: undefined, favorit: false, aussen: '', innen: '', breit: false },
  { name: 'Favorit', art: undefined, favorit: true, aussen: 'ring-ak-favorit-rand', innen: '', breit: false },
  { name: 'Start', art: 'start', favorit: false, aussen: 'ring-ak-akzent', innen: '', breit: true },
  { name: 'Finale', art: 'finale', favorit: false, aussen: 'ring-ak-finale', innen: '', breit: true },
  { name: 'Katalog', art: 'katalog', favorit: false, aussen: 'ring-ak-katalog', innen: '', breit: true },
  { name: 'Finale + Favorit', art: 'finale', favorit: true, aussen: 'ring-ak-favorit-rand', innen: 'inset-ring-ak-finale', breit: true },
  { name: 'Start + Favorit', art: 'start', favorit: true, aussen: 'ring-ak-favorit-rand', innen: 'inset-ring-ak-akzent', breit: true },
  { name: 'Katalog + Favorit', art: 'katalog', favorit: true, aussen: 'ring-ak-favorit-rand', innen: 'inset-ring-ak-katalog', breit: true },
  { name: 'Katalog vermutlich + Favorit', art: 'katalogVermutlich', favorit: true, aussen: 'ring-ak-favorit-rand', innen: 'inset-ring-ak-katalog', breit: true },
  { name: 'Neu bei + Favorit', art: 'imAngebot', favorit: true, aussen: 'ring-ak-favorit-rand', innen: '', breit: false },
  { name: 'Erstausgabe + Favorit', art: 'erstausgabe', favorit: true, aussen: 'ring-ak-favorit-rand', innen: '', breit: false },
  { name: 'Neu bei', art: 'imAngebot', favorit: false, aussen: 'ring-transparent', innen: '', breit: false },
]

console.log('Woche:')
for (const f of FAELLE) {
  const html = woche(f.art, f.favorit)
  const k = klassen(html, 'bg-ak-flaeche-2')
  const r = ringe(k)
  pruefe(`Woche ${f.name}: Cover gefunden`, k.includes('rounded-t-xl') && !k.includes('rounded-xl') && k.includes('ak-ring-oben-leiste') && !k.includes('ak-ring-oben'), k)
  pruefe(`Woche ${f.name}: Ringfarbe ${f.aussen || 'keine'}, genau eine`, r.farben.join() === f.aussen, r.farben)
  pruefe(`Woche ${f.name}: höchstens eine Ringbreite`, r.breiten.length <= 1, r.breiten)
  pruefe(`Woche ${f.name}: Favorit ring-3, sonst breit ring-2`, f.favorit ? r.breiten.join() === 'ring-3' : r.breiten.join() === (f.breit ? 'ring-2' : ''), r.breiten)
  const innen = klassen(html, 'inset-ring-2')
  pruefe(`Woche ${f.name}: Innenring ${f.innen || 'keiner'}`, f.innen ? innen.includes(f.innen) && innen.includes('border-ak-grund') && innen.includes('border') : innen.length === 0, innen)
  pruefe(`Woche ${f.name}: kein Katalog-Glanz am Favoriten`, !(f.favorit && k.includes('ak-katalog-glanz')), k)
  /* Die Leiste sitzt immer an der Unterkante des Covers, eckig und ohne Überstand — sonst schöbe ein Favoriten-Rand sie hoch (Daniel, 17.10.2026). */
  const leiste = klassen(html, 'h-1')
  pruefe(`Woche ${f.name}: Anbieterleiste bündig und eckig`, leiste.join() === 'pointer-events-none,absolute,inset-x-0,bottom-0,h-1', leiste)
}
const katalog = klassen(woche('katalog', false), 'bg-ak-flaeche-2')
pruefe('Woche Katalog ohne Favorit behält den Glanz', katalog.includes('ak-katalog-glanz'), katalog)

console.log('Kino-Saal:')
const saalFav = klassen(woche(undefined, true, 'kino'), 'bg-ak-flaeche-2')
pruefe('Saal + Favorit: Saal-Kachel', saalFav.includes('ak-saal'), saalFav)
pruefe('Saal + Favorit: Gold, kein Saal-Ring (ring-white/10, ring-1)', ringe(saalFav).farben.join() === 'ring-ak-favorit-rand' && ringe(saalFav).breiten.join() === 'ring-3', ringe(saalFav))
const saal = klassen(woche(undefined, false, 'kino'), 'bg-ak-flaeche-2')
pruefe('Saal ohne Favorit behält ring-1 ring-white/10', ringe(saal).farben.join() === 'ring-white/10' && ringe(saal).breiten.join() === 'ring-1', ringe(saal))

console.log('Monats-Cover:')
for (const f of FAELLE) {
  const html = renderToStaticMarkup(createElement(CoverKnopf, { ev: termin('netflix'), p: monatsProps(f.art, f.favorit) }))
  const k = klassen(html, 'overflow-hidden')
  const r = ringe(k)
  pruefe(`Monat ${f.name}: untere Ecken eckig, Ring endet an der Leiste`, k.includes('rounded-t-[5px]') && !k.includes('rounded-[5px]') && k.includes('ak-ring-oben'), k)
  pruefe(`Monat ${f.name}: Ringfarbe ${f.aussen || 'keine'}, genau eine`, r.farben.join() === f.aussen, r.farben)
  pruefe(`Monat ${f.name}: ring-2 nur mit Art oder Favorit`, r.breiten.join() === (f.art || f.favorit ? 'ring-2' : ''), r.breiten)
  const innen = klassen(html, 'inset-ring-2')
  pruefe(`Monat ${f.name}: Innenring ${f.innen || 'keiner'}`, f.innen ? innen.includes(f.innen) && innen.includes('border-ak-flaeche') && innen.includes('border') : innen.length === 0, innen)
}

console.log('Tagesliste:')
for (const f of FAELLE) {
  const html = renderToStaticMarkup(createElement(TerminZeile, { ev: termin('netflix'), p: monatsProps(f.art, f.favorit) }))
  const k = klassen(html, 'overflow-hidden')
  const r = ringe(k)
  pruefe(`Tagesliste ${f.name}: untere Ecken eckig, Ring endet an der Leiste`, k.includes('rounded-t-md') && !k.includes('rounded-md') && k.includes('ak-ring-oben-leiste') && !k.includes('ak-ring-oben'), k)
  pruefe(`Tagesliste ${f.name}: Favorit = goldener Ring, sonst keiner`, f.favorit ? r.farben.join() === 'ring-ak-favorit-rand' && r.breiten.join() === 'ring-2' : r.farben.length === 0 && r.breiten.length === 0, r)
}

console.log('Punkt am Handy:')
for (const f of FAELLE) {
  const html = renderToStaticMarkup(createElement(PunkteReihe, { stream: [termin('netflix')], p: monatsProps(f.art, f.favorit) }))
  pruefe(`Punkt ${f.name}: data-favorit ${f.favorit ? 'gesetzt' : 'fehlt'}`, html.includes('data-favorit=""') === f.favorit, html)
  pruefe(`Punkt ${f.name}: data-art ${f.art ?? 'fehlt'}`, f.art ? html.includes(`data-art="${f.art}"`) : !html.includes('data-art'), html)
}

if (fehler > 0) {
  console.error(`check-kachel-favorit-render: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-kachel-favorit-render: ok')
