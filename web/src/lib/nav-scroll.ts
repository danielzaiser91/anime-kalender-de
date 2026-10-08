import { useEffect, useState } from 'react'

/** Erst ab so vielen Pixeln Bewegung wechselt die Richtung — Zittern des Daumens soll nichts auslösen. */
const SCHWELLE_PX = 12
/** Ganz oben bleibt die Navigation immer da. */
const OBEN_PX = 80

/**
 * **Handy-Navigation weicht beim Abwärtsscrollen und kommt beim Aufwärtsscrollen zurück.**
 * Der Scroll-Handler ist passiv und läuft höchstens einmal je Bild (`requestAnimationFrame`).
 * Nur wenn `aktiv`: Ohne Vorschau hängt gar kein Handler am Fenster.
 * Zusätzlich setzt er `data-nav-weg` an `<html>`, damit Leisten, die über der Navigation sitzen, mit nach unten rücken.
 */
export function useNavVersteckt(aktiv: boolean): { versteckt: boolean; zeigen: () => void } {
  const [versteckt, setVersteckt] = useState(false)
  useEffect(() => {
    if (!aktiv) return
    let letzte = window.scrollY
    let wartet = false
    const pruefen = () => {
      wartet = false
      const y = window.scrollY
      const d = y - letzte
      if (y < OBEN_PX) setVersteckt(false)
      else if (d > SCHWELLE_PX) setVersteckt(true)
      else if (d < -SCHWELLE_PX) setVersteckt(false)
      if (Math.abs(d) > SCHWELLE_PX || y < OBEN_PX) letzte = y
    }
    const beiScroll = () => {
      if (wartet) return
      wartet = true
      requestAnimationFrame(pruefen)
    }
    window.addEventListener('scroll', beiScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', beiScroll)
      setVersteckt(false)
    }
  }, [aktiv])
  useEffect(() => {
    const html = document.documentElement
    if (aktiv && versteckt) html.dataset.navWeg = '1'
    else delete html.dataset.navWeg
    return () => {
      delete html.dataset.navWeg
    }
  }, [aktiv, versteckt])
  return { versteckt: aktiv && versteckt, zeigen: () => setVersteckt(false) }
}
