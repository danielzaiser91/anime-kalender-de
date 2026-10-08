/**
 * Form einer Detektiv-Regel. Jede Regel liefert ihre Treffer; Nutzerwirkung und Sicherheit
 * (1 − Fehlalarmquote aus der Handstichprobe) stehen in `einstufung.ts` und bestimmen den Hebel.
 */
export interface Treffer {
  /** Stabiler Schlüssel (Slug, Titel-Kennung, Adresse) zum Wiedererkennen zwischen zwei Läufen. */
  schluessel: string
  /** Ein Satz für Daniel: was widerspricht sich, mit Namen und Zahlen. */
  text: string
  /** Wo es zu sehen ist (Route der Seite oder Adresse der Zweitquelle). */
  ort?: string
}

export interface Regel {
  id: string
  name: string
  /** Was ein Besucher Falsches sähe, wenn der Treffer echt ist. */
  folge: string
  treffer: Treffer[]
  /** Wie viele Einheiten geprüft wurden (Nenner für die Quote). */
  geprueft: number
}

export const regel = (id: string, name: string, folge: string, geprueft: number, treffer: Treffer[]): Regel => ({ id, name, folge, geprueft, treffer })
