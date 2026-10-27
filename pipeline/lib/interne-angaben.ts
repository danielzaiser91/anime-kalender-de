/**
 * **Keine Angabe aus der Pflege in veröffentlichten Daten** (26.10.2026): „laut Daniels Sichtung“ stand in einer Notiz und im Panel.
 * Geprüft wird nach Feldern, nicht nach Wörtern: In den Feldern der Liste stehen echte Namen (Sprecher, Figur, Titel, Synopse,
 * Folgentitel) und sind ausgenommen; jedes andere Textfeld darf keine Person der Pflege nennen.
 */
const PFLEGE = /daniel|zaiser/i

/** Dateien, in denen das Feld `note` (interne Notiz) nie vorkommen darf, auch ohne Namen im Text. */
const NOTIZ_DATEIEN = /^(releases|woche|woche-kacheln)\.json$/

interface Ausnahme {
  /** Dateipfad unter `public/data`, mit `/`. */
  datei: RegExp
  /** Feldnamen; `*` nimmt die ganze Datei aus. Zahlen als Schlüssel zählen nicht als Feld, sie erben das Elternfeld. */
  felder: readonly string[]
}

export const NAMEN_AUSNAHMEN: readonly Ausnahme[] = [
  { datei: /^voices\/[^/]+\.json$/, felder: ['actor', 'character'] },
  { datei: /^sprecher\.json$/, felder: ['sprecher'] },
  { datei: /^sprecher\/[^/]+\.json$/, felder: ['rollen'] },
  { datei: /^synonyme\.json$/, felder: ['*'] },
  { datei: /^synopses\/[^/]+\.json$/, felder: ['de', 'en'] },
  { datei: /^folgen\/[^/]+\.json$/, felder: ['f'] },
  { datei: /^(cartoons|ohne-synchro|titles|titles-core)\.json$/, felder: ['slug', 'url', 'titleDe', 'titleEn', 'titleRomaji'] },
]

function erlaubt(datei: string, feld: string): boolean {
  return NAMEN_AUSNAHMEN.some((a) => a.datei.test(datei) && (a.felder.includes('*') || a.felder.includes(feld)))
}

/** Zeilen „datei :: feld :: Ausschnitt“ für jeden Treffer außerhalb der Namensfelder; `datei` relativ zu `public/data`. */
export function interneAngaben(datei: string, wert: unknown, feld = '(wurzel)'): string[] {
  if (typeof wert === 'string') {
    const m = PFLEGE.exec(wert)
    if (!m || erlaubt(datei, feld)) return []
    const von = Math.max(0, m.index - 30)
    return [`${datei} :: ${feld} :: …${wert.slice(von, m.index + 40)}…`]
  }
  if (Array.isArray(wert)) return wert.flatMap((v) => interneAngaben(datei, v, feld))
  if (wert && typeof wert === 'object') {
    return Object.entries(wert).flatMap(([k, v]) => {
      if (k === 'note' && NOTIZ_DATEIEN.test(datei)) return [`${datei} :: note :: Feld der internen Notiz`]
      return interneAngaben(datei, v, /^\d+$/.test(k) ? feld : k)
    })
  }
  return []
}
