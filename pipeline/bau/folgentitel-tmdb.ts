import type { Title } from '../../shared/types.ts'

/**
 * **Deutsche Folgentitel aus TMDB** — dritte Stufe hinter aniSearch und Crunchyroll, nur für Folgen ohne Titel
 * (Messung 06.10.2026: 193 Folgen in 17 Serien sicher gewinnbar, Bericht in `docs/wissen/folgentitel-quellen.md`).
 * Quelle ist `data/tmdb-folgen.json`; `titel` ist dort deutsch oder, wo TMDB keine Übersetzung hat, englisch — darum trägt
 * der Abruf je Folge auch den englischen Titel (`en`), und ein Titel, der ihm gleicht, gilt als nicht übersetzt.
 */
export interface TmdbFolge {
  s: number
  e: number
  titel: string | null
  en?: string | null
  datum: string | null
}
export interface TmdbEintrag {
  /** Name der Serie bei TMDB, vom Folgen-Abruf mitgeschrieben; sonst gilt `nameDe` aus `tmdb-titles.json`. */
  nameDe?: string
  folgen?: TmdbFolge[]
}

const PLATZHALTER = /^(episode|folge|episod|special|ova)\s*\d*$/i
const FORMATE = new Set(['TV', 'TV_SHORT', 'ONA'])

/** Name ohne Staffelzusatz und Satzzeichen, zum Vergleich. */
export function tmdbName(s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/\b(staffel|season|part|cour)\s*\d+\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

function echterTitel(f: TmdbFolge): string | undefined {
  const t = f.titel?.trim()
  if (!t || PLATZHALTER.test(t) || !f.en || t.toLowerCase() === f.en.trim().toLowerCase()) return undefined
  return t
}

/**
 * Titel je Folgennummer, nur wenn alles zusammenpasst: Format Serie mit mindestens sechs Folgen, Name gleich dem TMDB-Namen,
 * genau eine TMDB-Staffel mit unserer Folgenzahl und unserem Beginnjahr, Nummern 1:1. Sonst `undefined` — keine Nummer wird geraten.
 * Ohne englischen Vergleichstitel (`en`, Abruf noch nicht erneuert) gibt es keinen Titel.
 */
export function tmdbFolgentitel(titel: Title, tmdbNameDe: string | undefined, eintrag: TmdbEintrag | undefined, nummern: number[]): Map<number, string> | undefined {
  if (!eintrag?.folgen || !FORMATE.has(titel.format ?? '') || !titel.episodes || titel.episodes < 6 || !titel.jpYear) return undefined
  /* Auch ohne angehängte Staffelzahl („… II", „… 3"): TMDB führt die Staffeln unter dem Namen der ersten (Landei II, 06.10.2026). */
  const unser = [titel.titleDe, titel.titleEn, titel.titleRomaji].map(tmdbName).flatMap((n) => [n, n.replace(/(?:iii|ii|iv|[2-5])$/, '')])
  const tmdbSerie = eintrag.nameDe ?? tmdbNameDe
  if (!tmdbSerie || !unser.includes(tmdbName(tmdbSerie))) return undefined
  const jeStaffel = new Map<number, TmdbFolge[]>()
  for (const f of eintrag.folgen) if (f.s >= 1) jeStaffel.set(f.s, [...(jeStaffel.get(f.s) ?? []), f])
  const passend = [...jeStaffel.values()].filter((fs) => {
    const jahr = Math.min(...fs.map((f) => Number(f.datum?.slice(0, 4) ?? 9999)))
    return fs.length === titel.episodes && jahr === titel.jpYear
  })
  if (passend.length !== 1) return undefined
  const aus = new Map<number, string>()
  for (const f of passend[0]) {
    const t = echterTitel(f)
    if (t && nummern.includes(f.e)) aus.set(f.e, t)
  }
  return aus.size ? aus : undefined
}
