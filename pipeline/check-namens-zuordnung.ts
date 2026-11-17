/**
 * Zusicherungen zu `lib/namens-zuordnung.ts`: erst exakter Schlüssel, dann Anfang eines längeren Namens (ab 4 Zeichen, nur an Wortgrenze);
 * „exakt“ nur bei genau einem Treffer, dessen geführter Name der gemeldete ist. Läuft in `check:logic`.
 */
import { ratePerName } from './lib/namens-zuordnung.ts'
import { titelSchluessel } from './lib/zuordnung.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const NAMEN: Record<number, string> = {
  1: 'Magi: The Labyrinth of Magic',
  2: 'Imagination',
  3: 'Magi: The Kingdom of Magic',
  4: 'Frieren',
  5: 'Frieren',
  6: 'One Piece',
  7: 'Mob Psycho 100',
}
const nachTitel = new Map<string, number[]>()
for (const [id, name] of Object.entries(NAMEN)) {
  const k = titelSchluessel(name)
  nachTitel.set(k, [...(nachTitel.get(k) ?? []), Number(id)])
}
// Doppelte Kennung unter zwei Schlüsseln: zählt einmal.
nachTitel.set('one piece film', [6])
const unserName = (id: number) => NAMEN[id] ?? ''

pruefe('exakt, Plattformzusatz und Satzzeichen egal', ratePerName('One Piece – Netflix', nachTitel, unserName), { treffer: [6], exakt: true })
pruefe('Anfang an Wortgrenze, mehrere Treffer, nicht exakt', ratePerName('Magi', nachTitel, unserName), { treffer: [1, 3], exakt: false })
pruefe('Anfang mitten im Wort zählt nicht', ratePerName('imag', nachTitel, unserName), { treffer: [], exakt: false })
pruefe('exakter Schlüssel mit zwei Titeln: nicht exakt', ratePerName('Frieren', nachTitel, unserName), { treffer: [4, 5], exakt: false })
pruefe('Anfang mit genau einem Treffer: Vorschlag, nicht exakt', ratePerName('Mob Psycho', nachTitel, unserName), { treffer: [7], exakt: false })
pruefe('exakter Treffer verhindert die Anfangssuche', ratePerName('One Piece', nachTitel, unserName), { treffer: [6], exakt: true })
pruefe('kürzer als 4 Zeichen: keine Anfangssuche', ratePerName('Mob', nachTitel, unserName), { treffer: [], exakt: false })
pruefe('genau 4 Zeichen: Anfangssuche', ratePerName('Magi!', nachTitel, unserName).treffer, [1, 3])
pruefe('leerer Name', ratePerName('', nachTitel, unserName), { treffer: [], exakt: false })
pruefe('nur Satzzeichen', ratePerName('???', nachTitel, unserName), { treffer: [], exakt: false })
pruefe('Wortanfang „Fi“ trifft „Film“ nicht', ratePerName('One Piece Fi', new Map([['one piece film', [6]], ['one piece film red', [6]]]), unserName), { treffer: [], exakt: false })
pruefe('Kennung unter zwei Anfangstreffern zählt einmal; geführter Name gleich → exakt', ratePerName('One Piece', new Map([['one piece film', [6]], ['one piece film red', [6]]]), unserName), { treffer: [6], exakt: true })
pruefe('geführter Name weicht ab: nicht exakt', ratePerName('Magi The Labyrinth', nachTitel, () => 'Magi: Labyrinth'), { treffer: [1], exakt: false })

if (fehler) process.exit(1)
console.log('check-namens-zuordnung: ok')
