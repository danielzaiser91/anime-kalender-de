/** Texte des Antwort-Kastens im Detail-Panel (`components/detail/antwort-regeln.ts`); `TEXTE` in `i18n.tsx` nimmt sie über `i18n-kalender.ts` auf. */
export const TEXTE_ANTWORT = {
  // Wie die Pille „≈ 26 Fg.“: die Zahl ist die Folgenzahl des Werks, nicht am Weg belegt.
  // Nur Filme mit belegter Synchro und einem deutschen Kinostart bei TMDB; der Monat, nie ein Tag.
  'antwort.kinoZuletzt': 'Zuletzt im Kino: {monat}',
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
  // Ausfälle entstehen nur für errechnete Termine (`pipeline/termine-pruefen.ts`), daher „erwartet“.
  'antwort.vermerkUeberfaellig': 'Folge {n} wurde für den {datum} erwartet (errechnet) und ist bis heute nicht erschienen.',
  'antwort.vermerkAnnahme': 'Der Termin oben ist unsere Annahme — ändert sich etwas, tragen wir ihn nach.',
  'antwort.vermerkNaechsterBlick': 'Der nächste Blick folgt in wenigen Stunden.',
  'antwort.vermerkNewsLeerStand': 'Anime2You meldet bisher keine Verschiebung (Stand: {wann}, nächster Abgleich morgen früh).',
  'antwort.vermerkRechercheZuletzt': 'Zuletzt gesucht: {wann}. Nächste Suche {naechste}.',
  'antwort.vermerkRechercheStart': 'Die Suche in News und Social Media beginnt {naechste}.',
  'antwort.vermerkRechercheEnde': 'Nach zwei Monaten suchen wir nicht mehr aktiv; beim Anbieter sehen wir weiter nach.',
  // Mehrere belegte Folgen am selben Tag: eine Überschrift, ein Satz im Plural (Avatar: Die sieben Häfen, 4–6 am 16.10.).
  'antwort.naechsteFolgenNr': 'Nächste Folgen ({von}–{bis})',
  'antwort.ersteFolgenNr': 'Erste Folgen ({von}–{bis})',
  'antwort.finaleFolgenNr': 'Finale Folgen ({von}–{bis})',
  'antwort.erscheinenRelativ': 'erscheinen {rel}, am {tag} den {datum}.',
  'antwort.erscheinenDatum': 'erscheinen am {tag} den {datum}.',
} as const
