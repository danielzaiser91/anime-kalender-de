/** Test für `pipeline/lib/haken-lauf.ts`: Effekt-Regeln (Deps, Aufräumen vor Neulauf, Schließen). */
import { useEffect } from 'react'
import { hakenLauf } from '../pipeline/lib/haken-lauf.ts'

let fehler = 0
function gleich(name: string, ist: unknown, soll: unknown): void {
  if (JSON.stringify(ist) === JSON.stringify(soll)) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name} — gefunden: ${JSON.stringify(ist)}, erwartet: ${JSON.stringify(soll)}`)
}

function probe(deps: (p: { a: number }) => unknown[] | undefined) {
  const protokoll: string[] = []
  const lauf = hakenLauf((p: { a: number }) => {
    useEffect(() => {
      protokoll.push(`lauf${p.a}`)
      return () => void protokoll.push(`weg${p.a}`)
    }, deps(p))
    return null
  })
  return { protokoll, lauf }
}

const mitA = probe((p) => [p.a])
mitA.lauf.render({ a: 1 })
gleich('erster Durchlauf ruft den Effekt', mitA.protokoll, ['lauf1'])
mitA.lauf.render({ a: 1 })
gleich('gleiche Deps: Effekt ruft nicht erneut', mitA.protokoll, ['lauf1'])
mitA.lauf.render({ a: 2 })
gleich('neue Deps: erst Aufräumen, dann Neulauf', mitA.protokoll, ['lauf1', 'weg1', 'lauf2'])
mitA.lauf.schliessen()
gleich('schliessen räumt den letzten Lauf auf', mitA.protokoll, ['lauf1', 'weg1', 'lauf2', 'weg2'])

const leer = probe(() => [])
leer.lauf.render({ a: 1 })
leer.lauf.render({ a: 2 })
gleich('Liste []: nur einmal', leer.protokoll, ['lauf1'])

const ohne = probe(() => undefined)
ohne.lauf.render({ a: 1 })
ohne.lauf.render({ a: 1 })
gleich('ohne Liste: jedes Mal, mit Aufräumen davor', ohne.protokoll, ['lauf1', 'weg1', 'lauf1'])

if (fehler > 0) process.exit(1)
console.log('haken-lauf.test: Deps, Aufräumen vor Neulauf, schliessen ✓')
