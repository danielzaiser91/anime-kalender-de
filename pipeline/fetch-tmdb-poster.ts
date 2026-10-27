/**
 * Das größte brauchbare Plakat je Titel — von TMDB.
 *
 * **Warum.** AniList liefert höchstens 460 × 644 Pixel (`large`), 551 Titel nur 230 px. Im vergrößerten Cover (Klick aufs Cover im
 * Panel) wirkte das auf einem Full-HD-Schirm unscharf (Daniel, 07.10.2026, „Rascal Does Not Dream of a Dear Friend"). TMDB führt
 * dasselbe Plakat in mehreren Größen (w500, w780, original bis 2000 × 3000) und meist mehrere Fassungen je Titel.
 *
 * **Auswahl.** Aus `/images` zählen nur Hochformate (Seitenverhältnis 0,64–0,76, wie das AniList-Cover). Bevorzugt wird die deutsche
 * Fassung, dann englisch, dann ohne Schrift, zuletzt japanisch (seit 27.10.2026, vorher umgekehrt); innerhalb einer Sprache das breiteste.
 * Gespeichert wird nur Pfad, Breite und Höhe — die Seite lädt die Größe, die sie braucht (`image.tmdb.org/t/p/<w500|w780>`).
 *
 * **Grenzen.** Die Zuordnung Titel → TMDB-Kennung kommt aus `data/tmdb-titles.json` (geprüft im Bau der Folgentitel). Wo sie fehlt oder das
 * größte Plakat unter `MIN_BREITE` liegt, bekommt der Titel keinen Eintrag; die Liste dazu schreibt der Bau (Monitor).
 *
 * Im selben Lauf holt `holeBanner` das Hintergrundbild je Titel (`lib/tmdb-banner-abruf.ts`, `data/tmdb-banner.json`).
 *
 * Aufruf: `npx tsx pipeline/fetch-tmdb-poster.ts [--limit N] [--katalog N] [--alle]`
 */
