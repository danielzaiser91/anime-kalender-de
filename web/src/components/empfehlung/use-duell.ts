import { useEffect, useMemo, useRef, useState } from 'react'
import type { Antwort, Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import type { Title } from '@shared/types.ts'
import { baueDuellSteuerung, type DuellSchritt } from '../../lib/empfehlung-duell-steuerung.ts'
import { browserLader, kartenQuelle, ladeUndDekodiere, paarNachAntwort } from '../../lib/empfehlung-duell-bilder.ts'
import { geheZurueck } from '../../lib/empfehlung-bedienung.ts'
import { bannerUrl } from './bilder.tsx'

interface Eingabe {
  kontext: Kontext
  sitzung: Sitzung
  ziel: number
  titel?: Map<number, Title>
  breit: boolean
  antworte: (a: Antwort) => void
  zurueck: () => void
}

/** Verbindet die Duell-Steuerung mit React: Sperre, Schritt für das CSS, Bilder des nächsten Paars vorladen. */
export function useDuell(e: Eingabe) {
  const [schritt, setSchritt] = useState<DuellSchritt>('bereit')
  const [gewaehlt, setGewaehlt] = useState<Antwort>()
  const neu = useRef(e)
  neu.current = e
  const steuerung = useMemo(
    () =>
      baueDuellSteuerung({
        plane: (f, ms) => window.setTimeout(f, ms),
        loesche: (h) => window.clearTimeout(h),
        meldeSchritt: setSchritt,
        wechsle: (antwort) => {
          setGewaehlt(undefined)
          neu.current.antworte(antwort)
        },
        reduziert: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }),
    [],
  )
  useEffect(() => steuerung.abbrechen, [steuerung])

  const ladeNaechste = (antwort: Antwort): Promise<void> => {
    const { kontext, sitzung, ziel, titel, breit } = neu.current
    const paar = paarNachAntwort(kontext, sitzung, antwort, ziel)
    if (!paar) return Promise.resolve()
    const quellen = paar.map((i) => {
      const t = titel?.get(kontext.datei.einstiege[i].id)
      return kartenQuelle(bannerUrl(t, 780), t?.coverImage, breit)
    })
    return ladeUndDekodiere(quellen, browserLader)
  }
  /** Gibt zurück, ob die Wahl angenommen wurde; während eines Duells nicht. */
  const waehle = (antwort: Antwort): boolean => {
    if (!steuerung.waehle(antwort, () => ladeNaechste(antwort))) return false
    setGewaehlt(antwort)
    return true
  }
  const zurueckGehen = () => geheZurueck({ stopp: steuerung.abbrechen }, () => setGewaehlt(undefined), e.zurueck)
  return { schritt, gewaehlt, waehle, zurueckGehen }
}
