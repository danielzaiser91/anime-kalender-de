import { GENRE_DE, KEYWORD_DE } from '@shared/mappings.ts'
import type { ReleaseType } from '@shared/types.ts'

/**
 * Alle Texte der Oberfläche — auf Deutsch, und nur auf Deutsch.
 *
 * Bis zum 10.08.2026 lag hier ein englisches Wörterbuch als Grundlage, das
 * deutsche überschrieb es, und ein Flaggen-Umschalter im Kopf wechselte
 * zwischen beiden. Das ist gestrichen: Die Seite heißt anime-kalender.de,
 * sammelt ausschließlich deutsche Synchronfassungen und richtet sich an ein
 * deutschsprachiges Publikum. Zwei Sprachfassungen zu pflegen kostete Arbeit
 * für einen Fall, den es nicht gab.
 *
 * Englisch bleibt an den Stellen, wo es hingehört: Serientitel wie
 * „Steel Ball Run — 1st STAGE" sind Eigennamen und werden nicht übersetzt.
 */
const TEXTE = {
  'app.title': 'Anime-Kalender DE',
  'app.subtitle': 'alles mit deutscher Synchro',
  'app.description':
    'Wochenkalender aller Anime-Releases mit deutscher Synchronisation: Termine, Uhrzeiten, Plattform, FSK und Genres. Mit Google-Calendar-Export und Newsletter.',
  'app.loading': 'Kalender wird geladen …',
  'app.loadingTitles': '{count} Einträge werden geladen …',
  'app.loadError': 'Daten konnten nicht geladen werden',
  'app.loadHint': 'Wurde die Datenpipeline schon ausgeführt?',

  'view.woche': 'Woche',
  'view.monat': 'Monat',
  'view.agenda': 'Agenda',
  'view.datenbank': 'Datenbank',
  'view.favoriten': 'Favoriten',
  'view.wo': 'Wo sehen?',
  // Kurzform für schmale Schirme: Mit dem fünften Reiter passte die Leiste bei
  // 375 px nicht mehr in eine Zeile und schob die Seite waagrecht auf.
  'view.wo.short': 'Wo?',
  'view.abo': 'Kalender-Abo',
  'view.newsletter': 'Newsletter',
  // Steht im Hovertext des Newsletter-Knopfes, sobald ein Abo hinterlegt ist.
  'news.connectedAs': 'Browser ist verbunden mit folgender Newsletter-E-Mail-Adresse: {mail}',
  // Fällt an, solange die Adresse noch nicht im Browser liegt: Wer vor dem
  // 15.08.2026 verbunden hat, bekommt sie erst beim nächsten Abgleich.
  'news.connectedNoMail': 'Browser ist mit einem Newsletter-Abo verbunden.',
  'view.impressum': 'Impressum',
  'view.datenschutz': 'Datenschutz',

  'nav.today': 'heute',
  'nav.todayHere': 'Der heutige Tag ist schon zu sehen',
  'nav.todayGo': 'Zum heutigen Tag springen',
  'nav.back': 'zurück',
  'nav.forward': 'vor',
  'nav.from': 'ab {date}',
  'nav.theme': 'Hell/Dunkel umschalten',
  'nav.language': 'Sprache',

  'release.weekly': 'Wöchentlich (Simuldub)',
  'release.weekly.short': 'Wöchentlich',
  'release.weekly.hint': 'Folge für Folge, fester Wochentag',
  'release.batch': 'Katalogtitel',
  'release.batch.short': 'Katalog',
  'release.batch.hint': 'Ganze Staffel auf einen Schlag',
  'release.movie': 'Film',
  'release.movie.short': 'Film',
  'release.movie.hint': 'Filmstart (Stream oder Kino)',
  'release.disc': 'DVD / Blu-ray',
  'release.disc.short': 'Disc',
  'release.disc.hint': 'Kaufbarer Datenträger',

  'legend.colour': 'Farbe = Release-Art:',
  'legend.estimated':
    'Geschätzter Termin — aus dem bisherigen Wochenrhythmus fortgeschrieben. Wir ziehen nach, sobald der Anbieter den Tag nennt.',
  /*
    Ein Termin, den der Anbieter hat verstreichen lassen. Der Text nennt drei
    Dinge, weil ohne sie eine falsche Auskunft stehen bliebe: dass es nicht
    passiert ist, wie viele Folgen es wirklich gibt, und wann wir nachsehen.
  */
  'card.missed': 'Von uns nachgeprüft: der Anbieter hat diesen Termin nicht eingehalten',
  'card.missedBadge': 'nicht erschienen',
  'card.missedCount': 'beim Anbieter stehen {n} Folgen',
  'card.missedNext': 'neu erwartet: {d}',
  'card.missedCheck': 'wir sehen stündlich nach',
  'card.missedLate': 'erschien {d} — {h} Stunden später als angekündigt',
  'card.missedLateBadge': 'kam {d}',
  'legend.count': '{count} Termine im Filter · Tasten ← → T',

  'filter.search': 'Titel, Studio, Genre, Keyword …',
  'filter.mode': 'Klick-Modus',
  'filter.modeInclude': 'Auswählen',
  'filter.modeExclude': 'Ausschließen',
  'filter.modeIncludeHint': 'Ein Klick behält nur, was dieses Tag trägt.',
  'filter.modeExcludeHint': 'Ein Klick entfernt alles, was dieses Tag trägt.',
  'filter.button': 'Filter',
  'filter.reset': 'zurücksetzen',
  'filter.platform': 'Plattform',
  'filter.provider': 'Bezugsquelle ({count} Anbieter)',
  'filter.releaseType': 'Release-Art',
  'filter.status': 'Status',
  'filter.fsk': 'FSK',
  'filter.year': 'Jahr',
  'filter.confidence': 'Sicherheit der Angaben',
  'filter.genre': 'Genre',
  'filter.genreSearch': 'Genre suchen',
  'filter.keywords': 'Keywords ({count} verfügbar)',
  'filter.keywordSearch': 'z. B. Weibliche Protagonistin, Isekai, Zeitschleife …',
  'filter.confirmedOnly': 'nur bestätigte Termine',
  'filter.confirmedOnlyHint': 'Blendet geschätzte Termine aus — es bleiben nur die vom Anbieter bestätigten',
  'filter.favourites': 'nur Favoriten',
  'filter.fskFrom': 'ab {n}',
  'filter.sources': '≥{n} Quellen',
  'filter.source': '1 Quelle',
  'filter.showMore': 'alle anzeigen ({count})',
  'filter.showLess': 'weniger anzeigen',

  'week.nothing': 'nichts',
  'week.today': 'heute',
  'week.empty':
    'In dieser Woche liegt kein Termin, der zu den Filtern passt. Mit ← → springst du durch die Wochen.',
  'week.withTime': 'Mit Uhrzeit',
  'week.withoutTime': 'Uhrzeit offen',
  'month.more': '+{count} weitere',
  'month.openWeek': 'Woche dieses Tages öffnen',
  'agenda.empty': 'Ab dem gewählten Datum liegt kein Termin, der zu den Filtern passt.',

  'status.airing': 'Läuft',
  'status.abgeschlossen': 'Abgeschlossen',
  'status.tba': 'TBA',
  'status.erschienen': 'Erschienen',
  'status.unbekannt': 'Termin unbekannt',

  'card.inStores': 'im Handel',
  'card.episode': 'Ep {n}',
  'pwa.title': 'Auf den Startbildschirm legen',
  'pwa.pitch': 'Öffnet sich wie eine App, im Vollbild, und läuft auch ohne Verbindung.',
  'pwa.install': 'App installieren',
  'pwa.stayInBrowser': 'Im Browser weiter',
  'pwa.iosHint': 'In Safari: auf Teilen tippen, dann „Zum Home-Bildschirm".',
  'card.hide': 'Titel ausblenden',
  'card.unhide': 'Titel wieder anzeigen',
  'card.favourite': 'Als Favorit merken',
  'card.unfavourite': 'Aus Favoriten entfernen',

  'db.count': '{count} Anime mit belegter deutscher Synchro',
  'db.sort': 'Sortierung',
  'db.sortTitle': 'Titel A–Z',
  'db.sortYear': 'Jahr (neu zuerst)',
  'db.sortScore': 'Bewertung',
  'db.more': 'Weitere {count} anzeigen',
  'db.remaining': '({count} übrig)',
  'db.groupSeasons': 'Staffeln zusammenfassen',
  // Der Text sprach bis zum 12.08.2026 von „der neuesten Staffel" — das war die
  // alte, falsche Auswahl des Reihen-Vertreters.
  'db.groupSeasonsHint':
    'Fasst alle Staffeln, Filme und Specials einer Reihe zu einer Kachel zusammen. Gezeigt wird die erste Staffel, die übrigen stehen in ihrer Detailansicht.',
  // Titel ohne belegte deutsche Synchro — der Schalter, seine Begründung und
  // die Kennzeichnung an der Kachel. Eingeführt 13.08.2026.
  'db.countSplit': '{mit} mit belegter deutscher Synchro · {ohne} ohne',
  'db.withoutDub': 'Anime ohne deutsche Synchro',
  'db.withoutDubHint':
    'Holt zusätzlich alle Anime, zu denen wir keine deutsche Synchro kennen. Der Schalter beginnt bei jedem Aufruf wieder aus.',
  'db.withoutDubWhy': 'Merken und benachrichtigen lassen, sobald es eine gibt.',
  'db.withoutDubLoading': 'Wird geladen. Das ist die größte Liste der Seite.',
  'db.noDubBadge': 'keine deutsche Synchro',
  'db.noDubWatch': '☆ merken → Bescheid bei Synchro',
  'db.noDubWatched': '★ gemerkt',
  'db.seasons': '{count} Staffeln',
  'db.episodes': '{count} Ep.',

  // „Wo sehen?" — der Kalender von der anderen Seite: nach Anbieter statt nach
  // Datum. Für die meisten Titel ist das die eigentliche Frage, denn nur gut
  // hundert von ihnen haben überhaupt einen anstehenden Termin.
  'where.summary': '{mit} von {gesamt} Anime haben einen belegten Bezugsweg, verteilt auf {anbieter} Anbieter.',
  'where.stream': 'Ansehen',
  'where.streamHint': 'Abo, werbefinanziert oder kostenlos',
  // Die drei Arten, an einen Titel zu kommen. Kurz gehalten, weil sie als
  // Zwischenüberschrift zwischen den Anbietern stehen — „Ohne Kosten" statt
  // „Kostenlos verfügbar", „Mit Abo" statt „Mit einem Abonnement".
  'where.zugang.kostenlos': 'Ohne Kosten',
  'where.zugang.abo': 'Mit Abo',
  'where.zugang.kauf': 'Kaufen oder leihen',
  'where.zugang.unbekannt': 'Angebot unbekannt',
  'where.preorder': 'Vorbestellen',
  'where.preorderHint': 'erscheint noch',
  'where.buy': 'Kaufen oder leihen',
  'where.buyHint': 'einmaliger Preis je Titel oder Staffel',
  'where.titles': '{count} Einträge',
  'where.titleOne': '1 Eintrag',
  'where.tallyYes': 'deutsche Synchro dort belegt',
  'where.tallyOpen': 'Der Anbieter macht dazu keine öffentliche Angabe.',
  'where.openAt': 'Bei {name} öffnen',
  'where.more': 'Weitere {count} anzeigen',
  'where.empty': 'Zu den gewählten Filtern ist kein Bezugsweg belegt.',

  // Titel ohne belegte deutsche Synchro im Detail-Panel. „Termin unbekannt"
  // wäre hier falsch: Unbekannt ist nicht der Termin, sondern ob es je eine
  // deutsche Fassung gibt.
  // Reihen-Stern: die ganze Reihe auf einmal merken (13.08.2026).
  'detail.seriesStarDo': 'Alle {count} Teile dieser Reihe merken',
  'detail.seriesStarAllDone': 'Alle {count} Teile dieser Reihe sind gemerkt',
  'detail.seriesStarHelp':
    // Kein Markdown: Der Hinweis wird als reiner Text ausgegeben, Sternchen
    // stünden dort wörtlich da — ausgerechnet neben einem Stern-Symbol.
    'Merkt alle {count} Teile dieser Reihe auf einmal — auch Filme, Specials und Ableger ohne deutsche Synchro.',

  'detail.noDubTitle': 'Keine deutsche Synchro bekannt',
  'detail.noDubBody': 'Zu diesem Anime ist bisher keine deutsche Fassung bekannt.',
  // Zwei Fassungen, je nachdem ob ein Newsletter hinterlegt ist. Daniels
  // Vorgabe (15.08.2026): Der Text soll sagen, was der Stern bewirkt, und
  // nichts versprechen, was ohne Abo gar nicht passieren kann.
  'detail.noDubWatchOpen':
    'Interessiert dich dieser Titel und du möchtest direkt informiert werden, wenn es Termine gibt? Dann markier ihn mit dem ☆ und meld dich beim Newsletter an.',
  'detail.noDubWatchConnected':
    'Interessiert dich dieser Titel und du möchtest direkt informiert werden, wenn es Termine gibt? Dann markier ihn mit dem ☆, wir schreiben dir an {mail}.',
  'detail.noDubWatched': '★ Gemerkt. Du bekommst Bescheid, sobald es eine Synchro gibt.',

  // „Deutsche Releases" war zweideutig — es klang nach „hier erschienen",
  // gemeint ist aber der Termin der deutschen Synchronfassung (Daniel,
  // 15.08.2026).
  'detail.releases': 'Release-Termine für deutsche Synchro',
  // Beide Texte stehen seit dem 12.08.2026 als Hovertext hinter dem Wort
  // „unbekannt" statt als eigener Kasten — sie erklären, warum dort kein Datum
  // steht, und das ist eine Fußnote, keine Schlagzeile.
  'detail.noRelease': 'Eine deutsche Synchro ist belegt, ein deutscher Termin bisher nicht.',
  'detail.releasedNoDate':
    'Die deutsche Fassung ist erschienen, das genaue Datum führen wir nicht.',
  'detail.linkStream': 'ansehen',
  'detail.linkBuy': 'kaufen oder leihen',

  'detail.gone': 'nicht mehr abrufbar, geprüft am {d}',
  'detail.whereToWatch': 'Wo läuft es',
  // Steht bei den Titeln, zu denen wir keinen Anbieter kennen — 665 von 2.760.
  // Ein Satz, weil er eine Aufgabe hat: das Suchen auf dieser Seite beenden.
  // Ohne ihn fehlte der Abschnitt ganz, und „läuft nirgends" war von „wissen
  // wir nicht" nicht zu unterscheiden.
  'detail.whereUnknown': 'Kein Anbieter bekannt.',
  // **Wo deutsche Sprechrollen belegt sind, ist „kein Anbieter" die halbe
  // Auskunft.** 277 Titel sind am 29.08.2026 in genau diesem Fall: Es gab eine
  // deutsche Fassung — Anime News Network führt die Sprecher —, und wir kennen
  // keinen Weg mehr dorthin. Das ist etwas anderes als „vielleicht gab es nie
  // eine", und der Leser macht etwas anderes damit: Er hört auf, bei den
  // Streamingdiensten zu suchen, und sucht gebraucht.
  //
  // Behauptet wird dabei nichts Unbelegtes: **wir** kennen keinen Weg. Ob es
  // irgendwo noch einen gibt, sagt der Satz nicht.
  'detail.whereDubbedButGone':
    'Kein Bezugsweg bekannt. Eine deutsche Fassung gab es — die Sprecher sind belegt.',
  // Der Aufklapper für eine lange Notiz — siehe DetailPanel, `release.note`.
  'detail.noteToggle': 'Zur Sprachfassung',
  'detail.sharedUrl': '{count} Einträge',
  // Steht, wo der Anbieter mehrere unserer Einträge in **einer** durchlaufenden
  // Folgenliste führt: Prime zeigt „Captain Tsubasa (2018)" mit 91 Folgen, und
  // dieser Eintrag sind davon die Nummern 53 bis 91. Ohne die Angabe sucht
  // jemand 39 Folgen auf einer Seite, die 91 zeigt.
  'detail.teilBereich': 'Dort Folge {von}–{bis}',
  // Steht als „!" neben dem Anbieter, wenn der deutsche Ton Lücken hat. Der
  // Anbieter gilt trotzdem als deutsch — eine Folge genügt (Daniel,
  // 27.08.2026: „de anzeigen ab min 1 folge ist die richtige weise").
  //
  // Kurz gehalten, weil es aufgeklappt neben einer Pille steht: Wer es liest,
  // will wissen, welche Folgen — nicht, wie wir es herausgefunden haben.
  'detail.dubLuecken': 'Ohne deutschen Ton: Folge {n}',
  'detail.staffelNummer': 'Staffel {n}',
  'detail.dubLueckenTitel': 'Nicht alle Folgen auf Deutsch',
  // Bewusst „kann abweichen", nicht „weicht ab": Belegt ist nur, dass mehrere
  // unserer Einträge auf dieselbe Adresse zeigen. Wie der Anbieter seinerseits
  // in Staffeln teilt, steht auf einer Seite, die ihre Staffelliste per
  // JavaScript nachlädt — geprüft ist es also nicht.
  'detail.sharedUrlNote':
    'Führt zu {count} unserer Einträge. Der Anbieter teilt die Reihe womöglich anders in Staffeln.',
  // Steht nur, wo der deutsche Ton **mittendrin** aufhört oder anfängt — bei
  // Black Clover auf Netflix ab Folge 156. Ist die ganze Staffel deutsch, sagt
  // das Häkchen daneben schon alles, und eine zweite Angabe wäre Lärm.
  //
  // „Flg." ist Netflix' eigene Abkürzung; wer aus dem Player kommt, liest sie
  // dort genauso.
  'detail.dubUntil': 'Deutsch bis Flg. {n}',
  'detail.dubFrom': 'Deutsch ab Flg. {n}',
  'detail.genres': 'Genres',
  'detail.seriesPartsCount': '{count} Teile in dieser Reihe',
  'detail.reiheKuenftig': 'noch nicht erschienen',
  'detail.folgenKurz': '{n} Fg.',
  'detail.werkangaben': 'Zum Werk',
  'detail.bewertung': 'Bewertung',
  'detail.studio': 'Studio',
  'detail.keywords': 'Keywords',
  'detail.plot': 'Handlung',
  'detail.plotMore': 'mehr anzeigen',
  'detail.plotLess': 'weniger anzeigen',
  'detail.plotOnlyEnglish': 'Diese Beschreibung gibt es nur auf Englisch.',
  'detail.seasons': 'Alles aus dieser Reihe',
  // Nur noch als Beschriftung des Karussells für Screenreader — sichtbar steht
  // dort nichts mehr: Ein Karussell aus Covern erklärt sich selbst.
  'detail.seriesParts': 'Teile dieser Reihe',
  // Zwei Termine, keiner belegbar — beide anzeigen statt einen zu verschweigen
  // (Daniels Regel, 13.08.2026).
  'detail.disputedDate': 'Eine andere Quelle nennt:',
  'detail.disputedDateHint':
    'Welcher Tag stimmt, ist offen. Oben steht der, mit dem wir rechnen.',
  // Belegkette eines Termins. Kurz halten: Das steht unter jedem Termin, und
  // gelesen wird es nur von dem kleinen Teil, der wirklich nachprüfen will.
  // Handlung **und** Zielort in einem Knopf — man soll vor dem Klick wissen,
  // wo man landet. „Ansehen" wäre bei einem künftigen Disc-Termin falsch: Es
  // gibt noch nichts zu sehen, nur etwas vorzubestellen (Daniel, 15.08.2026).
  // Weitere Schreibweisen, nach dem Muster von MyAnimeLists „Alternative
  // Titles": ein Aufklapper statt drei dauerhafter Zeilen.
  'detail.otherTitles': '{count} weitere Schreibweisen',
  'detail.otherTitlesHide': 'Schreibweisen ausblenden',
  'detail.titleRomaji': 'Umschrift',
  'detail.titleEn': 'Englisch',
  'detail.titleNative': 'Original',
  'detail.scoreHint':
    'So haben die Nutzer von AniList diesen Anime bewertet.',
  'detail.editionCount': '{count} Ausgaben',
  'detail.preorderAt': 'Vorbestellen bei {shop}',
  'detail.buyAt': 'Kaufen bei {shop}',
  // Steht statt eines Links, wenn die Termine aus einer Programmschnittstelle
  // stammen. Ein Link auf einen API-Endpunkt hilft niemandem weiter.
  'detail.sourceProvider': 'direkt von {anbieter} ausgelesen',
  'detail.olderSource': '1 ältere Quelle',
  'detail.olderSources': '{count} ältere Quellen',
  'detail.olderSourcesHide': 'ältere Quellen ausblenden',
  'detail.sourceStale': 'veraltete Info',
  'detail.sourceMaybeStale': 'veraltete Info',
  'detail.autoSource': 'automatisch übernommen',
  'detail.autoSourceHint':
    'Info wurde automatisiert aus der verlinkten Quelle herausgelesen. Für genauere Details die Quelle konsultieren.',
  'detail.newsHeading': 'Was die Quellen melden',
  'detail.newsShow': 'Mehr Details ({count})',
  'detail.newsHide': 'Details ausblenden',
  'detail.newsHint': 'Die Quelle nennt keinen Tag. Hier steht ihr Wortlaut.',
  'detail.seasonLoading': 'Wird geladen …',
  'detail.start': 'Start',
  'detail.startCinema': 'Im Kino ab',
  'detail.startDisc': 'Im Handel ab',
  // „Start" wäre bei einem Katalogtitel eine Falschbehauptung: ADN nahm
  // „Sword Art Online" am 11.06.2025 ins Angebot, die deutsche Fassung gibt es
  // seit 2013. Was wir wissen, ist das Datum der Verfügbarkeit — mehr nicht.
  'detail.availableFrom': 'Erscheinungstermin',
  // Für Titel, deren deutsche Fassung längst draußen ist: Die Zeile nennt
  // zuerst, dass es sie gibt. „Erscheinungstermin: unbekannt" allein las sich
  // wie „kommt vielleicht noch" (Daniel, 22.08.2026).
  'detail.releasedLabel': 'Deutsche Synchro',
  'detail.releasedValue': 'vorhanden, Termin nicht erfasst',
  /*
    Eigene Beschriftung, weil „Erscheinungstermin" hier die falsche Auskunft
    waere: Der Tag sagt, seit wann der Anbieter den Titel listet — die deutsche
    Fassung kann Jahre aelter sein. Bei „Elfen Lied" stand „Erscheinungstermin
    13.08.2025" fuer eine Serie von 2004 (27.08.2026, im Dev-Server gesehen).
  */
  'detail.offerSince': 'Im Angebot seit',
  'detail.availableFromNote':
    'Seit diesem Tag steht der Titel dort im Angebot. Die deutsche Fassung selbst kann älter sein.',

  'detail.time': 'Uhrzeit',
  'detail.unknown': 'unbekannt',
  'detail.episodes': 'Folgen',
  'detail.voices': 'Deutsche Stimmen',
  'detail.voicesLoading': 'Wird geladen …',
  'detail.voicesNone': 'Keine Angaben gefunden.',
  // Anime News Network kommt nur dazu, wenn von dort auch Rollen stammen — der
  // Link daneben ist deren Nutzungsauflage, nicht bloß eine Höflichkeit.
  'detail.voicesSource': 'Angaben von AniList',
  'detail.nextEpisode': 'Nächste Folge',

  // Die Antwortzeile ganz oben im Panel — sie beantwortet in einem Satz,
  // wonach jemand das Panel überhaupt öffnet. Vier Fälle, gleiche Höhe.
  // Relative Angaben zuerst: Niemand rechnet gern nach, welcher Wochentag
  // der 25. ist (Daniel, 24.08.2026 am Mockup).
  'antwort.heute': 'Heute',
  'antwort.morgen': 'Morgen',
  'antwort.inTagen': 'In {count} Tagen',
  'antwort.folge': 'Folge {n}',
  'antwort.rhythmusWoechentlich': 'Wöchentlich {tag}s',
  'antwort.nochFolgen': 'noch {count} bis zum Finale am {datum}',
  'antwort.letzteFolge': 'letzte Folge',
  'antwort.erschienenZahl': '{raus} von {gesamt} Folgen erschienen',
  'antwort.fertigTitel': 'Auf Deutsch verfügbar',
  'antwort.fertigNeben': 'Vollständig synchronisiert',
  'antwort.fertigZahl': 'Alle {count} Folgen auf Deutsch',
  'antwort.fertigZahlOhne': 'Alle Folgen auf Deutsch',
  'antwort.filmTitel': 'Auf Deutsch verfügbar',
  'antwort.filmNeben': 'Deutsche Synchronfassung',
  'antwort.filmOhneTitel': 'Noch keine deutsche Fassung',
  'antwort.filmOhneNeben': 'Kein deutscher Anbieter führt ihn bisher',
  'antwort.ohneTitel': 'Noch keine deutsche Fassung',
  'antwort.ohneNeben': 'Bisher kein deutscher Anbieter',
  'antwort.ohneZahl': 'Keine Folge auf Deutsch',
  'antwort.faktErschienen': 'erschienen',
  'antwort.faktFsk': 'Altersfreigabe',
  'antwort.faktStudio': 'Studio',
  'antwort.fskAb': 'ab {n}',
  'detail.lastEpisode': 'Letzte Folge',
  'detail.allDates': 'Alle Termine',
  'detail.showAllDates': 'alle {count} Termine anzeigen',
  'detail.showFewer': 'weniger anzeigen',
  'detail.watchOn': 'Bei {platform} ansehen',
  'detail.buy': 'Kaufen',
  // Ein Knopf sagt, was der Klick bewirkt, nicht wohin er zeigt (Daniel,
  // 24.08.2026: „das button-label sollte lieber sagen was der effekt des
  // klicks ist"). Zwei Fassungen, weil zwei Plätze: der große Knopf trägt
  // das Verb, die Zeile je Termin nur das Ziel — dort steht das Verb im
  // aria-label, und für eine Zeile mit Datum und Folgennummer wäre der
  // ganze Satz zu lang.
  'detail.addToGoogleAction': 'In Google Calendar eintragen',
  'detail.addToGoogle': 'Google Calendar',
  'detail.addSingle': 'Diese Folge zu Google Calendar hinzufügen',
  'detail.downloadIcs': 'Kalenderdatei laden',
  'detail.downloadIcsHint':
    'Alle kommenden Folgen als Kalenderdatei. Ein Doppelklick trägt sie in Outlook, Apple Kalender oder Thunderbird ein. Für Google Calendar gibt es den Knopf daneben.',
  'detail.share': 'Teilen',
  'detail.shareHint': 'Kopiert einen Link, der diesen Titel mit eigenem Vorschaubild zeigt',
  'detail.source': 'Quelle',
  'detail.whyNoTime': 'Warum steht hier keine Uhrzeit?',
  'filter.available': 'stream verfügbar',
  'filter.availableHint':
    'Filtert Ergebnisse auf bestätigte Streaming-Verfügbarkeit.',
  'detail.estimatedDate': 'geschätzter Termin',
  'detail.estimatedWhy':
    'Aus dem bisherigen Wochenrhythmus dieser Reihe fortgeschrieben. Wir ziehen nach, sobald der Anbieter den Tag nennt.',
  'detail.timeNoteSource': 'Quelle',
  'detail.assumedEpisodes': 'Folgenzahl nicht belegt — 12 angenommen',
  'detail.assumedEpisodesAnisearch': 'Folgenzahl laut aniSearch, dort als vorläufige Schätzung geführt.',
  'detail.close': 'Schließen',
  'detail.hiddenNote': 'Dieser Titel ist von dir ausgeblendet. Bis du ihn wieder einblendest, wird hier nichts gezeigt.',
  'detail.noMeta': 'Zu diesem Eintrag liegen keine Metadaten vor.',
  'detail.dubYes': 'Deutsche Synchro hier belegt',
  'detail.dubUnknown': 'Der Anbieter macht dazu keine öffentliche Angabe.',
  // Bleibt vergleichsweise lang: Hier hängt eine Kaufentscheidung dran, und der
  // Leser kann den Unterschied nicht selbst herleiten.
  'detail.metaFrom': 'Metadaten von AniList',
  'quellen.heading': 'Woher diese Angaben stammen ({count})',
  'quellen.colSource': 'Quelle',
  'quellen.colFeeds': 'liefert',
  'quellen.feedTermine': 'Termine',
  'quellen.feedWerk': 'Titel, Cover, Genres, Jahr, Studio, Folgenzahl',
  // aniSearch liefert den **Haupttitel** seiner Seite, nicht zwingend einen
  // deutschen — bei „Maomao no Hitorigoto Dai 2 Ki" ist es eine zweite
  // Umschrift (Daniel, 03.09.2026: „warum hat dieser titel japanisch statt
  // deutschen titel?"). Die Zeile sagt jetzt, was wirklich kommt.
  'quellen.feedDeutsch': 'Titel und Beschreibung, wo vorhanden auf Deutsch',
  'quellen.feedStimmen': 'deutsche Sprechrollen',
  'quellen.feedAnbieterName': 'Anbieter selbst',
  'quellen.feedAnbieter': 'wo verfügbar, Sprachfassung',
  'quellen.feedFsk': 'Altersfreigabe',
  'quellen.note': 'Termine sind je Eintrag belegt und verlinkt. Bei den übrigen Angaben steht, welche Quelle sie im Regelfall liefert — sie werden nicht einzeln nachgewiesen.',
  'detail.malMeaning': 'Die Kennung dieses Anime bei MyAnimeList.',
  'detail.dubProof': 'Synchro belegt über MyDubList ({sources})',

  'sub.title': 'Kalender abonnieren',
  'sub.intro':
    'Ein Abo statt vieler Einzelklicks: Die Feeds unten aktualisieren sich mit jedem Daten-Update von selbst. Kein Konto, kein Login, keine Freigabe an uns nötig.',
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

export type TranslationKey = keyof typeof TEXTE
export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

function translate(key: TranslationKey, params?: Record<string, string | number>): string {
  const raw: string = TEXTE[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  )
}

interface LanguageValue {
  t: Translate
  /** Genre-Namen ins Deutsche bringen — AniList liefert sie englisch. */
  tGenre: (name: string) => string
  tKeyword: (name: string) => string
  /** Beschriftung einer Release-Art. */
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
}

/**
 * Kein Context, kein State: Es gibt nur eine Sprache, also ist das Ergebnis
 * für die gesamte Laufzeit dasselbe Objekt. Der frühere LanguageProvider
 * hätte hier nur noch Konstanten durchgereicht.
 */
const VALUE: LanguageValue = {
  t: (key, params) => translate(key, params),
  tGenre: (name) => GENRE_DE[name] ?? name,
  tKeyword: (name) => KEYWORD_DE[name] ?? name,
  tRelease: (type, variant = 'name') =>
    translate((variant === 'name' ? `release.${type}` : `release.${type}.${variant}`) as TranslationKey),
}

export function useLang(): LanguageValue {
  return VALUE
}

/** Einmalig beim Start: Sprache im HTML und die Metaangaben setzen. */
export function applyDocumentLanguage(): void {
  document.documentElement.lang = 'de'
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', TEXTE['app.description'])
  document.title = `${TEXTE['app.title']} — ${TEXTE['app.subtitle']}`
}
