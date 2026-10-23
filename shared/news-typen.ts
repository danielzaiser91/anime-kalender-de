/**
 * **Die Formen der Nachrichtenseite** (28.09.2026).
 *
 * Eigenes Modul, weil `shared/types.ts` über die Dateigrenze gewachsen ist. Weitergeleitet wird
 * von dort — die Aufrufer importieren unverändert aus `shared/types.ts`.
 */
import type { PlatformId } from './types.ts'
import type { TaktArt } from './takt.ts'
export type NewsArt = 'neu' | 'folgen' | 'angekuendigt' | 'disc' | 'kino' | 'verspaetet' | 'nachgereicht' | 'nachgetragen' | 'rhythmus' | 'takt' | 'offiziell'

/** Worum es einer freigegebenen Meldung der offiziellen Website geht (Art `offiziell`). */
export type OffiziellKategorie = 'staffel' | 'film' | 'synchro' | 'termin'

/**
 * Eine einzelne Auskunft — neue Folgen, ein Termin, eine verpasste Ankündigung.
 *
 * Der Text entsteht **nicht** hier: Der Bau liefert die Angaben, die Oberfläche
 * formuliert daraus einen Satz. Sonst stünde die deutsche Fassung fest in einer
 * Datei, und die Seite kann zwei Sprachen.
 */
/**
 * **Ein Beleg einer Meldung — ein Dokument, nicht eine Lesung** (01.10.2026).
 *
 * Daniel am 01.10.2026: „ich glaub so hast du es auch gemeint" — gezählt wird **nach Adresse**.
 * Derselbe Artikel, zweimal gelesen oder aktualisiert, bleibt **eine** Quelle; sonst verspräche
 * die Zeile „Sicherheit der Angaben" mehr, als da ist.
 */
export interface NewsBeleg {
  url: string
  /** Anzeigename (Verlag), meist der Hostname. */
  name: string
  /** Laut Artikel (Beleg-Lesung) — der Tag, an dem die Quelle es gesagt hat. */
  veroeffentlichtAm?: string
  aktualisiertAm?: string
  /** Produktseite: der Erscheinungstag der Ausgabe. */
  ausgabeAm?: string
  /** Bei einer eigenen Messung (Anbieter-Kalender): der Tag, an dem wir nachgesehen haben. */
  gemessenAm?: string
  /** Art `offiziell`: die Überschrift der Seite, wörtlich und in ihrer Sprache (`ja`, `en`) — der Satz der Kachel sagt nur, was sie bedeutet. */
  ueberschrift?: { text: string; sprache: string }
  /** Schlüssel des privaten Beleg-Bilds (Worker `/beleg`) — nur mit Lese-Schlüssel sichtbar. */
  bild?: string
  /** Die Fundstelle im Bild als Anteile `[links, oben, Breite, Höhe]` von 0 bis 1 — wo die Aussage steht (Beleg-Dialog, „Zur Fundstelle"). */
  markierung?: [number, number, number, number]
  /** Beleg-Lesung: wann wir die Quelle zum ersten Mal, zuletzt und wann wir das Bild gesichert haben (Beleg-Fenster, Daniel 05.10.2026). */
  erstGeprueftAm?: string; zuletztGeprueftAm?: string; bildAm?: string
  /** Eigene Messung statt Bild (Crunchyroll-Serienseiten lassen sich nicht fotografieren): was der Katalog am Tag `am` zu den Folgen der Meldung sagte. */
  messung?: { am: string; quelle: string; zeilen: string[] }
  /** Öffentliche Seite zum Beleg, wenn `url` eine API-Adresse ist (ADN: Serienseite); „Originalseite“ führt hierhin. */
  seite?: string
}

