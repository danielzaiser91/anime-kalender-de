/** Reine Teile von `pipeline/fetch-cr-katalog.mjs` (Abruf und Schreiben bleiben im Skript). */
import { normSchluessel } from './util.ts'

type Lose = Record<string, any>

/**
 * Ein Katalogeintrag; `typ` ist `film` nur im `movie_listing`-Durchlauf (`it.type` sagt immer `series`, gemessen 09.09.2026).
 * Der Slug ist der Schlüssel, den unsere Adressen mitbringen; er sagt, welche Serie gemeint ist, nicht ob ein Nebenwerk dazugehört.
 */
export function katalogEintrag(it: Lose, durchlauf: string): Lose {
  const md = it.movie_listing_metadata ?? it.series_metadata ?? {}
  return {
    id: it.id,
    typ: durchlauf === 'movie_listing' ? 'film' : 'serie',
    titel: it.title,
    slug: it.slug_title ?? null,
    beschreibung: (it.description ?? '').slice(0, 300),
    audio: md.audio_locales ?? (md.audio_locale ? [md.audio_locale] : []),
    untertitel: md.subtitle_locales ?? [],
    folgen: md.episode_count ?? null,
    staffeln: md.season_count ?? null,
    jahr: md.series_launch_year ?? md.movie_release_year ?? null,
  }
}

/** Alle Crunchyroll-Wege ohne Urteil. */
export function offeneVerweise(titles: Lose[]): Lose[] {
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes })
    }
  }
  return offen
}

/** Name UND Folgenzahl: nur ein eindeutig bester Katalogtreffer wird zugeordnet. */
export function ordneZu(offen: Lose[], alle: Lose[]): Lose[] {
  const zuordnung: Lose[] = []
  for (const o of offen) {
    const namen = [o.titel, o.en, o.romaji].filter(Boolean).map(normSchluessel)
    const kandidaten = alle
      .map((k) => {
        const kn = normSchluessel(k.titel)
        const exakt = namen.includes(kn)
        const teil = kn.length >= 6 && !exakt && namen.some((n) => n.includes(kn))
        if (!exakt && !teil) return null
        const folgenPasst =
          (o.folgen && k.folgen === o.folgen) ||
          (o.format === 'MOVIE' && o.folgen === 1 && (k.folgen === 0 || k.folgen === 1))
        if (!folgenPasst) return null
        return { ...k, punkte: exakt ? 5 : 3, art: exakt ? 'Name exakt' : 'Katalogtitel steckt in unserem' }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.punkte - a.punkte)
    const [a, b] = kandidaten as Lose[]
    if (!a || (b && b.punkte === a.punkte)) continue
    zuordnung.push({ id: o.id, unser: o.titel ?? o.en, katalogId: a.id, katalogTitel: a.titel, audio: a.audio, art: a.art, folgen: a.folgen })
  }
  return zuordnung
}
