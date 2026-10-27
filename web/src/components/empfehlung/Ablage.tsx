import { useState, type ReactNode } from 'react'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import { useLang } from '../../lib/i18n.tsx'
import type { TranslationKey } from '../../lib/i18n.tsx'

function Liste({ liste, holen }: { liste: Kandidat[]; holen: (id: number) => void }) {
  const { t } = useLang()
  return (
    <div className="flex basis-full flex-wrap gap-2">
      {liste.map((k) => (
        <span key={k.id} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ak-rand bg-ak-flaeche py-0 pl-3 pr-1.5 text-[13px]">
          {k.n}
          <button type="button" onClick={() => holen(k.id)} className="min-h-9 rounded-full bg-ak-flaeche-2 px-2.5 text-xs font-semibold">
            {t('empf.zurueckholen')}
          </button>
        </span>
      ))}
    </div>
  )
}

/** Der Knopf eines Fachs („Gesehene (n)“) samt „Alle zurückholen“, wenn es offen ist und mehr als einen Titel hat. */
function FachKnopf({ titelKey, liste, offen, umschalten, holen }: { titelKey: TranslationKey; liste: Kandidat[]; offen: boolean; umschalten: () => void; holen: (id: number) => void }) {
  const { t } = useLang()
  return (
    <span className="inline-flex items-center">
      <button type="button" onClick={umschalten} aria-expanded={offen} className="min-h-11 text-[13px] text-ak-leise underline">
        {t(titelKey, { n: liste.length })}
      </button>
      {offen && liste.length > 1 && (
        <button type="button" onClick={() => liste.forEach((k) => holen(k.id))} className="ml-3 min-h-11 rounded-full bg-ak-flaeche-2 px-3 text-xs font-semibold">
          {t('empf.alleZurueckholen')}
        </button>
      )}
    </span>
  )
}

/** Eine Zeile: links die übergebenen Knöpfe („Genauer“, „Von vorn“), rechts die Fächer Gesehene und Verworfene; geöffnete Listen darunter, jeder Titel einzeln zurückholbar. */
export function Ablage({ verworfen, gesehen, verworfenHolen, gesehenHolen, children }: {
  verworfen: Kandidat[]
  gesehen: Kandidat[]
  verworfenHolen: (id: number) => void
  gesehenHolen: (id: number) => void
  children?: ReactNode
}) {
  const [gesehenOffen, setGesehenOffen] = useState(false)
  const [verworfenOffen, setVerworfenOffen] = useState(false)
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {children}
      <span className="ml-auto flex flex-wrap items-center justify-end gap-x-4">
        <FachKnopf titelKey="empf.gesehenListe" liste={gesehen} offen={gesehenOffen} umschalten={() => setGesehenOffen(!gesehenOffen)} holen={gesehenHolen} />
        <FachKnopf titelKey="empf.verworfen" liste={verworfen} offen={verworfenOffen} umschalten={() => setVerworfenOffen(!verworfenOffen)} holen={verworfenHolen} />
      </span>
      {gesehenOffen && <Liste liste={gesehen} holen={gesehenHolen} />}
      {verworfenOffen && <Liste liste={verworfen} holen={verworfenHolen} />}
    </div>
  )
}
