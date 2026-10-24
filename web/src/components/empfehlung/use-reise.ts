import { useMemo, useState } from 'react'
import { antworteSitzung, DUELLE_MAX, DUELLE_START, istFertig, neueSitzung, neuerZustand, zurueck, type Antwort, type Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import { ausgeschlossenFuerReise, ersetzeVorschlag, ersteVorschlaege, naechstesZiel, rangliste, stand, type Stand } from '../../lib/empfehlung-reise.ts'
import { gesehenLesen } from '../../lib/gesehen.ts'

export type Phase = 'start' | 'duell' | 'ergebnis' | 'leinwand'

interface Mengen {
  favoriten: Set<number>
  ausgeblendet: Set<number>
  gesehen: Set<number>
  verworfen: Set<number>
  eigene: string[]
}

/** Ablauf der Reise: Phase, Sitzung, Ziel, gezeigte Vorschläge. Rechnet nur über den Kern, kennt kein DOM. */
export function useReise(kontext: Kontext | undefined, m: Mengen, startwert: () => number) {
  const [phase, setPhase] = useState<Phase>('start')
  const [sitzung, setSitzung] = useState<Sitzung>()
  const [ziel, setZiel] = useState(DUELLE_START)
  const [gezeigt, setGezeigt] = useState<number[]>([])
  const [aktuell, setAktuell] = useState<number>()
  const eigene = useMemo(() => new Set(m.eigene), [m.eigene])
  const weg = useMemo(() => [...m.verworfen, ...m.gesehen], [m.verworfen, m.gesehen])
  const rang = useMemo<Kandidat[]>(
    () => (kontext && sitzung ? rangliste(kontext, sitzung.zustand, weg, eigene) : []),
    [kontext, sitzung, weg, eigene],
  )

  const neu = () => {
    if (!kontext) return
    const aus = ausgeschlossenFuerReise({ favoriten: m.favoriten, gesehen: m.gesehen, ausgeblendet: m.ausgeblendet, gesehenBis: gesehenLesen() })
    setSitzung(neueSitzung(neuerZustand(kontext, startwert(), aus)))
    setZiel(DUELLE_START)
    setPhase('duell')
  }
  const zeigeErgebnis = (s: Sitzung) => {
    if (!kontext) return
    setGezeigt(ersteVorschlaege(rangliste(kontext, s.zustand, weg, eigene)))
    setPhase('ergebnis')
  }
  const antworte = (a: Antwort) => {
    if (!kontext || !sitzung) return
    const s = antworteSitzung(kontext, sitzung, a)
    setSitzung(s)
    if (s === sitzung || istFertig(kontext, s.zustand, ziel)) zeigeErgebnis(s)
  }
  const genauer = () => {
    if (!sitzung) return
    setZiel(naechstesZiel(ziel, DUELLE_MAX))
    setPhase('duell')
  }
  const entferne = (id: number) => {
    setGezeigt((g) => ersetzeVorschlag(g, id, rang))
    setPhase('ergebnis')
  }
  const stehen: Stand | undefined = kontext && sitzung ? stand(kontext, sitzung.zustand, ziel) : undefined
  const kannGenauer = !!kontext && !!sitzung && !istFertig(kontext, sitzung.zustand, DUELLE_MAX)
  return {
    phase,
    setPhase,
    sitzung,
    ziel,
    gezeigt,
    aktuell,
    eigene,
    stehen,
    kannGenauer,
    neu,
    antworte,
    genauer,
    entferne,
    zurueckDuell: () => setSitzung((s) => s && zurueck(s)),
    oeffne: (id: number) => {
      setAktuell(id)
      setPhase('leinwand')
    },
  }
}
