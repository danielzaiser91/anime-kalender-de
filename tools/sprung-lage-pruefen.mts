// Zusicherung: das Datumsfenster liegt immer vollständig im Bild (web/src/lib/sprung-lage.ts); Knopf in der Leiste unten öffnet nach oben.
import { sprungLage } from '../web/src/lib/sprung-lage.ts'

let fehler = 0
const ist = (ok: boolean, t: string) => {
  console.log((ok ? '✓ ' : '✗ ') + t)
  if (!ok) fehler++
}

const knopfUnten = { top: 840, bottom: 884, left: 330 }
const unten = sprungLage(knopfUnten, { breite: 1280, hoehe: 900 })
ist(unten.top === undefined && unten.bottom === 900 - 840 + 6, 'Knopf in der Leiste unten: Fenster öffnet nach oben')
ist(unten.maxHoehe >= 330, 'unten: nach oben ist Platz für die ganze Tagesansicht')

const knopfOben = { top: 20, bottom: 64, left: 1000 }
const oben = sprungLage(knopfOben, { breite: 1280, hoehe: 900 })
ist(oben.top === 70 && oben.bottom === undefined, 'Knopf oben: Fenster öffnet nach unten')
ist(oben.left === 1280 - 280 - 16, 'rechter Rand: das Fenster rutscht nach links ins Bild')

const quer = sprungLage({ top: 330, bottom: 374, left: 300 }, { breite: 851, hoehe: 393 })
ist(quer.bottom === 393 - 330 + 6 && quer.maxHoehe === 330 - 6 - 8, 'Handy quer (393 hoch): nach oben, Höhe auf den Platz begrenzt')

const mitte = sprungLage({ top: 400, bottom: 444, left: 10 }, { breite: 393, hoehe: 900 })
ist(mitte.top === 450 && mitte.left === 10, 'genug Platz darunter: unten, linksbündig mit dem Knopf')

process.exitCode = fehler ? 1 : 0
