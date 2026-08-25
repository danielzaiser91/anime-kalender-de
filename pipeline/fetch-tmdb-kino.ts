/**
 * Deutsche Anime-Kinostarts bei TMDB finden — und die eigenen bestätigen.
 *
 * ## Was diese Quelle kann, und was nicht
 *
 * Am 25.08.2026 an „Detektiv Conan Film 29" über **fünf** Endpunkte durchgespielt,
 * plus Gegentest an zwei Filmen mit belegter deutscher Synchronfassung:
 *
 * | Endpunkt | Ergebnis |
 * |---|---|
 * | `/movie/{id}?language=de-DE` | deutscher **Titel**, aber `spoken_languages: [ja]` |
 * | `/movie/{id}/translations` | eine deutsche Übersetzung — Titel und Beschreibung |
 * | `/movie/{id}/alternative_titles?country=DE` | leer |
 * | `/movie/{id}/watch/providers` | keine DE-Anbieter |
 * | `/movie/{id}/release_dates` | **Termin ja**, `iso_639_1` leer |
 * | `/discover/movie` mit `region=DE` | findet ihn |
 *
 * **Der Gegentest entscheidet:** „Chihiros Reise ins Zauberland" und „Your Name."
 * haben beide eine deutsche Synchronfassung — und tragen bei TMDB trotzdem nur
 * `spoken_languages: [ja]`. Das Feld meint die Sprache **des Films**, nicht die
 * verfügbaren Fassungen. Über 18 deutsche Termine in sechs Filmen ist
 * `iso_639_1` siebzehnmal leer; das eine `"de"` steht an einer TV-Ausstrahlung.
 *
 * **Also: TMDB kennt Termine, keine Synchronfassungen.** Wer beides von dort
 * erwartet, hat eine Angabe vor sich, die es nicht gibt. Die Fassung kommt aus
 * `data/curated/kino-2026.yaml` und bleibt Handarbeit, bis eine Quelle sie
 * wirklich führt (siehe `status.md`, Abschnitt „Kino-Termine und
 * Sprachfassung").
 *
 * ## Was dieser Lauf tut
 *
 * `discover` mit `region=DE`, `with_release_type=2|3` (Kino, auch limitiert),
 * `with_genres=16` (Animation) und `with_original_language=ja` liefert genau
 * unsere Schnittmenge: japanische Animationsfilme mit deutschem Kinostart.
 *
 * Geschrieben wird nach `data/tmdb-kino.json` — **Vorschläge, kein Kalender**.
 * Ein Kinostart wandert erst dann in `data/curated/kino-2026.yaml`, wenn jemand
 * ihn angesehen hat; dieses Projekt behauptet keinen Termin, den es nicht
 * belegen kann, und die Sprachfassung fehlt hier ohnehin.
 *
 * **Der erste Lauf hat sich sofort bezahlt gemacht:** „ALL YOU NEED IS KILL"
 * (AniList 187892) steht seit Wochen im Bestand — der deutsche Kinostart am
 * 29.09.2026 fehlte im Kalender vollständig.
 *
 * Aufruf: `npm run data:tmdb-kino [-- --monate 12]`
 */
import { readJson, writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const zahl = (name: string, standard: number): number => {
  const i = args.indexOf(name)
  const wert = i >= 0 ? Number(args[i + 1]) : NaN
  return Number.isFinite(wert) ? wert : standard
}

/** Wie weit nach vorn gesucht wird. Ein Kinostart wird selten früher angekündigt. */
const MONATE = zahl('--monate', 12)
const SCHLUESSEL = process.env.TMDB_API_KEY ?? ''
const ZIEL = 'data/tmdb-kino.json'

interface Fund {
  tmdbId: number
  titel: string
  originalTitel: string
  /** Der deutsche Kinostart, aus `release_dates` — nicht `primary_release_date`. */
  kinostart: string
  /** 2 = limitiert, 3 = regulär. Beide sind ein Kinostart. */
  typ: number
  /** Was TMDB an der Terminzeile vermerkt hat („25th anniversary"). */
  note: string
  /** Unser Titel, falls die Zuordnung eindeutig war. */
  anilistId?: number
}

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}

function inMonaten(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

async function hole(pfad: string, parameter: Record<string, string>): Promise<unknown> {
  const u = new URL(`https://api.themoviedb.org/3/${pfad}`)
  u.searchParams.set('api_key', SCHLUESSEL)
  for (const [k, v] of Object.entries(parameter)) u.searchParams.set(k, v)
  const antwort = await fetch(u, { headers: { accept: 'application/json' } })
  if (!antwort.ok) throw new Error(`TMDB ${pfad}: HTTP ${antwort.status}`)
  return antwort.json()
}

/**
 * Der deutsche Kinostart eines Films — aus `release_dates`, nicht aus `discover`.
 *
 * `discover` sortiert und zeigt `primary_release_date`, und das ist die
 * **Weltpremiere**. „Chihiros Reise ins Zauberland" erscheint dort mit 2003,
 * während die deutsche Wiederaufführung am 18.08.2026 läuft. Wer die Zahl aus
 * der Trefferliste übernimmt, trägt japanische Premieren in einen deutschen
 * Kalender.
 */
async function deutscherKinostart(
  tmdbId: number,
): Promise<{ datum: string; typ: number; note: string } | null> {
  const daten = (await hole(`movie/${tmdbId}/release_dates`, {})) as {
    results?: Array<{
      iso_3166_1?: string
      release_dates?: Array<{ release_date?: string; type?: number; note?: string }>
    }>
  }
  const de = daten.results?.find((r) => r.iso_3166_1 === 'DE')
  if (!de?.release_dates?.length) return null
  const kino = de.release_dates
    .filter((d) => d.type === 2 || d.type === 3)
    .map((d) => ({ datum: (d.release_date ?? '').slice(0, 10), typ: d.type ?? 3, note: d.note ?? '' }))
    .filter((d) => d.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum))
  // Der **nächste** Kinostart ab heute; sonst der letzte bekannte.
  const jetzt = heute()
  return kino.find((d) => d.datum >= jetzt) ?? kino.at(-1) ?? null
}

