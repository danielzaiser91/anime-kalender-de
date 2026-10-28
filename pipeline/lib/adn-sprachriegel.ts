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

/** Was ein Katalog-Durchgang über die Serien weiß: wer gefragt wurde und wer davon eine vollständige Antwort bekam. */
export type KatalogAuskunft = { gefragt: Set<number>; entschieden: Set<number> }

/**
 * Der neue Katalog: `neu` (frische Treffer mit Deutsch) plus jeder alte Eintrag ohne vollständige Antwort in diesem Lauf — nicht gefragt
 * (`--limit`, Abbruch nach fünf Fehlern) oder gefragt und abgebrochen (5xx, Zeitüberschreitung, französische Sicht). Nur wer frisch und
 * vollständig ohne Deutsch antwortete, fällt heraus. Die Zähler nennen jeden Weg.
 */
export function mitUngepruftenAlten<T extends { showId: number }>(alt: T[], neu: T[], auskunft: KatalogAuskunft) {
  const da = new Set(neu.map((s) => s.showId))
  const offen = alt.filter((s) => !da.has(s.showId) && !auskunft.entschieden.has(s.showId))
  const abbruch = offen.filter((s) => auskunft.gefragt.has(s.showId)).length
  return {
    shows: [...neu, ...offen],
    nichtGefragt: offen.length - abbruch,
    abbruch,
    entfernt: alt.filter((s) => !da.has(s.showId) && auskunft.entschieden.has(s.showId)).length,
  }
}

/** Logzeile mit den Zählern je Weg. */
export function katalogBilanzZeile(b: { nichtGefragt: number; abbruch: number; entfernt: number }): string {
  return `ADN-Katalog behalten: ${b.nichtGefragt} nicht gefragt, ${b.abbruch} Abbruch, ${b.entfernt} entfernt`
}

/** Schlusszeile des Laufs; `rot` heißt: mehr als eine Handvoll verworfen. */
export function riegelBilanz(anzahl: number): { zeile: string; rot: boolean } {
  return {
    zeile: `ADN-Sprachriegel: ${anzahl} Serien wegen französischer Sprachkürzel verworfen (Grenze ${MAX_VERWORFEN})`,
    rot: anzahl > MAX_VERWORFEN,
  }
}
