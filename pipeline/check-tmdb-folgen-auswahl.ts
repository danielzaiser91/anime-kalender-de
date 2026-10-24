/**
 * Zusicherungen zu `lib/tmdb-folgen-auswahl.ts`: laufende Serien mit titellosen, schon erschienenen Folgen kommen nach 7 Tagen wieder und zuerst.
 * Aufruf: `npm run check:logic`.
 */
import { frischFaellig, grundFaellig, waehleFaellige, type BestandKurz, type FolgeKurz } from './lib/tmdb-folgen-auswahl.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const heute = '2026-10-24'
const folge = (e: number, titel: string | null, datum: string | null, rest: Partial<FolgeKurz> = {}): FolgeKurz => ({ s: 1, e, titel, en: `Ep ${e}`, datum, ...rest })
const bestand = (geholtAm: string, ...folgen: FolgeKurz[]): BestandKurz => ({ geholtAm, folgen })
const echt = folge(1, 'Der Anfang', '2026-10-10')

console.log('\nTMDB-Folgen: frisch fällig')
pruefe('Platzhalter „Folge 2" nach 8 Tagen', frischFaellig(bestand('2026-10-16', echt, folge(2, 'Folge 2', '2026-10-15')), heute))
pruefe('Titel gleich dem englischen', frischFaellig(bestand('2026-10-16', folge(2, 'EP 2', '2026-10-15')), heute))
pruefe('fehlender Titel (null)', frischFaellig(bestand('2026-10-16', folge(2, null, '2026-10-15')), heute))
pruefe('Titel nur aus Leerzeichen', frischFaellig(bestand('2026-10-16', folge(2, '  ', '2026-10-15')), heute))
pruefe('ohne englischen Vergleich zählt ein echter Titel', !frischFaellig(bestand('2026-10-16', folge(2, 'Der Anfang', '2026-10-15', { en: undefined })), heute))
pruefe('alle Titel echt: nicht fällig', !frischFaellig(bestand('2026-10-16', echt, folge(2, 'Das Ende', '2026-10-15')), heute))
pruefe('Abruf genau 7 Tage alt: fällig', frischFaellig(bestand('2026-10-17', folge(2, 'Folge 2', '2026-10-15')), heute))
pruefe('Abruf 6 Tage alt: nicht fällig', !frischFaellig(bestand('2026-10-18', folge(2, 'Folge 2', '2026-10-15')), heute))
pruefe('Folge heute erschienen', frischFaellig(bestand('2026-10-16', folge(2, 'Folge 2', heute)), heute))
pruefe('Folge noch nicht erschienen', !frischFaellig(bestand('2026-10-16', folge(2, 'Folge 2', '2026-10-25')), heute))
pruefe('Folge ohne Datum', !frischFaellig(bestand('2026-10-16', folge(2, 'Folge 2', null)), heute))
pruefe('Folge genau 21 Tage alt zählt', frischFaellig(bestand('2026-10-01', folge(2, 'Folge 2', '2026-10-03')), heute))
pruefe('Folge 22 Tage alt zählt nicht', !frischFaellig(bestand('2026-10-01', folge(2, 'Folge 2', '2026-10-02')), heute))
pruefe('Staffel 0 zählt nicht', !frischFaellig(bestand('2026-10-16', folge(2, 'Folge 2', '2026-10-15', { s: 0 })), heute))

console.log('\nTMDB-Folgen: Grundfrist')
pruefe('nie geholt', grundFaellig(undefined, heute, 30))
pruefe('29 Tage alt, alles bekannt', !grundFaellig(bestand('2026-09-25', echt), heute, 30))
pruefe('30 Tage alt', grundFaellig(bestand('2026-09-24', echt), heute, 30))
pruefe('englischer Titel fehlt im Eintrag', grundFaellig(bestand('2026-10-23', folge(1, 'x', null, { en: undefined })), heute, 30))
pruefe('Frist ist Parameter', grundFaellig(bestand('2026-10-20', echt), heute, 4) && !grundFaellig(bestand('2026-10-21', echt), heute, 4))

console.log('\nTMDB-Folgen: Reihenfolge und Limit')
const k = (id: string): { id: string } => ({ id })
const b: Record<string, BestandKurz> = {
  alt1: bestand('2026-09-01', echt),
  alt2: bestand('2026-09-01', echt),
  neu: bestand('2026-10-16', folge(2, 'Folge 2', '2026-10-15')),
  ruhig: bestand('2026-10-16', echt),
}
const ids = (l: { id: string }[]): string => l.map((x) => x.id).join(',')
const eingabe = [k('alt1'), k('alt2'), k('ruhig'), k('neu'), k('leer')]
pruefe('frisch zuerst, dann Rest, ruhige fehlen', ids(waehleFaellige(eingabe, b, heute, 30, 10)) === 'neu,alt1,alt2,leer', ids(waehleFaellige(eingabe, b, heute, 30, 10)))
pruefe('Limit 1 behält den frischen', ids(waehleFaellige(eingabe, b, heute, 30, 1)) === 'neu')
pruefe('Limit 2', ids(waehleFaellige(eingabe, b, heute, 30, 2)) === 'neu,alt1')
pruefe('frischer Titel mit Alter über Grundfrist erscheint einmal', ids(waehleFaellige([k('x')], { x: bestand('2026-09-01', folge(2, 'Folge 2', '2026-10-15')) }, heute, 30, 5)) === 'x')

if (verletzt > 0) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB-Folgen-Auswahl: alle Zusicherungen halten.')
