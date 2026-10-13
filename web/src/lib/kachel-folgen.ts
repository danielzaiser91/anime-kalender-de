/** Was eine Kachel an Auszeichnung trägt. */
export type KartenArt = 'start' | 'finale'

/** Ring um das Cover, Farbe der Fahne und Texte (`kal.*`) je Auszeichnung — Woche und Monat teilen sie. */
export const ART_STIL = {
  start: { ring: 'ring-ak-akzent', fahne: 'bg-ak-akzent', name: 'kal.start', hinweis: 'kal.startHinweis' },
  finale: { ring: 'ring-ak-finale', fahne: 'bg-ak-finale', name: 'kal.finale', hinweis: 'kal.finaleHinweis' },
} as const
