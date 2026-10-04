import type { ReactNode } from 'react'

/**
 * **Ein Bereich im Detail-Panel als Karte** (Daniel, 04.10.2026: „neuigkeiten ist ausgegraut und schlecht sichtbar,
 * kasten drum, bessere colors … optisch anspruchsvoller"): Farbleiste links, ein leichter Farbverlauf aus dem Akzent,
 * ein Symbol-Chip, die Überschrift in voller Textfarbe und rechts ein Zähler. Der Akzent trennt die Bereiche auf einen
 * Blick, ohne dass der Inhalt grau wird.
 */
const AKZENT = {
  violet: { leiste: 'bg-violet-500', chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-300', glanz: 'from-violet-500/[0.10]' },
  amber: { leiste: 'bg-amber-500', chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', glanz: 'from-amber-500/[0.09]' },
  emerald: { leiste: 'bg-emerald-500', chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', glanz: 'from-emerald-500/[0.09]' },
  blue: { leiste: 'bg-blue-500', chip: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', glanz: 'from-blue-500/[0.09]' },
} as const

export type PanelAkzent = keyof typeof AKZENT

export function PanelKarte({ symbol, titel, zaehler, akzent, label, children }: {
  symbol: ReactNode
  titel: string
  zaehler?: number
  akzent: PanelAkzent
  label?: string
  children: ReactNode
}) {
  const a = AKZENT[akzent]
  return (
    <section
      aria-label={label ?? titel}
      className={`relative overflow-hidden rounded-2xl border border-ak-rand bg-gradient-to-br ${a.glanz} via-ak-flaeche to-ak-flaeche py-3 pl-5 pr-3.5 shadow-sm`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${a.leiste}`} />
      <header className="mb-2.5 flex items-center gap-2.5">
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-lg ${a.chip}`}>
          {symbol}
        </span>
        <h3 className="text-sm font-bold tracking-wide text-ak-text">{titel}</h3>
        {zaehler ? <span className="ml-auto rounded-full bg-ak-flaeche-2 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ak-text/80">{zaehler}</span> : null}
      </header>
      {children}
    </section>
  )
}

/** Eine Glocke für die Neuigkeiten. */
export function GlockeZeichen() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z" />
    </svg>
  )
}

/** Ein aufgeschlagenes Buch für die Handlung. */
export function BuchZeichen() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 6.5C10.6 5.5 8.7 5 6.5 5 5 5 3.7 5.2 2.5 5.7a1 1 0 0 0-.6.9v11.2a1 1 0 0 0 1.4.9C4.4 18.2 5.4 18 6.5 18c1.9 0 3.5.5 4.8 1.5.2.1.5.2.7.2s.5-.1.7-.2C14 18.5 15.600 18 17.500 18c1.100 0 2.100.2 3.200.7a1 1 0 0 0 1.400-.9V6.600a1 1 0 0 0-.6-.9C20.300 5.200 19 5 17.500 5 15.300 5 13.400 5.500 12 6.500Z" />
    </svg>
  )
}
