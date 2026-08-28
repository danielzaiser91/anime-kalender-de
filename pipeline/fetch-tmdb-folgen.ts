/**
 * Folgentitel und Erstausstrahlungsdaten je Folge — von TMDB.
 *
 * **Warum das gebraucht wird.** Die Zuordnung einer Anbieter-Folge zu unserer
 * hängt heute an der Folgennummer, und die ist bei jedem Anbieter eine andere:
 * Prime führt in einer Liste die deutsche Zählung (149–151) neben der
 * japanischen Gesamtzählung (1146–1148), Crunchyroll vergibt Staffelnummern der
 * Form `S00095473`, Amazon mischt in derselben Staffel 26, 27, 28 und 105.
 *
 * Was nicht wandert, ist **wann eine Folge zuerst lief** und **wie sie heißt**.
 * Beides liefert TMDB je Staffel, und 2.753 unserer Titel tragen bereits eine
 * `tmdbId` aus `data/tmdb-titles.json`.
 *
 * **Was hier nicht passiert.** Es wird nichts zugeordnet und nichts beurteilt —
 * die Datei ist ein Nachschlagewerk, das die Zuordnung im Bau später benutzt.
 * Sie erreicht die Webseite nie: Folgentitel und Laufzeiten sind Werkzeug, kein
 * Inhalt für den Besucher (siehe `ZIELE.md`, Querschnittsanforderungen).
 *
 * **Warteschlange nach Alter, nicht nach „noch nie geholt".** Eine Serie bekommt
 * Folgen dazu, und eine Staffel, die einmal abgefragt wurde, wäre sonst für
 * immer eingefroren — derselbe Fehler, den `scrape-crunchyroll-dub.ts` und
 * `fetch-anisearch.ts` am 15.08.2026 gekostet haben. Vorgabe sind 30 Tage;
 * abgeschlossene Staffeln ändern sich nicht mehr, laufende schon.
 *
 * Aufruf: `npx tsx pipeline/fetch-tmdb-folgen.ts [--limit N] [--alter TAGE]`
 */
import { loadEnv, fetchJson, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 400
const ALTER_TAGE = Number(args[args.indexOf('--alter') + 1]) || 30

const BASE = 'https://api.themoviedb.org/3'

/** Eine Folge, so wie TMDB sie führt — ohne Deutung. */
interface Folge {
  /** Staffel und Nummer in TMDBs eigener Zählung. */
  s: number
  e: number
  /** Der Folgentitel, deutsch wenn vorhanden, sonst englisch. */
  titel: string | null
  /** Erstausstrahlung, `YYYY-MM-DD`. Der eigentliche Anker der Zuordnung. */
  datum: string | null
  /** Laufzeit in Minuten — trennt eine Anthologie von ihrer Sammelfassung. */
  minuten: number | null
}

interface Eintrag {
  tmdbId: number
  /** Wann zuletzt geholt — die Warteschlange rechnet damit. */
  geholtAm: string
  /** Wie viele Staffeln TMDB führt; sagt, ob ein Nachschlag nötig war. */
  staffeln: number
  folgen: Folge[]
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY fehlt — ohne Schlüssel gibt TMDB keine Folgen heraus.')
    recordSource('tmdb-folgen', 0, 'kein Schlüssel')
    return
  }

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdbTitles = readJson<Record<string, { tmdbId?: number; kind?: string }>>(
    'data/tmdb-titles.json',
    {},
  )
  const bestand = readJson<Record<string, Eintrag>>('data/tmdb-folgen.json', {})

  const grenze = Date.now() - ALTER_TAGE * 86_400_000

  /*
    Nur Serien, und nur solche mit Verweis: Ein Titel ohne Anbieter braucht keine
    Zuordnungshilfe, und ein Film hat keine Folgenliste. Das hält die Zahl der
    Abrufe an der Sache statt am Katalog.
  */
  const offen = titles
    .filter((t) => (t.streams ?? []).length > 0)
    .filter((t) => (t.episodes ?? 0) > 1)
    .map((t) => ({ t, tmdb: tmdbTitles[String(t.id)] }))
    .filter((x) => x.tmdb?.tmdbId && x.tmdb.kind !== 'movie')
    .filter((x) => {
      const alt = bestand[String(x.t.id)]
      return !alt || Date.parse(alt.geholtAm) < grenze
    })
    .slice(0, LIMIT)

  log(`${offen.length} Titel mit Folgenbedarf (Grenze ${ALTER_TAGE} Tage, höchstens ${LIMIT})`)

  let geholt = 0
  let folgenGesamt = 0

  for (const { t, tmdb } of offen) {
    const id = tmdb!.tmdbId!
    try {
      const serie = await fetchJson<{ seasons?: { season_number: number }[] }>(
        `${BASE}/tv/${id}?api_key=${apiKey}&language=de-DE`,
      )
      /*
        Staffel 0 ist bei TMDB der Sammelplatz für Specials. Sie gehört dazu —
        genau dort liegen die Sonderfolgen, die bei Anbietern zwischen den
        regulären auftauchen und die Zählung verschieben.
      */
      const nummern = (serie.seasons ?? []).map((s) => s.season_number).sort((a, b) => a - b)
      const folgen: Folge[] = []

      for (const s of nummern) {
        const staffel = await fetchJson<{
          episodes?: { episode_number: number; name?: string; air_date?: string; runtime?: number }[]
        }>(`${BASE}/tv/${id}/season/${s}?api_key=${apiKey}&language=de-DE`)
        for (const e of staffel.episodes ?? []) {
          folgen.push({
            s,
            e: e.episode_number,
            titel: e.name?.trim() || null,
            datum: e.air_date || null,
            minuten: Number.isFinite(e.runtime) ? (e.runtime as number) : null,
          })
        }
        await sleep(120)
      }

      bestand[String(t.id)] = {
        tmdbId: id,
        geholtAm: new Date().toISOString().slice(0, 10),
        staffeln: nummern.length,
        folgen,
      }
      geholt++
      folgenGesamt += folgen.length
    } catch (err) {
      warn(`TMDB ${id} (${t.titleRomaji ?? t.id}): ${(err as Error).message}`)
    }
    await sleep(120)
  }

  writeJson('data/tmdb-folgen.json', bestand)
  log(`${geholt} Titel geholt, ${folgenGesamt} Folgen; Bestand jetzt ${Object.keys(bestand).length}`)
  recordSource('tmdb-folgen', Object.keys(bestand).length, undefined, geholt)
}

await main()
