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
  'db.groupSeasonsHint':
    'Zeigt nur die neueste Staffel einer Reihe; die älteren stehen in deren Detailansicht',
  'db.seasons': '{count} Staffeln',
  'db.episodes': '{count} Ep.',

  'detail.releases': 'Deutsche Releases',
  'detail.noRelease':
    'Für diesen Titel ist eine deutsche Synchro belegt, aber noch kein deutscher Termin erfasst.',
  'detail.noReleaseSingleSource': ' (nur eine Quelle)',
  'detail.releasedNoDate': 'Die deutsche Fassung ist erschienen. Ein genaues Datum führen wir dazu nicht — die Verweise unten führen hin.',
  'detail.linkStream': 'ansehen',
  'detail.linkBuy': 'kaufen oder leihen',

  'detail.whereToWatch': 'Wo läuft es',
  'detail.genres': 'Genres',
  'detail.keywords': 'Keywords',
  'detail.plot': 'Handlung',
  'detail.plotOnlyEnglish': 'Nur in der anderen Sprache verfügbar — eine maschinelle Übersetzung würde den Inhalt verfälschen.',
  'detail.seasons': 'Staffeln dieser Reihe',
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
  'detail.downloadIcsHint': 'Alle Termine dieser Staffel als Kalenderdatei',
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
