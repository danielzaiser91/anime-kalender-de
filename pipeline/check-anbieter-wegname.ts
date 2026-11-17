/**
 * Zusicherungen zu `plattformVonWegName()` aus `web/src/lib/anbieter-wegname.ts`: bekannte Schreibweisen von JustWatch/TMDB ergeben die
 * Plattform, auch mit anderer Groß/klein-Schreibung, Klammerzusatz, „über …“ und Leerraum; alles andere (auch der Plattformname selbst
 * und Teilwörter) ergibt nichts. Läuft in `check:logic`.
 */
import { plattformVonWegName } from '../web/src/lib/anbieter-wegname.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const treffer: [string, string][] = [
  ['Disney Plus', 'disneyplus'],
  ['Animation Digital Network', 'adn'],
  ['RTL+', 'rtlplus'],
  ['Netflix Standard with Ads', 'netflix'],
  ['Paramount+', 'paramountplus'],
  ['DISNEY PLUS', 'disneyplus'],
  ['  Disney Plus  ', 'disneyplus'],
  ['Paramount+ (Amazon Channel)', 'paramountplus'],
  ['Animation Digital Network über Amazon Prime Video', 'adn'],
  ['RTL+ über Amazon (Kanal)', 'rtlplus'],
  ['Disney Plus(Kids)', 'disneyplus'],
]
for (const [name, soll] of treffer) pruefe(`Treffer: ${JSON.stringify(name)}`, plattformVonWegName(name), soll)

const keine = [
  'Netflix', // Plattformname selbst: kein Alias
  'Disney+',
  'Disney  Plus', // doppeltes Leerzeichen
  'Disney Plus Premium',
  'Paramount',
  'ADN',
  'RTL',
  'über RTL+',
  '(RTL+)',
  'Disney Plus über',
  '',
]
for (const name of keine) pruefe(`kein Treffer: ${JSON.stringify(name)}`, plattformVonWegName(name), undefined)

if (fehler) {
  console.error(`check-anbieter-wegname: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-anbieter-wegname: ok')
