/**
 * Melde-Knopf erschien erst nach 9 s (Miraculous Staffel 20, Daniel 31.10.2026).
 *
 * Tagebuch der Diagnose: erste Antwort 20:28:12.454, `knopftext` erst 20:28:21.179 (Text vorher leer).
 * Ursache: `zeichnen()` steigt bei gleicher Zeichenkette aus; das erste Zeichnen lief, bevor der Speicher
 * (`erledigt`, `standGeladen`) da war, versteckte den Knopf („Serie unbekannt“), und nichts in der Zeichenkette
 * änderte sich, bis `ladeFristReif` nach 8 s kippte.
 * Geprüft wird der echte Aufruf aus amazon.js (Argumentliste wird herausgeschnitten und ausgewertet).
 */
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

const fehler = []
function pruefe(name, ok, gefunden) {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lies = (datei) => readFileSync(`${__dirname}/${datei}`, 'utf8')
const quelle = lies('amazon.js')
const k = {}
k.globalThis = k
vm.runInNewContext(lies('prime-stand.js'), k)

const aufruf = /const stand = globalThis\.akPrimeZeichenStand\(([^\n]*)\)\n/.exec(quelle)
pruefe('amazon.js bildet die Zeichenkette über akPrimeZeichenStand', aufruf !== null)

/* Die Zeichenkette zu einem Zeitpunkt nach dem Laden der Seite (Zeiten in ms seit der ersten Antwort). */
function zeichenStand(msSeitLaden, standGeladen) {
  const welt = {
    k,
    deutsch: false,
    geladen: 6,
    gesehen: { gesamt: 6 },
    wartet: msSeitLaden < 8000,
    zahlenStehen: msSeitLaden > 2000,
    freigabeReif: msSeitLaden > 12000,
    ladeFristReif: msSeitLaden > 8000,
    standGeladen,
  }
  return vm.runInNewContext(`k.globalThis.akPrimeZeichenStand(${aufruf?.[1] ?? ''})`.replace('k.globalThis', 'k'), { ...welt, globalThis: k })
}

/* Takt alle 500 ms wie im Betrieb: wann ändert sich die Zeichenkette zum ersten Mal nach dem Speicher? */
function ersteNeuzeichnungNachSpeicher(speicherDaMs) {
  let letzter = zeichenStand(0, false)
  for (let t = 500; t <= 12000; t += 500) {
    const jetzt = zeichenStand(t, t >= speicherDaMs)
    if (jetzt !== letzter) {
      if (t >= speicherDaMs) return t
      letzter = jetzt
    }
  }
  return null
}

pruefe('Speicher nach 100 ms da: Neuzeichnen binnen 1 s', (ersteNeuzeichnungNachSpeicher(100) ?? 99999) <= 1000, ersteNeuzeichnungNachSpeicher(100))
pruefe('Zeichenkette vor und nach dem Speicher verschieden', zeichenStand(300, false) !== zeichenStand(300, true))
pruefe('Fristwechsel nach 8 s bleibt in der Zeichenkette', zeichenStand(7500, true) !== zeichenStand(8500, true))

if (fehler.length) {
  console.error(`✖ ${fehler.length} Fehler`)
  process.exit(1)
}
console.log('knopf-erste-anzeige: ok')
