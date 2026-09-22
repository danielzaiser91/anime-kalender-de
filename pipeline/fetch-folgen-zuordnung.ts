/**
 * **Stufe 2: die Zuordnung je Plattform-Folge berechnen und festhalten** (22.09.2026).
 *
 * Holt jede Beobachtung aus `prime_folge` (`?rohfolgen=1&alle=1`, seitenweise), ordnet sie mit
 * `ordneFolgenZu()` unseren Titeln und Folgen zu und schreibt `data/folgen-zuordnung.json`. Die
 * Datei ist neu berechenbar und hält trotzdem fest, was einmal zugeordnet war (siehe dort).
 *
 * **Der Bau liest sie noch nicht.** Erst Stufe 3 (Urteil) baut darauf; bis dahin ist die Datei
 * ein Messwert: Wie viele Folgen tragen Titel und Nummer, wie viele nur den Titel, welche sind
 * offen und mit welchen Kandidaten.
 *
 * Aufruf: LAUF_TOKEN=… npx tsx pipeline/fetch-folgen-zuordnung.ts
 *         npx tsx pipeline/fetch-folgen-zuordnung.ts --aus <wrangler-export.json>   (ohne Worker)
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { adressIndex, ankerAdresse, ordneFolgenZu, type Beobachtung, type FolgenZuordnung } from './lib/folgen-je-folge.ts'
import { namenIndex, titelZuordnen } from './fetch-tv-programm.ts'
import type { AsFolgeRoh, TmdbFolge } from '../shared/folgen-zuordnung.ts'
import type { Title } from '../shared/types.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''
const ZIEL = 'data/folgen-zuordnung.json'

async function holen(): Promise<Beobachtung[] | null> {
  const aus = process.argv.indexOf('--aus')
  if (aus > 0) return (JSON.parse(readFileSync(process.argv[aus + 1]!, 'utf8')) as { results: Beobachtung[] }[])[0]!.results
  if (!TOKEN) {
    warn('LAUF_TOKEN fehlt — nichts geholt.')
    return null
  }
  const alle: Beobachtung[] = []
  let nach = 0
  for (;;) {
    const r = await fetch(`${WORKER}/pruefung?rohfolgen=1&alle=1&nach=${nach}&token=${encodeURIComponent(TOKEN)}`)
    /* Eine Störung ist keine Beobachtung: Ohne vollständigen Abruf wird nichts geschrieben. */
    if (!r.ok) {
      warn(`Worker antwortet ${r.status} — Lauf endet ohne zu schreiben.`)
      return null
    }
    const j = (await r.json()) as { folgen: Beobachtung[]; weiter: number | null }
    alle.push(...j.folgen)
    if (j.weiter == null) return alle
    nach = j.weiter
  }
}

/** Serienname je gemeldeter Adresse aus den Meldungen (`?rohfolgen=1&namen=1`). */
async function namenHolen(): Promise<Map<string, string>> {
  const aus = new Map<string, string>()
  if (!TOKEN) return aus
  const r = await fetch(`${WORKER}/pruefung?rohfolgen=1&namen=1&token=${encodeURIComponent(TOKEN)}`)
  if (!r.ok) {
    warn(`Namen: Worker antwortet ${r.status} — ohne Namen weiter.`)
    return aus
  }
  for (const n of ((await r.json()) as { namen: { url: string; titel: string }[] }).namen) {
    const k = ankerAdresse(n.url)
    if (k) aus.set(k, n.titel)
  }
  return aus
}

async function main() {
  const beobachtungen = await holen()
  if (!beobachtungen) return
  const namenJeAdresse = await namenHolen()
  const namen = namenIndex()
  const roh = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
  const titel = new Map((Array.isArray(roh) ? roh : roh.titles).map((t) => [t.id, t]))
  /* Frühere Zuordnungen: der heutige Einleser (je Adresse) und die Belege. */
  const frueher: [string, number][] = Object.entries(
    readJson<Record<string, { titleId?: number }>>('data/prime-zugeordnet.json', {}),
  ).flatMap(([url, x]) => (x.titleId ? [[url, x.titleId] as [string, number]] : []))
  for (const b of (yaml.load(readFileSync('data/dub-confirmed.yaml', 'utf8')) as { anilistId?: number; url?: string }[]) ?? []) {
    if (b.anilistId && b.url) frueher.push([b.url, b.anilistId])
  }
  const bisher = readJson<Record<string, FolgenZuordnung>>(ZIEL, {})
  const ergebnis = ordneFolgenZu(
    beobachtungen,
    {
      titel,
      tmdb: readJson<Record<string, { folgen: TmdbFolge[] }>>('data/tmdb-folgen.json', {}),
      asFolgen: readJson<Record<string, { folgen: AsFolgeRoh[] }>>('data/anisearch-folgen.json', {}),
      asKennung: readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {}),
      jeAdresse: adressIndex(titel, frueher),
      namenJeAdresse,
      nameZuTitel: (n) => titelZuordnen(n, namen),
    },
    bisher,
  )
  writeJson(ZIEL, ergebnis, true)
  const zaehl: Record<string, number> = {}
  for (const z of Object.values(ergebnis)) zaehl[z.titel ? (z.folge ? 'Titel und Folge' : 'nur Titel') : z.grund] = (zaehl[z.titel ? (z.folge ? 'Titel und Folge' : 'nur Titel') : z.grund] ?? 0) + 1
  log(
    `${Object.keys(ergebnis).length} Plattform-Folgen aus ${beobachtungen.length} Beobachtungen → ${ZIEL}: ` +
      Object.entries(zaehl)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${n} ${k}`)
        .join(', '),
  )
}

if (process.argv[1]?.endsWith('fetch-folgen-zuordnung.ts')) await main()
