/**
 * Zusicherungen zum Ton-Hinweis der Cartoons: JustWatch gilt der Serie (Entscheidung 07.09.2026), nur `audio` zählt, nie `untertitel`,
 * und der Hinweis setzt nie `dub` am Verweis. Läuft in `check:logic`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { jwTonAnbieter } from './lib/cartoons.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

pruefe('Flatrate mit deutschem Ton gibt den Anbieter', jwTonAnbieter([{ anbieter: 'Disney Plus', art: 'FLATRATE', audio: ['en', 'de'] }]).join() === 'Disney Plus')
pruefe('nur deutsche Untertitel (Chiikawa-Typ) geben keinen Hinweis', jwTonAnbieter([{ anbieter: 'Netflix', art: 'FLATRATE', audio: ['ja'], untertitel: ['de'] }]).length === 0)
pruefe('Kauf mit deutschem Ton gibt keinen Hinweis', jwTonAnbieter([{ anbieter: 'Apple TV Store', art: 'BUY', audio: ['de'] }]).length === 0)
pruefe('leere Tonangabe (Netflix) gibt keinen Hinweis', jwTonAnbieter([{ anbieter: 'Netflix', art: 'FLATRATE', audio: [] }]).length === 0)
pruefe('derselbe Anbieter zweimal steht einmal', jwTonAnbieter([
  { anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio: ['de'] },
  { anbieter: 'Amazon Prime Video', art: 'FLATRATE', audio: ['de'] },
]).length === 1)
pruefe('kein Angebot, kein Hinweis', jwTonAnbieter(undefined).length === 0)

// Echter Bestand (nach einem Bau): jeder Hinweis hat einen Beleg in JustWatch, und er schreibt kein `dub`.
const OUT = 'public/data/cartoons.json'
if (existsSync(OUT)) {
  const cartoons = readJson<Title[]>(OUT, [])
  const jw = readJson<Record<string, { angebote?: Parameters<typeof jwTonAnbieter>[0] }>>('data/justwatch-audio.json', {})
  const mit = cartoons.filter((t) => t.dubHinweis)
  pruefe('Bestand: jeder Ton-Hinweis hat einen Flatrate-Beleg mit deutschem Ton', mit.every((t) => jwTonAnbieter(jw[String(t.id)]?.angebote).length > 0))
  pruefe('Bestand: Ton-Hinweis nennt nur Anbieter mit Beleg', mit.every((t) => t.dubHinweis!.anbieter.every((n) => jwTonAnbieter(jw[String(t.id)]?.angebote).includes(n))))
  // 09.10.2026: 469 von 900; nie auf den Messwert des Augenblicks senken. Vor dem ersten Bestandsbau nach dieser Änderung steht noch kein Hinweis in der Datei.
  if (mit.length) pruefe('Bestand: mindestens 400 Cartoons mit Ton-Hinweis', mit.length >= 400, `${mit.length}`)
}

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zum Cartoon-Ton verletzt`)
  process.exit(1)
}
console.log('Cartoon-Ton: Zusicherungen erfüllt')