async function main(): Promise<void> {
  if (!SCHLUESSEL) {
    warn('TMDB_API_KEY fehlt — Kinostarts werden nicht geholt.')
    return
  }

  const von = heute()
  const bis = inMonaten(MONATE)
  log(`TMDB-Kinostarts: suche japanische Animationsfilme mit DE-Start ${von} bis ${bis}`)

  const funde: Fund[] = []
  const gesehen = new Set<number>()

  for (let seite = 1; seite <= 5; seite++) {
    const treffer = (await hole('discover/movie', {
      language: 'de-DE',
      region: 'DE',
      with_release_type: '2|3',
      'release_date.gte': von,
      'release_date.lte': bis,
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'primary_release_date.asc',
      page: String(seite),
    })) as { results?: Array<{ id: number; title?: string; original_title?: string }>; total_pages?: number }

    for (const r of treffer.results ?? []) {
      if (gesehen.has(r.id)) continue
      gesehen.add(r.id)
      const start = await deutscherKinostart(r.id)
      if (!start) continue
      // Was schon gelaufen ist, hilft dem Kalender nicht mehr.
      if (start.datum < von) continue
      funde.push({
        tmdbId: r.id,
        titel: r.title ?? '',
        originalTitel: r.original_title ?? '',
        kinostart: start.datum,
        typ: start.typ,
        note: start.note,
      })
    }
    if (seite >= (treffer.total_pages ?? 1)) break
  }

  /**
   * Zuordnung über die Brücke, die das Projekt schon führt.
   *
   * `data/tmdb-titles.json` hält je AniList-Titel die TMDB-Kennung. Sie ist
   * gepflegt und geprüft — eine zweite, eigene Namenssuche daneben wäre eine
   * zweite Fehlerquelle für dieselbe Frage.
   */
  const tmdbZuTitel = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-titles.json', {})
  const anilistJeTmdb = new Map<number, number>()
  for (const [anilist, e] of Object.entries(tmdbZuTitel)) {
    if (e?.tmdbId) anilistJeTmdb.set(e.tmdbId, Number(anilist))
  }
  /**
   * Zweite Stufe: der **exakt** gleiche Titel.
   *
   * Die Brücke oben deckt nur ab, was schon einmal zugeordnet wurde — für einen
   * neuen Kinofilm steht dort `{"miss": true}`, und genau die neuen sind hier
   * die interessanten. „ALL YOU NEED IS KILL" stand am 25.08.2026 im Bestand,
   * ohne dass die Brücke ihn kannte.
   *
   * **Exakt heißt exakt**, nach Kleinschreibung und ohne Satzzeichen. Kein
   * Ähnlichkeitsmaß: Bei Anime-Reihen unterscheiden sich Titel oft nur durch
   * ein Wort, und ein falsch zugeordneter Kinostart wandert als Termin in den
   * Kalender. Wer nicht exakt trifft, bleibt „nicht zugeordnet" und wird von
   * Hand angesehen — das ist der billigere Fehler.
   */
  const schlicht = (s: string): string =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const jeTitel = new Map<string, number>()
  for (const t of readJson<Title[]>('public/data/titles.json', [])) {
    for (const name of [t.titleRomaji, t.titleEn, t.titleDe]) {
      if (!name) continue
      const k = schlicht(name)
      // Mehrdeutig? Dann lieber gar nicht — siehe oben.
      jeTitel.set(k, jeTitel.has(k) && jeTitel.get(k) !== t.id ? -1 : t.id)
    }
  }
  for (const f of funde) {
    const anilist = anilistJeTmdb.get(f.tmdbId)
    if (anilist) {
      f.anilistId = anilist
      continue
    }
    for (const name of [f.titel, f.originalTitel]) {
      const treffer = jeTitel.get(schlicht(name))
      if (treffer && treffer > 0) {
        f.anilistId = treffer
        break
      }
    }
  }

  funde.sort((a, b) => a.kinostart.localeCompare(b.kinostart))
  writeJson(ZIEL, { geholtAm: new Date().toISOString(), fenster: { von, bis }, funde })

  /** Welche Funde noch in keinem Release stehen — das ist die eigentliche Ausbeute. */
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const bekannt = new Set(titles.map((t) => t.id))
  const zugeordnet = funde.filter((f) => f.anilistId && bekannt.has(f.anilistId)).length

  log(
    `TMDB-Kinostarts: ${funde.length} Filme im Fenster, ${zugeordnet} einem unserer Titel zugeordnet ` +
      `— Vorschläge in ${ZIEL}, Übernahme bleibt Handarbeit (die Sprachfassung liefert TMDB nicht)`,
  )
  for (const f of funde) {
    log(`  ${f.kinostart}  ${f.titel.slice(0, 46).padEnd(48)} ${f.anilistId ? `AniList ${f.anilistId}` : '— nicht zugeordnet'}`)
  }

  recordSource('tmdb-kino', funde.length, funde.length ? undefined : 'keine Kinostarts im Fenster')
}

await main()
