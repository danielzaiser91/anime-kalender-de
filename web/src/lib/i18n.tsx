import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { GENRE_DE, KEYWORD_DE } from '@shared/mappings.ts'
import { setDateLocale } from '@shared/time.ts'
import type { ReleaseType } from '@shared/types.ts'

export type Lang = 'de' | 'en'

export const LANGUAGES: { id: Lang; flag: string; label: string }[] = [
  { id: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { id: 'en', flag: '🇬🇧', label: 'English' },
]

/**
 * Englisch ist die Grundlage, Deutsch überschreibt.
 * Fehlt ein deutscher Eintrag, greift automatisch der englische — so bleibt
 * die Oberfläche auch bei halber Übersetzung benutzbar.
 */
const EN = {
  'app.title': 'Anime Calendar DE',
  'app.subtitle': 'everything with a German dub',
  'app.description':
    'Weekly calendar of every anime release with a German dub: dates, times, platform, age rating and genres. With Google Calendar export and newsletter.',
  'app.loading': 'Loading calendar …',
  'app.loadingTitles': 'Loading {count} entries …',
  'app.loadError': 'Could not load data',
  'app.loadHint': 'Has the data pipeline been run yet?',

  'view.woche': 'Week',
  'view.monat': 'Month',
  'view.agenda': 'Agenda',
  'view.datenbank': 'Database',
  'view.abo': 'Calendar feed',
  'view.newsletter': 'Newsletter',
  'view.impressum': 'Legal notice',
  'view.datenschutz': 'Privacy',

  'nav.today': 'today',
  'nav.back': 'back',
  'nav.forward': 'forward',
  'nav.from': 'from {date}',
  'nav.theme': 'Toggle light/dark',
  'nav.language': 'Language',

  'release.weekly': 'Weekly (simuldub)',
  'release.weekly.short': 'Weekly',
  'release.weekly.hint': 'Episode by episode, on a fixed weekday',
  'release.batch': 'Catalogue title',
  'release.batch.short': 'Catalogue',
  'release.batch.hint': 'The whole season at once',
  'release.movie': 'Film',
  'release.movie.short': 'Film',
  'release.movie.hint': 'Film release (stream or cinema)',
  'release.disc': 'DVD / Blu-ray',
  'release.disc.short': 'Disc',
  'release.disc.hint': 'Physical media you can buy',

  'legend.colour': 'Colour = release type:',
  'legend.estimated': 'projected — this episode has not appeared in the schedule yet',
  'legend.count': '{count} dates in filter · keys ← → T',

  'filter.search': 'Title, studio, genre, keyword …',
  'filter.mode': 'Click mode',
  'filter.modeInclude': 'Include',
  'filter.modeExclude': 'Exclude',
  'filter.modeIncludeHint': 'A click keeps only what carries this tag.',
  'filter.modeExcludeHint': 'A click removes everything that carries this tag.',
  'filter.button': 'Filters',
  'filter.reset': 'reset',
  'filter.platform': 'Platform',
  'filter.releaseType': 'Release type',
  'filter.status': 'Status',
  'filter.fsk': 'Age rating',
  'filter.year': 'Year',
  'filter.confidence': 'Confidence',
  'filter.genre': 'Genre',
  'filter.genreSearch': 'search genre',
  'filter.keywords': 'Keywords ({count} available)',
  'filter.keywordSearch': 'e.g. female protagonist, isekai, time loop …',
  'filter.confirmedOnly': 'confirmed dates only',
  'filter.confirmedOnlyHint': 'Hides dates that were only derived from the simulcast start',
  'filter.favourites': 'favourites only',
  'filter.fskFrom': '{n}+',
  'filter.sources': '{n}+ sources',
  'filter.source': '1 source',
  'filter.showMore': 'show all ({count})',
  'filter.showLess': 'show fewer',

  'week.nothing': 'nothing',
  'week.today': 'today',
  'week.empty':
    'No date in this week matches the filters. Use ← → to jump between weeks.',
  'week.withTime': 'With time',
  'week.withoutTime': 'Time not confirmed',
  'month.more': '+{count} more',
  'month.openWeek': 'Open the week of this day',
  'agenda.empty': 'No date from the chosen day matches the filters.',

  'status.airing': 'Airing',
  'status.abgeschlossen': 'Completed',
  'status.tba': 'TBA',
  'status.erschienen': 'Released',
  'status.unbekannt': 'Date unknown',

  'card.timeOpen': 'time TBC',
  'card.inStores': 'in stores',
  'card.episode': 'Ep {n}',
  'pwa.title': 'Add to your home screen',
  'pwa.pitch': 'Opens like an app, full screen, and works without a connection.',
  'pwa.install': 'Install app',
  'pwa.stayInBrowser': 'Continue in browser',
  'pwa.iosHint': 'In Safari: tap Share, then "Add to Home Screen".',
  'card.hide': 'Hide this title',
  'card.unhide': 'Show this title again',
  'card.favourite': 'Mark as favourite',
  'card.unfavourite': 'Remove from favourites',

  'db.count': '{count} anime with a documented German dub',
  'db.sort': 'Sort by',
  'db.sortTitle': 'Title A–Z',
  'db.sortYear': 'Year (newest first)',
  'db.sortScore': 'Rating',
  'db.more': 'Show {count} more',
  'db.remaining': '({count} left)',
  'db.groupSeasons': 'Combine seasons',
  'db.groupSeasonsHint': 'Shows only the newest season of a series; earlier ones appear in its details',
  'db.seasons': '{count} seasons',
  'db.episodes': '{count} ep.',

  'detail.releases': 'German releases',
  'detail.noRelease':
    'A German dub is documented for this title, but no German date has been recorded yet.',
  'detail.noReleaseSingleSource': ' (single source)',
  'detail.releasedNoDate': 'The German dub has been released. We do not have an exact date for it — the links below lead to it.',
  'detail.linkStream': 'watch',
  'detail.linkBuy': 'buy or rent',

  'detail.whereToWatch': 'Where to watch',
  'detail.genres': 'Genres',
  'detail.keywords': 'Keywords',
  'detail.plot': 'Plot',
  'detail.plotOnlyEnglish': 'Only available in the other language — automatic translations would distort the content.',
  'detail.seasons': 'Seasons of this series',
  'detail.start': 'Start',
  'detail.startCinema': 'In cinemas from',
  'detail.startDisc': 'On sale from',
  'detail.time': 'Time',
  'detail.unknown': 'unknown',
  'detail.episodes': 'Episodes',
  'detail.lastEpisode': 'Last episode',
  'detail.allDates': 'All dates',
  'detail.showAllDates': 'show all {count} dates',
  'detail.showFewer': 'show fewer',
  'detail.watchOn': 'Watch on {platform}',
  'detail.buy': 'Buy',
  'detail.addToGoogle': 'Add to Google Calendar',
  'detail.addSingle': 'Add this episode to Google Calendar',
  'detail.downloadIcs': 'Download .ics',
  'detail.downloadIcsHint': 'All dates of this season as a calendar file',
  'detail.share': 'Share',
  'detail.shareHint': 'Copies a link that shows this title with its own preview image',
  'detail.source': 'Source',
  'detail.estimatedDate': 'date derived',
  'detail.assumedEpisodes': 'Episode count not documented — 12 assumed',
  'detail.close': 'Close',
  'detail.hiddenNote': 'You hid this title. Nothing is shown until you bring it back.',
  'detail.noMeta': 'No metadata available for this entry.',
  'detail.dubYes': 'German dub documented here',
  'detail.dubNo': 'No German dub here — original audio with subtitles',
  'detail.dubUnknown': 'German audio not documented here — check on the platform itself',
  'detail.dubHintDisc':
    'The German dub of this title is only documented on disc. The streams listed above may well be original audio with subtitles — the “Buy” button leads to the dubbed edition.',
  'detail.metaFrom': 'Metadata from AniList',
  'detail.dubProof': 'dub documented via MyDubList ({sources})',

  'sub.title': 'Subscribe to the calendar',
  'sub.intro':
    'One subscription instead of many clicks: the feeds below update themselves with every data run. No account, no login, nothing shared with us.',
  'sub.pick': 'Choose a feed',
  'sub.all': 'Everything',
  'sub.copy': 'copy',
  'sub.copied': '✓ copied',
  'sub.download': 'Download file',
  'sub.insert': 'Add in Google Calendar',
  'sub.how': 'How it works',
  'sub.step1': 'Copy the address above.',
  'sub.step2': 'Open Google Calendar → next to "Other calendars" click +  → "From URL".',
  'sub.step3': 'Paste the address, "Add calendar".',
  'sub.note':
    'Google refreshes subscribed feeds only every few hours to days. If you need a date right away, use the "Google Calendar" button on the entry itself — that creates it immediately. Apple Calendar and Outlook read the same address.',

  'news.title': 'Newsletter',
  'news.intro':
    'Daily or weekly by email: what is coming out with a German dub. No tracking, no ads, unsubscribe with one click from every email.',
  'news.email': 'Email address',
  'news.frequency': 'Rhythm',
  'news.weekly': 'Weekly',
  'news.weeklyHint': 'Mondays 07:00, everything for the coming week',
  'news.daily': 'Daily',
  'news.dailyHint': '07:00, everything for the day',
  'news.autoSync': 'Changes are transferred automatically from now on.',
  'news.welcomeTitle': 'Subscription active',
  'news.welcomeBody': 'From now on you will receive the upcoming releases with a German dub by email.',
  'news.favorites': 'Favourites: {count} series',
  'news.favoritesHint': 'New episodes of these appear at the top of every email.',
  'news.favoritesNone': 'None yet. Star series in the calendar — their new episodes then lead every email.',
  'news.syncRunning': 'Syncing favourites …',
  'news.syncOk': 'Favourites synced: {count} series. From now on their episodes lead your emails.',
  'news.platforms': 'Only these platforms',
  'news.platformsHint': '(empty = all)',
  'news.consent':
    'I want to receive the newsletter and agree that my address is stored for that purpose. I can withdraw this at any time via the unsubscribe link.',
  'news.privacy': 'privacy policy',
  'news.submit': 'Subscribe',
  'news.sending': 'sending …',
  'news.ok': 'Almost done: a confirmation email is on its way. Only the click inside activates the subscription.',
  'news.notConnected': 'The newsletter service is not connected in this installation yet.',
  'news.howTitle': 'How this works technically',
  'news.how':
    'Signing up is a double opt-in: we send a confirmation email first, and the subscription is only stored after your click. Address, rhythm and platform choice live in a Cloudflare D1 database. Sending is done by a cron job that pulls the dates from this very calendar.',

  'footer.stats': '{titles} anime with a documented German dub · {releases} releases · {events} dates',
  'footer.updated': 'Data last updated:',
  'footer.sources': 'Sources',
  'footer.code': 'Source code',
} as const

export type TranslationKey = keyof typeof EN

const DE: Partial<Record<TranslationKey, string>> = {
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

  'detail.time': 'Uhrzeit',
  'detail.unknown': 'unbekannt',
  'detail.episodes': 'Folgen',
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
  'detail.estimatedDate': 'Termin abgeleitet',
  'detail.assumedEpisodes': 'Folgenzahl nicht belegt — 12 angenommen',
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
  'footer.sources': 'Quellen',
  'footer.code': 'Quellcode',
}

const DICTIONARIES: Record<Lang, Partial<Record<TranslationKey, string>>> = { en: EN, de: DE }

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

function translate(lang: Lang, key: TranslationKey, params?: Record<string, string | number>): string {
  const raw = DICTIONARIES[lang][key] ?? EN[key] ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  )
}

