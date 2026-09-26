import { useState, useEffect, useMemo, useRef } from 'react'
import { nowHhMm } from '@shared/time.ts'
import { type ReleaseEvent } from '@shared/types.ts'

/**
 * Unterhalb dieser Breite steht ein Tag als einzelne senkrechte Spalte —
 * dieselbe Grenze wie Tailwinds `sm:`. Nur dort ist der Sprung sinnvoll:
 * Auf breiten Schirmen liegen die sieben Tage nebeneinander und man sieht
 * ohnehin alles.
 */
export const SINGLE_COLUMN = '(max-width: 639px)'

/**
 * Wie viel vom Vorherigen über der nächsten Folge sichtbar bleibt. Ohne diesen
 * Rest sähe die Seite aus, als begänne der Tag hier — der Vorlauf verrät, dass
 * oben noch etwas ist.
 */
export const LEAD_PX = 30

/**
 * Die Wochenansicht springt zum nächsten Termin von heute — einmal je Ankunft und auf Zuruf
 * („heute" in der Kopfleiste). Liefert die Uhrzeit, das Sprungziel und seinen Anker.
 */
export function useSprungZuHeute({ days, today, monday }: {
  days: { timed: ReleaseEvent[]; untimed: ReleaseEvent[]; date: string; }[]
  today: string
  monday: string
}) {
  // Die aktuelle Uhrzeit trennt im heutigen Tag Vergangenes von Kommendem.
  // Einmal je Minute nachziehen, damit die Grenze nicht stehen bleibt.
  const [now, setNow] = useState(nowHhMm)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowHhMm()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  /**
   * Der Termin von heute, bei dem der Blick landen soll: der nächste, der noch
   * aussteht. Ist der Tag schon durch, wird es der letzte — dann steht der
   * jüngste Eintrag oben statt der Vormittag von vor zehn Stunden.
   */
  const landingId = useMemo(() => {
    const day = days.find((d) => d.date === today)
    if (!day?.timed.length) return undefined
    return (day.timed.find((e) => e.time! >= now) ?? day.timed[day.timed.length - 1]).id
  }, [days, today, now])

  const landingRef = useRef<HTMLDivElement | null>(null)
  /** Für welche Woche schon gesprungen wurde — verhindert erneutes Springen. */
  const jumpedFor = useRef<string | undefined>(undefined)

  /**
   * Beim Blättern in eine andere Woche sofort an den Anfang.
   *
   * Ohne das landet man nach dem Wechsel irgendwo in der Mitte des neuen
   * Zeitraums — auf dem Handy sogar bei Donnerstag, weil die vorige Woche
   * dort gerade so weit gescrollt war. Ohne Animation, weil das kein Weg
   * ist, den man mitverfolgen will, sondern ein Zustandswechsel.
   *
   * Die Woche mit heute ist ausgenommen: Dort übernimmt der Sprung zur
   * nächsten Folge, und beides gleichzeitig wäre ein Ruckeln.
   */
  const previousMonday = useRef(monday)
  useEffect(() => {
    if (previousMonday.current === monday) return
    previousMonday.current = monday
    if (days.some((d) => d.date === today)) return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [monday, days, today])

  useEffect(() => {
    const showsToday = days.some((d) => d.date === today)
    if (!showsToday || !landingId) return
    // Einmal je Ankunft. Wer innerhalb der Woche filtert, blättert oder eine
    // Karte öffnet, soll nicht wieder nach unten gerissen werden.
    if (jumpedFor.current === monday) return
    if (!window.matchMedia(SINGLE_COLUMN).matches) return

    const el = landingRef.current
    if (!el) return
    jumpedFor.current = monday

    const jump = () => {
      // Die Kopfleiste klebt oben und würde die Karte sonst verdecken.
      const header = document.querySelector('header')
      const offset = (header?.getBoundingClientRect().height ?? 0) + LEAD_PX
      /*
        Ist die Zielkarte die erste ihres Tages, gilt der Tagesanfang als Ziel: Sonst
        schnitt die Kopfleiste „FR · heute" halb ab (Handy-Bild, 18.09.2026).
      */
      const tag = el.closest('section')
      const ersteKarte = tag?.querySelector('.ak-oeffnen')?.parentElement
      const ziel = tag && (ersteKarte === el || el.contains(ersteKarte ?? null)) ? tag : el
      window.scrollTo({
        top: Math.max(0, ziel.getBoundingClientRect().top + window.scrollY - offset),
        // Wer Bewegung abgestellt hat, bekommt keine — und im versteckten Tab
        // liefe eine weiche Bewegung ohnehin nicht.
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }

    // Im Hintergrund geöffnet? Dann läuft die weiche Bewegung nicht, und der
    // Sprung ginge lautlos verloren — die Seite stünde beim Hinschauen oben.
    // Also warten, bis wirklich jemand hinsieht.
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onVisible)
        jump()
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
    jump()
  }, [days, monday, today, landingId])

  /*
    **„heute" in der Kopfleiste scrollt, auch wenn die Woche schon die laufende ist** (Daniel,
    25.09.2026). Der Sprung oben geschieht einmal je Ankunft; dieser auf Zuruf, auf jeder
    Bildschirmbreite. Ziel ist dieselbe Karte — der nächste anstehende Termin von heute —, sonst
    der Kopf des heutigen Tages.
  */
  useEffect(() => {
    const zuHeute = () => {
      const karte = landingRef.current
      const tag = document.querySelector<HTMLElement>('[data-heute="1"]')
      const ziel = karte ?? tag
      if (!ziel) return
      const header = document.querySelector('header')
      const offset = (header?.getBoundingClientRect().height ?? 0) + LEAD_PX
      window.scrollTo({
        top: Math.max(0, ziel.getBoundingClientRect().top + window.scrollY - offset),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
    /* Kam der Klick aus einer anderen Woche, steht die neue erst nach dem Zeichnen. */
    const spaeter = () => window.setTimeout(zuHeute, 50)
    window.addEventListener('ak-zu-heute', spaeter)
    return () => window.removeEventListener('ak-zu-heute', spaeter)
  }, [])

  // Verlässt man die Woche mit heute, darf beim nächsten Besuch wieder
  // gesprungen werden.
  useEffect(() => {
    if (!days.some((d) => d.date === today)) jumpedFor.current = undefined
  }, [days, today])
  return { landingId, landingRef, now }
}
