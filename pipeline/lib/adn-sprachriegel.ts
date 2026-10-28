/**
 * Riegel gegen die französische Sicht von ADN.
 *
 * Am 28.10.2026 (Lauf 14:01 UTC) lieferte ADN trotz `X-Target-Distribution: de` und
 * `Accept-Language: de` für 24 Serien nur `vostf`/`vf` statt `vostde`/`vde`; die Läufe davor und
 * danach waren in Ordnung, am Sammler hatte sich nichts geändert. Eine solche Antwort ist keine
 * Auskunft über die deutsche Fassung und darf das Archiv nicht überschreiben.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'

type MitSprachen = { languages?: string[] }

/** Mehr verworfene Serien je Lauf als diese Handvoll lassen den Schritt rot werden. */
export const MAX_VERWORFEN = 5

const FRANZ = ['vostf', 'vf']
const DEUTSCH = ['vostde', 'vde']

/** Trägt die Antwort französische und kein einziges deutsches Sprachkürzel? */
export function istFranzoesischeSicht(videos: MitSprachen[]): boolean {
  const alle = videos.flatMap((v) => v.languages ?? [])
  return alle.some((l) => FRANZ.includes(l)) && !alle.some((l) => DEUTSCH.includes(l))
}

/** Kennungen aller Archive in `verzeichnis`, die nur französische Kürzel tragen. */
export function franzoesischeArchive(verzeichnis: string): string[] {
  if (!existsSync(verzeichnis)) return []
  const treffer: string[] = []
  for (const datei of readdirSync(verzeichnis)) {
    if (!datei.endsWith('.json.gz')) continue
    const roh = JSON.parse(gunzipSync(readFileSync(`${verzeichnis}/${datei}`)).toString()) as { videos?: MitSprachen[] }
    if (istFranzoesischeSicht(roh.videos ?? [])) treffer.push(datei.replace('.json.gz', ''))
  }
  return treffer
}

/** Zähler der in diesem Lauf verworfenen Serien. */
export const verworfen: number[] = []

/** Prüft eine Antwort am Abruf: französische Sicht wird gezählt und gemeldet (true), nichts davon darf weiterverarbeitet werden. */
export function verwirfFranzoesische(showId: number, videos: MitSprachen[]): boolean {
  if (!istFranzoesischeSicht(videos)) return false
  verworfen.push(showId)
  console.warn(`⚠  ADN ${showId}: Antwort trägt nur französische Sprachkürzel (vostf/vf) — verworfen, alter Stand bleibt.`)
  return true
}

/** Legt die Serie ab, außer die Antwort ist die französische Sicht — dann bleibt das alte Archiv. */
export function schreibeArchiv(verzeichnis: string, showId: number, videos: MitSprachen[]): boolean {
  if (verwirfFranzoesische(showId, videos)) return false
  if (!existsSync(verzeichnis)) mkdirSync(verzeichnis, { recursive: true })
  const pfad = `${verzeichnis}/${showId}.json.gz`
  const neu = gzipSync(JSON.stringify({ showId, videos }), { level: 9 })
  if (existsSync(pfad) && readFileSync(pfad).equals(neu)) return true
  writeFileSync(pfad, neu)
  return true
}

/** Der neue Katalog; Serien mit verworfener Antwort behalten ihren alten Eintrag (sonst fielen sie heraus, `neu` trägt nur Serien mit deutscher Folge). */
export function mitVerworfenenAlten<T extends { showId: number }>(alt: T[], neu: T[], verworfene: number[]): T[] {
  const da = new Set(neu.map((s) => s.showId))
  return [...neu, ...alt.filter((s) => verworfene.includes(s.showId) && !da.has(s.showId))]
}

/** Schlusszeile des Laufs; `rot` heißt: mehr als eine Handvoll verworfen. */
export function riegelBilanz(anzahl: number): { zeile: string; rot: boolean } {
  return {
    zeile: `ADN-Sprachriegel: ${anzahl} Serien wegen französischer Sprachkürzel verworfen (Grenze ${MAX_VERWORFEN})`,
    rot: anzahl > MAX_VERWORFEN,
  }
}
