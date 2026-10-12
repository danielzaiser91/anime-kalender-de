import { schlicht } from './tmdb-plakat.ts'

/** Ein Treffer aus `/search/multi`, auf das Nötige verkürzt. */
export interface KatalogTreffer {
  art: 'movie' | 'tv'
  id: number
  name?: string
  original?: string
  datum?: string
  genres?: number[]
  sprache?: string
}

/** Was wir vom AniList-Titel brauchen (Namen aus `ohne-synchro.json`, Jahr und Format aus dem Katalogabgleich). */
export interface KatalogTitel {
  id: number
  format: string | null
  jahr: number | null
  en?: string
  romaji?: string
  native?: string
  land?: string
}

export type Stufe = 'sicher' | 'unsicher' | 'kein'

/** Eintrag in `data/tmdb-katalog-zuordnung.json`; bei `kein` fehlen Kennung und Art. */
export interface Zuordnung {
  tmdbId?: number
  art?: 'movie' | 'tv'
  stufe: Stufe
  grund: string
  /** Weitere Kandidaten als `tv/<Kennung>` oder `movie/<Kennung>` (nur bei unsicher). */
  kandidaten?: string[]
  /** `hand`: von Hand abgeglichen (11.10.2026); `stufe` und `grund` sind dann das Urteil, `fetch-tmdb-katalog.ts` sucht den Titel nicht neu. */
  von?: 'hand'
  /** Belege eines von Hand bestätigten Eintrags; `lib/tmdb-katalog-hand.ts` prüft sie. */
  beleg?: HandBeleg
}

/** Ausnahmen von der Regel, die ein Handurteil nennen muss: Genre (leer, Studio, Schlagwort), Jahr (fehlt, Folgen+Laufzeit, Kurzfilm, Studio), Land, Folgenzahl (TMDB unvollständig). */
export type Ausnahme = 'genre-leer' | 'genre-studio' | 'schlagwort' | 'jahr-fehlt' | 'jahr-folgen-lauf' | 'jahr-kurzfilm' | 'jahr-studio' | 'land-abweichend' | 'folgen-luecke'

/** Merkmale des gewählten TMDB-Werks: Genre-Kennungen, Jahr (AniList, TMDB), Art des Namens (Originalschrift oder lateinisch). */
export interface HandBeleg {
  /** Kennung des Werks, dessen Merkmale hier stehen (`tv/123`); muss zum Eintrag passen. */
  tmdb: string
  genres: number[]
  jahr: [number | null, number | null]
  name: 'original' | 'latein'
  ausnahme?: Ausnahme[]
}

const ANIMATION = 16
const ASIEN = new Set(['ja', 'zh', 'cn', 'ko'])

/** Passt die TMDB-Art zum AniList-Format? ONA/OVA/SPECIAL gibt es bei TMDB als Film und als Serie. */
const artOk = (format: string | null, art: string): boolean => (format === 'MOVIE' ? art === 'movie' : format === 'TV' || format === 'TV_SHORT' ? art === 'tv' : true)

/** Ein „Originalname“ in lateinischen Buchstaben ist meist nur Romaji (Her, NOISE, mine) und beweist nichts; nur andere Schrift zählt als Originalname. */
const hatNichtLatein = (name?: string): boolean => /[^\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}]/u.test(name ?? '')

/** Namen in Suchreihenfolge: bei chinesischen und koreanischen Titeln zuerst der Originalname, sonst englisch, romaji, Original. */
export function suchNamen(t: KatalogTitel): string[] {
  const nativeZuerst = t.land === 'CN' || t.land === 'KR'
  const reihe = nativeZuerst ? [t.native, t.en, t.romaji] : [t.en, t.romaji, t.native]
  return [...new Set(reihe.filter((n): n is string => Boolean(n)))]
}

type Pruefung = { treffer: KatalogTreffer; nativeGleich: boolean; fest: boolean; grund: string }

function pruefeTreffer(t: KatalogTitel, r: KatalogTreffer, latein: Set<string>, native: string): Pruefung | undefined {
  const namen = [r.name, r.original].map((n) => schlicht(n ?? '')).filter(Boolean)
  const nativeGleich = Boolean(native) && namen.includes(native)
  if (!nativeGleich && !namen.some((n) => latein.has(n))) return undefined
  const jahr = r.datum ? Number(r.datum.slice(0, 4)) : 0
  const abstand = jahr && t.jahr ? Math.abs(jahr - t.jahr) : null
  const animation = (r.genres ?? []).includes(ANIMATION)
  const asiatisch = ASIEN.has(r.sprache ?? '')
  const fest = abstand !== null && abstand <= 1 && artOk(t.format, r.art) && animation && (nativeGleich || asiatisch)
  if (fest) return { treffer: r, nativeGleich, fest, grund: nativeGleich ? 'Originalname gleich, Jahr ±1, Art passt' : 'Name gleich, Animation, Originalsprache asiatisch, Jahr ±1, Art passt' }
  const grund = !r.datum ? 'TMDB ohne Datum' : abstand === null ? 'unser Jahr fehlt' : abstand > 1 ? `Jahr weicht ab (TMDB ${jahr}, bei uns ${t.jahr})` : !artOk(t.format, r.art) ? `Art passt nicht (TMDB ${r.art}, bei uns ${t.format})` : 'Name gleich, aber kein Animationswerk aus Asien'
  return { treffer: r, nativeGleich, fest, grund }
}

/**
 * Die Regel aus der Probe vom 11.10.2026 (100 Titel, an Hand geeicht): **sicher** heißt Jahr ±1 (beide Seiten bekannt), Art passt und entweder
 * Genre Animation und entweder der Originalname (nicht-lateinische Schrift) gleich oder ein lateinischer Name (auch ein lateinisch geschriebener „Originalname“) gleich mit Originalsprache ja/zh/ko, dazu genau ein solches Werk.
 * Name gleich, aber etwas davon nicht belegt (oder mehrere Werke) ist **unsicher**; kein Werk gleichen Namens ist **kein**.
 */
export function urteilKatalog(t: KatalogTitel, ergebnisse: KatalogTreffer[]): Zuordnung {
  const nativeNichtLatein = hatNichtLatein(t.native)
  const lateinNamen = [t.en, t.romaji, nativeNichtLatein ? undefined : t.native]
  const latein = new Set(lateinNamen.filter((n): n is string => Boolean(n)).map(schlicht))
  const native = nativeNichtLatein ? schlicht(t.native ?? '') : ''
  const gesehen = new Set<string>()
  const pruefungen: Pruefung[] = []
  for (const r of ergebnisse) {
    const schluessel = `${r.art}/${r.id}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    const p = pruefeTreffer(t, r, latein, native)
    if (p) pruefungen.push(p)
  }
  const feste = pruefungen.filter((p) => p.fest)
  const bezug = (p: Pruefung): Pick<Zuordnung, 'tmdbId' | 'art'> => ({ tmdbId: p.treffer.id, art: p.treffer.art })
  if (feste.length === 1) return { ...bezug(feste[0]!), stufe: 'sicher', grund: feste[0]!.grund }
  const lose = feste.length ? feste : pruefungen
  if (!lose.length) return { stufe: 'kein', grund: 'kein Werk gleichen Namens' }
  const grund = feste.length ? 'mehrere Werke passen' : lose[0]!.grund
  const kandidaten = lose.slice(1, 5).map((p) => `${p.treffer.art}/${p.treffer.id}`)
  return { ...bezug(lose[0]!), stufe: 'unsicher', grund, ...(kandidaten.length ? { kandidaten } : {}) }
}
