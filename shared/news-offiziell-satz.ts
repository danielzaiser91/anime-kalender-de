import type { OffiziellKategorie } from './news-typen.ts'

/**
 * Der Satz zu einer Meldung der offiziellen Website, je Kategorie — für die Mail (Worker). Die Seite führt dieselben Sätze als `news.offiziell.*` in `web/src/lib/i18n-seiten.ts`;
 * `check-news-offiziell.ts` hält beide gleich. Er sagt, was die Meldung bedeutet; die Überschrift der Seite steht wörtlich im Beleg.
 */
export const OFFIZIELL_SATZ: Record<OffiziellKategorie, string> = {
  staffel: 'Weitere Staffel bestätigt',
  film: 'Film angekündigt',
  synchro: 'Hinweis zur Synchronfassung',
  termin: 'Start- oder Sendetermin genannt',
}
