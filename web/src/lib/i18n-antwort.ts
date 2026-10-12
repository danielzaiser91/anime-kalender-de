/** Texte des Antwort-Kastens im Detail-Panel (`components/detail/antwort-regeln.ts`); `TEXTE` in `i18n.tsx` nimmt sie über `i18n-kalender.ts` auf. */
export const TEXTE_ANTWORT = {
  // Wie die Pille „≈ 26 Fg.“: die Zahl ist die Folgenzahl des Werks, nicht am Weg belegt.
  'antwort.fertigUngefaehr': 'Auf Deutsch, {count} Folgen',
  // Nebenzeile unter „26 von 41 Folgen auf Deutsch“: woher die deutsche Zahl stammt.
  'antwort.deFolgenQuelle': 'Laut {quelle}: „{zitat}“',
  // Die Auskunft unter einer ausgebliebenen Folge. {anbieter} wird im Panel zum Verweis.
  'antwort.vermerkPruefen': 'Wir sehen mehrmals täglich bei {anbieter} nach und tragen die Folge ein, sobald sie da ist.',
  'antwort.vermerkZuletzt': 'Zuletzt nachgesehen: {wann}.',
  'antwort.vermerkNews': '{quelle} am {datum}:',
  'antwort.vermerkNewsLeer': 'Anime2You meldet bisher keine Verschiebung.',
  'antwort.vermerkQuelle': 'Quelle',
  'antwort.vermerkRechercheLeer': 'Auch in weiteren News und auf Social Media haben wir bis zum {datum} nichts dazu gefunden.',
  // „Offen kommunizieren": je Stufe, wann zuletzt und wann als Nächstes.
  // Die Folge hat einen neuen Termin, ist aber weiterhin überfällig (Daniel,
  // 20.09.2026): „entsprechend muss eine ausfallnotiz im detail panel stehen".
  'antwort.vermerkUeberfaellig': 'Folge {n} war für den {datum} angekündigt und ist bis heute nicht erschienen.',
  'antwort.vermerkAnnahme': 'Der Termin oben ist unsere Annahme — ändert sich etwas, tragen wir ihn nach.',
  'antwort.vermerkNaechsterBlick': 'Der nächste Blick folgt in wenigen Stunden.',
  'antwort.vermerkNewsLeerStand': 'Anime2You meldet bisher keine Verschiebung (Stand: {wann}, nächster Abgleich morgen früh).',
  'antwort.vermerkRechercheZuletzt': 'Zuletzt gesucht: {wann}. Nächste Suche {naechste}.',
  'antwort.vermerkRechercheStart': 'Die Suche in News und Social Media beginnt {naechste}.',
  'antwort.vermerkRechercheEnde': 'Nach zwei Monaten suchen wir nicht mehr aktiv; beim Anbieter sehen wir weiter nach.',
} as const
