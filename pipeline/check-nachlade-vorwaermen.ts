/**
 * Zusicherungen (05.11.2026): Das Vorwärmen der Nachlade-Pakete (`web/src/lib/nachlade-vorwaermen.ts`) lädt im Leerlauf ein Paket nach dem
 * anderen, überspringt knappe Leitungen, übersteht ein fehlgeschlagenes Paket und endet nach dem Abbruch. `window` ist eine Attrappe
 * mit Leerlauf-Warteschlange. Aufruf: `npm run check:logic`.
 */
import { readFileSync } from 'node:fs'
import { leitungKnapp, nachladeVorwaermen, PAKETE } from '../web/src/lib/nachlade-vorwaermen.ts'

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

/* Standardliste: genau die vier Ziele in dieser Reihenfolge (Laden der echten Module braucht Browser-APIs, daher die Quelle der Ladefunktion); ohne sie bliebe das Vorwärmen still lückenhaft. */
const erwartet = ['DetailPanel.tsx', 'FilterFeld.tsx', 'MonthView.tsx', 'Einstellungen.tsx']
pruefe('Standardliste hat vier Pakete', PAKETE.length === 4, PAKETE.length)
const quellen = PAKETE.map((p) => String(p))
for (const [i, name] of erwartet.entries()) pruefe(`Standardliste Paket ${i + 1} lädt ${name}`, quellen[i]?.includes(name) === true, quellen[i])
const vorher = warteschlange.length
nachladeVorwaermen(undefined, { effectiveType: '4g' })
pruefe('Standardliste: ein Leerlauf wartet, geladen wird erst darin', warteschlange.length === vorher + 1)
warteschlange.length = 0

/* Verdrahtung: App.tsx startet das Vorwärmen mit der Standardliste, sobald der Bestand da ist (voll). */
const app = readFileSync(new URL('../web/src/App.tsx', import.meta.url), 'utf8')
pruefe('App.tsx ruft nachladeVorwaermen() ohne Argumente unter der Bedingung voll', /voll \? nachladeVorwaermen\(\) : undefined/.test(app))

/* Safari: ohne requestIdleCallback läuft der Rückfall über setTimeout, nie im selben Tick, Abbruch per clearTimeout. */
const zeitgeber: Array<{ f: () => void; weg: boolean }> = []
const gerufen: string[] = []
Object.assign(globalThis, {
  window: {
    setTimeout: (f: () => void) => zeitgeber.push({ f, weg: false }),
    clearTimeout: (n: number) => {
      gerufen.push('clearTimeout')
      zeitgeber[n - 1].weg = true
    },
    cancelIdleCallback: () => gerufen.push('cancelIdleCallback'),
  },
})
geladen.length = 0
const abSafari = nachladeVorwaermen([paket('a'), paket('b')], { effectiveType: '4g' })
pruefe('ohne requestIdleCallback: im selben Tick ist nichts geladen, ein Zeitgeber läuft', geladen.length === 0 && zeitgeber.length === 1, { geladen, zeitgeber: zeitgeber.length })
zeitgeber[0].f()
await tick()
pruefe('ohne requestIdleCallback: der Zeitgeber lädt das erste Paket, der nächste wartet', geladen.join() === 'a' && zeitgeber.length === 2, { geladen, zeitgeber: zeitgeber.length })
abSafari()
pruefe('Abbruch im setTimeout-Zweig ruft clearTimeout, nicht cancelIdleCallback', gerufen.join() === 'clearTimeout' && zeitgeber[1].weg, gerufen)

console.log(verletzt ? `\ncheck-nachlade-vorwaermen: ${verletzt} verletzt` : '\ncheck-nachlade-vorwaermen: ok (Leitung, Reihenfolge, Fehler, Abbruch, Standardliste, App-Verdrahtung, setTimeout-Rückfall)')
process.exit(verletzt ? 1 : 0)
