import { useEffect, useState } from 'react'
import type { Ref } from 'react'

/**
 * **Die Eingabe muss laufen, auch wenn die Suche nicht hinterherkommt.**
 *
 * Jeder Tastendruck schrieb direkt in `filters.search` — und daran hängt die Filterung über
 * tausende Titel samt allem, was sie zeichnet. Bei schneller Eingabe verschluckte die Tastatur
 * Zeichen (Daniel, 12.09.2026). Deshalb zwei Zustände: Das Feld zeigt sofort, was getippt wurde;
 * gesucht wird erst, wenn `RUHE_MS` ohne weiteren Anschlag vergangen sind. Deutlich darunter
 * bündelt es nichts mehr, deutlich darüber läuft die Trefferliste sichtbar nach.
 */
const RUHE_MS = 250

export function Suchfeld({
  wert,
  setzen,
  platzhalter,
  className,
  eingabe,
}: {
  wert: string
  setzen: (s: string) => void
  platzhalter: string
  className: string
  eingabe?: Ref<HTMLInputElement>
}) {
  const [getippt, setGetippt] = useState(wert)

  /* Von außen geänderte Suche (Zurücksetzen, Einstieg über eine Adresse) schlägt die eigene Anzeige. */
  useEffect(() => {
    setGetippt(wert)
  }, [wert])

  /* Der Weckruf wird bei jedem Anschlag neu gestellt; erst wenn einer durchläuft, geht der Begriff nach oben. */
  useEffect(() => {
    if (getippt === wert) return
    const uhr = setTimeout(() => setzen(getippt), RUHE_MS)
    return () => clearTimeout(uhr)
    /* `setzen` ist bei jedem Rendern eine neue Funktion — es gehört nicht in die Liste. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getippt, wert])

  return (
    <input
      ref={eingabe}
      type="search"
      value={getippt}
      onChange={(e) => setGetippt(e.target.value)}
      placeholder={platzhalter}
      aria-label={platzhalter}
      className={className}
    />
  )
}