export interface NewsMeldung {
  art: NewsArt
  platform?: PlatformId
  anbieter?: string
  /** Prime-Zusatzkanal (z. B. Aniverse), den die Quelle nennt. */
  kanal?: string
  /** Bei `neu`: ein weiterer Anbieter, nicht die erste Synchro des Titels (18.09.2026). */
  weiterer?: boolean
  /** Bei `neu` und `angekuendigt` (Streaming): Jahre seit dem japanischen Start (ab fünf) — „Nach 14 Jahren endlich …"; `discSeitText`: so lange gibt es die deutsche Fassung schon auf Disc („4 Monaten"). */
  jahre?: number; discSeitText?: string
  /** Bei `angekuendigt` im TV: Handbeleg „erste deutsche Ausstrahlung“ (`premiereBelegtTv`) — der Satz sagt „Deutsche TV-Premiere“ (Daniel, 21.10.2026). */
  premiere?: boolean
  /** Bei `angekuendigt`: Start nur mit Untertiteln (OmU) — ob eine deutsche Synchro angekündigt ist (Daniel, 06.10.2026: beide Auskünfte sind interessant). */
  omu?: 'synchro-angekuendigt' | 'synchro-offen'
  /** Bei `offiziell`: was die Meldung der offiziellen Website sagt (von Hand bei der Freigabe gewählt). */
  kategorie?: OffiziellKategorie
  /** Bei `rhythmus`: Folgen pro Woche bis `datum` laut Quelle (von, bis) — Satz „Bis … wöchentlich 3–4 neue Folgen“, kein Start. */
  proWoche?: [number, number]
  /** Bei `takt`: wie der Takt abwich (Pause, mehrere Folgen auf einmal, Folge kurz nach der vorigen); `abstand` = Tage seit dem vorigen Folgen-Tag. */
  takt?: TaktArt
  abstand?: number
  /** Bei `disc`: welche Ausgabe („Vol. 1/2", „Gesamtausgabe", „Box 9") — ohne sie sagt der Satz bei jedem Volume dasselbe. */
  ausgabe?: string
  /** Der Termin, um den es geht (angekündigt, Disc, Kino, verpasst). */
  datum?: string
  /** Uhrzeit des Termins ("HH:MM", Berlin), wo die Quelle sie nennt — bei `nachgetragen` im Satz. */
  zeit?: string
  /** Erste betroffene Folge — bei `folgen` der Anfang des Bereichs. */
  von?: number
  /** Letzte betroffene Folge. */
  bis?: number
  anzahl?: number
  /** Bei `nachgereicht`: die angekündigten Tage der nachgereichten Folgen. */
  erwartet?: string[]; planmaessig?: number[] // planmäßige Folgen, die am selben Tag mit erschienen
  /** Bei `verspaetet`/`nachgereicht`: der Tag wurde genannt (`tagIstAngekuendigt`). Sonst ist er errechnet. */
  angekuendigtBelegt?: true
  release?: string
  /**
   * Der Teil der Reihe, um den es geht — nur wenn er nicht der Kopf ist.
   *
   * Gebündelt wird je Reihe: Die Specials und die Hauptserie von „Lord of
   * Mysteries" sind für den Leser ein Anime, für den Datensatz zwei Titel.
   * Steht die Meldung zu einem anderen Teil, nennt sie ihn.
   */
  teil?: string
  teilId?: number
  /**
   * **Wo das steht, was hier gemeldet wird**.
   *
   * Nicht die eigene Titelseite: Der Leser will nachsehen können, woher wir von einem Termin
   * wissen. Bevorzugt wird eine lesbare Seite (Artikel, Anbieterseite), erst dann ein
   * Schnittstellen-Endpunkt — die eigentliche Herkunft, aber nichts zum Anklicken.
   */
  quelle?: string
  /**
   * **Die Belege dieser Aussage — je Dokument einer** (01.10.2026).
   *
   * Der `quelle`-Link führt zu **einer** Stelle zum Nachsehen; `belege` trägt die
   * ganze Kette, aus der die Zeile „Sicherheit der Angaben" die Zahl zieht. Nur
   * gesetzt, wo ein Termin die Herkunft kennt (angekündigt, Disc, Kino, verpasst,
   * „neu auf Deutsch" mit erreichtem Termin) — ein bloßer Anbieter-Verweis ist kein
   * Dokument.
   */
  belege?: NewsBeleg[]
  /**
   * **Der Termin ist unsere eigene Schätzung, keine Aussage einer Quelle**.
   *
   * Aus dem bisherigen Rhythmus fortgeschrieben (`schedule.estimated`). Dann darf **kein**
   * Quellenlink daran hängen: Er führte auf eine Seite, die den Termin gar nicht nennt —
   * bei der abgelösten Apothekerin-Meldung auf Crunchyroll, wo der 02.10. steht.
   */
  geschaetzt?: boolean
  /**
   * **Was die Meldung aus sich heraus verständlich macht**.
   *
   * Der Quellenlink ist zum Nachsehen da, nicht als Bedingung: Bei einer
   * angekündigten Staffel trägt die Meldung die Einordnung (hier: die Ankündigung
   * lässt OmU oder Synchro offen, wir vermuten einen Simuldub). Rein, damit der
   * Ausschnitt auch ohne Klick die ganze Nachricht zeigt.
   */
  hinweis?: string
  /** Beschriftete Abschnitte hinter „mehr" (`nachgetragen`): `art` ist quelle, grund, abhilfe oder zusage. */
  abschnitte?: { art: string; text: string }[]
  /**
   * **Diese Meldung wurde von einer neueren abgelöst**.
   *
   * Ein Termin wurde verschoben: Die alte Ankündigung verschwindet nicht, sie
   * bleibt sichtbar und durchgestrichen stehen — samt Hinweis, wodurch sie
   * ersetzt wurde. `datum`/`quelle` führen zur neuen Angabe, damit der Leser den
   * Weg nachvollziehen kann.
   */
  ersetzt?: { datum?: string; release?: string; quelle?: string }
  /**
   * **Der Beleg ist entfallen, ohne Ersatz.** Nur, wenn eine Prüfung die
   * Ankündigung widerlegt hat — nicht, weil sie uns gerade fehlt.
   */
  zurueckgezogen?: { grund?: string }
}

