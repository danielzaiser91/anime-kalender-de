/**
 * Zusicherungen zum Ton-Hinweis der Cartoons am gebauten Bestand: jeder Hinweis hat einen Beleg in JustWatch.
 * Läuft in `check:bestand` (nach dem Bau), nicht in `check:logic`: Der Bestand liegt hinter neueren Rohdaten zurück,
 * sobald ein Sammellauf `data/justwatch-audio.json` erneuert, und würde sonst jeden PR rot machen (12.10.2026).
 * Die reinen Logik-Zusicherungen stehen in `check-cartoon-ton.ts`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { jwTonAnbieter, tonAnbieterNamen } from './lib/cartoons.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const OUT = 'public/data/cartoons.json'
if (!existsSync(OUT)) {
  console.error(`FEHLER: ${OUT} fehlt — erst bauen`)
  process.exit(1)
}
const cartoons = readJson<Title[]>(OUT, [])
const jw = readJson<Record<string, { angebote?: Parameters<typeof jwTonAnbieter>[0] }>>('data/justwatch-audio.json', {})
const mit = cartoons.filter((t) => t.dubHinweis)
pruefe('Bestand: jeder Ton-Hinweis hat einen Flatrate-Beleg mit deutschem Ton', mit.every((t) => jwTonAnbieter(jw[String(t.id)]?.angebote).length > 0))
pruefe('Bestand: Ton-Hinweis nennt nur Anbieter mit Beleg', mit.every((t) => t.dubHinweis!.anbieter.every((n) => tonAnbieterNamen(jwTonAnbieter(jw[String(t.id)]?.angebote)).includes(n))))
pruefe('Bestand: kein Anbieter doppelt im Ton-Hinweis', mit.every((t) => new Set(t.dubHinweis!.anbieter).size === t.dubHinweis!.anbieter.length))
// 09.10.2026: 469 von 900; nie auf den Messwert des Augenblicks senken. Vor dem ersten Bestandsbau nach dieser Änderung steht noch kein Hinweis in der Datei.
if (mit.length) pruefe('Bestand: mindestens 400 Cartoons mit Ton-Hinweis', mit.length >= 400, `${mit.length}`)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zum Cartoon-Ton im Bestand verletzt`)
  process.exit(1)
}
console.log('Cartoon-Ton im Bestand: Zusicherungen erfüllt')
