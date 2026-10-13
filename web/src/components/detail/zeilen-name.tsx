import type { StaffelNummer } from '@shared/titles.ts'
import { staffelKurz, zeilenZusatz } from './reihen-regeln.ts'

/** Name einer Zeile der Reihenliste: „Staffel 4 · War of the Three Titans", ohne Nummer der gekürzte Name. */
export function ZeilenName({ nr, rest, voll, kurz }: { nr: StaffelNummer | undefined; rest: string; voll: string; kurz: string }) {
  if (!nr) return <>{kurz}</>
  const zusatz = zeilenZusatz(nr, rest, voll)
  return (
    <>
      <b className="font-semibold">{staffelKurz(nr)}</b>
      {zusatz ? ` · ${zusatz}` : ''}
    </>
  )
}
