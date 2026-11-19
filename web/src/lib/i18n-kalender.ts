/**
 * Texte der Poster-Gestaltung (26.09.2026): Kopfleiste, Abo-Menü, Kalenderkopf, Filterfeld, Woche
 * und Monat. Eigene Datei, weil `i18n.tsx` über 800 Zeilen liegt; `TEXTE` dort nimmt sie auf.
 */
/* Die Texte des Sprecher-Filters reisen mit: `i18n.tsx` ist über der Dateigrenze und wächst nicht mehr. */
import { TEXTE_SPRECHER } from './i18n-sprecher.ts'
import { TEXTE_HERKUNFT } from './i18n-herkunft.ts'
import { TEXTE_FILTER } from './i18n-filter.ts'
import { TEXTE_ZEILEN } from './i18n-zeilen.ts'

export const TEXTE_KALENDER = {
  ...TEXTE_SPRECHER,
  ...TEXTE_HERKUNFT,
  ...TEXTE_FILTER,
  ...TEXTE_ZEILEN,
  // Fortsetzung mit eigenem Titel in der Reihenliste, keine Staffel.
  'detail.gruppeEigene': 'Eigene Serien',
  // Neuverfilmung einer Serie der Reihe samt ihren Fortsetzungen; zählt für sich (Yaiba 2025).
  'detail.gruppeNeuverfilmung': 'Neuverfilmung',
  // Original noch nicht erschienen (Reihenliste, Datenbankkarte).
  // Kurzfassung am Schalter der Reihenliste (einzeilige Kopfzeile); der volle Satz steht in `detail.reiheOhneSchalter` als Tooltip.
  'kopf.startseite': 'Anime-Kalender DE — zur aktuellen Woche',
  'kopf.suche': 'Anime suchen',
  'kopf.sucheOeffnen': 'Suche öffnen',
  'kopf.abo': 'Menü: Kalender-Abo, Newsletter, Einstellungen',
  'kopf.aboKalenderHinweis': 'Google, Apple, Outlook — aktualisiert sich selbst',
  'kopf.aboNewsletterHinweis': 'Neue Termine per Mail',
  'kopf.aboPush': 'Push für Favoriten',
  'kopf.aboPushHinweis': 'Meldung, wenn eine gemerkte Folge erscheint',
  'kopf.hell': 'Helles Design',
  'kopf.dunkel': 'Dunkles Design',
  'nav.kalender': 'Kalender',
  'nav.bereich': 'Bereich',


  'kal.dieseWoche': 'Diese Woche',
  'kal.naechsteWoche': 'Nächste Woche',
  'kal.letzteWoche': 'Letzte Woche',
  'kal.kw': 'KW {n}',
  'kal.zeitraum': 'Zeitraum',
  'kal.voriger': 'Voriger Zeitraum',
  'kal.naechster': 'Nächster Zeitraum',
  'kal.einTermin': '1 Termin',
  'kal.termine': '{n} Termine',
  'kal.keinTermin': 'Kein Termin an diesem Tag.',
  'kal.nichtsGefiltert': 'Nichts für diese Filter.',
  'kal.imTv': 'Im Fernsehen',
  'kal.laeuft': 'Läuft',
  'kal.jetztUhr': 'jetzt {zeit}',
  'kal.nichtsMehr': 'Heute nichts mehr',
  'kal.ersteSendung': 'erste Sendung {rest}',
  'kal.seit': 'seit {zeit}',
  'kal.zweitSatz': 'Neu auf {anbieter} · erschien zuerst auf Deutsch bei: {erster}',
  'kal.zweitHinweis': 'Zuerst bei {erster}, seit {datum}. {anbieter} zieht nach.',
  'kal.zweitHinweisKatalog': 'Zuerst bei {erster}, seit mindestens {datum} im Angebot. {anbieter} zieht nach.',
  'kal.keineAusstrahlung': 'Keine Ausstrahlung.',
  'kal.imTvZahl': '{n} im TV',
  'kal.imHandelZahl': '{n} im Handel',
  'kal.imHandel': 'Im Handel',
  'kal.augeBereich': '{bereich} anzeigen',
  'kal.buendelTv': '+{n}, zuletzt um {zeit}',
  'kal.buendelTvEine': '+1 um {zeit}',
  'kal.buendelTvOhneZeit': '+{n}',
  'kal.buendelAuch': 'Auch um {zeiten}',
  'kal.buendelStream': '+{n} Folgen',
  'kal.start': 'Staffelstart',
  'kal.finale': 'Staffelfinale',
  'kal.katalog': 'Katalog-Release',
  'kal.imAngebot': 'Neu bei {anbieter}',
  'kal.imAngebotHinweis': 'Im Angebot seit diesem Tag – nicht der Erscheinungstag der deutschen Fassung.',
  /* Mit Trennstelle (U+00AD): das lange Wort passt sonst nicht in die schmale Kachel und würde abgeschnitten. */
  'kal.erstausgabe': 'Erstver­öffentlichung',
  'kal.erstausgabeHinweis': 'Erster Tag der deutschen Fassung, laut aniSearch.',
  'kal.favorit': 'Favorit',
  'kal.startHinweis': 'Ab hier gibt es diese Staffel mit deutscher Synchro.',
  'kal.finaleHinweis': 'Letzte Folge der Staffel — danach ist sie auf Deutsch vollständig.',
  'kal.folge': 'Folge {n}',
  'kal.folgeVon': 'Folge {n}/{von}',
  'kal.folgen': '{n} Folgen',
  'kal.kanalNeu': 'neu bei {kanal}',
  'kal.folgenSpanne': 'Folgen {von}–{bis}',
  'kal.folgenSpanneVon': 'Folge {von}–{bis}/{gesamt}',
  'kal.katalogAlle': 'Alle {n} Folgen auf einmal',
  'kal.katalogHinweis': 'Die ganze Staffel erscheint an diesem Tag auf einmal.',
  'kal.katalogVermutlich': 'Katalog-Release ≈',
  'kal.katalogVermutlichHinweis': 'Vermutlich erscheint die ganze Staffel an diesem Tag auf einmal; eine Quelle sagt es nicht ausdrücklich.',
  'kal.katalogAlleVermutlich': 'Vermutlich alle {n} Folgen auf einmal',
  'fachwort.omu': 'Originalton mit deutschen Untertiteln — keine deutsche Synchro',
  'kal.omu': 'OmU', 'kal.synchroOffen': 'Synchro offen', 'kal.synchroOffenHinweis': 'Der Termin ist belegt, eine deutsche Synchro nicht.',
  'kal.undWeitere': 'und {n} weitere',

  /* Der Chip heißt, was er **tut** — vorher „Fernsehen zeigen" und leuchtete, solange das
     Fernsehen an war; der Zähler stand deshalb auf 1, ohne dass etwas ausgeblendet war.
     */
  'filter.inDieserWoche': 'in dieser Woche',
  'filter.imMonat': 'im {monat}',
  'filter.suche': 'Suche: {q}',
}