function detectLanguage(): Lang {
  const stored = localStorage.getItem('lang')
  if (stored === 'de' || stored === 'en') return stored
  return navigator.languages?.some((l) => l.toLowerCase().startsWith('de')) ? 'de' : 'en'
}

interface LanguageValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translate
  /** Genre-Namen (AniList liefert englisch) in die aktive Sprache bringen. */
  tGenre: (name: string) => string
  tKeyword: (name: string) => string
  /** Beschriftung einer Release-Art in der aktiven Sprache. */
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
}

const LanguageContext = createContext<LanguageValue | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = detectLanguage()
    // Vor dem ersten Rendern setzen, sonst stünden Wochentage kurz falsch da.
    setDateLocale(initial)
    return initial
  })

  useEffect(() => {
    setDateLocale(lang)
    document.documentElement.lang = lang
    const description = DICTIONARIES[lang]['app.description'] ?? EN['app.description']
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.title = `${translate(lang, 'app.title')} — ${translate(lang, 'app.subtitle')}`
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem('lang', next)
    setLangState(next)
  }, [])

  const value = useMemo<LanguageValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      tGenre: (name) => (lang === 'de' ? (GENRE_DE[name] ?? name) : name),
      tKeyword: (name) => (lang === 'de' ? (KEYWORD_DE[name] ?? name) : name),
      tRelease: (type, variant = 'name') =>
        translate(lang, (variant === 'name' ? `release.${type}` : `release.${type}.${variant}`) as TranslationKey),
    }),
    [lang, setLang],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang außerhalb des LanguageProvider verwendet')
  return ctx
}
