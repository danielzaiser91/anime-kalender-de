/**
 * **Westliche Animationsserien — der zweite Bestand.**
 *
 * Daniel am 12.09.2026, nach der Analyse in `docs/analyse-cartoons.md`: „also
 * cartoon analyse ergebnis? ist kein technisches problem es auf die seite zu
 * bringen nur ne fachliche frage? dann auf die seite."
 *
 * Die Analyse hatte drei Wege genannt; gebaut ist **B**: ein eigener Bestand
 * hinter einem eigenen Schalter, wie heute schon „Anime ohne deutsche
 * Synchro". Damit bleibt der Name der Seite richtig, und die Trennlinie, um
 * die es diesem Projekt geht, bleibt sichtbar.
 *
 * **Warum TMDB und nicht AniList.** AniList und aniSearch führen diese Titel
 * bewusst nicht: Ihre Grenze ist die Produktion, nicht das Aussehen — „RWBY:
 * Ice Queendom" (Studio Shaft) steht dort, „Avatar" nicht. TMDB kennt alle,
 * mit deutschem Titel, deutscher Beschreibung und den Anbietern für
 * Deutschland.
 *
 * **Der Genre-Filter ist kein Beiwerk, er ist der Riegel.** TMDB führt unter
 * „Avatar – Der Herr der Elemente" zwei Serien: die Zeichentrickserie von 2005
 * (ID 246, Genre Animation) und Netflix' Realverfilmung von 2024 (ID 82452,
 * ohne Animation). Ohne `with_genres=16` stünde die Realverfilmung im Bestand
 * einer Seite über Animation.
 *
 * **Kennungen sind negativ.** Unsere Titel tragen AniList-Kennungen; eine
 * TMDB-Kennung könnte mit einer davon zusammenfallen. `-tmdbId` kann das nie,
 * und man sieht einem Eintrag sofort an, aus welcher Welt er stammt.
 *
 * Aufruf: `tsx pipeline/fetch-cartoons.ts [--limit N] [--ab JAHR]`
 * Ergebnis: `data/cartoons.json`
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const TMDB = 'https://api.themoviedb.org/3'
const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de)'
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 0)
/*
  **Ab 2000, und das ist eine Entscheidung.** Davor gibt es reichlich
  US-Zeichentrick, aber kaum etwas davon hat einen Termin, den jemand vorher
  wissen will — und genau dafür ist diese Seite da. Wer weiter zurück will,
  setzt `--ab`.
*/
const AB_JAHR = Number(/--ab[= ](\d{4})/.exec(process.argv.join(' '))?.[1] ?? 2000)

/** Das Animations-Genre bei TMDB. */
const ANIMATION = 16

export interface CartoonEintrag {
  /** Negativ — siehe Kopf. */
  id: number
  tmdbId: number
  titleDe?: string
  titleEn: string
  jahr?: number
  /** Erstausstrahlung laut TMDB, so genau wie dort angegeben. */
  start?: string
  episodes?: number
  genres: string[]
  cover?: string
  /** Die Anbieter, bei denen es in Deutschland zu sehen ist. */
  anbieterDe: string[]
  /** Der Sender oder Dienst, für den es produziert wurde — „Paramount+", „Netflix". */
  netzwerk?: string
  beschreibungDe?: string
  land: string[]
  geholtAm: string
}

async function holeJson(url: string): Promise<unknown> {
  const antwort = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!antwort.ok) return null
  return antwort.json()
}

/**
 * **Wen wir überhaupt fragen.**
 *
 * Zwei Mengen, und beide werden gebraucht:
 *
 * - Was in Deutschland **zu sehen** ist (`watch_region=DE`) — der Bestand, den
 *   jemand heute sucht.
 * - Was noch **nicht erschienen** ist — „Avatar: Die sieben Häfen" hat am
 *   12.09.2026 keinen deutschen Anbietereintrag, aber einen Starttermin am
 *   09.10.2026. Genau solche Titel sind der Grund für einen Kalender.
 */
async function kandidaten(schluessel: string): Promise<number[]> {
  const ids = new Set<number>()
  const heute = new Date().toISOString().slice(0, 10)

  const laeufe = [
    {
      was: 'in Deutschland verfügbar',
      basis:
        `with_genres=${ANIMATION}&with_original_language=en&first_air_date.gte=${AB_JAHR}-01-01` +
        `&watch_region=DE&with_watch_monetization_types=flatrate|buy|rent`,
    },
    {
      was: 'angekündigt',
      basis: `with_genres=${ANIMATION}&with_original_language=en&first_air_date.gte=${heute}`,
    },
  ]

  for (const lauf of laeufe) {
    let seite = 1
    let gesamt = 0
    /* TMDB gibt höchstens 500 Seiten heraus; darüber antwortet es mit Fehler. */
    for (; seite <= 500; seite++) {
      const daten = (await holeJson(
        `${TMDB}/discover/tv?api_key=${schluessel}&language=de-DE&sort_by=popularity.desc&page=${seite}&${lauf.basis}`,
      )) as { results?: { id?: number }[]; total_pages?: number } | null
      if (!daten?.results?.length) break
      for (const e of daten.results) if (e.id) ids.add(e.id)
      gesamt = daten.total_pages ?? seite
      if (seite >= gesamt) break
      await sleep(60)
    }
    log(`  ${lauf.was}: ${seite} Seite(n)`)
  }

  return [...ids]
}

