import type { Title } from '@shared/types.ts'
import { erscheintErst } from '@shared/logic.ts'
import { Tooltip } from '../ui.tsx'
import type { Translate } from '../../lib/i18n.tsx'

/** Zeichen vor dem Namen in der Reihenliste: „🇩🇪 ✕" für einen Teil ohne belegte deutsche Synchro. */
export function OhneSynchroMarke({ t }: { t: Translate }) {
  return (
    <span className="shrink-0 rounded border border-rose-400/50 bg-rose-500/15 px-1.5 py-px text-[9px] font-extrabold leading-tight tracking-wider text-rose-600 dark:text-rose-400">
      <Tooltip text={t('detail.reiheOhneSynchro')} eigenerFokus>
        🇩🇪 ✕
      </Tooltip>
    </span>
  )
}

/** Zeichen für einen Teil, dessen Original noch nicht erschienen ist — dort ist fehlende Synchro kein Befund. */
export function GeplantMarke({ t }: { t: Translate }) {
  return (
    <span className="shrink-0 rounded border border-violet-400/50 bg-violet-500/15 px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-violet-700 dark:text-violet-300">
      <Tooltip text={t('geplant.hinweis')} eigenerFokus>
        {t('geplant.marke')}
      </Tooltip>
    </span>
  )
}

/** Genau eine Marke je Zeile: „Geplant" geht vor „ohne Synchro". */
export function SynchroMarke({ t, m, ohneDe }: { t: Translate; m: Pick<Title, 'jpStart' | 'jpStatus' | 'jpYear'>; ohneDe: boolean }) {
  if (erscheintErst(m)) return <GeplantMarke t={t} />
  return ohneDe ? <OhneSynchroMarke t={t} /> : null
}
