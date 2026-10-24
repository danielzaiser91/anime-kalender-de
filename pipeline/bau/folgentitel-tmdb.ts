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
  tmdbId?: number
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

/** Unser Name (auch ohne angehängte Staffelzahl „… II", „… 3": TMDB führt die Staffeln unter dem Namen der ersten, Landei II, 06.10.2026) gleich dem TMDB-Namen. */
function serieHeisstGleich(titel: Title, tmdbSerie: string | undefined): boolean {
  const unser = [titel.titleDe, titel.titleEn, titel.titleRomaji].map(tmdbName).flatMap((n) => [n, n.replace(/(?:iii|ii|iv|[2-5])$/, '')])
  return Boolean(tmdbSerie) && unser.includes(tmdbName(tmdbSerie))
}

/** Die TMDB-Staffeln ab 1 (Staffel 0 = Specials fällt weg), Folgen nach Nummer; `undefined` bei Lücke in Staffel- oder Folgennummern. */
function lueckenloseStaffeln(folgen: TmdbFolge[]): TmdbFolge[][] | undefined {
  const jeStaffel = new Map<number, TmdbFolge[]>()
  for (const f of folgen) if (f.s >= 1) jeStaffel.set(f.s, [...(jeStaffel.get(f.s) ?? []), f])
  const staffeln = [...jeStaffel.entries()].sort((a, b) => a[0] - b[0])
  if (!staffeln.length || staffeln.some(([s], i) => s !== i + 1)) return undefined
  const geordnet = staffeln.map(([, fs]) => [...fs].sort((a, b) => a.e - b.e))
  return geordnet.every((fs) => fs.every((f, i) => f.e === i + 1)) ? geordnet : undefined
}

/** Erster Sendetag der Staffel (JJJJ-MM-TT), `undefined` ohne Datum. */
function ersterTag(fs: TmdbFolge[]): string | undefined {
  return fs.map((f) => f.datum).filter((d): d is string => Boolean(d)).sort()[0]
}

/**
 * Langläufer ohne Folgenzahl (Shin-chan, Beyblade X): Die TMDB-Staffeln ab 1 hintereinander gelegt ergeben die durchgehende
 * Nummerierung. Nur wenn unsere Nummern genau 1 bis N sind und N die Summe aller Staffeln ist, Staffel 1 im Beginnjahr
 * anfängt und die Staffeln mit ihrem ersten Sendetag streng aufeinander folgen. Sonst `undefined` — keine Nummer wird geraten.
 */
function absoluteTitel(jpYear: number, folgen: TmdbFolge[], nummern: number[]): Map<number, string> | undefined {
  const staffeln = lueckenloseStaffeln(folgen)
  if (!staffeln) return undefined
  const gesamt = staffeln.reduce((summe, fs) => summe + fs.length, 0)
  const unser = new Set(nummern)
  if (gesamt < 6 || unser.size !== gesamt || nummern.some((n) => n < 1 || n > gesamt)) return undefined
  const tage = staffeln.map(ersterTag)
  if (tage.some((t, i) => !t || (i > 0 && t <= (tage[i - 1] as string)))) return undefined
  if (Number(tage[0]?.slice(0, 4)) !== jpYear) return undefined
  const aus = new Map<number, string>()
  let davor = 0
  for (const fs of staffeln) {
    for (const f of fs) {
      const t = echterTitel(f)
      if (t) aus.set(davor + f.e, t)
    }
    davor += fs.length
  }
  return aus.size ? aus : undefined
}

/**
 * Titel je Folgennummer, nur wenn alles zusammenpasst: Format Serie mit mindestens sechs Folgen, Name gleich dem TMDB-Namen,
 * genau eine TMDB-Staffel mit unserer Folgenzahl und unserem Beginnjahr, Nummern 1:1; ohne Folgenzahl gilt `absoluteTitel`. Sonst `undefined` — keine Nummer wird geraten.
 * Ohne englischen Vergleichstitel (`en`, Abruf noch nicht erneuert) gibt es keinen Titel.
 */
export function tmdbFolgentitel(titel: Title, tmdbNameDe: string | undefined, eintrag: TmdbEintrag | undefined, nummern: number[]): Map<number, string> | undefined {
  if (!eintrag?.folgen || !FORMATE.has(titel.format ?? '') || (titel.episodes ?? 6) < 6 || !titel.jpYear) return undefined
  if (!serieHeisstGleich(titel, eintrag.nameDe ?? tmdbNameDe)) return undefined
  if (!titel.episodes) return absoluteTitel(titel.jpYear, eintrag.folgen, nummern)
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
