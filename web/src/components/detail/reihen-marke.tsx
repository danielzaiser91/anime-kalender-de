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
