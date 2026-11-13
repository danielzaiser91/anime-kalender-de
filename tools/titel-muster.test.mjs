/**
 * Zusicherungen zu `pipeline/lib/titel-muster.mjs`: welche Videotitel auf eine deutsche Fassung deuten und welche ausdrücklich eine andere nennen.
 * Läuft in `tools/tests-alle.mjs`.
 */
import { ANDERE_FASSUNG, DEUTSCHE_SPUR } from '../pipeline/lib/titel-muster.mjs'

let fehler = 0
function pruefe(muster, name, titel, soll) {
  const ist = muster.test(titel)
  if (ist !== soll) {
    fehler++
    console.error(`FEHLER ${name}: „${titel}“ → ${ist}, erwartet ${soll}`)
  }
}

const deutsch = [
  ['Naruto - Der Film (Ganzer Film)', true],
  ['One Piece Ganzer Film auf Deutsch', true],
  ['Pokémon GERMAN DUB', true],
  ['Detektiv Conan Folge 1', true],
  ['Attack on Titan Staffel 2', true],
  ['Spy x Family Synchronfassung Trailer', true],
  ['Frieren deutsch', true],
  // Wortgrenzen: Teilwörter und Allerweltswörter zählen nicht.
  ['Folgenreich: Trailer', false],
  ['Deutschland-Tour Vlog', false],
  ['Der Weg', false],
  ['Das Boot', false],
  ['Attack on Titan Part 1 (English Dub)', false],
  ['', false],
]
for (const [titel, soll] of deutsch) pruefe(DEUTSCHE_SPUR, 'DEUTSCHE_SPUR', titel, soll)

const andere = [
  ['Tokyo Ghoul, 2. Staffel, 1. Episode, OmU', true],
  ['Anime, My Hero Academia, Episode 01, OmU', true],
  ['Frieren OmdU', true],
  ['Frieren mit deutschen Untertitel', true],
  ['Frieren mit deutscher Untertitelung', true],
  ['Bleach subbed', true],
  ['Bleach (sub)', true],
  ['Bleach (Sub) Folge 1', true],
  ['Attack on Titan Part 1 (English Dub)', true],
  ['Folge 1 Englisch Sub', true],
  ['Folge 1 French Dub', true],
  ['Folge 1 SpanishDub', true],
  // „German Dub“ ist unsere Fassung; Teilwörter und andere Sprachen ohne Dub/Sub zählen nicht.
  ['Pokémon German Dub', false],
  ['Subaru Trailer', false],
  ['English Trailer', false],
  ['Folge 1 Japanese Dub', false],
  ['', false],
]
for (const [titel, soll] of andere) pruefe(ANDERE_FASSUNG, 'ANDERE_FASSUNG', titel, soll)

if (fehler) process.exit(1)
console.log(`titel-muster.test: ${deutsch.length + andere.length} Fälle ok`)
