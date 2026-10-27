import type { Title } from '../../shared/types.ts'

/**
 * **Namensindex der Titel ohne Synchro** (`ohne-synchro-namen.json`): nur, was der Suchhinweis der Datenbank braucht, um in der Einheit der
 * Liste zu zählen — Suchnamen (ohne den nativen Namen), Reihe, Jahr und die Felder, auf die die Filter der Datenbank für diese Titel wirken.
 * Die volle Datei (`ohne-synchro.json`, 7,3 MB, gzip 1,7 MB) lädt die Seite weiter erst mit dem Schalter.
 */
export const NAMENSINDEX_FELDER = ['id', 'franchiseId', 'titleRomaji', 'titleEn', 'titleDe', 'jpYear', 'jpEnd', 'genres', 'format', 'land', 'fsk'] as const

export function namensIndex(titel: Pick<Title, 'titleRomaji'>[]): Record<string, unknown>[] {
  /* Nach Namen sortiert: so packt gzip die Datei um ein Zehntel kleiner (gemessen 27.10.2026: 584 → 545 kB). */
  const sortiert = titel.slice().sort((a, b) => (a.titleRomaji ?? '').localeCompare(b.titleRomaji ?? '') || ((a as { id?: number }).id ?? 0) - ((b as { id?: number }).id ?? 0))
  return sortiert.map((t) => {
    const zeile: Record<string, unknown> = {}
    for (const feld of NAMENSINDEX_FELDER) {
      const wert = (t as unknown as Record<string, unknown>)[feld]
      if (wert === undefined || wert === null || (Array.isArray(wert) && wert.length === 0)) continue
      /* Gleicher englischer Name wie der romanisierte: einmal genügt. */
      if (feld === 'titleEn' && wert === t.titleRomaji) continue
      zeile[feld] = wert
    }
    return zeile
  })
}
