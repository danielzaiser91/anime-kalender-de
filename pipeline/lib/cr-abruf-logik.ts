/**
 * Reine Logik der Crunchyroll-Abrufskripte `fetch-cr-einzelwerke/-katalog/-filmbloecke.mjs`:
 * Antworten zerlegen, zuordnen, Ergebnis formen. Die Skripte behalten Abruf und Dateischreiben.
 * Ausgabe gleich wie vorher (Beleg: `pipeline/check-cr-abruf-logik.ts`).
 */
import { kennwort } from './cr-kennwort.ts'
import { katalogTrefferPasst } from './cr-einzelwerk-urteil.ts'
import { normSchluessel } from './util.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Lose = any

/** Sprachen einer Katalog-Metadatenzeile (`audio_locales` vor `audio_locale`). */
export function audioVon(md: Lose): string[] {
  return md.audio_locales ?? (md.audio_locale ? [md.audio_locale] : [])
}

/** Crunchyroll-Wege ohne Urteil (`dub`), die auf keine Serienkennung zeigen. */
export function offeneOhneSerienkennung(titles: Lose[], cr: Lose): Lose[] {
  const nachUrl = new Map(cr.serien.map((s: Lose) => [s.url, s]))
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      const serie: Lose = nachUrl.get(s.url)
      if (serie?.seriesId) continue
      offen.push({ id: x.id, titel: x.titleDe ?? x.titleEn, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes, url: s.url })
    }
  }
  return offen
}

/** Erster passender Eintrag einer Suchantwort (`data` = Gruppen mit `items`), sonst null. */
export function ersterEinzelwerkTreffer(gruppen: Lose[], namen: string[]): Lose | null {
  for (const gruppe of gruppen ?? []) {
    for (const it of gruppe.items ?? []) {
      const { passt, exakt } = katalogTrefferPasst(it, namen)
      if (!passt) continue
      return { id: it.id, typ: gruppe.type ?? it.type, art: it.type, exakt, titel: it.title, meta: it.movie_listing_metadata ?? it.series_metadata ?? it.movie_metadata ?? {} }
    }
  }
  return null
}

/** Eintrag für `data/cr-einzelwerke.json`. */
export function einzelwerkFund(o: Lose, treffer: Lose | null): Lose {
  const audio = treffer ? audioVon(treffer.meta) : []
  return { ...o, treffer: treffer ? { id: treffer.id, typ: treffer.typ, art: treffer.art, exakt: treffer.exakt, titel: treffer.titel, audio } : null }
}

/** Katalogzeile aus `discover/browse`; `typ` ist der Durchlauf ('' = Serien, 'movie_listing' = Filme). */
export function katalogEintrag(it: Lose, typ: string): Lose {
  const md = it.movie_listing_metadata ?? it.series_metadata ?? {}
  return {
    id: it.id,
    typ: typ === 'movie_listing' ? 'film' : 'serie',
    titel: it.title,
    slug: it.slug_title ?? null,
    beschreibung: (it.description ?? '').slice(0, 300),
    audio: audioVon(md),
    untertitel: md.subtitle_locales ?? [],
    folgen: md.episode_count ?? null,
    staffeln: md.season_count ?? null,
    jahr: md.series_launch_year ?? md.movie_release_year ?? null,
  }
}

/** Crunchyroll-Wege ohne Urteil (alle, auch mit Serienkennung). */
export function offeneOhneUrteil(titles: Lose[]): Lose[] {
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, folgen: x.episodes })
    }
  }
  return offen
}

/** Name UND Folgenzahl: nur ein eindeutig bester Katalogtreffer ordnet zu. */
export function katalogZuordnung(offen: Lose[], alle: Lose[]): Lose[] {
  const zuordnung: Lose[] = []
  for (const o of offen) {
    const namen = [o.titel, o.en, o.romaji].filter(Boolean).map(normSchluessel)
    const kandidaten = alle
      .map((k) => {
        const kn = normSchluessel(k.titel)
        const exakt = namen.includes(kn)
        const teil = kn.length >= 6 && !exakt && namen.some((n) => n.includes(kn))
        if (!exakt && !teil) return null
        const folgenPasst = (o.folgen && k.folgen === o.folgen) || (o.format === 'MOVIE' && o.folgen === 1 && (k.folgen === 0 || k.folgen === 1))
        if (!folgenPasst) return null
        return { ...k, punkte: exakt ? 5 : 3, art: exakt ? 'Name exakt' : 'Katalogtitel steckt in unserem' }
      })
      .filter(Boolean)
      .sort((a: Lose, b: Lose) => b.punkte - a.punkte)
    const [a, b] = kandidaten as Lose[]
    if (!a || (b && b.punkte === a.punkte)) continue
    zuordnung.push({ id: o.id, unser: o.titel ?? o.en, katalogId: a.id, katalogTitel: a.titel, audio: a.audio, art: a.art, folgen: a.folgen })
  }
  return zuordnung
}

