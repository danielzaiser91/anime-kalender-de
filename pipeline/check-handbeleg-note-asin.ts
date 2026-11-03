/**
 * Fälle zu `findeFremdeNoteAsins` (03.11.2026) ohne `public/data`: Positivfall (Anlass Es war einmal … der Weltraum, Kennungen
 * aus dem Bestand), zwei Seiten in der Notiz (legitim), Notiz ohne Seitenkennung, eigene und mehrfach besessene Seite.
 * Läuft in `check:logic`; der Bestand wird in `check-handbeleg-note-asin-bestand.ts` geprüft.
 */
import { findeFremdeNoteAsins, NOTE_ASIN_ALTFAELLE } from './lib/handbeleg-note-asin.ts'
import type { BlockSeite } from './lib/handbeleg-notizseite.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}

const dp = (a: string) => `https://www.amazon.de/gp/video/detail/${a}`
const block = (anilistId: number, url: string, note?: string, platform = 'primevideo'): BlockSeite => ({ anilistId, platform, url, note })
const mensch = block(900001, dp('B00ERN03GM'), 'Amazon-Seite B00ERN03GM: alle 26 Folgen geprüft')
const finde = (b: BlockSeite[]) => findeFremdeNoteAsins(b).join()

pruefe('Weltraum S2 (11307) mit der Messung der Seite von „der Mensch“ ist rot', finde([mensch, block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: alle 26 Folgen')]) === '11307@B00ERN03GM')
pruefe('Zwei Seiten in der Notiz, eine ist die Adresse: kein Treffer', finde([mensch, block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: Kauf, Abo auf B088K17QGJ')]).length === 0)
pruefe('Adresse in der Notiz vor der Notizseite: kein Treffer', finde([mensch, block(11307, dp('B088K17QGJ'), 'Seitenadresse: B088K17QGJ, Amazon-Seite B00ERN03GM')]).length === 0)
pruefe('Nur die Kennung hinter „Amazon-Seite“ zählt, nicht eine frühere in der Notiz', finde([mensch, block(11307, dp('B088K17QGJ'), 'gti B0IRGENDWA, Amazon-Seite B00ERN03GM: x')]) === '11307@B00ERN03GM')
pruefe('Notiz ohne Seitenkennung: kein Treffer', finde([mensch, block(11307, dp('B088K17QGJ'), 'Tonspuren: Deutsch')]).length === 0)
pruefe('Block ohne Notiz: kein Treffer', finde([mensch, block(11307, dp('B088K17QGJ'))]).length === 0)
pruefe('Eigene Seite gleich Adresse: kein Treffer', finde([mensch, block(900001, dp('B00ERN03GM'), 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Notizseite ohne Besitzer im Bestand: kein Treffer (gleicher Titel, Messung an Schwesterseite)', finde([block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Notizseite ist die Adresse eines eigenen zweiten Blocks: kein Treffer', finde([block(11307, dp('B00ERN03GM')), block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Notizseite gehört zwei Titeln: kein Treffer', finde([mensch, block(900002, dp('B00ERN03GM')), block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Besitzer auf anderer Plattform zählt nicht', finde([block(900001, dp('B00ERN03GM'), '', 'netflix'), block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Block einer anderen Plattform zählt nicht', finde([mensch, block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x', 'netflix')]).length === 0)
pruefe('Block ohne Kennung zählt nicht', finde([mensch, { platform: 'primevideo', url: dp('B088K17QGJ'), note: 'Amazon-Seite B00ERN03GM: x' }]).length === 0)
pruefe('Block ohne Adress-Kennung zählt nicht', finde([mensch, block(11307, 'https://www.amazon.de/s?k=x', 'Amazon-Seite B00ERN03GM: x')]).length === 0)
pruefe('Zwei Blöcke desselben Titels mit derselben fremden Seite: ein Treffer', finde([mensch, block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x'), block(11307, dp('B0ANDERE01'), 'Amazon-Seite B00ERN03GM: y')]) === '11307@B00ERN03GM')
pruefe('Zwei Titel mit fremder Seite: beide, sortiert', finde([mensch, block(900009, dp('B0ZWEITE01'), 'Amazon-Seite B00ERN03GM: x'), block(11307, dp('B088K17QGJ'), 'Amazon-Seite B00ERN03GM: x')]) === '11307@B00ERN03GM,900009@B00ERN03GM')
pruefe('Ratsche: höchstens fünf Altfälle', NOTE_ASIN_ALTFAELLE.length <= 5, NOTE_ASIN_ALTFAELLE.length)

console.log(fehler ? `\n${fehler} von ${faelle} Fällen verletzt.` : `check-handbeleg-note-asin: ${faelle} Fälle ok.`)
process.exit(fehler ? 1 : 0)
