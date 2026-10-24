import { useEffect, useState } from 'react'
import type { EmpfehlungsDatei } from '@shared/empfehlung-pool.ts'
import { baueKontext, type Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { loadAllTitles, loadJson, type Dataset } from './data.ts'

let kontextVersprechen: Promise<Kontext> | undefined

/** Pool-Datei laden und den Merkmalsraum einmal rechnen; die Rechnung läuft nach dem ersten Bild (setTimeout), nicht im Ladeweg. */
export function ladeKontext(): Promise<Kontext> {
  kontextVersprechen ??= loadJson<EmpfehlungsDatei>('empfehlung.json').then(
    (datei) => new Promise<Kontext>((fertig) => setTimeout(() => fertig(baueKontext(datei)), 0)),
  )
  return kontextVersprechen
}

export interface EmpfehlungsDaten {
  kontext?: Kontext
  /** Bilder, Handlung-Zubehör, Trailer und Links je Kennung; kommen etwas später als der Kontext. */
  titel?: Map<number, Title>
  fehler?: true
}

/** Lädt Pool und Titelbestand parallel; die Reise startet, sobald der Kontext steht, die Bilder folgen. */
export function useEmpfehlungsDaten(data: Dataset): EmpfehlungsDaten {
  const [stand, setStand] = useState<EmpfehlungsDaten>({})
  useEffect(() => {
    let aktiv = true
    ladeKontext().then((kontext) => aktiv && setStand((s) => ({ ...s, kontext }))).catch(() => aktiv && setStand((s) => ({ ...s, fehler: true })))
    loadAllTitles(data)
      .then((alle) => aktiv && setStand((s) => ({ ...s, titel: new Map(alle.map((t) => [t.id, t])) })))
      .catch(() => undefined)
    return () => {
      aktiv = false
    }
  }, [data])
  return stand
}
