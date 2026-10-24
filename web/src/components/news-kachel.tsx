import { type NewsEintrag } from '@shared/types.ts'
import { coverBild } from '../lib/cover.ts'
import { useHoverCover } from './kalender/HoverCover.tsx'

const KACHEL = 'h-14 w-10 shrink-0 rounded'

/**
 * Das Bild einer News-Zeile. Ohne Cover steht eine graue Fläche.
 */
export function NewsCover({ e }: { e: NewsEintrag }): React.JSX.Element {
  const { zeiger, vorschau } = useHoverCover(e.cover)
  if (e.cover) {
    return (
      <span {...zeiger} className={KACHEL}>
        <img {...coverBild(e.cover, 40)} alt="" loading="lazy" className="size-full rounded object-cover" />
        {vorschau}
      </span>
    )
  }
  return <span className={`${KACHEL} bg-slate-200 dark:bg-slate-800`} />
}

/** Die Datum-Plakette auf dem Kino-Cover. */
export function KinoPlakette({ kommt, text }: { kommt: boolean; text: string }): React.JSX.Element {
  return (
    <span className={`absolute left-1 top-1 rounded px-1 py-px text-[10px] font-semibold ${kommt ? 'bg-slate-900/80 text-white' : 'bg-ak-akzent text-ak-auf-akzent'}`}>
      {text}
    </span>
  )
}
