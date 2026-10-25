/**
 * Negativtest für `pipeline/check-effekt-abhaengigkeiten.ts`: Der Wächter muss bei falschen Abhängigkeitslisten rot werden.
 * Die Mutanten haben denselben Start-Effekt wie `ReihenSpur`, nur mit anderer Liste.
 */
import { useLayoutEffect, useRef } from 'react'
import { pruefeSpurEffekt, type SpurProps } from '../pipeline/check-effekt-abhaengigkeiten.ts'
import { ReihenSpur } from '../web/src/components/detail/reihen-spur.tsx'
import { setzeStart } from '../web/src/components/detail/reihen-spur-regeln.ts'

type Spur = { querySelector: (s: string) => { offsetLeft: number }; clientWidth: number; scrollLeft: number }

function mutant(deps: (p: SpurProps) => unknown[] | undefined) {
  return (p: SpurProps) => {
    const spur = useRef<Spur>(null)
    useLayoutEffect(() => {
      const el = spur.current
      if (el) setzeStart(el, el.querySelector('[aria-selected="true"]'))
    }, deps(p))
    return null
  }
}

let fehler = 0
function erwarte(name: string, ist: boolean): void {
  if (ist) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}`)
}

erwarte('Original ReihenSpur: grün', pruefeSpurEffekt(ReihenSpur as never).length === 0)
erwarte('Mutant-Kontrolle [gewaehltId]: grün', pruefeSpurEffekt(mutant((p) => [p.gewaehltId])).length === 0)
erwarte('Mutant []: rot (Teilwechsel setzt die Spur nicht neu)', pruefeSpurEffekt(mutant(() => [])).some((v) => v.startsWith('Anderer Teil gewählt')))
erwarte('Mutant [erste]: rot (Teilwechsel setzt die Spur nicht neu)', pruefeSpurEffekt(mutant((p) => [p.erste])).some((v) => v.startsWith('Anderer Teil gewählt')))
erwarte('Mutant ohne Liste: rot (jedes Rendern setzt die Spur)', pruefeSpurEffekt(mutant(() => undefined)).some((v) => v.startsWith('Neu rendern mit gleichem Teil')))

if (fehler > 0) process.exit(1)
console.log('effekt-abhaengigkeiten.test: Wächter wird bei [], [erste] und fehlender Liste rot ✓')
