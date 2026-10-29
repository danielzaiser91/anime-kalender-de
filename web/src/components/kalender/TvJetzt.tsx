import type { ReleaseEvent } from '@shared/types.ts'
import { restText, type Zeilenzustand } from '@shared/laeuft-jetzt.ts'
import { useLang } from '../../lib/i18n.tsx'

/*
  Bausteine des Fernseh-Kastens für den heutigen Tag (Variante D, Daniel 13.10.2026): Orange wie der gewählte
  Reiter „Kalender"; im hellen Thema trägt `ak-akzent-text` den Kontrast. Die Rechnung steht in `shared/laeuft-jetzt.ts`.
*/

/** Uhrzeit, bei einer laufenden Sendung mit „● Läuft" darunter. */
export function UhrzeitMitLaeuft({ zeit, zustand }: { zeit: string; zustand: Zeilenzustand | undefined }) {
  const { t } = useLang()
  const uhr = <span className="whitespace-nowrap font-bold tabular-nums text-ak-tv">{zeit}</span>
  if (zustand?.art !== 'laeuft') return uhr
  return (
    <span className="flex flex-col">
      {uhr}
      <span className="text-[11px] font-semibold whitespace-nowrap">
        <span aria-hidden="true" className="text-ak-akzent">● </span>
        <span className="text-ak-akzent-text">{t('kal.laeuft')}</span>
      </span>
    </span>
  )
}

/** „Sender · Folge n"; läuft die zweite Sendung eines Bündels, steht ihre Folge. Die nächste Sendung trägt „· in 13 Min". */
export function SenderZeile({ ev, zustand, restZeigen }: { ev: ReleaseEvent; zustand: Zeilenzustand | undefined; restZeigen: boolean }) {
  const { t } = useLang()
  const folge = zustand?.art === 'laeuft' && zustand.folge ? zustand.folge : ev.episode && !ev.sichtung ? ev.episode : undefined
  return (
    <span className="text-xs text-ak-leise">
      {ev.sender}
      {folge ? ` · ${t('kal.folge', { n: folge })}` : ''}
      {restZeigen && zustand?.art === 'naechste' && <span className="font-semibold text-ak-tv"> · {restText(zustand.minuten)}</span>}
    </span>
  )
}

/** Linie mit der aktuellen Uhrzeit; nach der letzten Zeile dazu „Heute nichts mehr" in der Farbe der Uhrzeiten. */
export function JetztLinie({ uhr, nichtsMehr }: { uhr: string; nichtsMehr: boolean }) {
  const { t } = useLang()
  return (
    <>
      <li className="flex items-center gap-2 py-0.5 max-lg:hidden">
        <span aria-hidden="true" className="h-px flex-1 bg-ak-akzent" />
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ak-akzent-text">{t('kal.jetztUhr', { zeit: uhr })}</span>
      </li>
      {nichtsMehr && <li className="py-1 text-[13px] font-bold text-ak-tv max-lg:hidden">{t('kal.nichtsMehr')}</li>}
    </>
  )
}

/** Zusatz in der Kopfzeile „Im Fernsehen", nur vor der ersten Sendung. */
export function ErsteSendung({ minuten }: { minuten: number }) {
  const { t } = useLang()
  return <span className="text-[11px] font-semibold normal-case tracking-normal"> · {t('kal.ersteSendung', { rest: restText(minuten) })}</span>
}