import { fetchJson, loadEnv, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'
import { passtFilm, waehlePlakat, type TmdbBild } from './lib/tmdb-plakat.ts'
import { GRUND_DATEI, plakatEintrag, plakatSuche, type GrundBestand, type PlakatBestand } from './lib/tmdb-plakat-suche.ts'
import { schreibeCoverListe } from './lib/cover-liste.ts'
import { waehleStaffel, type TmdbStaffel } from './lib/tmdb-staffel.ts'
import { bilderAbzufragen, FRIST_TAGE, streicheBilderUeberFrist } from './lib/tmdb-ablauf.ts'
import { holeBanner } from './lib/tmdb-banner-abruf.ts'
import { holeStaffel0 } from './lib/tmdb-staffel0-abruf.ts'

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const ALLE = process.argv.includes('--alle')
/** Titel ohne TMDB-Plakat (erst ohne jedes Cover, dann Hauptbestand und Katalog), die je Lauf gesucht werden: ein Block von rund 12 Minuten, der Rest kommt im nächsten Lauf. */
const KATALOG = Number(process.argv[process.argv.indexOf('--katalog') + 1]) || 600

/**
 * **Filme ohne TMDB-Zuordnung** (Daniel, 07.10.2026, „Rascal Does Not Dream of a Dear Friend": der Kinofilm stand nicht in `tmdb-titles.json`).
 * Gesucht wird nach unseren Namen und dem Jahr; angenommen wird nur ein Treffer, dessen Name und Jahr passen (`passtFilm`) — sonst keiner.
 * Serien-Staffeln bleiben beim AniList-Cover, bis eine Zuordnung je Staffel besteht (`docs/wissen/quellen.md`).
 */
async function filmeSuchen(
  apiKey: string,
  zuordnung: Record<string, { tmdbId?: number }>,
  bestand: PlakatBestand,
): Promise<number> {
  const filme = readJson<Title[]>('public/data/titles.json', []).filter(
    (t) => t.format === 'MOVIE' && !zuordnung[String(t.id)]?.tmdbId && !(String(t.id) in bestand),
  )
  let gefunden = 0
  for (const t of filme) {
    try {
      let treffer: { id: number } | undefined
      for (const name of [t.titleEn, t.titleRomaji].filter((n): n is string => Boolean(n))) {
        const such = await fetchJson<{ results?: { id: number; title?: string; original_title?: string; release_date?: string }[] }>(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(name)}&api_key=${apiKey}`,
        )
        treffer = (such.results ?? []).slice(0, 5).find((r) => passtFilm([t.titleEn, t.titleRomaji], t.jpYear, r))
        await sleep(120)
        if (treffer) break
      }
      const bilder = treffer ? await fetchJson<{ posters?: TmdbBild[] }>(`https://api.themoviedb.org/3/movie/${treffer.id}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`) : undefined
      const wahl = bilder ? waehlePlakat(bilder.posters ?? []) : undefined
      bestand[String(t.id)] = wahl ? plakatEintrag(wahl) : null
      if (wahl) gefunden++
    } catch (e) {
      warn(`TMDB-Film ${t.id}: ${(e as Error).message.slice(0, 80)}`)
    }
    await sleep(120)
  }
  log(`TMDB-Filme ohne Zuordnung: ${filme.length} gesucht, ${gefunden} mit Plakat`)
  return gefunden
}

/**
 * **Staffelplakate** (Daniel, 07.10.2026: größere Cover, auch für spätere Staffeln): Ein Titel ohne eigene TMDB-Zuordnung, dessen Reihe eine
 * TMDB-Serie trägt, bekommt das Plakat der Staffel, die `waehleStaffel` sicher zuordnet (Beginn ±100 Tage und Folgenzahl ±1). Gemessen am 07.10.2026
 * an 40 von 623 Kandidaten: 10 Treffer, alle mit Plakat ab 1.000 px; die übrigen sind OVAs, Specials und Filme ohne eigene Staffel und bleiben beim AniList-Cover.
 */
async function staffelPlakate(apiKey: string, zuordnung: Record<string, { tmdbId?: number; kind?: string }>, bestand: PlakatBestand, limit: number): Promise<number> {
  const reihen = readJson<Record<string, { id: number; jpStart?: string; episodes?: number }[]>>('public/data/franchises.json', {})
  const serieVon = new Map<number, number>()
  for (const mitglieder of Object.values(reihen)) {
    const haupt = mitglieder.find((m) => zuordnung[String(m.id)]?.kind === 'tv' && zuordnung[String(m.id)]?.tmdbId)
    if (haupt) for (const m of mitglieder) serieVon.set(m.id, zuordnung[String(haupt.id)]!.tmdbId!)
  }
  /* Nur, was der Monitor des letzten Baus ohne Zuordnung führt: die übrigen Reihenmitglieder erscheinen nirgends mit Cover. */
  const gesucht = new Set(readJson<{ id: number; grund: string }[]>('data/cover-klein.json', []).filter((k) => k.grund === 'keine TMDB-Zuordnung').map((k) => k.id))
  const offen = Object.values(reihen).flat().filter((t) => gesucht.has(t.id) && !(String(t.id) in bestand) && serieVon.has(t.id)).slice(0, limit)
  const staffeln = new Map<number, TmdbStaffel[]>()
  let gefunden = 0
  for (const t of offen) {
    try {
      const serie = serieVon.get(t.id)!
      if (!staffeln.has(serie)) {
        staffeln.set(serie, (await fetchJson<{ seasons?: TmdbStaffel[] }>(`https://api.themoviedb.org/3/tv/${serie}?language=de-DE&api_key=${apiKey}`)).seasons ?? [])
        await sleep(120)
      }
      const nummer = waehleStaffel(staffeln.get(serie)!, t.jpStart, t.episodes)
      if (nummer === undefined) {
        bestand[String(t.id)] = null
        continue
      }
      const bilder = await fetchJson<{ posters?: TmdbBild[] }>(`https://api.themoviedb.org/3/tv/${serie}/season/${nummer}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`)
      const wahl = waehlePlakat(bilder.posters ?? [])
      bestand[String(t.id)] = wahl ? plakatEintrag(wahl) : null
      if (wahl) gefunden++
    } catch (e) {
      warn(`TMDB-Staffelplakat ${t.id}: ${(e as Error).message.slice(0, 80)}`)
    }
    await sleep(120)
  }
  log(`TMDB-Staffelplakate: ${offen.length} Titel geprüft, ${gefunden} mit Plakat`)
  return gefunden
}

/**
 * **Serien und Web-Produktionen, die nur bei aniSearch stehen** (Daniel, 07.10.2026: „Super Wings" hatte kein Cover): Suche bei TMDB nach unseren Namen und dem Jahr, angenommen
 * wird nur ein Treffer, dessen Name und Jahr passen (`passtFilm` mit den Feldern der Serie). Filme erledigt `filmeSuchen`.
 */
async function serienOhneCover(apiKey: string, bestand: PlakatBestand): Promise<number> {
  const offen = readJson<Title[]>('public/data/titles.json', []).filter((t) => t.id >= 10_000_000 && t.format !== 'MOVIE' && !t.coverImage && !(String(t.id) in bestand))
  let gefunden = 0
  for (const t of offen) {
    try {
      let treffer: { id: number } | undefined
      for (const name of [t.titleEn, t.titleRomaji, t.titleDe].filter((n): n is string => Boolean(n))) {
        const such = await fetchJson<{ results?: { id: number; name?: string; original_name?: string; first_air_date?: string }[] }>(
          `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(name)}&api_key=${apiKey}`,
        )
        treffer = (such.results ?? []).slice(0, 5).find((r) => passtFilm([t.titleEn, t.titleRomaji, t.titleDe], t.jpYear, { title: r.name, original_title: r.original_name, release_date: r.first_air_date }))
        await sleep(120)
        if (treffer) break
      }
      const bilder = treffer ? await fetchJson<{ posters?: TmdbBild[] }>(`https://api.themoviedb.org/3/tv/${treffer.id}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`) : undefined
      const wahl = bilder ? waehlePlakat(bilder.posters ?? []) : undefined
      bestand[String(t.id)] = wahl ? plakatEintrag(wahl) : null
      if (wahl) gefunden++
    } catch (e) {
      warn(`TMDB-Serie ${t.id}: ${(e as Error).message.slice(0, 80)}`)
    }
    await sleep(120)
  }
  log(`TMDB-Serien nur bei aniSearch: ${offen.length} gesucht, ${gefunden} mit Plakat`)
  return gefunden
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY fehlt — ohne Schlüssel liefert TMDB keine Plakate.')
    recordSource('tmdb-poster', 0, 'kein Schlüssel')
    return
  }
  const zuordnung = readJson<Record<string, { tmdbId?: number; kind?: string }>>('data/tmdb-titles.json', {})
  const bestand = readJson<PlakatBestand>('data/tmdb-poster.json', {})
  const { offen, entfernt } = bilderAbzufragen(zuordnung, bestand, ALLE, LIMIT, new Date())
  for (const id of entfernt) delete bestand[id]
  log(`TMDB-Plakate: ${offen.length} Titel abzufragen (${Object.keys(bestand).length} schon bekannt, ${entfernt.length} abgelaufene ohne Zuordnung entfernt)`)
  let gefunden = 0
  let fehler = 0
  let abgerufen = 0
  for (const [id, z] of offen) {
    try {
      const bilder = await fetchJson<{ posters?: TmdbBild[] }>(
        `https://api.themoviedb.org/3/${z.kind}/${z.tmdbId}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`,
      )
      const wahl = waehlePlakat(bilder.posters ?? [])
      bestand[id] = wahl ? plakatEintrag(wahl) : null
      if (wahl) gefunden++
    } catch (e) {
      /* Eine Kennung, die TMDB nicht mehr kennt, ist kein Ausfall: der Titel hat dort kein Plakat. */
      if ((e as Error).message.startsWith('404')) { bestand[id] = null; continue }
      fehler++
      warn(`TMDB-Plakat ${id}: ${(e as Error).message.slice(0, 80)}`)
      if (fehler > 20) break
    }
    await sleep(120)
    if (++abgerufen % 200 === 0) writeJson('data/tmdb-poster.json', bestand)
  }
  gefunden += await filmeSuchen(apiKey, zuordnung, bestand)
  gefunden += await staffelPlakate(apiKey, zuordnung, bestand, LIMIT)
  gefunden += await holeStaffel0(apiKey, bestand)
  gefunden += await serienOhneCover(apiKey, bestand)
  gefunden += await plakatSuche(apiKey, bestand, KATALOG, 12 * 60_000)
  const zuAlt = streicheBilderUeberFrist(bestand, new Date())
  if (zuAlt.length) warn(`${zuAlt.length} Plakate über ${FRIST_TAGE} Tage, Erneuerung gescheitert: aus dem Bestand genommen`)
  writeJson('data/tmdb-poster.json', bestand)
  schreibeCoverListe(bestand, readJson<GrundBestand>(GRUND_DATEI, {}))
  await holeBanner(apiKey, LIMIT, ALLE)
  log(`${gefunden} von ${offen.length} Titeln mit Plakat, ${fehler} Fehler`)
  recordSource('tmdb-poster', gefunden)
}

await main()
