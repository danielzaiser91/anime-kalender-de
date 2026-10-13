import { useEffect, useRef, useState } from 'react'
import type { MockupDef } from './register.ts'

const SCHRITT_MINUTEN = 5
const TAG_MINUTEN = 24 * 60

/** „16:40" einer ISO-Zeit mit Versatz, ohne Zeitzonenrechnung (der Versatz steht schon in der Zeichenkette). */
export const uhrVon = (iso: string): string => iso.slice(11, 16)

/** Dieselbe Zeit mit anderer Uhr: Datum und Versatz der ersten Zeit des Mockups bleiben. */
export function zeitMitUhr(erste: string, uhr: string): string {
  return `${erste.slice(0, 11)}${uhr}${erste.slice(16)}`
}

const minutenVon = (uhr: string): number => Number(uhr.slice(0, 2)) * 60 + Number(uhr.slice(3, 5))
const uhrAusMinuten = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Eine Zeit gilt, wenn sie am Tag der ersten Zeit liegt und eine Uhr trägt; sonst die erste. Ohne `zeiten` bleibt sie leer. */
export function gueltigeZeit(def: MockupDef, zeit: string): string {
  const erste = Object.values(def.zeiten ?? {})[0]
  if (!erste) return ''
  const gleicherTag = zeit.slice(0, 11) === erste.slice(0, 11) && /^\d\d:\d\d$/.test(uhrVon(zeit)) && zeit.slice(16) === erste.slice(16)
  return gleicherTag ? zeit : erste
}

/** Schieber über den Tag: Der Wert wandert beim Ziehen mit, übernommen wird er erst beim Loslassen (jeder Wechsel lädt alle Zellen neu). */
function Schieber({ zeit, erste, setze }: { zeit: string; erste: string; setze: (zeit: string) => void }) {
  const [ziehen, setZiehen] = useState<string>()
  const feld = useRef<HTMLInputElement>(null)
  /* React-`onChange` feuert bei jedem Zug; das native `change` kommt erst beim Loslassen. */
  useEffect(() => {
    const el = feld.current!
    const uebernehmen = () => {
      setZiehen(undefined)
      setze(zeitMitUhr(erste, uhrAusMinuten(Number(el.value))))
    }
    el.addEventListener('change', uebernehmen)
    return () => el.removeEventListener('change', uebernehmen)
  }, [erste, setze])
  return (
    <label className="zeit-regler">
      <input
        ref={feld}
        key={zeit}
        type="range"
        min={0}
        max={TAG_MINUTEN - SCHRITT_MINUTEN}
        step={SCHRITT_MINUTEN}
        defaultValue={minutenVon(uhrVon(zeit))}
        aria-label="Uhrzeit"
        onInput={(e) => setZiehen(uhrAusMinuten(Number(e.currentTarget.value)))}
      />
      <output>{ziehen ?? uhrVon(zeit)}</output>
    </label>
  )
}

/** Gruppe „Zeit" der Leiste: die Zeiten des Mockups als Knöpfe, dazu der Schieber über den Tag. */
export function ZeitGruppe({ def, zeit, setze }: { def: MockupDef; zeit: string; setze: (zeit: string) => void }) {
  const eintraege = Object.entries(def.zeiten ?? {})
  if (!eintraege.length) return null
  return (
    <div className="gruppe" data-gruppe="Zeit">
      <span>Zeit</span>
      {eintraege.map(([text, iso]) => (
        <button key={iso} type="button" data-wert={iso} aria-pressed={iso === zeit} onClick={() => setze(iso)}>
          {text}
        </button>
      ))}
      <Schieber zeit={zeit} erste={eintraege[0]![1]} setze={setze} />
    </div>
  )
}
