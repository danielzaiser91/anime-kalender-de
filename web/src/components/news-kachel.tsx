import { type NewsEintrag } from '@shared/types.ts'
import { coverBild } from '../lib/cover.ts'

const KACHEL = 'h-14 w-10 shrink-0 rounded'

/**
 * Das Bild einer News-Zeile. Ohne Cover steht eine graue Fläche.
 */
export function NewsCover({ e }: { e: NewsEintrag }): React.JSX.Element {
  if (e.cover) return <img {...coverBild(e.cover, 40)} alt="" loading="lazy" className={`${KACHEL} object-cover`} />
  return <span className={`${KACHEL} bg-slate-200 dark:bg-slate-800`} />
}

/** Die Datum-Plakette auf dem Kino-Cover. */
export function KinoPlakette({ kommt, text }: { kommt: boolean; text: string }): React.JSX.Element {
  return (
    <span className={`absolute left-1 top-1 rounded px-1 py-px text-[10px] font-semibold text-white ${kommt ? 'bg-slate-900/80' : 'bg-rose-600'}`}>
      {text}
    </span>
  )
}
