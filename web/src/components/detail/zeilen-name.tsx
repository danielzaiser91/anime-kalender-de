import type { StaffelNummer } from '@shared/titles.ts'
import { staffelKurz } from './reihen-regeln.ts'

/** Name einer Zeile der Reihenliste: „Staffel 4 · War of the Three Titans", ohne Nummer der gekürzte Name. */
export function ZeilenName({ nr, rest, kurz }: { nr: StaffelNummer | undefined; rest: string; kurz: string }) {
  if (!nr) return <>{kurz}</>
  return (
    <>
      <b className="font-semibold">{staffelKurz(nr)}</b>
      {nr.eigenerName && rest ? ` · ${rest}` : ''}
    </>
  )
}
