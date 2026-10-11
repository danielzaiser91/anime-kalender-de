import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import './rahmen.css'
import type { FaelleDatei } from './faelle.ts'
import { geraeteFuer } from './geraete.ts'
import { Leiste } from './leiste.tsx'
import { Raster } from './raster.tsx'
import { ladeMockups } from './mockups-laden.ts'
import { alleMockups, mockupMit, type MockupDef } from './register.ts'
import { leseHash, zustandAus, type Zustand } from './zustand.ts'

function aktuellerHash(): string {
  return location.hash
}

function Uebersicht() {
  return (
    <main className="uebersicht">
      <h1>Bühne</h1>
      <p>Mockups auf der echten App: echte Bauteile, eingefrorene Fälle, kein Netz.</p>
      <ul>
        {alleMockups().map((m) => (
          <li key={m.name}>
            <a href={`#${m.name}`}>{m.titel}</a> <small>({m.ausschnitt})</small>
          </li>
        ))}
      </ul>
    </main>
  )
}

/** Fehlende oder unbekannte Fälle und Varianten werden zu den ersten des Mockups. */
function mitVorgaben(z: Zustand, def: MockupDef): Zustand {
  const fall = def.faelle.includes(z.fall) ? z.fall : (def.faelle[0] ?? '')
  const variante = z.variante in def.varianten ? z.variante : (Object.keys(def.varianten)[0] ?? '')
  const erlaubt: string[] = [...geraeteFuer(def.ausschnitt), 'beide']
  const geraet = erlaubt.includes(z.geraet) ? z.geraet : geraeteFuer(def.ausschnitt)[0]!
  return { ...z, fall, variante, geraet }
}

function Rahmen({ faelle }: { faelle: FaelleDatei }) {
  const [hash, setHash] = useState(aktuellerHash)
  useEffect(() => {
    const merke = () => setHash(aktuellerHash())
    window.addEventListener('hashchange', merke)
    return () => window.removeEventListener('hashchange', merke)
  }, [])
  const { name, werte } = leseHash(hash)
  const def = mockupMit(name)
  if (!def) return <Uebersicht />
  const ersteVariante = Object.keys(def.varianten)[0] ?? ''
  const zustand = mitVorgaben(zustandAus(name, werte), def)
  const namen = Object.fromEntries(Object.entries(faelle.faelle).map(([slug, f]) => [slug, f.name]))
  return (
    <>
      <Leiste def={def} zustand={zustand} faelle={namen} />
      {def.varianten[zustand.variante]?.notiz && <p className="notiz">{def.varianten[zustand.variante]!.notiz}</p>}
      <Raster def={def} zustand={zustand} ersteVariante={ersteVariante} />
    </>
  )
}

export function zeigeRahmen(root: HTMLElement, faelle: FaelleDatei): void {
  ladeMockups()
  createRoot(root).render(<Rahmen faelle={faelle} />)
}
