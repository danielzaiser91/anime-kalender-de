import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { Title } from '../../shared/types.ts'
import { extractInfo } from '../fetch-anisearch.ts'
import { ARCHIV_SEITEN } from '../lib/anisearch-relationen.ts'
import { log } from '../lib/util.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'
import { studioName, studiosGleich } from './anisearch-spalte.ts'

/** So viele Studios führt auch AniList höchstens (`titleFromMedia`). */
const MAX_STUDIOS = 3

/**
 * **Das Studio aus der archivierten aniSearch-Seite** (`data/anisearch-raw/<Kennung>.html.gz`, kein Abruf). aniSearch kennt nur das Feld „Studio" (Reihenfolge der Seite),
 * keine Rollen wie Animation oder Produktion; ein Name mit Komma („Co., Ltd.") steht im Link und bleibt ganz.
 */
export function archivStudios(anisearchId: number, dir = ARCHIV_SEITEN): string[] {
  const pfad = `${dir}/${anisearchId}.html.gz`
  if (!existsSync(pfad)) return []
  return extractInfo(gunzipSync(readFileSync(pfad)).toString('utf8'))?.studios ?? []
}

/**
 * Schreibweise je Studio, wie AniList sie führt („TMS Entertainment" statt „TMS Entertainment Co., Ltd."), gefunden über denselben Schlüssel wie der Spaltenvergleich
 * (`studioName`: ohne Rechtsform und Satzzeichen). Mehrere Schreibweisen desselben Schlüssels: die häufigste. Katalogtitel zählen nicht, sie tragen aniSearchs eigene Schreibweise.
 */
export function anilistSchreibweisen(titles: Iterable<Title>): Map<string, string> {
  const zaehler = new Map<string, Map<string, number>>()
  for (const t of titles) {
    if (t.id >= ANISEARCH_ID_BASIS) continue
    for (const name of t.studios ?? []) {
      const schluessel = studioName(name)
      if (!schluessel) continue
      const jeName = zaehler.get(schluessel) ?? new Map<string, number>()
      zaehler.set(schluessel, jeName.set(name, (jeName.get(name) ?? 0) + 1))
    }
  }
  return new Map([...zaehler].map(([schluessel, jeName]) => [schluessel, [...jeName].sort((a, b) => b[1] - a[1])[0]![0]]))
}

/** Rechtsform am Ende („, Inc.", „Co., Ltd."), wie AniList sie nicht führt. „Corporation" bleibt: Es gehört bei „ICHI Corporation" zum Namen. */
const RECHTSFORM = /(?:,\s*|\s+)(?:Co\.?\s*,?\s*Ltd\.?|Inc\.?|Ltd\.?|Corp\.?|K\.K\.?|LLC|Co\.)\s*$/i

/** Die Studios einer Seite in der Schreibweise des Bestands (sonst ohne Rechtsform), ohne Doppelte, höchstens drei. */
export function studiosInBestandsschreibweise(namen: string[], schreibweisen: Map<string, string>): string[] {
  const ohneRechtsform = (n: string): string => n.replace(RECHTSFORM, '').trim()
  return [...new Set(namen.map((n) => schreibweisen.get(studioName(n)) ?? ohneRechtsform(n)))].slice(0, MAX_STUDIOS)
}

/**
 * Eine Seite, die mehrere Titel teilen, gilt nur, wenn ihr Studio den Studios nicht widerspricht, die AniList den anderen Titeln der Seite nennt (Persona 3, Seite 7939: Teil 1
 * AIC A.S.T.A., Teile 2 bis 4 A-1 Pictures, also kein Studio für das ganze Werk). Nennt keiner der anderen eines (Princess Principal Crown Handler Kapitel 5 und 6), ist nichts widersprochen.
 */
export function seiteEindeutig(geschwister: Title[], seitenStudios: string[]): boolean {
  const mengen = [...geschwister.map((t) => t.studios ?? []).filter((s) => s.length), seitenStudios]
  return mengen.every((a) => mengen.every((b) => studiosGleich(a, b)))
}

/**
 * Titel ohne Studio (AniList nennt keines) bekommen das der archivierten aniSearch-Seite ihrer Kennung, soweit die Seite eindeutig ist (`seiteEindeutig`). Ein vorhandenes Studio
 * wird nie ersetzt. Muss vor `slim` (13-2) laufen und nach `baueTitelGemessen`, damit der Spaltenvergleich AniList unverfälscht sieht. Die Kennungen kommen aus dem ganzen Bestand:
 * `anisearchKennungen` vergibt MAL-Brücken nur an freie Seiten. Rückgabe: Zahl der ergänzten Titel.
 */
export function ergaenzeStudiosAusArchiv(
  titles: Map<number, Title>,
  dir = ARCHIV_SEITEN,
  kennungen = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId }))),
): number {
  const jeSeite = new Map<number, Title[]>()
  for (const t of titles.values()) {
    const seite = kennungen.get(t.id)
    if (seite !== undefined) jeSeite.set(seite, [...(jeSeite.get(seite) ?? []), t])
  }
  const ohne = [...titles.values()].filter((t) => !t.studios?.length)
  const schreibweisen = anilistSchreibweisen(titles.values())
  let ergaenzt = 0
  for (const t of ohne) {
    const seite = kennungen.get(t.id)
    const namen = seite === undefined ? [] : studiosInBestandsschreibweise(archivStudios(seite, dir), schreibweisen)
    if (!namen.length || !seiteEindeutig(jeSeite.get(seite!)!.filter((x) => x !== t), namen)) continue
    t.studios = namen
    ergaenzt++
  }
  if (ergaenzt) log(`${ergaenzt} von ${ohne.length} Titeln ohne Studio bekommen es aus dem aniSearch-Archiv`)
  return ergaenzt
}
