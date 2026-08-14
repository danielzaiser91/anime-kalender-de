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
  'view.wo': 'Wo sehen?',
  // Kurzform für schmale Schirme: Mit dem fünften Reiter passte die Leiste bei
  // 375 px nicht mehr in eine Zeile und schob die Seite waagrecht auf.
  'view.wo.short': 'Wo?',
  'view.abo': 'Kalender-Abo',
  'view.newsletter': 'Newsletter',
  'view.impressum': 'Impressum',
  'view.datenschutz': 'Datenschutz',

  'nav.today': 'heute',
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
  'legend.estimated': 'fortgeschrieben — diese Folge stand noch nicht im Sendeplan',
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
  'filter.confirmedOnlyHint': 'Blendet Termine aus, die nur aus dem Simulcast-Start abgeleitet sind',
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

  'card.timeOpen': 'Zeit offen',
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
    'Fasst alle Staffeln, Filme und Specials einer Reihe zu einer Kachel zusammen. Gezeigt wird die erste Staffel; die übrigen stehen in ihrer Detailansicht.',
  // Titel ohne belegte deutsche Synchro — der Schalter, seine Begründung und
  // die Kennzeichnung an der Kachel. Eingeführt 13.08.2026.
  'db.countSplit': '{mit} mit belegter deutscher Synchro · {ohne} ohne',
  'db.withoutDub': 'Anime ohne deutsche Synchro',
  'db.withoutDubHint':
    'Holt zusätzlich alle Anime, zu denen wir keine deutsche Synchro kennen. Der Schalter beginnt bei jedem Aufruf wieder aus.',
  'db.withoutDubWhy': 'Merken und benachrichtigen lassen, sobald es eine gibt.',
  'db.withoutDubLoading': 'Wird geladen — das ist die größte Liste der Seite.',
  'db.noDubBadge': 'keine deutsche Synchro',
  'db.noDubWatch': '☆ merken → Bescheid bei Synchro',
  'db.noDubWatched': '★ gemerkt — du bekommst Bescheid',
  'db.seasons': '{count} Staffeln',
  'db.episodes': '{count} Ep.',

  // „Wo sehen?" — der Kalender von der anderen Seite: nach Anbieter statt nach
  // Datum. Für die meisten Titel ist das die eigentliche Frage, denn nur gut
  // hundert von ihnen haben überhaupt einen anstehenden Termin.
  'where.summary': '{mit} von {gesamt} Anime haben einen belegten Bezugsweg, verteilt auf {anbieter} Anbieter.',
  'where.stream': 'Ansehen',
  'where.streamHint': 'Abo, werbefinanziert oder kostenlos',
  'where.buy': 'Kaufen oder leihen',
  'where.buyHint': 'einmaliger Preis je Titel oder Staffel',
  'where.titles': '{count} Einträge',
  'where.titleOne': '1 Eintrag',
  'where.tallyYes': 'deutsche Synchro dort belegt',
  'where.tallyNo': 'dort nachgesehen: keine deutsche Synchro',
  'where.tallyOpen': 'Synchro dort nicht belegt — der Anbieter sagt es nicht öffentlich',
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
    'Ein Klick auf die drei Sterne merkt alle Staffeln, Filme und Specials dieser Reihe auf einmal — hier sind das {count} Einträge. Das ist praktisch, wenn du eine Serie ganz verfolgst: Du bekommst dann zu jedem Teil Bescheid, auch zu Ablegern, die noch gar keine deutsche Synchro haben.',

  'detail.noDubTitle': 'Keine deutsche Synchro bekannt',
  'detail.noDubBody':
    'Zu diesem Titel kennen wir keine deutsche Fassung — weder eine erschienene noch eine angekündigte. Deshalb führen wir hier absichtlich fast nichts: keine Termine, keine Anbieter, keine Sprecher. Es gibt nichts zu führen.',
  'detail.noDubWatch': '☆ Merk ihn dir mit dem Stern — du bekommst eine Mail, sobald sich das ändert.',
  'detail.noDubWatched': '★ Gemerkt. Sobald eine deutsche Synchro angekündigt ist, bekommst du Bescheid.',

  'detail.releases': 'Deutsche Releases',
  // Beide Texte stehen seit dem 12.08.2026 als Hovertext hinter dem Wort
  // „unbekannt" statt als eigener Kasten — sie erklären, warum dort kein Datum
  // steht, und das ist eine Fußnote, keine Schlagzeile.
  'detail.noRelease': 'Eine deutsche Synchro ist belegt, ein deutscher Termin bisher nicht.',
  'detail.noReleaseSingleSource': 'Belegt durch nur eine Quelle.',
  'detail.releasedNoDate':
    'Die deutsche Fassung ist erschienen, das genaue Datum führen wir nicht.',
  'detail.linkStream': 'ansehen',
  'detail.linkBuy': 'kaufen oder leihen',

  'detail.whereToWatch': 'Wo läuft es',
  'detail.sharedUrl': '{count} Einträge',
  // Bewusst „kann abweichen", nicht „weicht ab": Belegt ist nur, dass mehrere
  // unserer Einträge auf dieselbe Adresse zeigen. Wie der Anbieter seinerseits
  // in Staffeln teilt, steht auf einer Seite, die ihre Staffelliste per
  // JavaScript nachlädt — geprüft ist es also nicht.
  'detail.sharedUrlNote':
    'Diese Adresse führt {count} unserer Einträge zu dieser Reihe. Wie der Anbieter sie in Staffeln teilt, kann von unserer Zählung abweichen — Crunchyroll zeigt manche Reihen als eine Staffel, die wir getrennt führen.',
  'detail.genres': 'Genres',
  'detail.keywords': 'Keywords',
  'detail.plot': 'Handlung',
  'detail.plotMore': 'mehr anzeigen',
  'detail.plotLess': 'weniger anzeigen',
  'detail.plotOnlyEnglish': 'Nur in der anderen Sprache verfügbar — eine maschinelle Übersetzung würde den Inhalt verfälschen.',
  'detail.seasons': 'Alles aus dieser Reihe',
  // Nur noch als Beschriftung des Karussells für Screenreader — sichtbar steht
  // dort nichts mehr: Ein Karussell aus Covern erklärt sich selbst.
  'detail.seriesParts': 'Teile dieser Reihe',
  // Zwei Termine, keiner belegbar — beide anzeigen statt einen zu verschweigen
  // (Daniels Regel, 13.08.2026).
  'detail.disputedDate': 'Eine andere Quelle nennt:',
  'detail.disputedDateHint':
    'wir konnten nicht klären, welcher Tag stimmt. Beide Quellen sind verlinkt, der Kalender führt den erstgenannten.',
  'detail.seasonLoading': 'Wird geladen …',
  'detail.start': 'Start',
  'detail.startCinema': 'Im Kino ab',
  'detail.startDisc': 'Im Handel ab',
  // „Start" wäre bei einem Katalogtitel eine Falschbehauptung: ADN nahm
  // „Sword Art Online" am 11.06.2025 ins Angebot, die deutsche Fassung gibt es
  // seit 2013. Was wir wissen, ist das Datum der Verfügbarkeit — mehr nicht.
  'detail.availableFrom': 'Im Angebot seit',
  'detail.availableFromNote':
    'Das Datum sagt, seit wann der Titel dort abrufbar ist — nicht, wann die deutsche Fassung erschienen ist. Die kann deutlich älter sein.',

  'detail.time': 'Uhrzeit',
  'detail.unknown': 'unbekannt',
  'detail.episodes': 'Folgen',
  'detail.voices': 'Deutsche Stimmen',
  'detail.voicesLoading': 'Wird geladen …',
  'detail.voicesNone': 'Keine Angaben gefunden.',
  'detail.voicesSource': 'Angaben von AniList',
  'detail.lastEpisode': 'Letzte Folge',
  'detail.allDates': 'Alle Termine',
  'detail.showAllDates': 'alle {count} Termine anzeigen',
  'detail.showFewer': 'weniger anzeigen',
  'detail.watchOn': 'Bei {platform} ansehen',
  'detail.buy': 'Kaufen',
  'detail.addToGoogle': 'Zu Google Calendar',
  'detail.addSingle': 'Diese Folge zu Google Calendar hinzufügen',
  'detail.downloadIcs': '.ics laden',
  'detail.downloadIcsHint':
    'ICS ist das Standardformat für Kalendertermine. Die Datei enthält alle noch kommenden Folgen; ein Doppelklick trägt sie in Outlook, Apple Kalender oder Thunderbird ein. Für Google Calendar stattdessen den Knopf daneben nehmen.',
  'detail.share': 'Teilen',
  'detail.shareHint': 'Kopiert einen Link, der diesen Titel mit eigenem Vorschaubild zeigt',
  'detail.source': 'Quelle',
  'detail.whyNoTime': 'Warum steht hier keine Uhrzeit?',
  'filter.available': 'verfügbar',
  'filter.availableHint':
    'Nur Titel, bei denen belegt ist, wo man sie sehen oder kaufen kann — Stream, Kauf oder anstehender Termin.',
  'detail.estimatedDate': 'Termin abgeleitet',
  'detail.assumedEpisodes': 'Folgenzahl nicht belegt — 12 angenommen',
  'detail.assumedEpisodesAnisearch': 'Folgenzahl laut aniSearch — dort als vorläufige Schätzung geführt',
  'detail.close': 'Schließen',
  'detail.hiddenNote': 'Dieser Titel ist von dir ausgeblendet. Bis du ihn wieder einblendest, wird hier nichts gezeigt.',
  'detail.noMeta': 'Zu diesem Eintrag liegen keine Metadaten vor.',
  'detail.dubYes': 'Deutsche Synchro hier belegt',
  'detail.dubNo': 'Hier keine deutsche Synchro — Originalton mit Untertiteln',
  'detail.dubUnknown': 'Deutsche Tonspur hier nicht belegt — beim Anbieter selbst prüfen',
  'detail.dubHintDisc':
    'Die deutsche Synchro dieses Titels ist nur auf Disc belegt. Die oben gelisteten Streams laufen möglicherweise nur im Originalton mit Untertiteln — der Knopf „Kaufen" führt zur synchronisierten Fassung.',
  'detail.metaFrom': 'Metadaten von AniList',
  'detail.malMeaning': 'MyAnimeList — die Kennung dieses Anime in der größten Anime-Datenbank.',
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
  'sub.note':
    'Google holt sich abonnierte Feeds nur alle paar Stunden bis Tage. Wer Termine sofort braucht, nutzt beim einzelnen Eintrag den Knopf „Google Calendar" — der legt den Termin direkt an. Apple Kalender und Outlook lesen dieselbe Adresse.',

  'news.title': 'Newsletter',
  'news.intro':
    'Täglich oder wöchentlich per Mail, was mit deutscher Synchro erscheint. Kein Tracking, keine Werbung, Abmelden mit einem Klick aus jeder Mail.',
  'news.email': 'E-Mail-Adresse',
  'news.frequency': 'Rhythmus',
  'news.weekly': 'Wöchentlich',
  'news.weeklyHint': 'montags 07:00, alles der kommenden Woche',
  'news.daily': 'Täglich',
  'news.dailyHint': '07:00, alles des Tages',
  'news.autoSync': 'Änderungen werden ab jetzt selbsttätig übernommen.',
  'news.noSyncYet':
    'Falls du bereits abonniert hast: Dieser Browser ist noch nicht mit deinem Abo verbunden — gemerkte Titel bleiben hier liegen. Öffne einmal den Abgleich-Link am Ende einer Newsletter-Mail, dann übernimmt er Änderungen von selbst.',
  'news.welcomeTitle': 'Abo aktiv',
  'news.welcomeBody': 'Ab jetzt bekommst du die anstehenden Releases mit deutscher Synchro per Mail.',
  'news.favorites': 'Favoriten: {count} Serien',
  'news.favoritesHint': 'Neue Folgen davon stehen in jeder Mail ganz oben.',
  'news.favoritesNone': 'Noch keine. Markiere Serien im Kalender mit dem Stern — ihre neuen Folgen stehen dann in jeder Mail ganz oben.',
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
  'news.restoreTitle': 'Favoriten verloren?',
  'news.restoreBody':
    'Gemerkte Titel liegen in deinem Browser. Wer die Browserdaten löscht, das Gerät wechselt oder ein neues Handy hat, verliert sie — und Safari räumt den Speicher nach sieben Tagen ohne Besuch sogar von allein auf. Hast du ein Abo, liegen sie bei uns: Wir schicken dir einen Link, der sie in diesen Browser zurückholt.',
  'news.restoreSubmit': 'Link anfordern',
  'news.restoreSent':
    'Falls für diese Adresse ein Abo besteht, ist eine Mail unterwegs. Der Link darin gilt dreißig Minuten und lässt sich einmal benutzen.',
  'news.restoreSafety':
    'Die Mail geht immer nur an das eingetragene Postfach — hier im Browser erscheint nichts. Fremde Adressen einzutippen verrät deshalb nichts und ändert nichts.',
  'news.restoreOk':
    '{count} gemerkte Titel wiederhergestellt. Was du hier schon gemerkt hattest, ist erhalten geblieben.',

  'news.waitTitle': 'Warten, ohne nachzusehen',
  'news.waitBody':
    'Der häufigste Grund, diese Seite immer wieder aufzurufen, ist eine Serie, die es auf Deutsch noch gar nicht gibt. Man schaut nach, findet nichts, schaut nächste Woche wieder nach — und wird jedes Mal enttäuscht.',
  'news.waitHow':
    'Dafür gibt es in der Datenbank den Schalter „Anime ohne deutsche Synchro". Er holt alle Titel dazu, zu denen wir keine deutsche Fassung kennen. Merke dir dort mit dem Stern, worauf du wartest — und du bekommst eine Mail, sobald eine deutsche Synchro angekündigt ist oder ein Termin feststeht. Auch dann, wenn sonst gerade nichts ansteht.',
  'news.waitNote':
    'Zu diesen Titeln führen wir absichtlich fast nichts: Es gibt nichts zu führen, solange es keine deutsche Fassung gibt. Sobald es eine gibt, wird daraus ein vollständiger Eintrag mit Terminen, Anbietern und Sprechern.',

  'news.howTitle': 'Wie das technisch läuft',
  'news.how':
    'Die Anmeldung ist ein Double-Opt-in: Wir schicken erst eine Bestätigungsmail, gespeichert wird das Abo erst nach deinem Klick. Adresse, Rhythmus und Plattformwahl liegen in einer Cloudflare-D1-Datenbank. Der Versand läuft über einen Cron-Job, der die Termine aus genau diesem Kalender zieht.',

  'footer.stats': '{titles} Anime mit belegter deutscher Synchro · {releases} Releases · {events} Termine',
  'footer.updated': 'Daten zuletzt aktualisiert:',
  'footer.sources': 'Quellen & Lizenzen',
  'footer.code': 'Quellcode',
  'sources.title': 'Quellen & Lizenzen',
  'sources.intro':
    'Dieser Kalender führt Daten aus mehreren Quellen zusammen. Manche davon verlangen eine Nennung, alle haben sie verdient.',
  'sources.perEntry':
    'Woher ein einzelner Termin stammt, steht bei jedem Eintrag: Das Detail-Panel nennt unter „Quelle" die Seite, auf der er belegt ist.',
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
