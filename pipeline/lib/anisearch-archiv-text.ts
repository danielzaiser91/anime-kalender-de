import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { ARCHIV_SEITEN } from './anisearch-relationen.ts'
import { extractDescription } from './anisearch-handlung.ts'

/**
 * **Die deutsche Inhaltsangabe aus dem Seitenarchiv** (`data/anisearch-raw/<Kennung>.html.gz`), für Titel, die `data/anisearch.json` nicht führt (12.10.2026: 112 von 248 Titeln
 * ohne deutsche Handlung; alle 84 reinen aniSearch-Titel und 28 AniList-Titel). Der Text trägt wie im Abruf die Zeile „Quelle: www.anisearch.de/anime/<Kennung>“.
 */
export function archivHandlung(anisearchId: number, dir = ARCHIV_SEITEN): string | undefined {
  const pfad = `${dir}/${anisearchId}.html.gz`
  if (!existsSync(pfad)) return undefined
  return extractDescription(gunzipSync(readFileSync(pfad)).toString('utf8'))
}

/**
 * Archivtexte der Titel, die sonst keinen deutschen Text haben (`hatText`). Eine Seite, die zwei oder mehr Titeln zugeordnet ist, beschreibt die Reihe oder alle Teile
 * zusammen (Film 1–3 auf einer Seite, Serie und ihr Special) — den Text bekommt dann kein Titel, denn nichts belegt, dass er zu genau diesem gehört.
 */
export function archivTexte(kennungen: Map<number, number>, hatText: (titelId: number) => boolean, dir = ARCHIV_SEITEN): Map<number, string> {
  const jeSeite = new Map<number, number>()
  for (const seite of kennungen.values()) jeSeite.set(seite, (jeSeite.get(seite) ?? 0) + 1)
  const texte = new Map<number, string>()
  for (const [titelId, seite] of kennungen) {
    if (hatText(titelId) || jeSeite.get(seite)! > 1) continue
    const text = archivHandlung(seite, dir)
    if (text) texte.set(titelId, text)
  }
  return texte
}
