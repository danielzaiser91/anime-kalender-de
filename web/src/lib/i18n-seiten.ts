/**
 * Texte der Seiten abseits des Kalenders: Abo, Newsletter, Favoriten, Import, Fußzeile, Quellen.
 * Eigene Datei, weil `i18n.tsx` über 800 Zeilen lag; `TEXTE` dort nimmt sie vollständig auf.
 */
export const TEXTE_SEITEN = {
  'sub.title': 'Kalender abonnieren',
  'sub.intro':
    'Ein Abo statt vieler Einzelklicks: Die Feeds unten aktualisieren sich mit jedem Daten-Update von selbst. Kein Konto, kein Login, keine Freigabe an uns nötig.',
  'sub.favTitel': 'Nur deine Favoriten',
  'sub.adresse': 'Adresse zum Kopieren',
  'sub.favOhneAbo': 'Deine Favoriten als eigenes Kalender-Abo gibt es mit bestätigtem Newsletter — dort liegen sie auf dem Server.',
  'sub.favZumNewsletter': 'Zum Newsletter',
  'sub.favAnlegen': 'Adresse für meine Favoriten erzeugen',
  'sub.favAbonnieren': 'Im Kalender abonnieren',
  'sub.favNeu': 'Neue Adresse (alte wird ungültig)',
  'sub.favHinweis': 'Wer diese Adresse kennt, sieht deine Favoriten. Neue Favoriten erscheinen beim nächsten Abruf deines Kalenders.',
  'sub.pick': 'Feed wählen',
  'sub.all': 'Alles',
  'sub.copy': 'kopieren',
  'sub.copied': '✓ kopiert',
  'sub.download': 'Datei laden',
  'sub.insert': 'In Google Calendar einfügen',
  'sub.how': "So geht's",
  'sub.step1': 'Adresse oben kopieren.',
  'sub.step2': 'Google Calendar öffnen → links bei „Weitere Kalender" auf + → „Per URL".',
  'sub.step3': 'Adresse einfügen, „Kalender hinzufügen".',
  // Bleibt: Die Verzögerung ist nicht herleitbar und erzeugt sonst die Frage
  // „warum ist mein Termin nicht da?".
  'sub.note':
    'Google aktualisiert abonnierte Feeds nur alle paar Stunden bis Tage. Wer einen Termin sofort braucht, nimmt am Eintrag den Knopf „Google Calendar".',

  'news.title': 'Newsletter',
  'news.intro':
    'Täglich oder wöchentlich per Mail, was mit deutscher Synchro erscheint. Kein Tracking, keine Werbung, Abmelden mit einem Klick aus jeder Mail.',
  'news.email': 'E-Mail-Adresse',
  // Was ein verbundener Browser auf der Newsletter-Seite sieht: seinen Stand
  // statt des Anmeldeformulars (Daniel, 15.08.2026).
  'news.yourSubscription': 'Dein Abo',
  'news.loadingPrefs': 'Einstellungen werden geladen …',
  'news.allPlatforms': 'alle',
  'fav.timeline': 'Die letzten und die nächsten sieben Tage',
  'fav.missed': '{count} erschienen',
  'fav.upcoming': '{count} folgen',
  'fav.overview': 'Deine {count} Favoriten',
  'push.an': 'Benachrichtigungen an',
  'push.aus': 'Bei neuen Folgen benachrichtigen',
  'push.hinweis': 'Für die Favoriten in diesem Browser, ohne Konto.',
  'fav.gesehenBis': 'gesehen bis',
  'fav.gesehenHinweis': 'Bis zu welcher Folge du geschaut hast — erschienen ist bis Folge {n}. Bleibt nur in diesem Browser.',
  'fav.neuSeit': '{n} neu',
  'card.details': 'Details zu {titel}',
  'import.titel': 'Aus deiner AniList- oder MyAnimeList-Liste übernehmen',
  'import.mal': 'oder MyAnimeList-Export (.xml / .xml.gz):',
  'import.malLeer': 'Die Datei enthält keine MyAnimeList-Liste.',
  'import.platzhalter': 'AniList-Benutzername',
  'import.knopf': 'Übernehmen',
  'import.laeuft': 'Liste wird geholt …',
  'import.hinweis': 'Übernimmt „schaue ich“, „geplant“ und „pausiert“ aus einer öffentlichen Liste — nur Titel mit deutscher Synchro.',
  'import.ergebnis': '{treffer} von {gesamt} Titeln deiner Liste haben deutsche Synchro und sind jetzt Favoriten.',
  'import.nichtGefunden': 'Diese Liste gibt es nicht oder sie ist privat.',
  'import.fehler': 'AniList hat nicht geantwortet. Später noch einmal versuchen.',
  'fav.search': 'Suchen',
  'fav.sort': 'Sortiert nach',
  'fav.sort.date': 'Termin',
  'fav.sort.alpha': 'Titel',
  'fav.sort.score': 'Bewertung',
  'fav.onlyDub': 'nur mit deutscher Synchro',
  'fav.cat.alle': 'alle',
  'fav.cat.laufend': 'laufend',
  'fav.cat.abgeschlossen': 'abgeschlossen',
  'fav.cat.ohne-termin': 'ohne Termin',
  'fav.dayFilter': 'nur {datum}',
  'fav.noMatch': 'Kein Favorit passt zu dieser Auswahl.',
  'fav.series': 'Reihe, {count} Teile gemerkt',
  'fav.remove': 'Nicht mehr merken',
  'fav.removed': '{name} entfernt',
  'fav.undo': 'Rückgängig',
  'fav.savedSince': 'gemerkt seit',
  'fav.savedLong': 'schon länger',
  'fav.year': 'Jahr',
  'fav.episodes': 'Folgen',
  'fav.score': 'Bewertung',
  'fav.studio': 'Studio',
  'fav.where': 'zu sehen bei',
  'fav.details': 'Alle Termine und Quellen ansehen',
  'fav.emptyTitle': 'Du hast noch nichts gemerkt.',
  'fav.emptyHint': 'Der Stern an einem Titel legt ihn hier ab — dann siehst du auf einen Blick, was erschienen ist und was ansteht.',
  'news.franchiseHint': 'Auch Neues aus gemerkten Reihen',
  'news.franchiseHintNote':
    'Erscheint zu einer Reihe, von der du etwas gemerkt hast, eine neue Staffel, ein Film oder ein Special, steht es in der nächsten Mail.',
  'news.prefsSaved': '✓ Gespeichert.',
  'news.changeAddress': 'Andere Adresse verwenden',
  'news.frequency': 'Rhythmus',
  'news.weekly': 'Wöchentlich',
  'news.weeklyHint': 'montags 07:00, alles der kommenden Woche',
  'news.daily': 'Täglich',
  'news.dailyHint': '07:00, alles des Tages',
  'news.autoSync': 'Änderungen werden ab jetzt selbsttätig übernommen.',
  'news.noSyncYet':
    'Schon abonniert? Dieser Browser ist noch nicht verbunden, gemerkte Titel bleiben also hier liegen. Unter „Favoriten verloren?" gibt es einen Link.',
  'news.welcomeTitle': 'Abo aktiv',
  'news.welcomeBody': 'Ab jetzt bekommst du die anstehenden Releases mit deutscher Synchro per Mail.',
  'news.favorites': 'Favoriten: {count} Serien',
  'news.favoritesHint': 'Neue Folgen davon stehen in jeder Mail ganz oben.',
  'news.favoritesNone': 'Noch keine. Markiere Serien im Kalender mit dem Stern, dann stehen ihre neuen Folgen in jeder Mail ganz oben.',
  'news.syncRunning': 'Favoriten werden abgeglichen …',
  'news.syncOk': 'Favoriten übernommen: {count} Serien. Ab jetzt stehen deren Folgen in deinen Mails ganz oben.',
  'news.platforms': 'Nur diese Plattformen',
  'news.platformsHint': '(leer = alle)',
  'news.consent':
    'Ich möchte den Newsletter erhalten und bin damit einverstanden, dass meine Adresse dafür gespeichert wird. Die Einwilligung kann ich jederzeit über den Abmeldelink widerrufen.',
  'news.privacy': 'Datenschutzerklärung',
  'news.submit': 'Anmelden',
  'news.sending': 'sendet …',
  'news.ok': 'Fast geschafft: Bestätigungsmail ist unterwegs. Erst der Klick darin aktiviert das Abo.',
  'news.notConnected': 'Der Newsletter-Dienst ist in dieser Installation noch nicht verbunden.',
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
  'news.restoreTitle': 'Favoriten auf dieses Gerät holen',
  // Verbunden: Der Kasten zeigt kein Problem, sondern dieses Gerät.
  'news.deviceTitle': 'Dieses Gerät',
  // Gekürzt: Warum sie verlorengehen können, muss hier nicht stehen — wer das
  // Feld sucht, weiß es bereits.
  // Sagt jetzt auch, was danach passiert: Der Abgleich läuft von selbst weiter.
  // Das ist die Frage, mit der man hier ankommt („bleibt das synchron?").
  'news.restoreBody':
    'Gemerkte Titel liegen im Browser. Hast du ein Abo, liegen sie auch bei uns. Wir schicken dir einen Link — danach gleichen sich beide Geräte von selbst ab.',
  // Ein Satz statt zwei: Dass die Titel auch auf dem Server liegen, ist die
  // Folge — wissen muss man in diesem Moment nur, dass es verbunden ist.
  'news.restoreConnected': 'Dieser Browser ist mit deinem Abo verbunden.',
  // Der Link ist kein Notbehelf, sondern der Weg, ein weiteres Gerät zu
  // verbinden — genau dafür braucht man ihn, wenn hier schon alles stimmt.
  'news.restoreAnyway': 'Link für ein anderes Gerät anfordern',
  'news.unsub': 'Abo beenden',
  'news.unsubConfirm': 'Wirklich abmelden?',
  'news.unsubYes': 'Ja, abmelden',
  'news.unsubNo': 'Abbrechen',
  'news.unsubDone': 'Abgemeldet. Deine Adresse ist gelöscht.',
  'news.restoreSubmit': 'Link anfordern',
  'news.restoreSent':
    'Falls für diese Adresse ein Abo besteht, ist eine Mail unterwegs. Der Link darin gilt dreißig Minuten und lässt sich einmal benutzen.',
  'news.restoreSafety': 'Die Mail geht nur an das eingetragene Postfach.',
  'news.mergedTitle': '{count} Titel von deinem Abo übernommen',
  'news.mergedBody': 'Nicht gewollt? Häkchen entfernen.',

  'news.waitTitle': 'Kein ständiges Nachsehen mehr!',
  // Gekürzt nach der Regel „Texte für Nutzer so kurz wie möglich" (14.08.2026).
  // Weg ist `news.waitNote`: Dass wir zu diesen Titeln wenig führen, ändert für
  // den Leser nichts — er sieht es ohnehin, sobald er einen öffnet.
  'news.waitBody':
    'Bleib über alle Neuerscheinungen auf dem Laufenden und werde informiert, sobald es neue Infos zur deutschen Synchro für deine Favoriten gibt.',
  'news.waitHow':
    'In der Datenbank holt der Schalter „Anime ohne deutsche Synchro" diese Titel dazu. Merke dir einen mit dem Stern, dann bekommst du eine Mail, sobald es eine Synchro gibt.',

  'news.howTitle': 'Wie das technisch läuft',
  'news.how':
    'Die Anmeldung ist ein Double-Opt-in: Wir schicken erst eine Bestätigungsmail, gespeichert wird das Abo erst nach deinem Klick. Adresse, Rhythmus und Plattformwahl liegen in einer Cloudflare-D1-Datenbank. Der Versand läuft über einen Cron-Job, der die Termine aus genau diesem Kalender zieht.',

  'footer.stats': '{titles} Anime mit belegter deutscher Synchro · {releases} Releases · {events} Termine',
  'footer.updated': 'Daten zuletzt aktualisiert:',
  'footer.sources': 'Quellen',
  'footer.code': 'Quellcode',
  'sources.title': 'Quellen & Lizenzen',
  'sources.intro':
    'Dieser Kalender führt Daten aus mehreren Quellen zusammen. Hier stehen sie alle.',
  'sources.perEntry':
    'Woher ein einzelner Termin stammt, steht in seiner Detailansicht unter „Quelle".',

  // Wie der Bot arbeitet. Für Leser geschrieben, nicht für Entwickler: Jeder
  // Absatz beantwortet eine Frage, die beim Anschauen eines Termins aufkommt.
  'sources.pipelineTitle': 'Woher beziehen wir die Termine?',
  'sources.howTitle': 'Wie oft schauen wir nach?',
  'sources.howText':
    'Die Sendezeiten bei Crunchyroll prüfen wir stündlich. Alle anderen Quellen einmal pro Nacht: Anime2You, aniSearch, ADN, AniList und TMDB. Was neu dazukommt, steht danach von selbst auf der Seite.',
  'sources.autoTitle': 'Was trägt der Bot selbst ein?',
  'sources.autoText':
    'Nennt eine Meldung einen Tag, einen klaren Titel und einen Anbieter, wird daraus ein Termin. Er trägt dann den Hinweis „automatisch übernommen". Ist unklar, welche Staffel gemeint ist, bleibt der Termin offen.',
  'sources.unsureTitle': 'Und wenn nur ein Monat genannt wird?',
  'sources.unsureText':
    'Dann bleibt es beim Monat. Die Meldung steht in der Detailansicht im Wortlaut, mit Datum und Link zur Quelle.',
  'sources.catalogTitle': 'Woher kommen Sprachen und Folgenzahlen?',
  'sources.catalogText':
    'Aus den öffentlich abrufbaren Katalogdaten der Anbieter — dort steht je Folge, welche Tonspuren es gibt. Wir übernehmen daraus nur Tatsachen: Sprache, Folgenzahl, Datum. Keine Texte, keine Bilder, keine Videos. Die Anbieter betreiben diese Seite nicht und unterstützen sie nicht.',
  'sources.staleTitle': 'Was passiert mit alten Quellen?',
  'sources.staleText':
    'Sie bleiben stehen. Verschiebt sich ein Termin, markieren wir die frühere Quelle als veraltet und klappen sie unter dem Termin ein. So bleibt nachvollziehbar, woher der alte Tag kam.',
}
