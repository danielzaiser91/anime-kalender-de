import { type NewsEintrag } from '@shared/types.ts'
import { AnbieterIcon } from '../lib/anbieter-icon.tsx'
import { coverBild } from '../lib/cover.ts'
import { useVorschau } from '../lib/vorschau.ts'
import { anbieterDerMeldung } from '../lib/news-text.ts'

const KACHEL = 'h-14 w-10 shrink-0 rounded'

/**
 * Das Bild einer News-Zeile. Ohne Cover steht bei der Vorschau „news-platzhalter“ das Zeichen des
 * Anbieters (sonst der Anfangsbuchstabe des Titels) statt einer leeren Fläche.
 */
export function NewsCover({ e }: { e: NewsEintrag }): React.JSX.Element {
  const v = useVorschau('news-platzhalter')
  if (e.cover) return <img {...coverBild(e.cover, 40)} alt="" loading="lazy" className={`${KACHEL} object-cover`} />
  const grund = `${KACHEL} bg-slate-200 dark:bg-slate-800`
  if (!v) return <span className={grund} />
  const anbieter = e.meldungen.map(anbieterDerMeldung).find(Boolean)
  return (
    <span className={`${grund} flex items-center justify-center text-slate-500 dark:text-slate-400`} aria-hidden="true">
      {(anbieter && <AnbieterIcon was={anbieter} groesse={14} />) || (
        <span className="text-lg font-semibold">{[...e.titel][0]?.toUpperCase()}</span>
      )}
    </span>
  )
}

/** Die Datum-Plakette auf dem Kino-Cover; mit der Vorschau „news-platzhalter“ dunkler hinterlegt und 12 px groß. */
export function KinoPlakette({ kommt, text }: { kommt: boolean; text: string }): React.JSX.Element {
  const v = useVorschau('news-platzhalter')
  const farbe = kommt ? (v ? 'bg-slate-900' : 'bg-slate-900/80') : v ? 'bg-rose-700' : 'bg-rose-600'
  return (
    <span className={`absolute left-1 top-1 rounded px-1 py-px font-semibold text-white ${v ? 'text-xs' : 'text-[10px]'} ${farbe}`}>
      {text}
    </span>
  )
}