/** Die Einzelheiten je Titel — Name, Anbieter, Beschreibung. */
async function einzelheiten(tmdbId: number, schluessel: string): Promise<CartoonEintrag | null> {
  const j = (await holeJson(
    `${TMDB}/tv/${tmdbId}?api_key=${schluessel}&language=de-DE&append_to_response=watch/providers`,
  )) as
    | {
        id?: number
        name?: string
        original_name?: string
        first_air_date?: string
        number_of_episodes?: number
        genres?: { id?: number; name?: string }[]
        poster_path?: string
        overview?: string
        origin_country?: string[]
        networks?: { name?: string }[]
        'watch/providers'?: { results?: Record<string, { flatrate?: { provider_name?: string }[]; buy?: { provider_name?: string }[] }> }
      }
    | null
  if (!j?.id) return null

  /*
    **Der Riegel gilt auch hier, nicht nur in der Suche.** `discover` filtert
    nach Genre, aber ein Titel kann sein Genre verlieren — und dann stünde er
    beim nächsten Lauf weiter im Bestand, weil er schon drin ist.
  */
  if (!(j.genres ?? []).some((g) => g.id === ANIMATION)) return null

  const de = j['watch/providers']?.results?.DE
  const anbieter = [...(de?.flatrate ?? []), ...(de?.buy ?? [])]
    .map((p) => p.provider_name)
    .filter((n): n is string => Boolean(n))

  return {
    id: -j.id,
    tmdbId: j.id,
    /* Nur, wenn er wirklich etwas anderes sagt — sonst steht dieselbe Zeichenkette zweimal. */
    titleDe: j.name && j.name !== j.original_name ? j.name : undefined,
    titleEn: j.original_name ?? j.name ?? `#${j.id}`,
    jahr: j.first_air_date ? Number(j.first_air_date.slice(0, 4)) : undefined,
    start: j.first_air_date || undefined,
    episodes: j.number_of_episodes || undefined,
    genres: (j.genres ?? []).map((g) => g.name).filter((n): n is string => Boolean(n)),
    cover: j.poster_path ?? undefined,
    anbieterDe: [...new Set(anbieter)],
    netzwerk: j.networks?.[0]?.name,
    beschreibungDe: j.overview || undefined,
    land: j.origin_country ?? [],
    geholtAm: new Date().toISOString().slice(0, 10),
  }
}

async function main(): Promise<void> {
  const schluessel = process.env.TMDB_API_KEY
  if (!schluessel) {
    warn('Kein TMDB_API_KEY — der Lauf kann nichts holen.')
    recordSource('cartoons', 0, 'kein TMDB_API_KEY')
    return
  }

  const bestand = readJson<Record<string, CartoonEintrag>>('data/cartoons.json', {})
  log(`Bestand: ${Object.keys(bestand).length} Titel · suche Kandidaten ab ${AB_JAHR}`)

  const ids = await kandidaten(schluessel)
  log(`${ids.length} Kandidaten`)

  /*
    **Wiedervorlage nach Alter, nicht nach „schon geholt".** Anbieter wechseln,
    Folgenzahlen wachsen, und ein angekündigter Titel bekommt irgendwann einen
    Anbieter — ein Bestand, der nur wächst, behauptet alte Stände für immer.
  */
  const grenze = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10)
  const faellig = ids.filter((id) => (bestand[String(-id)]?.geholtAm ?? '') < grenze)
  const dran = GRENZE > 0 ? faellig.slice(0, GRENZE) : faellig
  log(`${dran.length} fällig (älter als 21 Tage oder neu)`)

  let neu = 0
  let verworfen = 0
  for (const tmdbId of dran) {
    const e = await einzelheiten(tmdbId, schluessel)
    await sleep(60)
    if (!e) {
      verworfen++
      continue
    }
    if (!bestand[String(e.id)]) neu++
    bestand[String(e.id)] = e
  }

  writeJson('data/cartoons.json', bestand)
  const mitAnbieter = Object.values(bestand).filter((e) => e.anbieterDe.length).length
  recordSource('cartoons', dran.length - verworfen, undefined, dran.length, true)
  log(
    `${neu} neu, ${verworfen} ohne Animations-Genre verworfen · ` +
      `${Object.keys(bestand).length} Titel, davon ${mitAnbieter} mit Anbieter in Deutschland`,
  )
}

await main()
