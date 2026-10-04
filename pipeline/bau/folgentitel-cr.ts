import { existsSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { Title } from '../../shared/types.ts'

/**
 * **Deutsche Folgentitel aus Crunchyroll** (Daniel, 04.10.2026: aniSearch hat für viele Serien keine; Quellenvergleich in
 * `docs/wissen/folgentitel-quellen.md`). Die Antworten der deutschen Crunchyroll-Schnittstelle liegen archiviert in
 * `data/crunchyroll-raw/<Serienkennung>.de.json.gz`; jede Folge trägt dort ihren `title` in der Sprache des Katalogs, und die
 * `versions` nennen die Kennung (`guid`) jeder Sprachfassung — dieselbe Kennung, die `crunchyroll-dub.json` je deutscher Folge führt.
 * Es kommt also **kein zusätzlicher Abruf** hinzu.
 */
export interface CrSerie {
  seriesId?: string
  staffeln?: { deutscheFolgen?: { nummer?: number; guid?: string }[] }[]
}
interface ArchivFolge {
  id?: string
  title?: string
  versions?: { guid?: string }[]
}
export interface CrArchiv {
  episodes?: Record<string, { items?: ArchivFolge[] }>
}

/** „Episode 1" ist kein Titel: Crunchyroll trägt sie, wo noch keiner übersetzt ist (Tomb Raider King, 04.10.2026). */
const PLATZHALTER = /^(folge|episode|ep\.?)\s*\d+$/i

/** Kennung (Hauptfolge und jede Sprachfassung) → Titel der Folge. */
export function titelJeKennung(archiv: CrArchiv): Map<string, string> {
  const je = new Map<string, string>()
  for (const staffel of Object.values(archiv.episodes ?? {}))
    for (const f of staffel.items ?? []) {
      const titel = f.title?.trim()
      if (!titel || PLATZHALTER.test(titel)) continue
      if (f.id) je.set(f.id, titel)
      for (const v of f.versions ?? []) if (v.guid) je.set(v.guid, titel)
    }
  return je
}

/**
 * Titel je Folgennummer für einen Titel, dessen Crunchyroll-Verweis **nur ihm** gehört. Die Nummern sind dieselben wie die der Synchro-Bereiche
 * (`bau/09-7`: eindeutig, keine über der Folgenzahl); wo das nicht aufgeht, gibt es nichts — keine Nummer wird geraten.
 */
export function crFolgentitel(titel: Title, serie: CrSerie | undefined, archiv: CrArchiv | undefined): Map<number, string> | undefined {
  const weg = titel.streams.find((s) => s.platform === 'crunchyroll')
  if (!weg || weg.sharedWith || !serie || !archiv || !titel.episodes) return undefined
  const folgen = (serie.staffeln ?? []).flatMap((st) => st.deutscheFolgen ?? [])
  const nummern = folgen.map((f) => f.nummer).filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
  if (!nummern.length || new Set(nummern).size !== nummern.length || Math.max(...nummern) > titel.episodes) return undefined
  const je = titelJeKennung(archiv)
  const aus = new Map<number, string>()
  for (const f of folgen) {
    const t = f.guid ? je.get(f.guid) : undefined
    if (t && f.nummer) aus.set(f.nummer, t)
  }
  return aus.size ? aus : undefined
}

/** Das gepackte Archiv einer Serie, falls vorhanden. */
export function ladeCrArchiv(seriesId: string | undefined, ordner = 'data/crunchyroll-raw'): CrArchiv | undefined {
  const pfad = `${ordner}/${seriesId}.de.json.gz`
  if (!seriesId || !existsSync(pfad)) return undefined
  try {
    return JSON.parse(gunzipSync(readFileSync(pfad)).toString('utf8')) as CrArchiv
  } catch {
    return undefined
  }
}

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

/**
 * Die Liste aus aniSearch, wo sie keinen Titel hat, mit den Titeln aus Crunchyroll gefüllt; fehlt die Liste ganz, entsteht sie aus Crunchyroll
 * (mindestens zwei Folgen). Ein vorhandener Titel wird nie überschrieben.
 */
export function mitCrTiteln(f: Folge[] | undefined, cr: Map<number, string> | undefined): Folge[] | undefined {
  if (!cr) return f
  if (!f || f.length < 2) return cr.size >= 2 ? [...cr].sort((a, b) => a[0] - b[0]).map(([nr, de]) => ({ nr, de })) : f
  return f.map((x) => (x.de ?? x.en ?? x.ja ? x : cr.has(x.nr) ? { ...x, de: cr.get(x.nr) } : x))
}
