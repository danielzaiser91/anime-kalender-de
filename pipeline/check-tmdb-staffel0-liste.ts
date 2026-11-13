/**
 * Zusicherungen zu `staffel0ListeText()` aus `lib/tmdb-staffel0-liste.ts`: nur unsichere Urteile als Zeile, Zählzeile, Vorzeichen der
 * Tage, fehlende Länge, Name gleich/anders, Ersatzname und `|` in Zellen. Schreibt nichts. Läuft in `check:logic`.
 */
import type { Staffel0Eintrag, Staffel0Urteil } from './lib/tmdb-staffel0.ts'
import type { Staffel0Kandidat } from './lib/tmdb-staffel0-kandidaten.ts'
import { staffel0ListeText } from './lib/tmdb-staffel0-liste.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const kandidat = (id: number, namen: (string | null)[], start = '2024-04-01') => ({ id, titel: { namen, start }, serien: [1] }) as unknown as Staffel0Kandidat
const urteil = (stufe: Staffel0Urteil['stufe'], tage: number, laenge: number | null, name: boolean, grund = 'Datum nah, aber Name oder Länge tragen nicht'): Staffel0Urteil => ({
  stufe,
  grund,
  treffer: { serie: 777, e: 3, merkmale: { tage, laenge, name } } as NonNullable<Staffel0Urteil['treffer']>,
})

const kandidaten = [kandidat(1, ['Film A | Teil 1']), kandidat(2, [null, '', 'Romaji B']), kandidat(3, ['Sicher']), kandidat(4, []), kandidat(5, ['Ohne Urteil'])]
const offen = new Map<number, Staffel0Urteil>([
  [1, urteil('unsicher', 2, 3, true, 'Name gleich, aber   Datum | Länge')],
  [2, urteil('unsicher', -5, null, false)],
  [3, urteil('sicher', 0, 0, true)],
  [4, urteil('unsicher', 0, 0, false)],
])
const eintraege = { '3': {} as Staffel0Eintrag, '9': {} as Staffel0Eintrag }
const text = staffel0ListeText(kandidaten, offen, new Set(['a', 'b', 'c']), eintraege)
const zeilen = text.split('\n')

pruefe('Zählzeile', zeilen.find((z) => z.startsWith('Erzeugt von'))?.includes('2 Titel sind zugeordnet (`data/tmdb-staffel0.json`), 3 unsicher (diese Liste), 3 ohne Zuordnung'), true)
pruefe('nur unsichere Urteile, Reihenfolge der Kandidaten', zeilen.filter((z) => z.startsWith('| [')), [
  '| [Film A / Teil 1](https://anime-kalender.de/#/woche?t=1) | 2024-04-01 | [tv/777/season/0](https://www.themoviedb.org/tv/777/season/0) Folge 3 | +2 Tage, Länge ±3 min, Name gleich | Name gleich, aber Datum / Länge |',
  '| [Romaji B](https://anime-kalender.de/#/woche?t=2) | 2024-04-01 | [tv/777/season/0](https://www.themoviedb.org/tv/777/season/0) Folge 3 | -5 Tage, Länge –, Name anders | Datum nah, aber Name oder Länge tragen nicht |',
  '| [4](https://anime-kalender.de/#/woche?t=4) | 2024-04-01 | [tv/777/season/0](https://www.themoviedb.org/tv/777/season/0) Folge 3 | +0 Tage, Länge ±0 min, Name anders | Datum nah, aber Name oder Länge tragen nicht |',
])
pruefe('endet mit Leerzeile', text.endsWith('|\n'), true)
const leer = staffel0ListeText([], new Map(), new Set(), {}).split('\n')
pruefe('leer: Kopf ohne Zeilen', [leer.find((z) => z.startsWith('Erzeugt von'))?.includes('0 Titel sind zugeordnet'), leer.slice(-3)], [true, ['| Titel | Start | TMDB | Werte | Grund |', '|---|---|---|---|---|', '']])

if (fehler) process.exit(1)
console.log('check-tmdb-staffel0-liste: ok')
