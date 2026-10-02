/**
 * **Der Stream/Disc-Umschalter über der Pillen-Reihe** (30.09.2026 aus `AntwortKasten` gelöst).
 *
 * Überschrift und Umschalter teilen sich eine Zeile; saß er absolut in der Ecke, kostete das eine
 * zweite: „headline auf selbe zeile wie den toggle, trennstrich genau
 * darunter, dann die pills." Gibt es keine zweite Seite, gibt es nichts umzuschalten.
 */
export function Umschalter({ aktivDisc, streamLeer, discLeer, onWahl, T }: {
  aktivDisc: boolean
  streamLeer: boolean
  discLeer: boolean
  onWahl: (disc: boolean) => void
  T: (k: string, v?: Record<string, string | number>) => string
}) {
  if (streamLeer && discLeer) return null
  return (
    <div
      className="ml-auto mb-[5px] inline-flex shrink-0 self-start rounded-full border border-slate-300/60 bg-white/70 p-0.5 text-[11px] dark:border-white/15 dark:bg-black/25"
      role="tablist"
      aria-label={T('where.umschalter')}
    >
      {[
        { an: false, text: T('where.umschalterStream'), leer: streamLeer },
        { an: true, text: T('where.umschalterDisc'), leer: discLeer },
      ].map((o) => (
        <button
          key={String(o.an)}
          type="button"
          role="tab"
          aria-selected={aktivDisc === o.an}
          disabled={o.leer}
          onClick={() => onWahl(o.an)}
          className={[
            'rounded-full px-2.5 py-0.5 transition',
            aktivDisc === o.an
              ? 'bg-slate-900 font-medium text-white dark:bg-white/90 dark:text-slate-900'
              : o.leer
                ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
          ].join(' ')}
        >
          {o.text}
        </button>
      ))}
    </div>
  )
}
