import { useEffect, useRef, useState } from 'react'
import type { DiscAusgabe, Title } from '@shared/types.ts'
import { ladeTitelBestand, loadDiscAusgaben, loadSynopsis, type Dataset, type Synopsis } from '../../lib/data.ts'
import { useSeiteGesperrt } from '../../lib/use-seite-gesperrt.ts'

/** Die Disc-Ausgaben des Titels; der Aufklapper fällt mit dem Titel zurück. */
export function useDiscAusgaben(titleId: number) {
  const [discAusgaben, setDiscAusgaben] = useState<DiscAusgabe[]>([])
  const [discOffen, setDiscOffen] = useState(false)

  useEffect(() => {
    let alive = true
    setDiscAusgaben([])
    setDiscOffen(false)
    loadDiscAusgaben(titleId)
      .then((a) => {
        if (alive) setDiscAusgaben(a)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [titleId])

  return { discAusgaben, discOffen, setDiscOffen }
}

/** Die Inhaltsangabe; mit dem Titel fallen Schlagwort- und Handlungs-Aufklapper zurück. */
export function useSynopse(
  titleId: number,
  title: Title | undefined,
  setAllKeywords: (offen: boolean) => void,
  setPlotOffen: (offen: boolean) => void,
): Synopsis | undefined {
  const [synopsis, setSynopsis] = useState<Synopsis | undefined>()

  useEffect(() => {
    let alive = true
    setSynopsis(undefined)
    /* Cartoons (negative Kennung) tragen ihre Beschreibung im Titel — für sie gibt es keine Gruppendatei (16.09.2026). */
    if (titleId < 0) {
      setSynopsis(title?.synopsis ? { de: title.synopsis } : undefined)
    } else {
      loadSynopsis(titleId)
        .then((s) => {
          if (alive) setSynopsis(s)
        })
        .catch(() => {})
    }
    setAllKeywords(false)
    setPlotOffen(false)
    return () => {
      alive = false
    }
  }, [titleId, title?.synopsis, setAllKeywords, setPlotOffen])

  return synopsis
}

/** Escape schließt das Panel. */
function useEscapeSchliesst(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

/**
 * Das Panel liegt über der Seite: Escape schließt es, und die Seite dahinter bleibt stehen. Sonst wanderte sie auf dem Handy
 * beim Wischen mit (`overscroll-contain` gilt dort nicht), und „Zurück" sprang beim Schließen an die alte Stelle (Daniel, 11.10.2026).
 */
export function usePanelFenster(onClose: () => void) {
  useEscapeSchliesst(onClose)
  useSeiteGesperrt(true)
}

/**
 * **Ein Titel, den der Kern nicht kennt, wird nachgeladen.**
 *
 * `titles-core.json` führt nur, worauf ein Termin zeigt — ein Reihenteil ohne
 * deutschen Termin steht dort nicht. Beim Einstieg über eine geteilte Adresse
 * ist das der Unterschied zwischen dem Panel und einer Fehlermeldung.
 *
 * Genau einmal je Kennung: `versucht` merkt sich, wofür schon geladen wurde,
 * damit ein wirklich unbekannter Titel nicht in eine Schleife läuft.
 */
export function useTitelNachladen(data: Dataset, titleId: number): boolean {
  const [holt, setHolt] = useState(false)
  const versucht = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (data.titleById.has(titleId) || versucht.current === titleId) return
    versucht.current = titleId
    setHolt(true)
    ladeTitelBestand(data, titleId)
      .catch(() => {})
      .finally(() => setHolt(false))
  }, [data, titleId])
  return holt
}

/**
 * Beim Wechsel auf eine Staffel ohne Termin fehlen die Metadaten — die liegen
 * in `titles.json`, das im Kalender nicht geladen ist. Erst holen, dann
 * öffnen, sonst zeigt das Panel „keine Metadaten".
 */
export function useWechsleZu(data: Dataset, titleId: number, onOpenTitle: (id: number) => void) {
  const [wechselt, setWechselt] = useState(false)

  const wechsleZu = (id: number) => {
    if (id === titleId) return
    if (data.titleById.has(id)) {
      onOpenTitle(id)
      return
    }
    setWechselt(true)
    /*
      **Beide Bestände holen, nicht nur den Hauptbestand.**

      Seit die Reihenliste auch die Teile aus dem Katalog zeigt, kann der Klick
      auf einen davon fallen: `loadAllTitles` lädt `titles.json`, und dort steht
      ein Titel ohne belegte Synchro nicht. Das Panel meldete dann „Zu diesem
      Eintrag liegen keine Metadaten vor" — und derselbe Klick funktionierte,
      sobald der Toggle den Katalog geladen hatte.

      Ein Eintrag, den die Liste zeigt, muss sich auch öffnen lassen. Beide
      Ladewege sind gegen Mehrfachaufrufe gesichert und tun beim zweiten Mal
      nichts, das Paar kostet also nur beim ersten Wechsel etwas.
    */
    ladeTitelBestand(data, id)
      .catch(() => {})
      .finally(() => {
        setWechselt(false)
        onOpenTitle(id)
      })
  }

  return { wechselt, wechsleZu }
}