/** Offene Filme/OVAs/Specials (keine TV/ONA) samt eigener Serienzeile. */
export function offeneFilmbloecke(titles: Lose[], cr: Lose): Lose[] {
  const nachUrl = new Map(cr.serien.map((s: Lose) => [s.url, s]))
  const offen: Lose[] = []
  for (const x of titles) {
    for (const s of x.streams ?? []) {
      if (s.platform !== 'crunchyroll' || s.dub !== undefined) continue
      if (x.format === 'TV' || x.format === 'ONA') continue
      offen.push({ id: x.id, titel: x.titleDe, en: x.titleEn, romaji: x.titleRomaji, format: x.format, jahr: x.jpYear, url: s.url, serie: nachUrl.get(s.url) })
    }
  }
  return offen
}

/** Reihenname vor dem ersten Trenner (` - `, ` : `, `:`). */
export function reiheVon(o: Lose): string {
  return (o.titel ?? o.en ?? '').split(/\s[-–—:]\s|\s*:\s*/)[0]
}

/** Serien-IDs einer Suchantwort, deren Titel die Reihe enthält. */
export function serienIdsAusSuche(antwort: Lose, reihe: string): string[] {
  const ids: string[] = []
  for (const it of (antwort?.data ?? []).flatMap((g: Lose) => g.items ?? [])) {
    if (normSchluessel(it.title).includes(normSchluessel(reihe))) ids.push(it.id)
  }
  return ids
}

/** Erster Block, dessen Titel exakt oder über das Kennwort zu einem unserer Namen passt. */
export function passenderBlock(bloecke: Lose[], namen: string[], serienId: string): Lose | null {
  for (const b of bloecke) {
    const bn = normSchluessel(b.titel)
    const passt = namen.some((n) => normSchluessel(n) === bn) || namen.some((n) => bn.includes(kennwort(n)) && kennwort(n).length >= 6)
    if (!passt) continue
    return { serienId, blockId: b.id, blockTitel: b.titel, audio: b.audio }
  }
  return null
}

/** Dritter Weg: die OVA als Folge einer Serie (Serienname UND Kennwort im Episodentitel). */
export function episodenTreffer(antwort: Lose, namen: string[], reihe: string): Lose | null {
  for (const it of (antwort?.data ?? []).flatMap((g: Lose) => g.items ?? [])) {
    const md = it.episode_metadata ?? {}
    const serieOk = normSchluessel(md.series_title ?? '').includes(normSchluessel(reihe)) || normSchluessel(reihe).includes(normSchluessel(md.series_title ?? ''))
    const kw = namen.map(kennwort).find((k) => k.length >= 6 && normSchluessel(it.title).includes(k))
    if (!serieOk || !kw) continue
    const versionen = (md.versions ?? []).map((v: Lose) => v.audio_locale).filter(Boolean)
    if (!versionen.length) continue
    return { serienId: md.series_id ?? null, blockId: it.id, blockTitel: `Folge „${it.title}" in ${md.series_title}`, audio: versionen }
  }
  return null
}

/** Führt neue Funde in die alten ein; ein Schweigen überschreibt keinen alten Treffer. */
export function filmbloeckeZusammen(vorher: Lose, funde: Lose[]): { gesamt: Lose[]; neuDazu: number; ersetzt: number; behalten: number } {
  const zusammen = new Map<number, Lose>()
  for (const f of Array.isArray(vorher) ? vorher : []) if (f?.id != null) zusammen.set(f.id, f)
  let ersetzt = 0
  let neuDazu = 0
  let behalten = 0
  for (const f of funde) {
    if (f?.id == null) continue
    const alt = zusammen.get(f.id)
    if (alt?.treffer && !f.treffer) {
      behalten++
      continue
    }
    if (alt) ersetzt++
    else neuDazu++
    zusammen.set(f.id, f)
  }
  const gesamt = [...zusammen.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  return { gesamt, neuDazu, ersetzt, behalten }
}
