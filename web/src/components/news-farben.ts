import type { NewsArt } from '@shared/types.ts'

const GRUEN = 'bg-ak-gut-grund text-ak-gut-text'
const ORANGE = 'bg-orange-500/15 text-orange-800 dark:text-orange-300'
const GELB = 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300'
const GRAU = 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
const BLAU = 'bg-sky-500/15 text-sky-800 dark:text-sky-300'

/** Die Marke einer Meldungsart (Chip in News und Panel). */
export const NEWS_FARBE: Record<NewsArt, string> = {
  neu: GRUEN,
  folgen: GRUEN,
  nachgereicht: GRUEN,
  angekuendigt: ORANGE,
  kino: ORANGE,
  disc: GELB,
  verspaetet: GRAU,
  nachgetragen: GRAU,
  rhythmus: ORANGE,
  offiziell: BLAU,
}

/** Der Punkt an der Zeitleiste im Panel, je Art in ihrer Farbe. */
export const NEWS_PUNKT: Record<NewsArt, string> = {
  neu: 'bg-ak-gut',
  folgen: 'bg-blue-400',
  angekuendigt: 'bg-violet-500',
  disc: 'bg-ak-finale-text',
  kino: 'bg-ak-akzent',
  verspaetet: 'bg-slate-400',
  nachgereicht: 'bg-teal-500',
  nachgetragen: 'bg-indigo-500',
  rhythmus: 'bg-violet-400',
  offiziell: 'bg-sky-500',
}
