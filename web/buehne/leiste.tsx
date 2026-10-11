import type { MockupDef } from './register.ts'
import { hashVon, type Geraet, type Seitenteil, type Thema, type Zustand } from './zustand.ts'

function Gruppe<T extends string>({ name, werte, aktuell, setze }: { name: string; werte: [T, string][]; aktuell: T; setze: (wert: T) => void }) {
  return (
    <div className="gruppe">
      <span>{name}</span>
      {werte.map(([wert, text]) => (
        <button key={wert} type="button" aria-pressed={wert === aktuell} onClick={() => setze(wert)}>
          {text}
        </button>
      ))}
    </div>
  )
}

const GERAETE: [Geraet, string][] = [['375', 'Handy 375'], ['512', 'Desktop 512'], ['beide', 'beide']]
const THEMEN: [Thema, string][] = [['hell', 'hell'], ['dunkel', 'dunkel'], ['beide', 'beide']]
const TEILE: [Seitenteil, string][] = [['vorher', 'Vorher'], ['nachher', 'Nachher'], ['beide', 'beide']]

/** Die gemeinsame Leiste aller Mockups: Variante · Fall · Gerät · Thema · Vorher/Nachher. Jeder Klick ändert nur den Hash. */
export function Leiste({ def, zustand, faelle }: { def: MockupDef; zustand: Zustand; faelle: Record<string, string> }) {
  const aendere = (teil: Partial<Zustand>) => {
    location.hash = hashVon({ ...zustand, ...teil })
  }
  return (
    <header className="leiste">
      <a href="#" className="zurueck">Bühne</a>
      <h1>{def.titel}</h1>
      <Gruppe name="Variante" werte={Object.keys(def.varianten).map((v): [string, string] => [v, v])} aktuell={zustand.variante} setze={(variante) => aendere({ variante })} />
      <Gruppe name="Fall" werte={def.faelle.map((f): [string, string] => [f, faelle[f] ?? f])} aktuell={zustand.fall} setze={(fall) => aendere({ fall })} />
      <Gruppe name="Gerät" werte={GERAETE} aktuell={zustand.geraet} setze={(geraet) => aendere({ geraet })} />
      <Gruppe name="Thema" werte={THEMEN} aktuell={zustand.thema} setze={(thema) => aendere({ thema })} />
      <Gruppe name="Ansicht" werte={TEILE} aktuell={zustand.teil} setze={(teil) => aendere({ teil })} />
    </header>
  )
}