/** „angekündigt“ nur bei belegter Ankündigung, sonst „erwartet“ (der Tag ist dann Rhythmus oder Originaltermin plus Versatz). */
export function ankuendigungsWort(angekuendigt?: boolean): 'angekündigt' | 'erwartet' {
  return angekuendigt ? 'angekündigt' : 'erwartet'
}

/** Ob der Tag eines ausgebliebenen Termins genannt wurde: Foto der Ankündigung oder im Plan nicht geschätzt. Detailfenster, Mail und Meldungen fragen hier. */
export function tagIstAngekuendigt(vermerk: object | undefined, estimated?: boolean): boolean {
  const v = vermerk as { wocheBeleg?: unknown; tagGeschaetzt?: boolean } | undefined
  /* Der beim Vermerken festgehaltene Stand gilt für immer; der Plan ändert sich, sobald die Folge da ist (Meldungen schreiben sich nicht um). */
  return Boolean(v?.wocheBeleg) || !(v?.tagGeschaetzt ?? estimated)
}

/** Rückzugsgrund, wenn die Ankündigung aus einer Meldung mit nur Originalton kam — ihr eigener Beleg widerlegt sie (10.10.2026). */
export const GRUND_NUR_ORIGINALTON = 'Die Quelle nennt nur Originalton mit Untertiteln, keine deutsche Synchro.'

/**
 * **Ein Anime an einem Tag — mit allem, was an ihm passiert ist.**
 *
 * Daniel am 12.09.2026: „pro tag max 1 eintrag je anime - alle infos zu diesem
 * anime (neue folgen, disc release, ankündigung zu weiteren folgen/staffeln,
 * etc.) müssen unter diesem anime gebündelt aufgelistet sein."
 *
 * Vorher war eine Meldung die Einheit, und ein Anime mit vier Auskünften
 * belegte vier Zeilen — die Seite wuchs, ohne mehr zu sagen.
 */
export interface NewsEintrag {
  /** Tag, an dem die Meldung zum ersten Mal wahr war — sie wandert danach nicht mehr. */
  am: string
  /** Kennung der Reihe bzw. des Titels, unter dem gebündelt wird. */
  titelId: number
  titel: string
  slug: string
  cover?: string
  meldungen: NewsMeldung[]
}
