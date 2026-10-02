import { useEffect, useState } from 'react'
import type { Ref } from 'react'
import { SUCHFELD_ARTEN } from '../lib/search.ts'
import { translate } from '../lib/i18n.tsx'
import { Fragezeichen } from './ui.tsx'

/**
 * **Die Eingabe muss laufen, auch wenn die Suche nicht hinterherkommt.**
 *
 * Jeder Tastendruck schrieb direkt in `filters.search` — und daran hängt die Filterung über
 * tausende Titel samt allem, was sie zeichnet. Bei schneller Eingabe verschluckte die Tastatur
 * Zeichen. Deshalb zwei Zustände: Das Feld zeigt sofort, was getippt wurde;
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

  /*
    **Was durchsucht wird, steht am Feld** (Daniel, 29.09.2026: „welche felder durchsucht werden
    nicht ersichtlich ist und gemäß der projekt regel alles offen zu kommunizieren, muss hier in der
    suche nahe dem such-input ein icon erscheinen, das on hover oder touch erklärt über welche
    felder gesucht wird (+ fuzzy search)"). Die Liste kommt aus `SUCHFELD_ARTEN` — dieselbe Quelle,
    aus der die Suche ihre Felder bezieht; `check:logic` hält beide gegeneinander.
  */
  const felder = [translate('suche.felderTitel'), SUCHFELD_ARTEN.map((s) => s.label).join(' · '), translate('suche.unscharf')].join(' ')

  /*
    **Das Fragezeichen sitzt im Feld, rechts** (Daniel, 29.09.2026: „den icon rechts vom input ins
    input (rechts) packen"). Der Platz dafür kommt aus dem rechten Innenabstand des Feldes — in der
    Kopfleiste `pr-16` (zwei Knöpfe: Löschen und Erklären).

    **Und das Löschen ist ein eigener, runder Knopf** (Daniel, 29.09.2026: „make x more clickable, by
    making it a circular button"). Das native ✕ von `type="search"` ist je Browser verschieden groß
    und kaum zu treffen; es wird ausgeblendet, und wir zeichnen ein eigenes — gleiche Größe überall,
    mit Fläche zum Anklicken.
  */
  return (
    <span className="relative flex w-full items-center">
      <input
        ref={eingabe}
        type="search"
        value={getippt}
        onChange={(e) => setGetippt(e.target.value)}
        placeholder={platzhalter}
        aria-label={platzhalter}
        className={`${className} [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
      />
      <FeldKnoepfe
        getippt={getippt}
        felder={felder}
        leeren={() => {
          setGetippt('')
          /* Ohne Wartezeit: Wer löscht, will die volle Liste sehen, nicht nach 250 ms. */
          setzen('')
          if (typeof eingabe === 'object') eingabe?.current?.focus()
        }}
      />
    </span>
  )
}

/** Der rechte Bereich im Feld: Löschen · Trennstrich · Erklären (Daniels gekapselter Bereich). */
function FeldKnoepfe({ getippt, felder, leeren }: { getippt: string; felder: string; leeren: () => void }) {
  return (
    <span className="absolute inset-y-0.5 right-px flex items-stretch">
      {getippt && <LoeschKnopf leeren={leeren} />}
      {/* Der Trennstrich ist die **linke Kante** des „?"-Bereichs — kein
          eigenes Element mit Abstand. Damit ist der Abstand ✕→Strich gleich dem Strich→?. */}
      <Fragezeichen text={felder} gekapselt />
    </span>
  )
}

/** Der runde Lösch-Knopf im Suchfeld — gleiche Größe in jedem Browser, mit Fläche zum Treffen. */
function LoeschKnopf({ leeren }: { leeren: () => void }) {
  return (
    <button
      type="button"
      aria-label={translate('suche.leeren')}
      title={translate('suche.leeren')}
      onClick={leeren}
      className="my-auto ml-2 flex h-10 w-10 cursor-pointer items-center justify-center self-center rounded-full text-ak-leise transition hover:bg-white/15 hover:text-ak-text"
    >
      <svg viewBox="0 0 14 14" className="size-3.5" fill="none" aria-hidden="true">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  )
}
