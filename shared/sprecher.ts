/**
 * Sprecher-Index: Bau (`pipeline/bau/sprecher-index.ts`) und Oberfläche (`web/src/lib/sprecher.ts`) müssen Namen
 * gleich lesen — sonst sucht die Oberfläche in der falschen Gruppe. Deshalb liegen Form und Normalisierung hier.
 */

/** Der schlanke Index: je Sprecher Name, Zahl der Titel und die Gruppe, in der seine Rollen liegen. */
export interface SprecherIndex {
  /** Tag des Baus (Europe/Berlin), damit die Oberfläche den Stand nennen kann. */
  stand: string
  /** [Name, Titelzahl, Gruppe] — Gruppe ist die Datei `sprecher/<gruppe>.json`. */
  sprecher: [string, number, string][]
}

/** Ein Titel eines Sprechers mit seinen Rollen darin; `ann` markiert Rollen, die (auch) von Anime News Network stammen. */
export interface SprecherTitel {
  id: number
  rollen: string[]
  ann?: true
}

/** Eine Gruppe: Name → Titel. */
export type SprecherGruppe = Record<string, SprecherTitel[]>

/** Kleinschreibung, Umlaute und Akzente abgelegt, Leerraum zusammengezogen — für Vergleich und Gruppe. */
export function sprecherNormal(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Anzeigename ohne doppelte Leerzeichen — „Josef  Tratnik" und „Josef Tratnik" sind derselbe Eintrag. */
export function sprecherName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

/** Die Gruppe (Datei) eines Namens: sein erster lateinischer Buchstabe, sonst `_`. */
export function sprecherGruppe(name: string): string {
  const erster = sprecherNormal(name)[0] ?? ''
  return /[a-z]/.test(erster) ? erster : '_'
}
