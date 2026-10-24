/**
 * Abhängigkeitslisten von Effekten (PR 1698: `[gewaehltId]` → `[]` überlebte, weil kein Test je neu renderte).
 * `ReihenSpur` läuft mehrfach durch `hakenLauf` (kein DOM): Der Start-Effekt setzt die Spur nur beim Öffnen und beim Wechsel des gewählten Teils.
 * Aufruf: `npm run check:logic`.
 */
import { hakenLauf } from './lib/haken-lauf.ts'
import { ReihenSpur } from '../web/src/components/detail/reihen-spur.tsx'

let verletzt = 0
function gleich(name: string, ist: unknown, soll: unknown): void {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}`)
}

/** Fake-Spur: die gewählte Karte steht bei `karte.offsetLeft`; jedes Setzen von `scrollLeft` landet im Protokoll. */
function fakeSpur() {
  const karte = { offsetLeft: 1000 }
  const gesetzt: number[] = []
  const spur = {
    clientWidth: 300,
    scrollWidth: 900,
    set scrollLeft(w: number) {
      gesetzt.push(w)
    },
    get scrollLeft() {
      return gesetzt.at(-1) ?? 0
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    querySelector: () => karte,
  }
  return { karte, gesetzt, spur }
}

Object.assign(globalThis, { requestAnimationFrame: () => 1, cancelAnimationFrame: () => undefined })
const t = ((k: string) => k) as never
const lauf = hakenLauf(ReihenSpur)
const f = fakeSpur()
const props = (gewaehltId: number) => ({ titel: 'Hauptserie', gewaehltId, erste: true, t, children: null })
// Die Spur ist das einzige `useRef` von ReihenSpur.
const einhaengen = (refs: { current: unknown }[]) => void (refs[0] && (refs[0].current ??= f.spur))

lauf.render(props(1), einhaengen)
gleich('Öffnen: Spur wird einmal an die gewählte Karte gesetzt', f.gesetzt.length, 1)
const erste = f.gesetzt[0]
gleich('Startwert ist nicht 0 (Karte liegt außerhalb)', (erste ?? 0) > 0, true)

lauf.render(props(1), einhaengen)
gleich('Neu rendern mit gleichem Teil: Spur bleibt stehen', f.gesetzt.length, 1)

f.karte.offsetLeft = 2000
lauf.render(props(2), einhaengen)
gleich('Anderer Teil gewählt: Spur wird neu gesetzt', f.gesetzt.length, 2)
gleich('Neue Position folgt der neuen Karte', (f.gesetzt[1] ?? 0) > (erste ?? 0), true)

lauf.schliessen()
if (verletzt > 0) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
console.log('\ncheck-effekt-abhaengigkeiten: ReihenSpur setzt die Spur nur beim Öffnen und beim Teilwechsel ✓')
