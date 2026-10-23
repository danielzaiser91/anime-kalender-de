import { expandEvents } from '@shared/logic.ts'
import type { Release } from '@shared/types.ts'
import { FolgenBereich } from './folgen-bereich.tsx'
import { erschieneneFuerFolgenliste } from './antwort-regeln.ts'
import { nachlegerJeAnbieter, nachlegerText } from './nachleger.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

/** Nur diese Zustände sagen etwas über den Stand der Folgen; Film, Kino und Disc haben keine Nachleger. */
const MIT_NACHLEGERN = ['fertig', 'laeuft', 'teilweise']

/** Die Zeilen unter dem Antwortkasten-Kopf, direkt über der Folgenliste (`folgen`-Platz des Kastens). */
export function FolgenMitNachlegern({ titleId, wege, antwort, releases, today, laufzeitImKopf }: {
  titleId: number
  wege: { from: number; to: number }[]
  laufzeitImKopf?: boolean
  antwort: ReturnType<typeof berechneAntwort>
  releases: Release[]
  today: string
}) {
  const zeilen = antwort && MIT_NACHLEGERN.includes(antwort.art) ? nachlegerJeAnbieter(releases.flatMap((r) => expandEvents(r)), today) : []
  return (
    <>
      {zeilen.map((n) => (
        <p key={n.platform} className="mt-1 text-t4 text-slate-500 dark:text-slate-400">
          {nachlegerText(n)}
        </p>
      ))}
      <FolgenBereich titleId={titleId} wege={wege} erschienen={erschieneneFuerFolgenliste(antwort)} laufzeitImKopf={laufzeitImKopf} />
    </>
  )
}
