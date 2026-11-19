import { GENRE_DE, KEYWORD_DE } from '@shared/mappings.ts'
import type { ReleaseType } from '@shared/types.ts'
import { TEXTE_SEITEN } from './i18n-seiten.ts'
import { TEXTE_KALENDER } from './i18n-kalender.ts'
import type { TEXTE_SPAET } from './i18n-spaet.ts'
import { SPAET } from './i18n-spaet-ablage.ts'
import '@/lib/i18n-knoten.ts'

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
  'app.loading': 'Kalender wird geladen …',
  'app.loadError': 'Die Daten laden gerade nicht.',
  'app.loadRetry': 'Erneut versuchen',
  'app.loadRetryHint': 'Klappt es nicht, versuch es in ein paar Minuten noch einmal.',
  'app.laedt': 'Lädt …',

  'view.woche': 'Woche',
  'view.monat': 'Monat',
  'view.datenbank': 'Datenbank',
  'view.news': 'News',
  // Eine Zeile je Meldung, so kurz wie möglich — die Karte nennt den Titel schon.
  /*
    **Eine abgelöste Meldung bleibt stehen**. Sie wird
    durchgestrichen, nennt aber, wodurch sie ersetzt wurde — mit Verweis auf die
    Quelle der neueren Angabe. So ist der Weg nachvollziehbar, statt dass eine
    Meldung spurlos verschwindet.
  */
  // Kurzform für die Übersichtszeile: Stichworte statt Satz — der Vollsatz steht aufgeklappt darunter.
  // Der Chip nennt die Art, die Zeile nennt die Umstände — sonst steht beides zweimal da
  // („Kino 29.09." neben dem Chip „Im Kino").
  /*
    **Die Suche erklärt sich selbst**: Welche Felder durchsucht werden, ist
    nirgends sichtbar — nach der Projektregel „alles offen kommunizieren" steht es am Suchfeld.
  */
  'suche.leeren': 'Suche leeren',
  'suche.felderTitel': 'Durchsucht werden:',
  'suche.unscharf':
    'Findet sie nichts Genaues, sucht sie zusätzlich unscharf — Tippfehler werden dann verziehen.',
  'suche.fundstelleTitel': 'Dieser Treffer steht nicht im Namen — gefunden über:',
  'suche.unscharfHinweis':
    'Unscharf getroffen: Die Schreibweise weicht ab. Hervorgehoben ist das Wort, das den Treffer trägt; die übereinstimmenden Buchstaben stehen oben.',
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
  'nav.todayZurueck': 'Zurück zum heutigen Tag',
  'nav.todayVor': 'Vor zum heutigen Tag',
  'nav.todayHoch': 'Hoch zum heutigen Tag',
  'nav.todayRunter': 'Runter zum heutigen Tag',
  'nav.todayScroll': 'Zum nächsten Termin von heute scrollen',
  'nav.back': 'zurück',
  'sprung.oeffnen': 'Zu einem Datum springen',
  'sprung.termine': '{n} Termine',
  'sprung.ganzerMonat': 'Monat zeigen',
  'sprung.ersterTitel': 'Zum frühesten Termin',
  'sprung.letzterTitel': 'Zum spätesten Termin',
  'nav.forward': 'vor',

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

  // **Die Legende bekommt zwei Wörter, die Erklärung den Tooltip** — wie bei
  // jedem anderen Eintrag daneben. Der volle Satz stand am 03.09.2026
  // ungekürzt in der Zeile und war länger als die vier Farbeinträge zusammen;
  // sein zweiter Halbsatz („Wir ziehen nach, sobald der Anbieter den Tag
  // nennt") ist ein Versprechen, kein Handlungshinweis.
  'legend.estimated':
    'Geschätzter Termin — kein vom Anbieter genannter Tag. Wir ziehen nach, sobald der Anbieter den Tag nennt.',
  /*
    Ein Termin, den der Anbieter hat verstreichen lassen. Der Text nennt drei
    Dinge, weil ohne sie eine falsche Auskunft stehen bliebe: dass es nicht
    passiert ist, wie viele Folgen es wirklich gibt, und wann wir nachsehen.
  */
  'card.missed': 'Von uns nachgeprüft: der Anbieter hat diesen Termin nicht eingehalten',
  'card.missedBadge': 'nicht erschienen',
  'card.missedCount': 'beim Anbieter stehen {n} Folgen',
  'card.missedNext': 'neu erwartet: {d}',
  // „stündlich" stimmte nie: GitHub startet den Lauf im Mittel alle 4,7 Stunden
  // (gemessen 03.09.2026, CLAUDE.md „Der stündliche Lauf läuft fünfmal am Tag").
  'card.missedCheck': 'wir sehen mehrmals täglich nach',
  'card.missedLateBadge': 'kam {d}',

  'filter.button': 'Filter',

  'week.today': 'heute',
  'week.empty':
    'In dieser Woche liegt kein Termin, der zu den Filtern passt. Mit ← → springst du durch die Wochen.',

  'status.airing': 'Läuft',
  'status.abgeschlossen': 'Abgeschlossen',
  'status.tba': 'TBA',
  'status.erschienen': 'Erschienen',
  'status.unbekannt': 'Termin unbekannt',

  'card.inStores': 'im Handel',
  'card.zeitVoraussichtlich': 'Voraussichtlich — Netflix veröffentlicht Anime meist um 17:00 japanischer Zeit',
  'card.zeitFestgelegt': 'Voraussichtlich, nicht gemessen',
  'pwa.title': 'Auf den Startbildschirm legen',
  'pwa.pitch': 'Öffnet sich wie eine App, im Vollbild, und läuft auch ohne Verbindung.',
  'pwa.install': 'App installieren',
  'pwa.stayInBrowser': 'Im Browser weiter',
  'pwa.manualHint': 'Im Browser-Menü ⋮ „App installieren“ oder „Zum Startbildschirm“.',
  'pwa.iosHint': 'In Safari: auf Teilen tippen, dann „Zum Home-Bildschirm".',
  'card.hide': 'Titel ausblenden',
  'card.unhide': 'Titel wieder anzeigen',
  'card.favourite': 'Als Favorit merken',
  'card.unfavourite': 'Aus Favoriten entfernen',

  // Der Text sprach bis zum 12.08.2026 von „der neuesten Staffel" — das war die
  // alte, falsche Auswahl des Reihen-Vertreters.
  // Titel ohne belegte deutsche Synchro — der Schalter, seine Begründung und
  // die Kennzeichnung an der Kachel. Eingeführt 13.08.2026.

  // **„Eintrag" ist unser Wort, nicht seins.** Unter einer Shop-Pille im
  // Detail-Panel stand „2 Einträge" — Daniel am 03.09.2026: „wieso steht da
  // ‚2 einträge‘? unnötig verwirrende info". Gemeint sind zwei Adressen beim
  // selben Händler: bei einer Disc zwei Ausgaben, bei einem Kaufstream zwei
  // Käufe. „Angebote" trifft beide und sagt, was hinter dem Klick wartet.
  /* Disc-Bereich: eine Zeile je Variante, nach Art gruppiert (Mockup B3, 27.10.2026). */

  // Zwei Fassungen, je nachdem ob ein Newsletter hinterlegt ist. Daniels
  // Vorgabe (15.08.2026): Der Text soll sagen, was der Stern bewirkt, und
  // nichts versprechen, was ohne Abo gar nicht passieren kann.

  // „Deutsche Releases" war zweideutig — es klang nach „hier erschienen",
  // gemeint ist aber der Termin der deutschen Synchronfassung (Daniel,
  // 15.08.2026).
  /* Disc-Termin ohne Shop-Adresse — die Pille verspricht dann keinen Klick (23.09.2026). */
  /* Der Kino-Banner im Detail-Panel (17.09.2026). */
  'detail.abDatum': 'ab {d}',
  'detail.seitDatum': 'seit {d}',
  'detail.neuAm': 'neue Folge {d}',
  // Der Bereich „Release-Termine für deutsche Synchro" ist am 16.09.2026 entfallen:
  // Was er trug, steht im Antwort-Kasten darüber (Status in Worten), am Cover (FSK)
  // oder nirgends mehr („Erscheinungstermin: unbekannt" war eine Nicht-Auskunft).

  // Steht bei den Titeln, zu denen wir keinen Anbieter kennen — 665 von 2.760.
  // Ein Satz, weil er eine Aufgabe hat: das Suchen auf dieser Seite beenden.
  // Ohne ihn fehlte der Abschnitt ganz, und „läuft nirgends" war von „wissen
  // wir nicht" nicht zu unterscheiden.
  // Steht unter einer Pille, deren Adresse auf genau eine Folge zeigt — etwa
  // eine Dub-Vorschau. Ohne die Angabe sieht sie aus wie ein Weg zur Serie.
  // Steht, wo der Anbieter mehrere unserer Einträge in **einer** durchlaufenden
  // Folgenliste führt: Prime zeigt „Captain Tsubasa (2018)" mit 91 Folgen, und
  // dieser Eintrag sind davon die Nummern 53 bis 91. Ohne die Angabe sucht
  // jemand 39 Folgen auf einer Seite, die 91 zeigt.
  'detail.teilLautTmdb': 'laut TMDB',
  // Steht als „!" neben dem Anbieter, wenn der deutsche Ton Lücken hat. Der
  // Anbieter gilt trotzdem als deutsch — eine Folge genügt (Daniel,
  // 27.08.2026: „de anzeigen ab min 1 folge ist die richtige weise").
  //
  // Kurz gehalten, weil es aufgeklappt neben einer Pille steht: Wer es liest,
  // will wissen, welche Folgen — nicht, wie wir es herausgefunden haben.
  // **Auf eine Zeile gekürzt**. In der Pille steht
  // nur noch, was fehlt: das Kreuz, die Sprache, die Folgen. Der volle Satz
  // steht im Tooltip daneben.
  // Bewusst „kann abweichen", nicht „weicht ab": Belegt ist nur, dass mehrere
  // unserer Einträge auf dieselbe Adresse zeigen. Wie der Anbieter seinerseits
  // in Staffeln teilt, steht auf einer Seite, die ihre Staffelliste per
  // JavaScript nachlädt — geprüft ist es also nicht.
  // Steht nur, wo der deutsche Ton **mittendrin** aufhört oder anfängt — bei
  // Black Clover auf Netflix ab Folge 156. Ist die ganze Staffel deutsch, sagt
  // das Häkchen daneben schon alles, und eine zweite Angabe wäre Lärm.
  //
  // „Flg." ist Netflix' eigene Abkürzung; wer aus dem Player kommt, liest sie
  // dort genauso.
  // Dieselbe Kurzform: ein Häkchen für das, was auf Deutsch da ist, dahinter der
  // Bereich. Ausgeschrieben stand es in einer Pille, die dafür zu schmal ist.
  'detail.dubUntil': 'Fg. 1–{n}',
  'detail.dubFrom': 'Fg. ab {n}',
  // Wo nur die erste Folge dort liegt — auf einem Verlagskanal bei YouTube der
  // Normalfall. „1–1" wäre richtig gerechnet und trotzdem verwirrend.
  // **Das Label sagt, was es auf Deutsch gibt**. Vorher nannte es die Lücke — „✕ DE 5–7" —, also das, was
  // fehlt. Wer vor der Pille steht, will aber wissen, was er bekommt, und bei mehr als
  // einem Wechsel wird die Lücken-Form ohnehin unübersichtlich.
  // Ab drei Bereichen bliebe die Pille nicht mehr schmal. Die Zahl sagt, dass da noch
  // etwas kommt; die vollständige Aufzählung steht im Hinweis daneben.
  // Der Hinweis, zeilenweise.
  'detail.dubKopfVon': '{n} von {m} Folgen auf Deutsch',
  'detail.dubKopf': '{n} Folgen auf Deutsch',
  // „Nicht im Angebot" statt „nicht erfasst": Bei bekannter Folgenzahl ist das die
  // Aussage, die der Leser braucht — dort gibt es sie nicht, nicht einmal untertitelt.
  // Die vier Gruppen der Reihenliste. „Hauptserie" statt „Staffeln", weil eine
  // Reihe aus einem einzigen Teil bestehen kann und „Staffeln" dann falsch
  // klingt; „Specials & OVAs" nennt beides, weil der Unterschied hier keiner ist.
  'detail.gruppeStaffeln': 'Hauptserie',
  // Am Abzeichen in der Reihenliste — das Zeichen selbst ist 🇩🇪 ✕, der Satz
  // steht im Hinweis. „Bisher" fehlt bewusst: Wir wissen nicht, ob eine kommt.
  'detail.folgenKurz': '{n} Fg.',
  'detail.folgenBereich': 'Fg. {bereich}',
  // **Der Ersatz sagt, wessen Handlung dasteht.** Ohne den Namen liest jemand
  // die Handlung von Staffel 1 und hält sie für die von Staffel 3.
  // Zwei Termine, keiner belegbar — beide anzeigen statt einen zu verschweigen
  // (Daniels Regel, 13.08.2026).
  // Belegkette eines Termins. Kurz halten: Das steht unter jedem Termin, und
  // gelesen wird es nur von dem kleinen Teil, der wirklich nachprüfen will.
  // Handlung **und** Zielort in einem Knopf — man soll vor dem Klick wissen,
  // wo man landet. „Ansehen" wäre bei einem künftigen Disc-Termin falsch: Es
  // gibt noch nichts zu sehen, nur etwas vorzubestellen.
  // Weitere Schreibweisen, nach dem Muster von MyAnimeLists „Alternative
  // Titles": ein Aufklapper statt drei dauerhafter Zeilen.
  // Steht statt eines Links, wenn die Termine aus einer Programmschnittstelle
  // stammen. Ein Link auf einen API-Endpunkt hilft niemandem weiter.
  // „Start" wäre bei einem Katalogtitel eine Falschbehauptung: ADN nahm
  // „Sword Art Online" am 11.06.2025 ins Angebot, die deutsche Fassung gibt es
  // seit 2013. Was wir wissen, ist das Datum der Verfügbarkeit — mehr nicht.
  /*
    Eigene Beschriftung, weil „Erscheinungstermin" hier die falsche Auskunft
    waere: Der Tag sagt, seit wann der Anbieter den Titel listet — die deutsche
    Fassung kann Jahre aelter sein. Bei „Elfen Lied" stand „Erscheinungstermin
    13.08.2025" fuer eine Serie von 2004 (27.08.2026, im Dev-Server gesehen).
  */

  // Anime News Network kommt nur dazu, wenn von dort auch Rollen stammen — der
  // Link daneben ist deren Nutzungsauflage, nicht bloß eine Höflichkeit.

  // Die Antwortzeile ganz oben im Panel — sie beantwortet in einem Satz,
  // wonach jemand das Panel überhaupt öffnet. Vier Fälle, gleiche Höhe.
  /*
    **Die Überschrift nennt zuerst, wonach gefragt wird.**

    Vorn steht, worum es geht — „Nächste Folge (Folge 2)" —, und der
    Termin folgt als Satz. Der Wochentag steht dabei ausgeschrieben im Datum
    und ist deshalb aus der Rhythmuszeile darunter verschwunden: „am Samstag
    den 12.09.2026" und „Wöchentlich samstags" wären dieselbe Auskunft zweimal
    auf einem Bildschirm (CLAUDE.md, „Keine Information zweimal").
  */
  // Wo noch keine Folge draußen ist, ist die nächste die erste — und das ist
  // die interessantere Auskunft: Die Reihe fängt an.
  /*
    **Ein Komplettabwurf bringt alle Folgen an einem Tag**.

    Der Kasten las den ADN-Abwurf von „86: Eighty Six" als Sendeplan und schrieb
    „Erste Folge … · Wöchentlich · letzte Folge". Für `available-from` ist weder
    das eine noch das andere wahr — es kommt der ganze Block.
  */
  'antwort.alleFolgen': 'Alle {count} Folgen', 'antwort.alleFolgenOhneZahl': 'Alle Folgen',
  // Nur noch diese eine steht aus.
  // Ohne relative Angabe (Kino, Angebot) trägt das Datum allein.
  // Die Uhrzeit hängt hinten an, wo eine bekannt ist — „voraussichtlich", weil
  // der einzelne Termin aus dem gemessenen Rhythmus fortgeschrieben ist.
  // Die nächste Folge kam nicht zum angekündigten Termin (`schedule.verpasst`).
  // Angekündigt und verstrichen, beim Anbieter noch nicht gesehen; das Wort steigt mit dem Abstand (`shared/ausbleiben-plan.ts`).
  'antwort.faelligWirdGeprueft': 'Folge {n} fällig seit {wann}, wird geprüft',
  'antwort.faelligVerspaetet': 'Folge {n} fällig seit {wann}, noch nicht gesehen',
  'antwort.angekuendigtFuer': 'angekündigt für {tag} den {datum}.',
  // Fortgeschriebener Tag (`estimated`): kein vom Anbieter genannter Tag (Wochentakt, Starttag laut Quelle, Meldetag), also „geschätzt“.
  'antwort.erwartetFuer': 'erwartet für {tag} den {datum} (geschätzt).',
  // Steht der neue Tag nur geschätzt da, klänge „verschoben“ nach einer Ansage des Anbieters.
  // Ohne Wochentag: der Rhythmus sagt nur noch die Frequenz, der Tag steht in
  // der Überschrift.
  'antwort.rhythmusWoechentlichKurz': 'Wöchentlich',
  // „freitags", nicht „Frs" — siehe DetailPanel. Kleingeschrieben, weil es ein
  // Adverb ist: „wöchentlich freitags".
  'antwort.nochFolgen': 'noch {count} Folgen bis zum Finale am {datum}',
  'antwort.erschienenZahl': '{raus} von {gesamt} Folgen erschienen',
  // Dieselbe Zeile, aber ohne die vordere Zahl: Die steht hervorgehoben
  // davor, weil sie die Auskunft ist, um die es geht.
  'antwort.erschienenRest': 'von {gesamt} Folgen erschienen',
  // Steht nur noch, wo die Folgenzahl fehlt — sonst trägt „Alle {count} Folgen
  // auf Deutsch" die Überschrift allein. „Vollständig synchronisiert" und
  // „Alle Folgen auf Deutsch" sagten dasselbe noch zwei weitere Male und sind
  // am 03.09.2026 entfallen („Keine Information zweimal", CLAUDE.md).
  'antwort.fertigZahl': 'Alle {count} Folgen auf Deutsch',
  /*
    **Was belegt ist, nicht was vermutet wird.**

    „Kill Blue" stand mit „Alle 12 Folgen auf Deutsch" da, belegt waren vier.
    Der Satz hier nennt beide Zahlen — er ist genauso kurz
    und sagt die Wahrheit.
  */
  'antwort.teilweiseZahl': '{raus} von {gesamt} Folgen auf Deutsch',
  'antwort.teilweiseNeben': 'Übrige Folgen: nicht auf Deutsch belegt',
  'kostenlos.zahl': '{frei} von {von} Folgen',
  // Steht unter der Überschrift bei Titeln, zu denen wir keinen eigenen Termin
  // haben — 1.985 Stück. „Seit" statt „erschienen am": aniSearch nennt die
  // deutsche Erstveröffentlichung, oft eine DVD, und bei einem Simuldub sogar
  // den Simulcast-Start. Die Quelle steht im Tooltip, damit die Zeile kurz bleibt.
  // **Dieselbe Angabe, aber unter einem Nein.** Wo wir selbst keine Fassung
  // belegen können, stand „Noch keine deutsche Fassung" über „Auf Deutsch seit
  // 03.11.2024" — ein offener Widerspruch. Die Fremdquelle
  // muss sich hier selbst nennen: Dann steht dort nicht zweimal dasselbe mit
  // umgekehrtem Vorzeichen, sondern unsere Auskunft und die von aniSearch.
  // Ein angekündigter Kinofilm ohne deutsche Fassung: Der
  // Kasten nennt den japanischen Kinostart und was zum deutschen bekannt ist,
  // statt nur „Noch keine deutsche Fassung" zu sagen.
  // Der deutsche Kinostart steht fest, aber ohne Synchro — der Stern wartet dann auf die Fassung.
  // Der deutsche Termin stand da, doch der Anbieter selbst führt an dem Tag nur OmU (02.10.2026).
  'antwort.widerlegtTitel': 'Angekündigt — vom Anbieter widerlegt',
  'antwort.widerlegtNeben': 'Am {datum} führt Crunchyrolls Wochenprogramm nur die japanische Fassung.',
  // Angekündigter Simulcast (data/ankuendigungen.yaml, 25.09.2026) — kurz, der Kasten ist klein.
  'antwort.synchroAngekuendigt': 'Deutsche Synchro angekündigt',
  'antwort.omuAb': 'mit Untertiteln ab {wann}',
  'antwort.omuSeit': 'mit Untertiteln seit {wann}',
  'antwort.synchroTerminOffen': 'Synchro-Termin offen',
  'antwort.synchroOffen': 'Synchro offen',
  // JustWatch gilt der Serie, nicht der Folge (Entscheidung 07.09.2026).
  // Die drei Angaben, die es zu einer Kaufausgabe wirklich gibt — an der
  // Stelle, an der bei einer Serie der Fortschrittsbalken steht.
  'einstellungen.titel': 'Einstellungen',
  'antwort.fskAnbieter': 'FSK {n} laut Anbieter',  'detail.lastEpisode': 'Letzte Folge',
  // Ein Knopf sagt, was der Klick bewirkt, nicht wohin er zeigt (Daniel,
  // 24.08.2026: „das button-label sollte lieber sagen was der effekt des
  // klicks ist"). Zwei Fassungen, weil zwei Plätze: der große Knopf trägt
  // das Verb, die Zeile je Termin nur das Ziel — dort steht das Verb im
  // aria-label, und für eine Zeile mit Datum und Folgennummer wäre der
  // ganze Satz zu lang.
  'detail.share': 'Teilen',
  'detail.shareHint': 'Kopiert einen Link, der diesen Titel mit eigenem Vorschaubild zeigt',
  // Schnellfilter, kurz und allgemein; ✅ zeigt nur, 🚫 blendet aus (04.10.2026).
  'filter.zustand.nichts': 'nicht gewählt',
  'filter.zustand.ja': 'ausgewählt',
  'filter.zustand.nein': 'ausgeschlossen',
  'detail.dubYes': 'Deutsche Synchro hier belegt',
  // Fähnchen „Premiere" an TV-Pille und Kalender-Kachel (Daniel, 22.09.2026: Tooltip, „nicht verpassen").
  // Der Anbieter führt den Titel, die Adresse kennt nur TMDB — der Klick landet dort (22.09.2026).
  'detail.dubUnknown': 'Der Anbieter macht dazu keine öffentliche Angabe.',
  // Bleibt vergleichsweise lang: Hier hängt eine Kaufentscheidung dran, und der
  // Leser kann den Unterschied nicht selbst herleiten.
  // aniSearch liefert den **Haupttitel** seiner Seite, nicht zwingend einen
  // deutschen — bei „Maomao no Hitorigoto Dai 2 Ki" ist es eine zweite
  // Umschrift. Die Zeile sagt jetzt, was wirklich kommt.

  ...TEXTE_SEITEN,
  ...TEXTE_KALENDER,
}

