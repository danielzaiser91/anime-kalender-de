/**
 * Bestandswache (nur Warnung, Exit 0): Ein Joyn-Termin trägt „≈“, obwohl das Abruffenster seines Wegs Folge, Tag und Uhrzeit belegt
 * (Yaiba, 10.11.2026). Der Bau übernimmt solche Tage in `belegeJoynTermine` (13-schreiben); ein Befund heißt, dass dieser Schritt nicht greift.
 * Warnung statt Rot: Der Fall ist ein überflüssiges „≈“, kein falscher Termin, und ein Rot stoppte den ganzen Bestandsbau.
 */
import { readJson } from './lib/util.ts'
import { joynTerminGeschaetztTrotzFenster } from './lib/joyn-schaetzung-pruefung.ts'
import type { ReleaseEvent, Title } from '../shared/types.ts'

const titel = new Map(readJson<Title[]>('public/data/titles.json', []).map((t) => [t.id, t]))
const befunde = joynTerminGeschaetztTrotzFenster(readJson<ReleaseEvent[]>('public/data/events.json', []), titel)
for (const b of befunde) console.log(`  ⚠ WARNUNG Joyn-Termin: ${b}`)
console.log(`Joyn-Termine mit ≈ trotz belegendem Fenster: ${befunde.length}`)
console.log('VERSTÖSSE: 0')
