// Kennwort eines Filmtitels für die CR-Suche (fetch-cr-filmbloecke.mjs): Titel wörtlich aus public/data/titles.json.
import { kennwort, kennwortRoh } from './lib/cr-kennwort.ts'

const roh: [string, string][] = [
  ['Fairy Tail: The Movie - Phoenix Priestess', 'Phoenix Priestess'],
  ['Haikyu!! Movie 1 - Ende und Anfang', 'Ende und Anfang'],
  ['Code Geass: Akito the Exiled - The Wyvern Arrives', 'The Wyvern Arrives'],
  ['Dr. STONE Special Episode – RYUSUI', 'RYUSUI'],
  ['JUJUTSU KAISEN: Hidden Inventory / Premature Death – The Movie', 'The Movie'],
  ['Detektiv Conan: Episode ONE - Der geschrumpfte Meisterdetektiv', 'Der geschrumpfte Meisterdetektiv'],
  // eigene Fälle für Gedankenstrich und Doppelpunkt ohne Leerzeichen davor
  ['Film — Untertitel', 'Untertitel'],
  ['Film: Untertitel', 'Untertitel'],
  ['Film:Untertitel', 'Untertitel'],
  ['Film:sturm', 'sturm'],
  // kein Trenner: "s-s" im Wort darf nichts trennen
  ['Kiss-Shot', 'Kiss-Shot'],
  ['Kiss-Shot Acerola', 'Kiss-Shot Acerola'],
  ['Haus-Stein', 'Haus-Stein'],
  ['Ohne Trenner', 'Ohne Trenner'],
  ['Film - „Untertitel"', 'Untertitel'],
  ['Film - ~Uniform~', 'Uniform'],
  // Trenner am Ende: der Titel davor bleibt
  ['Kampf der Welten:', 'Kampf der Welten'],
]
let fehler = 0
for (const [eingabe, erwartet] of roh) {
  const ist = kennwortRoh(eingabe)
  if (ist !== erwartet) {
    console.error(`✖ kennwortRoh(${JSON.stringify(eingabe)}) = ${JSON.stringify(ist)}, erwartet ${JSON.stringify(erwartet)}`)
    fehler++
  }
}
// beide Funktionen trennen gleich
for (const [eingabe] of roh) {
  const a = kennwort(eingabe)
  const b = kennwort(kennwortRoh(eingabe))
  if (a !== b) {
    console.error(`✖ kennwort(${JSON.stringify(eingabe)}) = ${JSON.stringify(a)} weicht von kennwort(kennwortRoh) = ${JSON.stringify(b)} ab`)
    fehler++
  }
}
if (kennwort('Fairy Tail: The Movie - Phoenix Priestess') !== 'phoenixpriestess') {
  console.error(`✖ kennwort Phoenix Priestess = ${kennwort('Fairy Tail: The Movie - Phoenix Priestess')}`)
  fehler++
}
if (fehler) process.exit(1)
console.log(`check-cr-kennwort: ${roh.length} Fälle ok`)
