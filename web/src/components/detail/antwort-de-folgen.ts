import type { Synopsis } from '../../lib/data.ts'
import { berechneAntwort } from './antwort-berechnen.ts'

type Berechnet = ReturnType<typeof berechneAntwort>
export type DeFolgen = NonNullable<Synopsis['deFolgen']>

/**
 * **Nur ein Teil der Folgen liegt auf Deutsch vor** (`deFolgen`, von Hand mit Quelle): Der Kasten sagt „26 von 41 Folgen auf Deutsch“ statt „Alle 41“.
 * Gilt nur, wo die deutsche Zahl unter der Folgenzahl des Werks liegt; ohne `deFolgen` bleibt die Antwort, wie sie ist.
 * Die übrigen Folgen sind damit belegt nicht deutsch (`restBelegt`), es fehlt keine Angabe.
 */
export function berechneAntwortMitDeFolgen({ title, releases, today, deFolgen }: {
  title: Parameters<typeof berechneAntwort>[0]['title']
  releases: Parameters<typeof berechneAntwort>[0]['releases']
  today: string
  deFolgen: DeFolgen | undefined
}): Berechnet {
  const antwort = berechneAntwort({ title, releases, today, jetzt: new Date() })
  if (!deFolgen || (antwort?.art !== 'fertig' && antwort?.art !== 'teilweise')) return antwort
  if (!antwort.gesamt || deFolgen.n >= antwort.gesamt) return antwort
  const teilweise = { art: 'teilweise' as const, raus: deFolgen.n, gesamt: antwort.gesamt, restBelegt: true, deFolgen }
  return teilweise
}

