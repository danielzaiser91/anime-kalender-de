/**
 * Zusicherungen zu `lib/unbekannte-seite.ts`: Kennzeichen der Erweiterung, Katalogtreffer (Attrappe im Temp-Ordner), Widerspruch
 * zwischen Seite und Titel an den Toleranzgrenzen, Urteil und Zählzeile. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { istUnbekannteSeite, katalogTreffer, neuerZaehler, urteileUnbekannt, widerspruchZumTitel, zaehlzeile } from './lib/unbekannte-seite.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

pruefe('Kennzeichen allein', istUnbekannteSeite(['unbekannt=1']), true)
pruefe('Kennzeichen nach Komma/Leerzeichen, in einer von mehreren Notizen', istUnbekannteSeite([null, 'staffel=2,unbekannt=1 x']), true)
pruefe('Kennzeichen mit anderem Wert', istUnbekannteSeite(['unbekannt=10', 'unbekannt=0']), false)
pruefe('Kennzeichen als Wortteil', istUnbekannteSeite(['xunbekannt=1']), false)
pruefe('keine Notizen', istUnbekannteSeite([]), false)
pruefe('nur leere Notizen', istUnbekannteSeite([undefined, null, '']), false)

const wurzel = mkdtempSync(join(tmpdir(), 'unbekannte-seite-'))
try {
  pruefe('Katalog fehlt: kein Treffer', katalogTreffer(wurzel, 'Frieren'), [])
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  writeFileSync(
    join(wurzel, 'public/data/ohne-synchro-namen.json'),
    JSON.stringify([
      { id: 1, titleDe: 'Frieren – Nach dem Ende der Reise', titleEn: 'Frieren: Beyond Journey’s End' },
      { id: 2, titleRomaji: 'Sousou no Frieren' },
      { id: 3, titleEn: 'FRIEREN!' },
      { id: 3, titleDe: 'Frieren' },
      { id: 4, titleEn: 'Frieren 2' },
    ]),
  )
  pruefe('Name über alle drei Namensfelder, ohne Doppelte, Satzzeichen und Groß/klein egal', katalogTreffer(wurzel, 'frieren'), [3])
  pruefe('Romaji', katalogTreffer(wurzel, 'Sousou no Frieren – Prime Video'), [2])
  pruefe('leerer Name', katalogTreffer(wurzel, ''), [])
  pruefe('Name nur aus Satzzeichen', katalogTreffer(wurzel, '…'), [])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

pruefe('passt', widerspruchZumTitel(12, { episodes: 12, format: 'TV' }, 1), null)
pruefe('Obergrenze ×1,5 noch passend', widerspruchZumTitel(18, { episodes: 12 }, 1), null)
pruefe('über ×1,5', widerspruchZumTitel(19, { episodes: 12 }, 1), 'Seite nennt 19 Folgen, der Titel hat 12')
pruefe('Untergrenze ÷1,5 noch passend', widerspruchZumTitel(8, { episodes: 12 }, 1), null)
pruefe('unter ÷1,5', widerspruchZumTitel(7, { episodes: 12 }, 1), 'Seite nennt 7 Folgen, der Titel hat 12')
pruefe('Seite ohne Folgenzahl', widerspruchZumTitel(0, { episodes: 12 }, 1), null)
pruefe('Titel ohne Folgenzahl', widerspruchZumTitel(50, { format: 'TV' }, 1), null)
pruefe('unbekannter Titel', widerspruchZumTitel(5, undefined, 1), null)
pruefe('Film mit einer Folge', widerspruchZumTitel(1, { episodes: 1, format: 'MOVIE' }, 1), null)
pruefe('Film ohne Folgenzahl, Seite mit mehreren', widerspruchZumTitel(2, { format: 'MOVIE' }, 1), 'Seite nennt 2 Folgen, der Titel ist ein Film')
pruefe('Reihe', widerspruchZumTitel(12, { episodes: 12 }, 3), 'der Titel gehört zu einer Reihe mit 3 Einträgen, die Staffel der Seite ist nicht bestimmt')
pruefe('Folgenzahl geht vor Reihe', widerspruchZumTitel(30, { episodes: 12 }, 3), 'Seite nennt 30 Folgen, der Titel hat 12')

pruefe('Bestand ohne Grund', urteileUnbekannt([5, 6], [9]), { art: 'mehrdeutig', vorschlag: [5, 6], zuTun: 'Mehrere oder nur ähnliche Treffer: den richtigen Titel wählen, die Seite als Verweis eintragen' })
pruefe('Bestand mit Grund', urteileUnbekannt([5], [], 'x').zuTun, 'Name stimmt, aber x: den richtigen Titel wählen, die Seite als Verweis eintragen')
pruefe('nur Katalog', urteileUnbekannt([], [9]), { art: 'katalog', vorschlag: [9], zuTun: 'Titel steht im Katalog ohne Synchro: Seite als Verweis und Synchro-Beleg eintragen' })
pruefe('nichts', urteileUnbekannt([], [], 'egal'), { art: 'keiner', vorschlag: [], zuTun: 'Kein Treffer im Bestand: Seite öffnen, Titel anlegen oder verwerfen' })

pruefe('Zählzeile leer ohne Meldung', zaehlzeile(neuerZaehler()), '')
pruefe('Zählzeile', zaehlzeile({ ...neuerZaehler(), eindeutig: 2, ueberAdresse: 1, keiner: 4 }), 'Unbekannte Prime-Seiten: 7 gemeldet — 2 über den Namen zugeordnet, 1 über die Adresse, 0 mehrdeutig, 0 im Katalog ohne Synchro, 4 ohne Treffer')
pruefe('neuer Zähler ist frisch', [neuerZaehler() !== neuerZaehler(), neuerZaehler()], [true, { eindeutig: 0, mehrdeutig: 0, katalog: 0, keiner: 0, ueberAdresse: 0 }])

if (fehler) process.exit(1)
console.log('check-unbekannte-seite: ok')
