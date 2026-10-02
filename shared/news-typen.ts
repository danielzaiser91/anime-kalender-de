/**
 * **Die Formen der Nachrichtenseite** (28.09.2026).
 *
 * Eigenes Modul, weil `shared/types.ts` über die Dateigrenze gewachsen ist. Weitergeleitet wird
 * von dort — die Aufrufer importieren unverändert aus `shared/types.ts`.
 */
import type { PlatformId } from './types.ts'
export type NewsArt = 'neu' | 'folgen' | 'angekuendigt' | 'disc' | 'kino' | 'verspaetet'

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
  /** Wann wir dieses Dokument zum ersten Mal gesehen haben — der ehrliche, weil einzige Wert. */
  gelesenAm?: string
}

export interface NewsMeldung {
  art: NewsArt
  platform?: PlatformId
  anbieter?: string
  /** Bei `neu`: ein weiterer Anbieter, nicht die erste Synchro des Titels (18.09.2026). */
  weiterer?: boolean
  /** Der Termin, um den es geht (angekündigt, Disc, Kino, verpasst). */
  datum?: string
  /** Erste betroffene Folge — bei `folgen` der Anfang des Bereichs. */
  von?: number
  /** Letzte betroffene Folge. */
  bis?: number
  anzahl?: number
  /** Bei `verspaetet`: wann die Folge dann doch kam. */
  nachgereichtAm?: string
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
   * **Wo das steht, was hier gemeldet wird** (Daniel, 28.09.2026: „inkl Link zur Quelle").
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
