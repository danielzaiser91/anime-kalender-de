import type { VermerkAusgeblieben } from './types.ts'

/** Das Foto der Wochenprogramm-Zeile, die einen Termin ankündigte (`pipeline/lib/woche-beleg.ts`). */
export interface WocheBelegVermerk {
  /** Der Artikel, in dem die Zeile stand. */
  url: string
  /** Wann ein Lauf die Zeile zuerst sah (ISO-Zeitpunkt). */
  gesehenAm: string
  /** Schlüssel des privaten Bilds (Worker `/beleg`). */
  bild: string
  bildAm: string
  /** Die Zeile im Bild als Anteile `[links, oben, Breite, Höhe]`. */
  markierung?: [number, number, number, number]
}

/** Ein Vermerk samt Foto der Ankündigung. Eigener Typ statt Feld in `types.ts`, das über der Dateigrenze liegt (`check:umfang` darf nur sinken). */
export type VermerkMitAnkuendigung = VermerkAusgeblieben & { wocheBeleg?: WocheBelegVermerk }
