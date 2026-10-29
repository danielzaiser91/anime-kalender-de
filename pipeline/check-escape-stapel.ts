/**
 * Ablauf von `haengeEscape` (web/src/lib/escape.ts) mit Attrappen für `window` und `document`: Ein Escape gilt nur der zuletzt geöffneten
 * Ebene, gleich an welchem Ziel ihr Hörer hängt; Reihenfolge der Phasen wie im Browser (Fangphase window, document, dann Blase document, window).
 */
import { haengeEscape, type EscapeQuelle } from '../web/src/lib/escape.ts'

interface Taste {
  key: string
  defaultPrevented: boolean
  preventDefault: () => void
}

class Quelle implements EscapeQuelle {
  hoerer: { f: (e: Event) => void; capture: boolean }[] = []
  addEventListener(_t: string, f: EventListenerOrEventListenerObject, capture?: boolean | AddEventListenerOptions) {
    this.hoerer.push({ f: f as (e: Event) => void, capture: capture === true })
  }
  removeEventListener(_t: string, f: EventListenerOrEventListenerObject) {
    this.hoerer = this.hoerer.filter((h) => h.f !== f)
  }
  feuere(e: Taste, capture: boolean) {
    for (const h of [...this.hoerer]) if (h.capture === capture) h.f(e as unknown as Event)
  }
}

const win = new Quelle()
const dok = new Quelle()

/** Eine Taste wie im Browser: Fangphase window, document, Blase document, window; `vorher` markiert sie als schon verbraucht. */
function druecke(key = 'Escape', vorher = false): void {
  const e: Taste = { key, defaultPrevented: vorher, preventDefault() { this.defaultPrevented = true } }
  win.feuere(e, true)
  dok.feuere(e, true)
  dok.feuere(e, false)
  win.feuere(e, false)
}

let verletzt = 0
function pruefe(name: string, soll: string, ist: string): void {
  if (soll === ist) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — erwartet „${soll}“, gefunden „${ist}“`)
}

const gerufen: string[] = []
const nimm = () => gerufen.splice(0).join(',') || '-'
const ebene = (name: string, q: Quelle, capture = false) => haengeEscape(q, capture, () => void gerufen.push(name))

{
  const a = ebene('A', win)
  const b = ebene('B', win)
  druecke()
  pruefe('zwei Ebenen am window: nur die spätere', 'B', nimm())
  b()
  druecke()
  pruefe('nach dem Schließen der obersten: die darunter', 'A', nimm())
  a()
  druecke()
  pruefe('keine Ebene offen: nichts', '-', nimm())
}
{
  const a = ebene('A', dok)
  const b = ebene('B', win)
  druecke()
  pruefe('Dokument-Ebene zuerst, window später (document läuft vor window): nur window', 'B', nimm())
  b()
  a()
}
{
  const a = ebene('A', win)
  const b = ebene('B', dok)
  druecke()
  pruefe('window zuerst, Dokument später (der Fall Panel + Quellen-Fenster): nur das Dokument', 'B', nimm())
  b()
  druecke()
  pruefe('danach das Panel (window)', 'A', nimm())
  a()
}
{
  const a = ebene('A', win)
  const b = ebene('B', dok)
  const c = ebene('C', dok, true)
  druecke()
  pruefe('Fangphase später geöffnet: nur sie', 'C', nimm())
  b()
  druecke()
  pruefe('mittlere Ebene zurückgenommen: die oberste bleibt oberste', 'C', nimm())
  c()
  druecke()
  pruefe('danach die älteste', 'A', nimm())
  a()
}
{
  const a = ebene('A', win)
  const b = ebene('B', win)
  const c = ebene('C', win)
  b()
  druecke()
  pruefe('mittlere zurückgenommen, oberste offen', 'C', nimm())
  c()
  druecke()
  pruefe('oberste zurückgenommen, die älteste bekommt Escape', 'A', nimm())
  a()
}
{
  const a = ebene('A', win)
  druecke('Escape', true)
  pruefe('schon verbrauchtes Escape (preventDefault von außen): niemand', '-', nimm())
  druecke('ArrowDown')
  pruefe('andere Taste: niemand', '-', nimm())
  druecke('Enter')
  pruefe('Enter: niemand', '-', nimm())
  a()
}
{
  /* Ein Hörer, der nicht über den Helfer läuft (Leinwand), sieht ein verbrauchtes Escape als `defaultPrevented`. */
  let gesehen = 'nichts'
  win.addEventListener('keydown', ((e: Taste) => void (gesehen = e.defaultPrevented ? 'verbraucht' : 'frei')) as unknown as EventListener)
  const a = ebene('A', dok)
  druecke()
  pruefe('fremder Hörer hinter einer Ebene sieht Escape als verbraucht', 'verbraucht', gesehen)
  a()
  gesehen = 'nichts'
  druecke()
  pruefe('ohne Ebene bleibt Escape für den fremden Hörer frei', 'frei', gesehen)
  nimm()
  win.hoerer.pop()
}
{
  const a = ebene('A', win)
  a()
  const b = ebene('B', dok)
  druecke()
  pruefe('Ebene nach einer zurückgenommenen: gilt allein', 'B', nimm())
  b()
}

pruefe('nach allen Rücknahmen hängt nichts mehr an window und document', '0,0', `${win.hoerer.length},${dok.hoerer.length}`)

console.log(`check-escape-stapel: ${verletzt ? 'FEHLER' : 'ok'} (Reihenfolge window/document/Fangphase, Rücknahme mitten im Stapel, verbrauchtes Escape, andere Tasten)`)
process.exit(verletzt ? 1 : 0)
