/**
 * **Was die Antwortzeile zu sagen hat — je nach Lage des Titels.**
 *
 * Lag bis zum 01.10.2026 in `antwort-kasten.tsx`; die Datei reißt die
 * Längengrenze (`tools/umfang-pruefen.mjs`), der Typ gehört ohnehin nicht in die
 * Darstellung.
 */
import type { ReleaseEvent, VermerkAusgeblieben } from '@shared/types.ts'

export type Antwort =
  | {
      art: 'laeuft'
      haupt: ReleaseEvent
      rest: number
      raus: number
      gesamt?: number
      letzter?: string
      /** Feste Sendetage der Ausgabe (Fernsehen), 1 = Montag. */
      sendetage?: number[]
      /** Ein Komplettabwurf (`available-from`): alle Folgen an einem Tag, kein Wochentakt. */
      komplett?: boolean
      /** Aus dem TV-Programm gesichtet, ohne Folgenliste: die Nummer ist nur unsere Zählung. */
      sichtung?: boolean
      /** Aus dem TV-Programm gesichtet: das Ende ist unbekannt, auch wenn die Nummern stimmen. */
      offenesEnde?: boolean
      /** Der verstrichene Tag, wenn die nächste Folge auf einem Ersatztermin liegt. */
      verschobenVon?: string
      /** Stehen mehrere ausgebliebene Folgen hintereinander, die Nummer der letzten. */
      ausgebliebenBis?: number
      /** Was wir zum Ausfall wissen — am ausgebliebenen Termin, auch wenn ein Ersatztermin vorn steht. */
      vermerk?: VermerkAusgeblieben
    }
  | { art: 'fertig'; raus?: number; gesamt?: number }
  /** Belegt ist nur ein Teil — die Zahl sagt welcher. */
  | { art: 'teilweise'; raus: number; gesamt: number; restBelegt: boolean }
  | { art: 'film'; hatSynchro: boolean; raus: number; gesamt?: number; ohneWeg: boolean; imKino: boolean }
  /**
   * **Ein angekündigter Kinofilm ohne deutsche Fassung.** `jp` in der Genauigkeit
   * der Quelle (Tag, Monat oder Jahr), `jpRaus` sagt, ob er dort schon läuft.
   */
  | {
      art: 'kino'
      jp?: string
      jpRaus: boolean
      land: string
      deTermin?: string
      deZeitraum?: string
      verleih?: string
      fassung?: 'synchro' | 'omu' | 'beides'
    }
  /**
   * **Ein Film mit deutschem Kino- oder Streamtermin** (17.09.2026). Kino kommt
   * meist Wochen vor dem Stream, manchmal zeitgleich, manchmal danach — der Kasten
   * nennt den nächsten Termin zuerst und den anderen daneben.
   */
  | {
      art: 'filmDe'
      /** Gibt es überhaupt einen Weg zum Ansehen? Dann fehlt kein Streamstart. */
      streamWege?: boolean
      kino?: { datum: string; raus: boolean }
      stream?: { datum: string; raus: boolean; anbieter: string }
      verleih?: string
      fassung?: 'synchro' | 'omu' | 'beides'
    }
  | { art: 'ohne'; gesamt?: number }
  /**
   * **Eine Disc ist kein Sendeplan.**
   *
   * Gibt es zu einem Titel überhaupt kein Streaming-Release, fällt der Kopf auf
   * die Disc zurück — ein Kaufdatum ist besser als gar keine Auskunft. Nur
   * beantwortet es eine andere Frage: über einer Steelbook-Box stand
   * „Wöchentlich freitags · letzte Folge · 0 von 24 Folgen erschienen" (Daniel,
   * 02.09.2026). Eine Disc erscheint an einem Tag komplett; Fortschrittsbalken
   * und Rhythmus gehören dort nicht hin.
   *
   * **Und er nennt den Band, den es schon gibt.** Bei „Banana Fish" stand dort
   * „in 2 Monaten, 06.11.2026" — Band 1 lag seit dem 21.08.2026 im Laden, und
   * wir verlinkten sogar dorthin (Daniel, 12.09.2026).
   */
  | {
      art: 'disc'
      datum: string
      publisher?: string
      edition?: string
      /** Alle Kaufausgaben des Titels, erschienene zuerst. Ab zwei Bänden gezeigt. */
      baende?: { name?: string; datum: string; raus: boolean }[]
    }
