import { useState } from 'react'
import type { Kandidat } from '@shared/empfehlung-pool.ts'
import { useLang } from '../../lib/i18n.tsx'
import type { TranslationKey } from '../../lib/i18n.tsx'

function Liste({ liste, holen }: { liste: Kandidat[]; holen: (id: number) => void }) {
  const { t } = useLang()
  return (
    <div className="mt-3 flex flex-wrap gap-2">
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

function Fach({ titelKey, liste, holen }: { titelKey: TranslationKey; liste: Kandidat[]; holen: (id: number) => void }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOffen(!offen)} aria-expanded={offen} className="min-h-11 text-[13px] text-ak-leise underline">
        {t(titelKey, { n: liste.length })}
      </button>
      {offen && <Liste liste={liste} holen={holen} />}
    </div>
  )
}

/** Verworfene und Gesehene: zwei getrennte, einzeln ein- und ausklappbare Listen, jeder Titel einzeln zurückholbar. */
export function Ablage({ verworfen, gesehen, verworfenHolen, gesehenHolen }: {
  verworfen: Kandidat[]
  gesehen: Kandidat[]
  verworfenHolen: (id: number) => void
  gesehenHolen: (id: number) => void
}) {
  return (
    <div className="mt-2 flex flex-col">
      <Fach titelKey="empf.gesehenListe" liste={gesehen} holen={gesehenHolen} />
      <Fach titelKey="empf.verworfen" liste={verworfen} holen={verworfenHolen} />
    </div>
  )
}
