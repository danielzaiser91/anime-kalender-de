/**
 * Was wir über einen Termin wissen, den der Anbieter nicht eingehalten hat.
 *
 * Die Felder ab `geprueftAm` beantworten die Frage, die jeder stellt, der „nicht erschienen" liest:
 * **und wann dann?** Wissen wir es nicht, soll wenigstens dastehen, dass und wann wir nachgesehen
 * haben, und wo.
 */
export interface VermerkAusgeblieben {
  /** Wann es hätte sein sollen. */
  erwartetAm: string
  /** Wann der Lauf das Ausbleiben bemerkte (Tag der Messung) und wann die Folge wirklich kam — leer, solange sie aussteht. */
  bemerktAm?: string; erschienenAm?: string; messBild?: string; nachBild?: string // Schlüssel der privaten Beleg-Bilder (Kalendertag beim Bemerken / beim Nachreichen)
  /** Verzug in Stunden, sobald beides bekannt ist. */
  verzugStunden?: number
  /** Wie viele Folgen der Anbieter zu diesem Zeitpunkt zeigte. */
  folgenVerfuegbar?: number
  /** Der neue erwartete Termin — nur mit einer Quelle, die ihn nennt. */
  neuErwartet?: string
  /** Was die Recherche ergeben hat, ein bis zwei Sätze für Besucher. */
  recherche?: string
  /** Die Adresse, die `recherche` belegt. */
  rechercheQuelle?: string
  /** Wann zuletzt recherchiert wurde — auch wenn nichts gefunden wurde. */
  rechercheAm?: string
  /** Wann der Anbieter-Kalender zuletzt gelesen wurde, ohne die Folge zu zeigen. */
  geprueftAm?: string
  /** Wann die News-Feeds zuletzt gelesen wurden. */
  newsGeprueftAm?: string
  /** Meldungen, die zu diesem Titel eine Pause oder Verschiebung nennen. */
  hinweise?: { quelle: string; titel: string; url: string; datum: string }[]
}
