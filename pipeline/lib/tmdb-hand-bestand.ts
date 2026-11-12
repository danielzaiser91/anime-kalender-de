/**
 * Block „TMDB-Kennungen von Hand (gegen den Bestand)“ aus `check-logic-bestand.ts`: Einlesen und Zusicherungen, ohne eigenen Dateizugriff
 * (`lies` liefert den Text einer Datei relativ zum Repo), damit ein Test die Verdrahtung samt Warnzeile mit Fixtures fahren kann.
 */
import yaml from 'js-yaml'
import type { Title } from '../../shared/types.ts'
import { geteilteFilmeWarnzeile, geteilteFilmGruppen, reihenfremdImBestand } from './tmdb-eindeutig.ts'

type Pruefe = (name: string, bedingung: boolean, gefunden?: unknown) => void

/** Fährt die Zusicherungen und druckt Hinweise über `ausgabe`; gibt die Zahl der Zusicherungen zurück (Abgriff für den Aufrufer). */
export function pruefeTmdbHandBestand(lies: (datei: string) => string, pruefeEinzel: Pruefe, ausgabe: (zeile: string) => void): number {
  let gezaehlt = 0
  const pruefe: Pruefe = (name, bedingung, gefunden) => {
    gezaehlt++
    pruefeEinzel(name, bedingung, gefunden)
  }
  const eintraege = (yaml.load(lies('data/tmdb-von-hand.yaml')) as { anilistId: number; tmdbId?: number }[] | null) ?? []
  /*
    Dieselbe TMDB-Kennung an zwei Titeln ist erlaubt und kommt vor: TMDB führt „Dragon Ball Z
    Kai" und dessen „Final Chapters" als eine Serie, unser Bestand trennt sie. Erlaubt ist das
    nur innerhalb derselben Reihe — sonst wandern Wege zu einem fremden Werk.
  */
  const jeTmdb = new Map<number, number[]>()
  for (const e of eintraege) {
    if (e.tmdbId) jeTmdb.set(e.tmdbId, [...(jeTmdb.get(e.tmdbId) ?? []), e.anilistId])
  }
  /*
    **Beide Bestände zählen.** „Super Dragon Ball Heroes" hat keine deutsche Synchro und steht
    deshalb in `ohne-synchro.json` — eine TMDB-Kennung braucht es trotzdem, denn genau dort
    beantwortet sie die Frage „gibt es das irgendwo?".
  */
  const imBestand = [
    ...(JSON.parse(lies('public/data/titles.json')) as Title[]),
    ...(JSON.parse(lies('public/data/ohne-synchro.json')) as Title[]),
  ]
  const bestand = new Map(imBestand.map((t) => [t.id, t]))
  const fremdGeteilt = [...jeTmdb.values()]
    .filter((ids) => ids.length > 1)
    .filter((ids) => new Set(ids.map((id) => bestand.get(id)?.franchiseId ?? `solo-${id}`)).size > 1)
  pruefe('eine geteilte TMDB-Kennung bleibt in ihrer Reihe', fremdGeteilt.length === 0, fremdGeteilt)
  // Dasselbe über den ganzen Cache, nicht nur die Handzeilen (Bestand 12.11.2026: 0 Funde; Einträge ohne Titel im Bestand zählen nicht).
  const tmdbCache = JSON.parse(lies('data/tmdb-titles.json')) as Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>
  const reihenfremd = reihenfremdImBestand(tmdbCache, bestand)
  pruefe('keine TMDB-Kennung hängt an Titeln verschiedener Reihen', reihenfremd.length === 0, reihenfremd)
  // Neue geteilte Filmteile (Kitaro-Kandidaten) warnen nur: die Beteiligten verlieren ihre TMDB-Angaben ohnehin, eine falsche Aussage kommt nicht live.
  const filmWarnung = geteilteFilmeWarnzeile(geteilteFilmGruppen(tmdbCache, (id) => bestand.has(Number(id))))
  if (filmWarnung) ausgabe(filmWarnung)
  pruefe(
    'jede AniList-Kennung steht im Bestand',
    eintraege.every((e) => bestand.has(e.anilistId)),
    eintraege.filter((e) => !bestand.has(e.anilistId)).map((e) => e.anilistId),
  )
  return gezaehlt
}