export type TranslationKey = keyof typeof TEXTE | keyof typeof TEXTE_SPAET
export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

/** „{n} Folgen“ wird bei n = 1 (auch „≈ 1“) zu „{n} Folge“. */
export function einzahlFolge(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\} Folgen\b/g, (match, name: string) =>
    /^(≈\s*)?1$/.test(String(params[name])) ? `{${name}} Folge` : match,
  )
}

/** Ohne Hook-Namen: für Code außerhalb von Komponenten, etwa den RSS-Feed im Bau. */
export function translate(key: TranslationKey, params?: Record<string, string | number>): string {
  const roh: string = (TEXTE as Record<string, string>)[key] ?? SPAET[key] ?? key
  if (!params) return roh
  return einzahlFolge(roh, params).replace(/\{(\w+)\}/g, (match, name: string) =>
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

/**
 * Einmalig beim Start: Sprache im HTML setzen. Titel und Beschreibung bleiben, wie die ausgelieferte Seite sie nennt —
 * jede Seite (Start, Titel, Verzeichnis) trägt ihre eigenen; die App überschrieb sie auf allen mit demselben Text,
 * und Google liest die Seite nach dem Rendern (13.10.2026).
 */
export function applyDocumentLanguage(): void {
  document.documentElement.lang = 'de'
}
