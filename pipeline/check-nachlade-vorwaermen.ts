/**
 * Zusicherungen (05.11.2026): Das Vorwärmen der Nachlade-Pakete (`web/src/lib/nachlade-vorwaermen.ts`) lädt im Leerlauf ein Paket nach dem
 * anderen, überspringt knappe Leitungen, übersteht ein fehlgeschlagenes Paket und endet nach dem Abbruch. `window` ist eine Attrappe
 * mit Leerlauf-Warteschlange. Aufruf: `npm run check:logic`.
 */
import { leitungKnapp, nachladeVorwaermen } from '../web/src/lib/nachlade-vorwaermen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const warteschlange: Array<() => void> = []
const attrappe = {
  requestIdleCallback: (f: () => void) => warteschlange.push(f),
  cancelIdleCallback: () => {},
}
Object.assign(globalThis, { window: attrappe })
const tick = () => new Promise((r) => setTimeout(r, 0))
/** Führt alle fälligen Leerlauf-Aufgaben samt Mikrotasks aus. */
async function leerlaufDurch() {
  while (warteschlange.length) {
    warteschlange.shift()!()
    await tick()
  }
}

pruefe('Datensparmodus ist knapp', leitungKnapp({ saveData: true }))
pruefe('2g ist knapp', leitungKnapp({ effectiveType: '2g' }))
pruefe('3g ist knapp', leitungKnapp({ effectiveType: '3g' }))
pruefe('4g ist nicht knapp', !leitungKnapp({ effectiveType: '4g' }))
pruefe('ohne Angabe ist nicht knapp', !leitungKnapp(undefined))

const geladen: string[] = []
const paket = (name: string, scheitert = false) => () => {
  geladen.push(name)
  return scheitert ? Promise.reject(new Error('x')) : Promise.resolve()
}

nachladeVorwaermen([paket('a'), paket('b')], { saveData: true })
await leerlaufDurch()
pruefe('knappe Leitung lädt nichts', geladen.length === 0, geladen)

nachladeVorwaermen([paket('a'), paket('b', true), paket('c')], { effectiveType: '4g' })
pruefe('vor dem Leerlauf ist nichts geladen', geladen.length === 0, geladen)
warteschlange.shift()!()
await tick()
pruefe('ein Paket je Leerlauf', geladen.join() === 'a', geladen)
await leerlaufDurch()
pruefe('ein fehlgeschlagenes Paket stoppt die Folge nicht', geladen.join() === 'a,b,c', geladen)

geladen.length = 0
const ab = nachladeVorwaermen([paket('a'), paket('b')], undefined)
warteschlange.shift()!()
await tick()
ab()
await leerlaufDurch()
pruefe('nach dem Abbruch kommt kein weiteres Paket', geladen.join() === 'a', geladen)

console.log(verletzt ? `\ncheck-nachlade-vorwaermen: ${verletzt} verletzt` : '\ncheck-nachlade-vorwaermen: ok (Leitung, Reihenfolge, Fehler, Abbruch)')
process.exit(verletzt ? 1 : 0)
