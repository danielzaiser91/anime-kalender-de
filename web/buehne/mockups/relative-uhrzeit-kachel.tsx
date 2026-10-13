import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { nowHhMm, todayIso } from '@shared/time.ts'
import { ZeitMarke } from '../../src/components/kalender/Marken.tsx'
import { loadJson } from '../../src/lib/data.ts'
import { fruehesteKommende, kachelAngabe } from './relative-uhrzeit-zeit.ts'

/** Dieselbe Pille wie `ZeitMarke` der Seite (Cover oben links). */
function Pille({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-[rgba(13,15,20,.85)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#f2f1ee]">{children}</span>
}

let termine: Promise<ReleaseEvent[]> | undefined

/** Die Termine des Bestands, einmal geladen: Eine Kachel kennt die anderen Kacheln des Tages nicht, braucht aber „die nächste". */
const ladeTermine = () => (termine ??= loadJson<ReleaseEvent[]>('events.json'))

/** Die frühste feste Uhrzeit, die heute noch aussteht; solange die Termine laden, leer (dann nur „seit"). */
function useFruehsteKommende(heute: string, jetzt: string): string | undefined {
  const [alle, setAlle] = useState<ReleaseEvent[]>()
  useEffect(() => {
    void ladeTermine().then(setAlle)
  }, [])
  return alle ? fruehesteKommende(alle, heute, jetzt) : undefined
}

/**
 * Uhrzeit-Pille der Kachel mit Bezug zu „jetzt" (alle Varianten): „seit 17:00" statt „17:00", wenn vergangen,
 * und an der ersten kommenden Kachel des Tages bis drei Stunden vorher eine zweite Pille „in 12 Min".
 * Alles andere (Schätzung „≈", Disc, ohne Uhrzeit, andere Tage) zeigt das echte Bauteil.
 */
export function ZeitMarkeJetzt(p: ComponentProps<typeof ZeitMarke>) {
  const heute = todayIso()
  const jetzt = nowHhMm()
  const fruehste = useFruehsteKommende(heute, jetzt)
  const angabe = kachelAngabe(p.event, heute, jetzt, fruehste)
  if (!angabe.seit && !angabe.in) return <ZeitMarke {...p} />
  return (
    <>
      <Pille>{angabe.seit ? `seit ${angabe.seit}` : p.event.time}</Pille>
      {angabe.in && <Pille>{angabe.in}</Pille>}
    </>
  )
}
