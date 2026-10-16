/**
 * Der Wortlaut der Takt-Meldung (Art `takt`) — Seite, Feed und Mail sagen dasselbe.
 * Beispiele: „Folge 15 ist schon da — einen Tag nach Folge 14“, „Zwei Folgen auf einmal: 12 und 13“,
 * „Nach 5 Wochen Pause wieder neue Folgen: Folge 14“.
 */
import type { NewsMeldung } from './types.ts'

type TaktAngaben = Pick<NewsMeldung, 'takt' | 'von' | 'bis' | 'anzahl' | 'abstand'>

const ZAHLWORT: Record<number, string> = { 2: 'Zwei', 3: 'Drei', 4: 'Vier' }

const folgen = (a: TaktAngaben): string => (a.bis !== undefined && a.bis !== a.von ? `Folgen ${a.von}–${a.bis}` : `Folge ${a.von}`)
const wochen = (a: TaktAngaben): number => Math.round((a.abstand ?? 0) / 7)

export function taktSatz(a: TaktAngaben): string {
  if (a.takt === 'pause') return `Nach ${wochen(a)} Wochen Pause wieder neue Folgen: ${folgen(a)}`
  if (a.takt === 'doppelt') {
    const n = a.anzahl ?? 2
    return `${ZAHLWORT[n] ?? n} Folgen auf einmal: ${n === 2 ? `${a.von} und ${a.bis}` : `${a.von}–${a.bis}`}`
  }
  const tage = a.abstand === 1 ? 'einen Tag' : `${a.abstand} Tage`
  return `Folge ${a.von} ist schon da — ${tage} nach Folge ${(a.von ?? 1) - 1}`
}

/** Stichworte für die Übersichtszeile. */
export function taktKurz(a: TaktAngaben): string {
  if (a.takt === 'pause') return `${a.bis !== undefined && a.bis !== a.von ? `E${a.von}–${a.bis}` : `E${a.von}`} · nach ${wochen(a)} Wo. Pause`
  if (a.takt === 'doppelt') return `E${a.von}–${a.bis} · zusammen`
  return `E${a.von} · ${a.abstand === 1 ? 'einen Tag' : `${a.abstand} Tage`} nach E${(a.von ?? 1) - 1}`
}
