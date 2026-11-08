/**
 * Bestandsprüfung (`public/data`): TV-Termin bei einem Joyn-Sender, aber kein Joyn-Weg (Regel in `lib/joyn-sender-luecke.ts`).
 * Nur eine Warnung (Exit 0): ein Joyn-Weg kommt aus JustWatch oder von Hand, und ein neuer Termin darf den Bestandsbau nicht anhalten.
 */
import { readJson } from './lib/util.ts'
import { joynLueckeZeile, joynLuecken } from './lib/joyn-sender-luecke.ts'
import { todayIso } from '../shared/time.ts'

type Eingabe = Parameters<typeof joynLuecken>
const heute = todayIso()
const luecken = joynLuecken(readJson<Eingabe[0]>('public/data/releases.json', []), readJson<Eingabe[1]>('public/data/titles.json', []), heute)

console.log(`Joyn-Lücke (TV-Termin ohne Joyn-Weg): ${luecken.length}`)
const zeile = joynLueckeZeile(luecken)
if (zeile) console.log(`  ${zeile}`)
console.log('VERSTÖSSE: 0')
