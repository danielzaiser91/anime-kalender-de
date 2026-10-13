import { useEffect, useState } from 'react'
import { loadKinoZuletzt } from '../../lib/data.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { fragtKinoZuletzt, kinoMonatText } from './kino-zuletzt.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

/** Eine leise Zeile unter dem Antwort-Kasten: „Zuletzt im Kino: April 2026“, wenn TMDB einen deutschen Kinostart führt. */
export function KinoZuletzt({ titleId, antwort, t }: { titleId: number; antwort: ReturnType<typeof berechneAntwort>; t: Translate }) {
  const gefragt = fragtKinoZuletzt(antwort)
  const [fund, setFund] = useState<{ id: number; monat?: string }>()

  useEffect(() => {
    if (!gefragt) return
    let alive = true
    loadKinoZuletzt(titleId).then((monat) => {
      if (alive) setFund({ id: titleId, monat })
    })
    return () => {
      alive = false
    }
  }, [gefragt, titleId])

  if (!gefragt || fund?.id !== titleId || !fund.monat) return null
  return <p className="mt-1 text-t4 text-slate-500 dark:text-slate-400">{t('antwort.kinoZuletzt', { monat: kinoMonatText(fund.monat) })}</p>
}
