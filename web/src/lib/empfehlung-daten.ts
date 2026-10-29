import { useEffect, useState } from 'react'
import type { EmpfehlungsDatei } from '@shared/empfehlung-pool.ts'
import { baueKontext, type Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { loadAllTitles, loadJson, type Dataset } from './data.ts'
import { ecchiZeigen } from './ecchi.ts'

let kontextVersprechen: Promise<Kontext> | undefined

/** Die Datei ohne Ecchi-Einstiege (Genre-Index aus der Datei selbst), solange Ecchi ausgeblendet ist (`ecchi.ts`). */
export function ohneEcchiEinstiege(datei: EmpfehlungsDatei, zeigen = ecchiZeigen()): EmpfehlungsDatei {
  const ecchi = datei.genres.indexOf('Ecchi')
  if (zeigen || ecchi < 0) return datei
  return { ...datei, einstiege: datei.einstiege.filter((k) => !k.g.includes(ecchi)) }
}

/** Pool-Datei laden und den Merkmalsraum einmal rechnen; die Rechnung läuft nach dem ersten Bild (setTimeout), nicht im Ladeweg. */
export function ladeKontext(): Promise<Kontext> {
  kontextVersprechen ??= loadJson<EmpfehlungsDatei>('empfehlung.json').then(
    (datei) => new Promise<Kontext>((fertig) => setTimeout(() => fertig(baueKontext(ohneEcchiEinstiege(datei))), 0)),
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
