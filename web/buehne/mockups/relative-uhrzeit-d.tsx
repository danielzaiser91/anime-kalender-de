import type { ReleaseEvent } from '@shared/types.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { JetztLinie, type Farben } from './relative-uhrzeit-teile.tsx'
import { restText, type Zeilenzustand } from './relative-uhrzeit-zeit.ts'

/** Variante D: Uhrzeit mit „● Läuft" darunter statt einer eigenen Spalte rechts. */
export function UhrzeitMitLaeuft({ zeit, zustand, farben }: { zeit: string; zustand: Zeilenzustand | undefined; farben: Farben }) {
  const uhr = <span className="font-bold tabular-nums text-ak-tv">{zeit}</span>
  if (zustand?.art !== 'laeuft') return uhr
  return (
    <span className="flex flex-col">
      {uhr}
      <span className="text-[11px] font-semibold whitespace-nowrap">
        <span aria-hidden="true" className={farben.punkt}>● </span>
        <span className={farben.text}>Läuft</span>
      </span>
    </span>
  )
}

/** Variante D: „Sender · Folge n"; läuft die zweite Sendung eines Bündels, steht ihre Folge, ein Termin „in 43 Min" ergänzt die Zeile. */
export function SenderZeileD({ ev, zustand, naechsteInZeile }: { ev: ReleaseEvent; zustand: Zeilenzustand | undefined; naechsteInZeile: boolean }) {
  const { t } = useLang()
  const folge = zustand?.art === 'laeuft' && zustand.folge ? zustand.folge : ev.episode && !ev.sichtung ? ev.episode : undefined
  return (
    <span className="text-xs text-ak-leise">
      {ev.sender}
      {folge ? ` · ${t('kal.folge', { n: folge })}` : ''}
      {naechsteInZeile && zustand?.art === 'naechste' && <span className="font-semibold text-ak-tv"> · {restText(zustand.minuten)}</span>}
    </span>
  )
}

/** Variante D: Linie mit der aktuellen Uhrzeit, nach der letzten Zeile dazu „Heute nichts mehr" in der Farbe der Uhrzeiten. */
export function LinieD({ jetzt, nichtsMehr, farben }: { jetzt: string; nichtsMehr: boolean; farben: Farben }) {
  return (
    <>
      <JetztLinie jetzt={jetzt} farben={farben} />
      {nichtsMehr && <li className="py-1 text-[13px] font-bold text-ak-tv">Heute nichts mehr</li>}
    </>
  )
}

/** Variante D: Zusatz in der Kopfzeile „Im Fernsehen", nur vor der ersten Sendung. */
export function ErsteSendung({ minuten }: { minuten: number }) {
  return <span className="text-[11px] font-semibold normal-case tracking-normal"> · erste Sendung {restText(minuten)}</span>
}
