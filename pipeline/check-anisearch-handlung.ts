/**
 * Zusicherungen zu `lib/anisearch-handlung.ts`: nur der deutsche Block, Zeilenumbrüche, Quellenhinweis ab, Entities,
 * Mindestlänge und der Mitmach-Aufruf als Platzhalter. Läuft in `check:logic`.
 */
import { decode, extractDescription } from './lib/anisearch-handlung.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

pruefe('decode', decode('a&nbsp;b &amp; &quot;c&quot; d&#039;s e&#39;s f&apos;s &lt;g&gt; &#252;'), 'a b & "c" d\'s e\'s f\'s <g> ü')
pruefe('decode: ein Durchgang, &amp;lt; bleibt &lt;', decode('&amp;lt;'), '<')
pruefe('decode: leer', decode(''), '')

const LANG = 'Frieren ist eine Elfe, die nach dem Sieg über den Dämonenkönig weiterreist.'
const seite = (bloecke: string) => `<html><section id="description">${bloecke}</section></html>`

pruefe('deutscher Block nach dem englischen', extractDescription(seite(`<div lang="en">English text that is long enough to count here.</div><div lang="de" class="t">${LANG}</div>`)), LANG)
pruefe('nur englisch: nichts', extractDescription(seite('<div lang="en">English text that is long enough to count here.</div>')), undefined)
pruefe('ohne Abschnitt: nichts', extractDescription(`<div lang="de">${LANG}</div>`), undefined)
pruefe('leere Seite', extractDescription(''), undefined)
pruefe(
  'br wird Zeilenumbruch, mehr als zwei Leerzeilen werden eine, Tags fallen weg',
  extractDescription(seite(`<div lang="de">Erster Absatz, <b>fett</b> und lang genug.<br><br/><br />Zweiter Absatz.</div>`)),
  'Erster Absatz, fett und lang genug.\n\nZweiter Absatz.',
)
pruefe('Quellenhinweis als span fällt weg', extractDescription(seite(`<div lang="de">${LANG}<span class="source">Quelle: Verlag</span></div>`)), LANG)
pruefe('„Source:“ fällt weg', extractDescription(seite(`<div lang="de">${LANG} Source: Crunchyroll</div>`)), LANG)
pruefe('Entities im Text', extractDescription(seite(`<div lang="de">Tom &amp; Jerry &quot;jagen&quot; sich durch die ganze Stadt.</div>`)), 'Tom & Jerry "jagen" sich durch die ganze Stadt.')
pruefe('genau 40 Zeichen: zu kurz', extractDescription(seite(`<div lang="de">${'x'.repeat(40)}</div>`)), undefined)
pruefe('41 Zeichen: genug', extractDescription(seite(`<div lang="de">${'x'.repeat(41)}</div>`))?.length, 41)
pruefe('Länge nach dem Trimmen', extractDescription(seite(`<div lang="de">   ${'x'.repeat(39)}   </div>`)), undefined)
pruefe(
  'Mitmach-Aufruf ist keine Handlung',
  extractDescription(seite('<div lang="de">Eine kurze Inhaltsangabe zum Anime „X“ würde vielen Anime- und Manga-Fans weiterhelfen. Du kennst diesen Anime bereits? Dann unterstütze aniSearch und füge eine kurze Beschreibung hinzu.</div>')),
  undefined,
)
pruefe('Platzhalter ohne Groß/klein', extractDescription(seite(`<div lang="de">${LANG} UNTERSTÜTZE ANISEARCH</div>`)), undefined)

if (fehler) process.exit(1)
console.log('check-anisearch-handlung: ok')
