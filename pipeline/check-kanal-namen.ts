/**
 * Zusicherung: **Die Kanal-Gegenprobe wirft Klammerzusätze aus dem Abo-Namen** (22.09.2026, „Abos: crunchyrollde (Meldung 4738)").
 * Als Lauf der Funktion, die `kanal-gegenprobe.ts` aufruft — ersetzt die Quelltext-Zusicherung in `check-logic.ts`.
 */
import { kanalNamen } from './lib/kanal-namen.ts'

const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

erwarte('Klammerzusatz fällt weg, de am Ende auch', kanalNamen('Abos: crunchyrollde (Meldung 4738)'), ['crunchyroll'])
erwarte('mehrere Kanäle, Zusatz nur beim zweiten', kanalNamen('Abos: netflix, crunchyrollde (Meldung 4738), joyn'), ['netflix', 'crunchyroll', 'joyn'])
erwarte('Klammer mitten im Namen', kanalNamen('Abos: disney (x) plus'), ['disneyplus'])
erwarte('Zusatz nach der Liste endet an zugang=', kanalNamen('Abos: netflix, zugang=abo'), ['netflix'])
erwarte('Zusatz nach der Liste endet an Gedankenstrich', kanalNamen('Abos: netflix — Sonstiges, joyn'), ['netflix'])
erwarte('prime und „keine angabe“ zählen nicht', kanalNamen('Abos: prime, Keine Angabe, ADN'), ['adn'])
erwarte('ohne Abos-Teil leer', kanalNamen('Sonstige Notiz'), [])
erwarte('ohne Notiz leer', kanalNamen(undefined), [])

if (fehler.length) {
  console.error(`FEHL check-kanal-namen:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-kanal-namen: ${pruefungen} Prüfungen ok.`)
