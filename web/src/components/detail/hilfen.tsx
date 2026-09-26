import { type ReleaseEvent } from '@shared/types.ts'
import { buildIcs } from '@shared/ics.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useShare } from '../../lib/share.ts'
import { Tooltip } from '../ui.tsx'
import { useState, useEffect } from 'react'
import { berlinToUtc } from '@shared/time.ts'

export const KEYWORD_PREVIEW = 8

/**
 * Wie viel von der Handlung ohne Klick zu sehen ist.
 *
 * 200 Zeichen sind etwa zwei Sätze — genug, um zu entscheiden, ob man
 * weiterlesen will, und kurz genug, dass alles Übrige im Bild bleibt.
 */
export const PLOT_PREVIEW = 200

export function downloadIcs(events: ReleaseEvent[], filename: string): void {
  const blob = new Blob([buildIcs(events, { calendarName: filename, erinnerung: true })], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Teilen — als Symbol im Kopf, nicht als Knopf neben dem Anbieter.
 *
 * Vorher stand er in der Knopfzeile direkt neben „Bei ADN ansehen", und dort
 * las er sich, als teile er den ADN-Link (Daniel, 15.08.2026: „es lässt
 * vermuten das der teilen link sich auf adn bezieht, dabei bezieht er sich auf
 * dieses panel"). Geteilt wird der Titel, also gehört er zu Auge und Stern —
 * den anderen beiden Handlungen, die dem Titel gelten.
 */
export function ShareIcon({ slug, name }: { slug: string; name: string }) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const copied = copiedSlug === slug

  return (
    <Tooltip text={t('detail.shareHint')} seite="unten">
      <button
        type="button"
        /* Titel-Seite `/t/`, nicht `/r/` — dort liegen nur Termine (toter Link, Daniel 19.09.2026). */
        onClick={() => share(slug, name, 't')}
        aria-label={t('detail.share')}
        className="cursor-pointer rounded p-1 text-lg leading-none text-slate-400 transition hover:bg-slate-500/10 hover:text-sky-400"
      >
        {copied ? '✓' : '🔗'}
      </button>
    </Tooltip>
  )
}

const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** „Mo–Fr" bei lückenlosen Sendetagen, sonst „Sa, So". */
export function sendetageText(tage: number[]): string {
  const t = [...new Set(tage)].filter((x) => x >= 1 && x <= 7).sort((a, b) => a - b)
  if (t.length === 7) return 'Täglich'
  const lueckenlos = t.length > 2 && t.every((x, i) => i === 0 || x === t[i - 1]! + 1)
  return lueckenlos ? `${TAGE_KURZ[t[0]! - 1]}–${TAGE_KURZ[t[t.length - 1]! - 1]}` : t.map((x) => TAGE_KURZ[x - 1]).join(', ')
}

/**
 * **Wie lange noch — nur am Tag davor und am Tag selbst, nur mit belegter Uhrzeit**
 * (18.09.2026, Feature-Vergleich: LiveChart). „Erscheint heute um 17:00" sagt, wann;
 * „noch 2 Std. 14 Min." sagt, ob man jetzt nachsehen soll. Bei „≈" (fortgeschriebener
 * Termin) und ohne Uhrzeit steht nichts — ein Countdown auf eine geschätzte Minute
 * wäre eine erfundene Genauigkeit.
 */
export function Countdown({ date, time }: { date: string; time: string }) {
  const [jetzt, setJetzt] = useState(() => Date.now())
  useEffect(() => {
    const takt = window.setInterval(() => setJetzt(Date.now()), 30_000)
    return () => window.clearInterval(takt)
  }, [])
  const rest = berlinToUtc(date, time).getTime() - jetzt
  if (rest <= 0 || rest > 24 * 3600_000) return null
  const std = Math.floor(rest / 3600_000)
  const min = Math.floor((rest % 3600_000) / 60_000)
  return (
    <span className="ml-1 whitespace-nowrap rounded bg-sky-500/10 px-1.5 text-xs font-medium tabular-nums text-sky-700 dark:text-sky-300">
      {std ? `noch ${std} Std. ${min} Min.` : `noch ${Math.max(1, min)} Min.`}
    </span>
  )
}
