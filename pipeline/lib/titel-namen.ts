import type { Title } from '../../shared/types.ts'

/** Die übrigen Schreibweisen eines Titels (Deutsch, Englisch, Romaji, Japanisch), ohne den gezeigten Namen und ohne Dopplungen — damit Suchen in jeder Sprache auf die Seite führen. */
export function andereNamen(t: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji' | 'titleNative'> | undefined, gezeigt: string): string[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const gesehen = new Set([norm(gezeigt)])
  const raus: string[] = []
  for (const n of [t?.titleDe, t?.titleEn, t?.titleRomaji, t?.titleNative]) {
    if (!n || gesehen.has(norm(n))) continue
    gesehen.add(norm(n))
    raus.push(n.trim())
  }
  return raus
}

/** Schema.org-Block für eine Titelseite ohne Termin (nur belegte Felder); `<` wird maskiert, damit nichts den Skript-Block beendet. */
export function titelJsonLd(daten: Record<string, unknown>): string {
  return `    <script type="application/ld+json">${JSON.stringify(daten).replace(/</g, '\\u003c')}</script>`
}
