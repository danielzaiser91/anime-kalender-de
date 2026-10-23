import type { NewsArt } from '@shared/types.ts'

const GRUEN = 'bg-ak-gut-grund text-ak-gut-text'
const AKZENT = 'bg-ak-akzent/15 text-ak-akzent-text'
const FINALE = 'bg-ak-favorit/15 text-ak-favorit-text'
const LEISE = 'bg-ak-flaeche-2 text-ak-leise'
const INFO = 'bg-ak-info-grund text-ak-info-text'

/** Die Marke einer Meldungsart (Chip in News und Panel). */
export const NEWS_FARBE: Record<NewsArt, string> = {
  neu: GRUEN,
  folgen: GRUEN,
  nachgereicht: GRUEN,
  angekuendigt: INFO,
  kino: AKZENT,
  disc: FINALE,
  verspaetet: LEISE,
  nachgetragen: LEISE,
  rhythmus: AKZENT,
  takt: LEISE,
  offiziell: INFO,
}

/** Der Punkt an der Zeitleiste im Panel, je Art in ihrer Farbe. */
export const NEWS_PUNKT: Record<NewsArt, string> = {
  neu: 'bg-ak-gut',
  folgen: 'bg-ak-gut',
  angekuendigt: 'bg-ak-info',
  disc: 'bg-ak-favorit-text',
  kino: 'bg-ak-akzent',
  verspaetet: 'bg-ak-leise',
  nachgereicht: 'bg-ak-gut',
  nachgetragen: 'bg-ak-leise',
  rhythmus: 'bg-ak-akzent',
  takt: 'bg-ak-leise',
  offiziell: 'bg-ak-info',
}
