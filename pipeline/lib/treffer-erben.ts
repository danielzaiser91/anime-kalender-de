import { readJson, log } from './util.ts'
/**
 * **Ein Special erbt den Serien-Treffer nicht.** TMDB und JustWatch führen Specials, OVAs und ONAs oft unter der Hauptserie;
 * unser Titel bekäme deren Verweise (Netflix-Pille, Beschreibung, FSK) und behauptete damit etwas über Folgen, die dort nicht
 * liegen (Daniel, 04.10.2026; Messung 06.10.2026: 46 Titel, Beispiel „Kakegurui Picture Drama" an der Real-Serie).
 * Rein, ohne Node-APIs; der Bau ruft `gesperrteSerienTreffer` in `bau/01-quellen.ts`.
 */
export interface TrefferAngabe {
  art: 'serie' | 'film'
  /** Normalisierte Namen des Treffers (TMDB `nameDe`, JustWatch-Pfad). */
  namen: string[]
  /** Folgenzahlen laut `tmdb-folgen.json` (Staffel 0 nicht gezählt): je Staffel und gesamt. */
  folgen: number[]
  /** Ein TV/TV_SHORT-Titel unseres Bestands trägt denselben Treffer. */
  teiltMitSerie: boolean
}
export interface TitelAngabe {
  format: string | null
  episodes: number | null
  /** Normalisierte englische und romaji-Namen — nicht der deutsche, der oft selbst aus dem Treffer stammt. */
  namen: string[]
}

const KURZFORMEN = ['SPECIAL', 'OVA', 'ONA', 'MUSIC']

export function normalisiereName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Darf dieser Titel den Serien-Treffer von JustWatch/TMDB erben? */
export function darfTrefferErben(titel: TitelAngabe, treffer: TrefferAngabe): boolean {
  if (!KURZFORMEN.includes(titel.format ?? '') || treffer.art !== 'serie') return true
  if (titel.namen.some((n) => n && treffer.namen.includes(n))) return true
  if (titel.episodes !== null && treffer.folgen.includes(titel.episodes)) return true
  return !treffer.teiltMitSerie && titel.format !== 'SPECIAL'
}

export interface MedienAngabe {
  id: number
  format: string | null
  episodes: number | null
  title: { romaji: string | null; english: string | null }
}
type TmdbEintrag = { tmdbId?: number; kind?: 'tv' | 'movie'; nameDe?: string }
type JustwatchEintrag = { jwId?: string; jwPfad?: string }

function folgenzahlen(f: { s: number }[] | undefined): number[] {
  const je = new Map<number, number>()
  for (const x of f ?? []) if (x.s >= 1) je.set(x.s, (je.get(x.s) ?? 0) + 1)
  const alle = [...je.values()]
  return alle.length ? [...alle, alle.reduce((a, b) => a + b, 0)] : []
}

/** Titel-IDs, die weder bei TMDB noch bei JustWatch einen erbberechtigten Treffer haben, obwohl sie einen Serientreffer tragen. */
export function gesperrteSerienTreffer(a: {
  medien: MedienAngabe[]
  tmdbTitles: Record<string, TmdbEintrag>
  justwatch: Record<string, JustwatchEintrag>
  tmdbFolgen: Record<string, { folgen?: { s: number }[] }>
}): Set<string> {
  const serienFormen = new Set(['TV', 'TV_SHORT'])
  const mitSerie = (schluessel: (id: string) => string | undefined, medium: MedienAngabe): boolean => {
    const mein = schluessel(String(medium.id))
    return !!mein && a.medien.some((m) => m.id !== medium.id && serienFormen.has(m.format ?? '') && schluessel(String(m.id)) === mein)
  }
  const tmdbSchluessel = (id: string) => (a.tmdbTitles[id]?.tmdbId ? `${a.tmdbTitles[id]?.kind}${a.tmdbTitles[id]?.tmdbId}` : undefined)
  const jwSchluessel = (id: string) => a.justwatch[id]?.jwId
  const gesperrt = new Set<string>()
  for (const m of a.medien) {
    if (!KURZFORMEN.includes(m.format ?? '')) continue
    const id = String(m.id)
    const titel: TitelAngabe = { format: m.format, episodes: m.episodes, namen: [normalisiereName(m.title.english), normalisiereName(m.title.romaji)] }
    const treffer: TrefferAngabe[] = []
    const t = a.tmdbTitles[id]
    if (t?.tmdbId && t.kind) treffer.push({ art: t.kind === 'tv' ? 'serie' : 'film', namen: [normalisiereName(t.nameDe)], folgen: folgenzahlen(a.tmdbFolgen[id]?.folgen), teiltMitSerie: mitSerie(tmdbSchluessel, m) })
    const j = a.justwatch[id]
    if (j?.jwId && j.jwPfad) treffer.push({ art: j.jwPfad.includes('/Serie/') ? 'serie' : 'film', namen: [normalisiereName(j.jwPfad.split('/').pop())], folgen: [], teiltMitSerie: mitSerie(jwSchluessel, m) })
    if (treffer.some((x) => x.art === 'serie') && treffer.every((x) => !darfTrefferErben(titel, x))) gesperrt.add(id)
  }
  return gesperrt
}

/** Für den Bau: sperrt die Serien-Treffer der Kurzformen — sie fallen aus `tmdbTitles` und zählen wie mehrdeutige Filme. */
export function sperreSerienTreffer(medien: Record<string, MedienAngabe>[], tmdbTitles: Record<string, TmdbEintrag>, mehrdeutig: Set<string>): void {
  const je = new Map<number, MedienAngabe>()
  for (const quelle of medien) for (const m of Object.values(quelle)) je.set(m.id, m)
  const gesperrt = gesperrteSerienTreffer({
    medien: [...je.values()],
    tmdbTitles,
    justwatch: readJson('data/justwatch-audio.json', {}),
    tmdbFolgen: readJson('data/tmdb-folgen.json', {}),
  })
  for (const id of gesperrt) { mehrdeutig.add(id); delete tmdbTitles[id] }
  if (gesperrt.size) log(`${gesperrt.size} Specials/OVAs/ONAs erben keinen Serien-Treffer (JustWatch/TMDB)`)
}
