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

/** Mindestens diese Handvoll verworfener Serien je Lauf bleibt grün. */
export const MAX_VERWORFEN = 5

/** Bei großen Durchgängen (Katalog, ~540 Serien) gilt dieser Anteil der Gefragten, wenn er über der Handvoll liegt (10.11.2026: 11 von 536 = 2,1 %). */
export const ANTEIL_VERWORFEN = 0.03

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

/** Eine Eintragung je gefragter Serie in diesem Lauf (Bezugsgröße der Grenze). */
export const gefragt: number[] = []

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
export type KatalogAuskunft = { gefragt: Set<number>; entschieden: Set<number>; leer?: Set<number> }

/**
 * Der neue Katalog: `neu` (frische Treffer mit Deutsch) plus jeder alte Eintrag ohne vollständige Antwort in diesem Lauf — nicht gefragt
 * (`--limit`, Abbruch nach fünf Fehlern) oder gefragt und abgebrochen (5xx, Zeitüberschreitung, französische Sicht). Nur wer frisch und
 * vollständig ohne Deutsch antwortete, fällt heraus. Eine Antwort ganz ohne Videos (`leer`) ist keine Auskunft: elf Serien mit belegter Synchro
 * fielen am 09.11.2026 so aus dem Katalog, der alte Eintrag bleibt. Die Zähler nennen jeden Weg.
 */
export function mitUngepruftenAlten<T extends { showId: number }>(alt: T[], neu: T[], auskunft: KatalogAuskunft) {
  const da = new Set(neu.map((s) => s.showId))
  const leer = auskunft.leer ?? new Set<number>()
  const offen = alt.filter((s) => !da.has(s.showId) && (!auskunft.entschieden.has(s.showId) || leer.has(s.showId)))
  const abbruch = offen.filter((s) => auskunft.gefragt.has(s.showId)).length
  return {
    shows: [...neu, ...offen],
    nichtGefragt: offen.length - abbruch,
    abbruch,
    entfernt: alt.filter((s) => !da.has(s.showId) && auskunft.entschieden.has(s.showId) && !leer.has(s.showId)).length,
  }
}

/** Logzeile mit den Zählern je Weg. */
export function katalogBilanzZeile(b: { nichtGefragt: number; abbruch: number; entfernt: number }): string {
  return `ADN-Katalog behalten: ${b.nichtGefragt} nicht gefragt, ${b.abbruch} Abbruch, ${b.entfernt} entfernt`
}

/** Grenze der Verwürfe: die Handvoll oder, bei vielen Gefragten, ihr Anteil — was größer ist. */
export function verworfenGrenze(gefragtAnzahl: number): number {
  return Math.max(MAX_VERWORFEN, Math.floor(gefragtAnzahl * ANTEIL_VERWORFEN))
}

/** Schlusszeile des Laufs; `rot` heißt: mehr verworfen als `verworfenGrenze` erlaubt. */
export function riegelBilanz(anzahl: number, gefragtAnzahl = 0): { zeile: string; rot: boolean } {
  const grenze = verworfenGrenze(gefragtAnzahl)
  return {
    zeile: `ADN-Sprachriegel: ${anzahl} Serien wegen französischer Sprachkürzel verworfen (Grenze ${grenze}, ${gefragtAnzahl} gefragt)`,
    rot: anzahl > grenze,
  }
}

/** Wartezeit vor der zweiten Frage bei französischer Sicht (ADN wechselt zeitweise, danach meist wieder in Ordnung). */
export const WIEDERHOLUNG_WARTE_MS = 25_000

type Antwort<T extends MitSprachen> = { videos: T[]; abbruch?: string }

/**
 * Fragt eine Serie; liefert `frage` die französische Sicht (`abbruch: 'franzoesisch'`), wird nach `warte` einmal erneut gefragt. Erst ein
 * zweites Mal Französisch zählt als Verwurf (Bilanz, Fünf-in-Folge-Riegel); die Antwort trägt dann keine Videos.
 */
export async function mitWiederholung<T extends MitSprachen>(showId: number, frage: () => Promise<Antwort<T>>, warte: () => Promise<void>): Promise<Antwort<T>> {
  gefragt.push(showId)
  let antwort = await frage()
  if (antwort.abbruch === 'franzoesisch') {
    console.warn(`⚠  ADN ${showId}: französische Sicht — einmal erneut gefragt.`)
    await warte()
    antwort = await frage()
  }
  if (antwort.abbruch !== 'franzoesisch') return antwort
  verwirfFranzoesische(showId, antwort.videos)
  return { videos: [], abbruch: 'franzoesisch' }
}
