/**
 * Zusicherungen zum Ton-Hinweis der Cartoons: JustWatch gilt der Serie (Entscheidung 07.09.2026), nur `audio` zählt, nie `untertitel`,
 * und der Hinweis setzt nie `dub` am Verweis. Läuft in `check:logic`; die Prüfung am gebauten Bestand steht in
 * `check-cartoon-ton-bestand.ts` (`check:bestand`).
 */
import { jwTonAnbieter, tonAnbieterNamen } from './lib/cartoons.ts'

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
const doppelt = tonAnbieterNamen(['Amazon Prime Video', 'Amazon Prime Video with Ads', 'Apple TV', 'Apple TV Amazon Channel'])
pruefe('Anbieternamen: JustWatch-Varianten werden je Anbieter einmal genannt', new Set(doppelt).size === doppelt.length && doppelt.length <= 2, doppelt.join(' | '))
pruefe('kein Angebot, kein Hinweis', jwTonAnbieter(undefined).length === 0)

if (fehler) {
  console.error(`${fehler} Zusicherung(en) zum Cartoon-Ton verletzt`)
  process.exit(1)
}
console.log('Cartoon-Ton: Zusicherungen erfüllt')
