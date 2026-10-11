/**
 * **Der Stream/Disc-Umschalter über der Pillen-Reihe** (30.09.2026 aus `AntwortKasten` gelöst).
 *
 * Überschrift und Umschalter teilen sich eine Zeile; saß er absolut in der Ecke, kostete das eine
 * zweite: „headline auf selbe zeile wie den toggle, trennstrich genau
 * darunter, dann die pills."
 *
 * **Eine leere Seite wird nicht gezeigt, nicht ausgegraut** (Daniel, 10.10.2026: bei „YAIBA"
 * stand „Stream" tot neben „Disc"). Bei nur einer Seite bleibt deren Name als Etikett stehen —
 * sonst wäre eine einzelne Kaufpille nicht als Disc zu erkennen —, aber ohne Schalter dahinter.
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
      className="ml-auto inline-flex shrink-0 self-start rounded-full border border-slate-300/60 bg-white/70 p-0.5 text-sm dark:border-white/15 dark:bg-black/25"
      role="tablist"
      aria-label={T('where.umschalter')}
    >
      {[
        { an: false, text: T('where.umschalterStream'), leer: streamLeer },
        { an: true, text: T('where.umschalterDisc'), leer: discLeer },
      ]
        .filter((o) => !o.leer)
        .map((o) => (
          <button
            key={String(o.an)}
            type="button"
            role="tab"
            aria-selected={aktivDisc === o.an}
            onClick={() => onWahl(o.an)}
            className={[
              'min-h-11 rounded-full px-4 transition',
              aktivDisc === o.an
                ? 'bg-slate-900 font-medium text-white dark:bg-white/90 dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100',
            ].join(' ')}
          >
            {o.text}
          </button>
        ))}
    </div>
  )
}
