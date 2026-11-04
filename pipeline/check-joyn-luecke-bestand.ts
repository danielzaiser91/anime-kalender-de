/**
 * Bestandswächter: Titel, die bei JustWatch ein Joyn-Angebot haben und bei uns keinen Joyn-Weg (Regel in `lib/joyn-luecke.ts`).
 * Ausnahmen mit Grund stehen in `data/joyn-luecke-ausnahmen.json`. Nur Warnung (Exit 0): eine tote Joyn-Adresse nimmt die Linkprüfung jederzeit
 * heraus, Rot stoppte den ganzen Bestandsbau. Liest `public/data`, gehört deshalb in `check:bestand`.
 */
import { readFileSync } from 'node:fs'
import { joynLuecken, ordneAusnahmen, type Ausnahme } from './lib/joyn-luecke.ts'

const lies = <T>(pfad: string): T => JSON.parse(readFileSync(pfad, 'utf8')) as T

const titel = [...lies<{ id: number; streams?: { platform: string }[] }[]>('public/data/titles.json'), ...lies<{ id: number; streams?: { platform: string }[] }[]>('public/data/cartoons.json')]
const ausnahmen = lies<Ausnahme[]>('data/joyn-luecke-ausnahmen.json')
const luecken = joynLuecken(titel, lies('data/justwatch-audio.json'))
const { offen, veraltet } = ordneAusnahmen(luecken, ausnahmen)
console.log(`Joyn-Lücke: ${luecken.length} von ${titel.length} Titeln mit JustWatch-Joyn ohne Joyn-Weg, ${ausnahmen.length} Ausnahmen, ${offen.length} offen, ${veraltet.length} Ausnahmen ohne Lücke`)
for (const id of offen.slice(0, 10)) console.log(`  ⚠ WARNUNG Joyn-Lücke: Titel ${id} hat bei JustWatch ein Joyn-Angebot, bei uns keinen Joyn-Weg (Ursache beheben oder mit Grund in data/joyn-luecke-ausnahmen.json eintragen)`)
for (const id of veraltet) console.log(`  ⚠ WARNUNG Joyn-Lücke: Ausnahme für Titel ${id} gilt nicht mehr, Eintrag aus data/joyn-luecke-ausnahmen.json streichen`)
console.log('VERSTÖSSE: 0')
