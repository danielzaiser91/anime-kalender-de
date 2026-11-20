/**
 * Zusicherung: **Panel-Zeile und Staffel-Kurzform nennen die Spanne eines Sammeltitels** („Staffel 1–5 von 25“ für Pokémon 527, Auftrag 20.11.2026).
 * `reihenZeile` (reihen-karte.tsx) und `staffelKurz` (reihen-regeln.ts) werden mit der Pokémon-Reihe aus der Handdatei gerufen,
 * `staffelBis` kommt wie im Bau aus `staffelEnden()`. Läuft in `check:logic`.
 */
import { ignoriereCss } from '../tools/mini-dom.ts'
import type { FranchiseMember } from '../shared/types.ts'
import { alleStaffelQuellen } from './bau/staffel-quelle.ts'
import { ladeStaffelGrenzen, staffelEnden } from './lib/pokemon-staffeln.ts'

ignoriereCss()
const { reihenZeile } = await import('../web/src/components/detail/reihen-karte.tsx')
const { staffelKurz } = await import('../web/src/components/detail/reihen-regeln.ts')
const { TEXTE_SPAET } = await import('../web/src/lib/i18n-spaet.ts')

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const t = (schluessel: string, p?: Record<string, string | number>): string =>
  (TEXTE_SPAET as Record<string, string>)[schluessel]!.replace(/\{(\w+)\}/g, (_, n: string) => String(p?.[n]))

pruefe('staffelKurz: Spanne', staffelKurz({ staffel: 1, bis: 5 }) === 'Staffel 1–5')
pruefe('staffelKurz: Einzelstaffel und Teil unverändert', staffelKurz({ staffel: 4 }) === 'Staffel 4' && staffelKurz({ staffel: 4, teil: 2 }) === 'Staffel 4 - Teil 2')

const grenzen = ladeStaffelGrenzen()
const quellen = alleStaffelQuellen([], grenzen)
const enden = staffelEnden(grenzen)
const reihe = [
  [527, 1997], [1564, 2002], [1565, 2006], [9107, 2010], [14093, 2012], [17115, 2013], [17873, 2013], [19291, 2013], [21356, 2015], [97634, 2016], [112153, 2019], [158870, 2023],
].map(([id, jahr]) => ({ id: id!, name: `Pokémon ${id}`, format: 'TV', jpYear: jahr, staffelQuelle: quellen.get(id!), staffelBis: enden.get(id!) }) as unknown as FranchiseMember)
pruefe('Panel-Zeile 527: Staffel 1–5 von 25', reihenZeile(reihe, 'Pokémon', 527, t as never) === 'Staffel 1–5 von 25', reihenZeile(reihe, 'Pokémon', 527, t as never))
pruefe('Panel-Zeile 112153: Staffel 23–25 von 25', reihenZeile(reihe, 'Pokémon', 112153, t as never) === 'Staffel 23–25 von 25')
pruefe('Panel-Zeile 21356 (Einzelstaffel): Staffel 19 von 25', reihenZeile(reihe, 'Pokémon', 21356, t as never) === 'Staffel 19 von 25')

if (fehler) process.exit(1)
console.log('check-reihen-zeile-spanne: ok (staffelKurz, Panel-Zeile 527/112153/21356)')
