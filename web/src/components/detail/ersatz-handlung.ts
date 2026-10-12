import { useEffect, useState } from 'react'
import type { FranchiseMember, Title } from '@shared/types.ts'
import { istStaffel } from '@shared/titles.ts'
import { loadSynopsis, type Synopsis } from '../../lib/data.ts'
import { aussagekraeftig } from './plot.ts'

/*
  **Eine Staffel, die noch nicht läuft, hat keine Handlung — die Reihe schon.**

  aniSearch und AniList führen künftige Staffeln ohne Inhaltsangabe, und das
  ist richtig so: Niemand kann erzählen, was noch nicht gesendet wurde. Auf
  der Seite blieb dafür eine leere Fläche — bei einem Titel, den gerade
  deshalb jemand aufschlägt, weil er ihn noch nicht kennt.

  Also zeigen wir die Handlung des letzten Teils, den es wirklich gibt. Daniel
  am 04.09.2026: „für zukünftige staffeln können wir hinweistext ‚noch nicht
  erschienen, handlung der vorherigen staffel:' … oder ‚der zuletzt
  erschienenen staffel'".

  **Gesucht wird rückwärts, nicht der direkte Vorgänger** — auch das seine
  Beobachtung: „wenn man cour 2 anklickt, wäre letzte ja cour 1 und dort steht
  auch keine handlung". Bei einer Staffel, die in zwei Cours zerfällt, ist der
  Vorgänger genauso leer wie sie selbst. Die Schleife geht deshalb so weit
  zurück, bis ein Teil eine Handlung trägt, und der Hinweis nennt ihn beim
  Namen — sonst liest jemand die Handlung von Staffel 1 und hält sie für die
  von Staffel 3.
*/
export function useErsatzHandlung({ titleId, title, synopsis, reihenTeile }: {
  titleId: number
  title: Title | undefined
  synopsis: Synopsis | undefined
  reihenTeile: FranchiseMember[]
}): { plot: Synopsis; von: FranchiseMember } | undefined {
  const [ersatz, setErsatz] = useState<{ plot: Synopsis; von: FranchiseMember } | undefined>()
  useEffect(() => {
    let alive = true
    setErsatz(undefined)
    if (synopsis?.de || synopsis?.en) return
    /*
      **Eine Staffel schlägt einen Film — auch einen neueren.**

      Bei „Black Clover" Staffel 2 stand als Ersatz die Handlung von „Sword of
      the Wizard King" (2023), weil der Film jünger ist als Staffel 1 (2017).
      Daniel hatte aber „die handlung der zuletzt erschienenen **staffel**"
      verlangt, und das ist auch die brauchbarere Auskunft: Ein Film erzählt
      eine abgeschlossene Nebengeschichte, die Serie den Strang, den eine
      Fortsetzung aufnimmt.
    */
    const vorher = reihenTeile
      .filter((m) => m.id !== titleId && (m.jpYear ?? 9999) <= (title?.jpYear ?? 9999))
      .sort(
        (a, b) =>
          Number(istStaffel(b.format)) - Number(istStaffel(a.format)) ||
          (b.jpYear ?? 0) - (a.jpYear ?? 0) ||
          b.id - a.id,
      )
    ;(async () => {
      for (const m of vorher) {
        const s = await loadSynopsis(m.id).catch(() => undefined)
        if (!alive) return
        if (aussagekraeftig(s)) {
          setErsatz({ plot: s, von: m })
          return
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [titleId, synopsis, reihenTeile, title])
  return ersatz
}
