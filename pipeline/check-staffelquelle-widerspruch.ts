/**
 * Zusicherung: **zwei Hauptstaffeln einer Reihe mit derselben belegten Staffelnummer sind ein Widerspruch** (Anlass: Tokyo Ghoul √A und :re 2 beide
 * „Staffel 2“, weil aniSearch „:re (Staffel 2)“ innerhalb von :re zählt, 21.11.2026). Regel `staffelQuellenWidersprueche`, Kulisse im Format der
 * `franchises.json`-Glieder; dazu die Handdatei: `alleStaffelQuellen()` ordnet :re 2 (102351) Staffel 4 zu. Läuft in `check:logic`.
 */
import { alleStaffelQuellen } from './bau/staffel-quelle.ts'
import { staffelQuellenWidersprueche, type QuellenGlied } from './lib/staffelquelle-widerspruch.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const g = (id: number, name: string, staffelQuelle?: number, extra: Partial<QuellenGlied> = {}): QuellenGlied => ({ id, name, format: 'TV', episodes: 12, staffelQuelle, ...extra })
const ghoul = [g(900001, 'Tokyo Ghoul'), g(900002, 'Tokyo Ghoul √A', 2), g(900003, 'Tokyo Ghoul:re'), g(900004, 'Tokyo Ghoul:re — 2', 2)]

const treffer = staffelQuellenWidersprueche(ghoul, new Set())
pruefe('zwei Hauptstaffeln mit Quelle 2: ein Widerspruch', treffer.length === 1 && treffer[0]!.staffel === 2 && treffer[0]!.ids.join() === '900002,900004', JSON.stringify(treffer))
pruefe('verschiedene Nummern: kein Widerspruch', staffelQuellenWidersprueche([g(900011, 'A', 2), g(900012, 'B', 3), g(900013, 'C')], new Set()).length === 0)
pruefe('nur ein Eintrag mit Quelle: kein Widerspruch', staffelQuellenWidersprueche([g(900021, 'A', 2), g(900022, 'B')], new Set()).length === 0)
pruefe('belegte Ausnahme (Pokémon): kein Widerspruch', staffelQuellenWidersprueche([g(900031, 'A', 16), g(900032, 'B', 16)], new Set([900031, 900032])).length === 0)
pruefe('Ausnahme gilt nur für ihre Kennungen: dritter Eintrag mit 16 meldet', staffelQuellenWidersprueche([g(900041, 'A', 16), g(900042, 'B', 16), g(900043, 'C', 16)], new Set([900041])).length === 1)
pruefe('Beiwerk zählt nicht', staffelQuellenWidersprueche([g(900051, 'A', 2), g(900052, 'Special', 2, { format: 'SPECIAL', beiwerk: true })], new Set()).length === 0)
pruefe('zwei getrennte Staffelnummern doppelt: zwei Widersprüche', staffelQuellenWidersprueche([g(900061, 'A', 2), g(900062, 'B', 2), g(900063, 'C', 3), g(900064, 'D', 3)], new Set()).length === 2)

/* Handdatei: :re 2 steht in Staffel 4, √A behält 2 (aniSearch), sonst bliebe der Widerspruch. */
const quellen = alleStaffelQuellen()
pruefe('Handdatei: Tokyo Ghoul:re — 2 (102351) = Staffel 4', quellen.get(102351) === 4, String(quellen.get(102351)))
pruefe('√A (20850) bleibt Staffel 2', quellen.get(20850) === 2, String(quellen.get(20850)))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-staffelquelle-widerspruch: ok')
