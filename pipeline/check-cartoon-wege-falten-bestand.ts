/**
 * Bestandsteil zum Falten der Cartoon-Wege: Das Panel (`sortiereNachZugang`) zeigt für Om Nom Stories nicht mehr 56 Pillen,
 * und Jack behält seine drei Netflix-Pillen mit je eigenem Haken. Fängt den Aufrufer (`wege-sortieren.ts`), den
 * `check-cartoon-wege-falten.ts` nicht sieht. Läuft in `check:bestand`.
 */
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { readJson } from './lib/util.ts'
import type { Title } from '../shared/types.ts'

const OM_NOM = -57480
const JACK = -92684
const MAX_PILLEN_OM_NOM = 12

const cartoons = readJson<Title[]>('public/data/cartoons.json', [])
const pillen = (id: number) =>
  sortiereNachZugang({ title: cartoons.find((t) => t.id === id) }).flatMap((g) => g.plattformen)
let fehler = 0

const om = pillen(OM_NOM)
if (om.length === 0) {
  console.log('Cartoon-Wege falten (Bestand): Om Nom Stories nicht im Bestand, übersprungen')
} else {
  if (om.length > MAX_PILLEN_OM_NOM) {
    fehler++
    console.error(`FEHLER: Om Nom Stories zeigt ${om.length} Pillen (höchstens ${MAX_PILLEN_OM_NOM})`)
  }
  const jack = pillen(JACK).filter((s) => s.platform === 'netflix')
  if (jack.length !== 3 || jack.some((s) => !s.dub)) {
    fehler++
    console.error(`FEHLER: Jack zeigt ${jack.length} Netflix-Pillen mit Haken, erwartet 3`)
  }
}

if (fehler) process.exit(1)
console.log('Cartoon-Wege falten (Bestand): Zusicherungen erfüllt')
