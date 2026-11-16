import { useEffect, useState } from 'react'

/** Nach dieser Zeit gibt der Platzhalter auf: Der Fuß (Impressum, Datenschutz) darf nie dauerhaft fehlen, auch wenn ein Abruf hängt. */
export const LADEPLATZ_FRIST_MS = 8000

/** Platzhalter für eine nachladende Ansicht; der Fuß bleibt unsichtbar (styles.css), solange er steht, sonst springt er beim Füllen aus dem Bild. */
export function Ladeplatz() {
  const [abgelaufen, setAbgelaufen] = useState(false)
  useEffect(() => {
    const h = window.setTimeout(() => setAbgelaufen(true), LADEPLATZ_FRIST_MS)
    return () => window.clearTimeout(h)
  }, [])
  if (abgelaufen) return null
  return <div className="min-h-[60vh]" data-ladeplatz aria-hidden />
}
