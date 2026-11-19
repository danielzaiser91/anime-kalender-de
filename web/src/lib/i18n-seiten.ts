/**
 * Texte der Seiten abseits des Kalenders: Abo, Newsletter, Favoriten, Import, Fußzeile, Quellen.
 * Eigene Datei, weil `i18n.tsx` über 800 Zeilen lag; `TEXTE` dort nimmt sie vollständig auf.
 */
export const TEXTE_SEITEN = {
  /*
    **Die Nachrichtenseite** (29.09.2026 aus `i18n.tsx` hierher): Der Block lag mit der Datei an der
    800-Zeilen-Grenze, und diese Datei ist genau dafür da. Dazu die Quellenangabe — Daniel,
    28.09.2026: „inkl Link zur Quelle"; „Heute"/„Gestern" beschriften die Tagesgruppen.
  */
  'view.saison': 'Saison',
  /* Quellen werden nach Dokument gezählt — ein aktualisierter Artikel bleibt eine Quelle. */
  /* Der Tag, an dem die Quelle es sagte — bei eigener Messung der Tag, an dem wir nachsahen (news-plan.md). */
  'detail.primeSuchen': 'Öffnet die Suche bei Prime Video – eine Direktadresse fehlt noch',
  'sub.title': 'Kalender abonnieren',
  // Bleibt: Die Verzögerung ist nicht herleitbar und erzeugt sonst die Frage
  // „warum ist mein Termin nicht da?".

  // Was ein verbundener Browser auf der Newsletter-Seite sieht: seinen Stand
  // statt des Anmeldeformulars.
  'fav.neuSeit': '{n} neu',
  'card.details': 'Details zu {titel}',
  // Der Grund, aus dem sich jemand anmeldet, dessen Serie gar nicht im
  // Kalender steht (Daniel, 13.08.2026 — aus eigener Erfahrung beschrieben).
  // Wiederherstellung der Favoriten per E-Mail-Link (14.08.2026).
  // **Nicht „verloren" — der häufigere Fall ist ein zweites Gerät.**
  //
  // Daniel am 29.08.2026: „ich möchte auf all meinen Geräten mit meinen
  // Favoriten synchron sein … auf meinem Handy ist der newsletter noch nicht
  // mit meiner E-Mail-Adresse verbunden." Auf einem frischen Handy ist nichts
  // verloren, und wer „Favoriten verloren?" liest, hält den Kasten für ein
  // Problem, das er nicht hat — und sucht die Synchronisierung woanders.
  //
  // „Auf dieses Gerät holen" deckt beide Fälle mit denselben Worten ab.
  // Verbunden: Der Kasten zeigt kein Problem, sondern dieses Gerät.
  // Gekürzt: Warum sie verlorengehen können, muss hier nicht stehen — wer das
  // Feld sucht, weiß es bereits.
  // Sagt jetzt auch, was danach passiert: Der Abgleich läuft von selbst weiter.
  // Das ist die Frage, mit der man hier ankommt („bleibt das synchron?").
  // Ein Satz statt zwei: Dass die Titel auch auf dem Server liegen, ist die
  // Folge — wissen muss man in diesem Moment nur, dass es verbunden ist.
  // Der Link ist kein Notbehelf, sondern der Weg, ein weiteres Gerät zu
  // verbinden — genau dafür braucht man ihn, wenn hier schon alles stimmt.

  // Gekürzt nach der Regel „Texte für Nutzer so kurz wie möglich" (14.08.2026).
  // Weg ist `news.waitNote`: Dass wir zu diesen Titeln wenig führen, ändert für
  // den Leser nichts — er sieht es ohnehin, sobald er einen öffnet.


  'footer.stats': '{belegt} Anime mit belegter deutscher Synchro · {rest} angekündigt oder wahrscheinlich · {releases} Releases · {events} Termine',
  'footer.statsGesamt': '{titles} Anime mit deutscher Synchro · {releases} Releases · {events} Termine',
  'footer.updated': 'Daten zuletzt aktualisiert:',
  'footer.sources': 'Quellen',
  'footer.code': 'Quellcode',

  // Wie der Bot arbeitet. Für Leser geschrieben, nicht für Entwickler: Jeder
  // Absatz beantwortet eine Frage, die beim Anschauen eines Termins aufkommt.
  // Datenbank-Vorgabe „Relevanz": Gruppenüberschriften und Startdatum auf der Kachel.
  // Entdecken (Spezifikation 18, Daniels Wortlaut)
  'view.entdecken': 'Entdecken',
}
