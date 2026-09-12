/**
 * **Deutsche Trailer zu Anime-Filmen.**
 *
 * Daniel am 12.09.2026: „pack für anime filme trailer von diesem kanal" — dem
 * deutschen KinoCheck-Kanal, an dessen Beispiel („A NEW DAWN Trailer German
 * Deutsch (2026) Exklusiv") er es gezeigt hat.
 *
 * **Zwei Wege, und der erste ist der belegte.** KinoCheck betreibt eine
 * offizielle API für genau diesen Zweck (`api.kinocheck.de`, Endpunkte
 * `/movies`, `/shows`, `/trailers`, Schlüssel `tmdb_id` oder `imdb_id`). Wer
 * eine TMDB-Kennung hat, bekommt dort einen Treffer ohne jeden Namensvergleich
 * — und unsere Filme tragen sie in `data/tmdb-titles.json`.
 *
 * Gemessen am 12.09.2026: `movies?tmdb_id=299534&language=de&categories=Trailer`
 * antwortet mit Titel, KinoCheck-Adresse und `trailer.youtube_video_id`.
 * Für „A New Dawn" (TMDB 900438) dagegen „movie not found" — KinoCheck ordnet
 * längst nicht jeden Film einer TMDB-Kennung zu, obwohl der Trailer auf ihrem
 * Kanal liegt.
 *
 * **Deshalb der zweite Weg: der Kanal selbst.** Die Uploads-Playlist des
 * Kanals (8.281 Videos) wird einmal je Lauf durchgeblättert — 166 Aufrufe à
 * eine Kontingenteinheit, gegen 100 Einheiten je einzelner `search.list`. Aus
 * ihr entsteht ein Index, und der Abgleich läuft lokal.
 *
 * **Der Namensabgleich ist die Stelle, an der so etwas schiefgeht**, und diese
 * Akte führt die Fälle: „To Love-Ru" gegen „To Love-Ru Darkness",
 * „Wolf's Rain" gegen „Wolf's Rain OVA". Deshalb drei Riegel, jeder für sich
 * notwendig:
 *
 * 1. Der Videotitel muss vor dem Wort „Trailer" **genau** unseren Filmtitel
 *    tragen — KinoCheck schreibt ihn dort in Versalien und immer an den Anfang.
 * 2. Das Erscheinungsjahr in Klammern muss zum Filmjahr passen (±1), wo beide
 *    bekannt sind.
 * 3. Der Titel muss „German" oder „Deutsch" nennen — ein englischer Trailer
 *    beantwortet die Frage dieser Seite nicht.
 *
 * Bleibt mehr als ein Treffer, gewinnt der jüngste: KinoCheck lädt zu einem
 * Film mehrere Trailer, und der letzte ist der vollständigste.
 *
 * Aufruf: `tsx pipeline/fetch-trailer.ts [--limit N]`
 * Ergebnis: `data/trailer.json`
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

/*
  Die Uploads-Playlist des deutschen Hauptkanals (`UCOL10n-as9dXO2qtjjFUQbQ`,
  8.281 Videos). YouTube bildet sie aus der Kanalkennung, indem es das dritte
  Zeichen von `C` auf `U` setzt — die Kennung selbst wird sonst nicht gebraucht.
*/
const UPLOADS = 'UUOL10n-as9dXO2qtjjFUQbQ'
const KINOCHECK = 'https://api.kinocheck.de'
const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de)'
const GRENZE = Number(/--limit[= ](\d+)/.exec(process.argv.join(' '))?.[1] ?? 0)

interface Titel {
  id: number
  titleDe?: string
  titleEn?: string
  titleRomaji?: string
  format?: string
  jpYear?: number
}

interface TmdbEintrag {
  tmdbId?: number
  kind?: string
}

export interface TrailerEintrag {
  /** Die YouTube-Kennung — alles, was die Oberfläche zum Einbetten braucht. */
  video: string
  /** Der Titel des Videos, damit im Dialog steht, was dort läuft. */
  titel: string
  /** `kinocheck` (über die TMDB-Kennung) oder `kanal` (über den Namen im Index). */
  herkunft: 'kinocheck' | 'kanal'
  gefundenAm: string
}

/**
 * **Was vom Videotitel für den Vergleich übrig bleibt.**
 *
 * KinoCheck schreibt „A NEW DAWN Trailer German Deutsch (2026) Exklusiv" — der
 * Filmname steht vorn, danach kommt immer „Trailer". Alles ab dort ist
 * Beiwerk des Kanals und gehört nicht in den Vergleich.
 */
function filmteilVon(videoTitel: string): string {
  const vor = videoTitel.split(/\bTrailer\b/i)[0] ?? ''
  return normal(vor)
}

/** Klein, ohne Satzzeichen, ohne doppelte Leerzeichen — sonst trennt ein Doppelpunkt zwei gleiche Namen. */
function normal(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * **Das Jahr im Videotitel — in jeder Schreibweise.**
 *
 * Der erste Entwurf las nur die Klammerform „(2026)". Damit ging „ELYSIUM
 * Trailer - Deutsch German | 2013 Official Film" durch und landete an unserem
 * gleichnamigen Anime von 2003 (gemessen 12.09.2026, ein Fehltreffer von 13).
 * Der Riegel war gebaut und griff nicht, weil das Jahr ohne Klammern stand.
 */
function jahrAus(videoTitel: string): number | undefined {
  const treffer = [...videoTitel.matchAll(/\b(19[5-9]\d|20[0-4]\d)\b/g)].map((m) => Number(m[1]))
  return treffer.length ? Math.min(...treffer) : undefined
}

/** Nennt der Videotitel eine deutsche Fassung? */
function istDeutsch(videoTitel: string): boolean {
  return /\b(german|deutsch)\b/i.test(videoTitel)
}

async function holeJson(url: string, kopf: Record<string, string> = {}): Promise<unknown> {
  const antwort = await fetch(url, { headers: { 'User-Agent': UA, ...kopf } })
  if (!antwort.ok) return null
  return antwort.json()
}

/**
 * **Weg 1 — KinoCheck über die TMDB-Kennung.**
 *
 * Der Endpunkt antwortet mit HTTP 404 und `movie not found`, wenn er den Film
 * nicht führt. Das ist keine Auskunft über den Trailer, sondern über die
 * Zuordnung; der Aufrufer geht dann den zweiten Weg.
 */
async function ausKinocheck(tmdbId: number, art: string): Promise<TrailerEintrag | null> {
  const pfad = art === 'movie' ? 'movies' : 'shows'
  const daten = (await holeJson(
    `${KINOCHECK}/${pfad}?tmdb_id=${tmdbId}&language=de&categories=Trailer`,
  )) as { trailer?: { youtube_video_id?: string; title?: string } } | null
  const video = daten?.trailer?.youtube_video_id
  if (!video) return null
  return {
    video,
    titel: daten?.trailer?.title ?? '',
    herkunft: 'kinocheck',
    gefundenAm: new Date().toISOString().slice(0, 10),
  }
}

/**
 * **Der Index des Kanals.**
 *
 * Einmal je Lauf geholt und im Zwischenspeicher abgelegt: Die Playlist wächst
 * täglich um wenige Videos, aber sie ganz zu holen kostet 166 Einheiten — ein
 * zweiter Lauf am selben Tag soll das nicht noch einmal zahlen.
 */
async function kanalIndex(schluessel: string): Promise<{ video: string; titel: string; am: string }[]> {
  const cache = readJson<{ geholtAm?: string; videos?: { video: string; titel: string; am: string }[] }>(
    'data/cache/kinocheck-kanal.json',
    {},
  )
  const heute = new Date().toISOString().slice(0, 10)
  if (cache.geholtAm === heute && cache.videos?.length) {
    log(`${cache.videos.length} Kanalvideos aus dem Zwischenspeicher`)
    return cache.videos
  }

  const videos: { video: string; titel: string; am: string }[] = []
  let seite: string | undefined
  do {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50` +
      `&playlistId=${UPLOADS}&key=${schluessel}${seite ? `&pageToken=${seite}` : ''}`
    const daten = (await holeJson(url)) as {
      items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[]
      nextPageToken?: string
    } | null
    if (!daten?.items?.length) break
    for (const eintrag of daten.items) {
      const video = eintrag.snippet?.resourceId?.videoId
      if (video) {
        videos.push({
          video,
          titel: eintrag.snippet?.title ?? '',
          am: (eintrag.snippet?.publishedAt ?? '').slice(0, 10),
        })
      }
    }
    seite = daten.nextPageToken
    /* Das Kontingent ist großzügig, die Höflichkeit kostet nichts. */
    await sleep(120)
  } while (seite)

  writeJson('data/cache/kinocheck-kanal.json', { geholtAm: heute, videos })
  log(`${videos.length} Videos im Kanalindex`)
  return videos
}

/**
 * **Weg 2 — der Index, mit drei Riegeln.**
 *
 * Verglichen wird gegen **jede** Schreibweise unseres Titels: KinoCheck nimmt
 * den international gebräuchlichen Namen, und der ist mal unser deutscher, mal
 * unser englischer.
 */
function ausIndex(
  titel: Titel,
  index: { video: string; titel: string; am: string }[],
): TrailerEintrag | null {
  const namen = new Set(
    [titel.titleDe, titel.titleEn, titel.titleRomaji].filter(Boolean).map((n) => normal(n!)),
  )
  if (!namen.size) return null

  const treffer = index.filter((v) => {
    if (!istDeutsch(v.titel)) return false
    if (!namen.has(filmteilVon(v.titel))) return false
    const jahr = jahrAus(v.titel)
    /*
      **Der deutsche Trailer kommt nach der japanischen Ausstrahlung, aber nicht
      lange danach.** „Der Mohnblumenberg" lief 2011 in Japan und 2013 hier —
      der Trailer trägt 2013, und das ist ein richtiger Treffer. Zehn Jahre
      Abstand sind keiner: Unter „Elysium" führt KinoCheck einen Sci-Fi-Film von
      2013, unser Anime ist von 2003.

      Also ein Fenster statt eines Abstands: ein Jahr vor der japanischen
      Ausstrahlung (Trailer laufen vor der Premiere) bis drei Jahre danach.
    */
    if (jahr && titel.jpYear && (jahr < titel.jpYear - 1 || jahr > titel.jpYear + 3)) return false
    return true
  })
  if (!treffer.length) return null

  /* Mehrere Trailer zu einem Film: der jüngste ist der vollständigste. */
  const jüngster = treffer.sort((a, b) => b.am.localeCompare(a.am))[0]!
  return {
    video: jüngster.video,
    titel: jüngster.titel,
    herkunft: 'kanal',
    gefundenAm: new Date().toISOString().slice(0, 10),
  }
}

async function main(): Promise<void> {
  const schluessel = process.env.YOUTUBE_API_KEY
  const titles = readJson<Titel[]>('public/data/titles.json', [])
  const tmdb = readJson<Record<string, TmdbEintrag>>('data/tmdb-titles.json', {})
  const bestand = readJson<Record<string, TrailerEintrag>>('data/trailer.json', {})

  /*
    **Nur Filme** (Daniel: „für anime filme trailer"). KinoCheck ist ein
    Kinokanal; zu einer Fernsehstaffel gibt es dort in aller Regel nichts, und
    jeder Abruf dafür wäre ein Treffer, der keiner sein kann.
  */
  const filme = titles.filter((t) => t.format === 'MOVIE')
  const offen = filme.filter((t) => !bestand[String(t.id)])
  const dran = GRENZE > 0 ? offen.slice(0, GRENZE) : offen
  log(`${filme.length} Filme, ${offen.length} ohne Trailer, ${dran.length} in diesem Lauf`)
  if (!dran.length) return

  let ausKc = 0
  let ausKanal = 0

  /*
    **Der Index zuerst, KinoCheck für den Rest.**

    Beide Wege führen zu demselben Kanal; sie unterscheiden sich nur darin,
    wie zugeordnet wird — über die TMDB-Kennung (sicher) oder über den Namen
    (mit drei Riegeln). Der erste Entwurf fragte deshalb KinoCheck zuerst.

    Gemessen am 12.09.2026 ist das die teure Reihenfolge: 700 Filme, davon
    trifft der Index 19 — und KinoCheck kennt von unseren Filmen praktisch
    keinen unter seiner TMDB-Kennung. Das wären 700 Abrufe an einem fremden
    Server für nichts, bei einem Index, der lokal in Millisekunden antwortet.

    Also andersherum, und KinoCheck fragt nur, was der Index nicht kennt. Die
    Zuordnung bleibt dieselbe: Wo KinoCheck antwortet, trägt der Eintrag
    `herkunft: 'kinocheck'` und ist über die Kennung belegt.
  */
  const index = schluessel ? await kanalIndex(schluessel) : []
  if (!schluessel) warn('Kein YOUTUBE_API_KEY — der Kanalindex bleibt leer, es fragt nur KinoCheck.')

  for (const titel of dran) {
    const fund = ausIndex(titel, index)
    if (fund) {
      bestand[String(titel.id)] = fund
      ausKanal++
    }
  }

  /*
    **KinoCheck nur für das, was übrig bleibt — und nur, wo es etwas geben
    kann.** Der Kanal begleitet das Kinoprogramm; zu einem Film von 1998 gibt
    es dort nichts, und jeder Abruf dafür wäre ein Aufruf ins Leere. Die Grenze
    ist großzügig gesetzt: KinoCheck lädt auch ältere Filme nach, wenn sie neu
    ins Kino kommen.
  */
  const nochOffen = dran.filter((t) => !bestand[String(t.id)] && (t.jpYear ?? 0) >= 2012)
  for (const titel of nochOffen) {
    const eintrag = tmdb[String(titel.id)]
    if (!eintrag?.tmdbId) continue
    const fund = await ausKinocheck(eintrag.tmdbId, eintrag.kind ?? 'movie')
    if (fund) {
      bestand[String(titel.id)] = fund
      ausKc++
    }
    await sleep(250)
  }

  writeJson('data/trailer.json', bestand)
  /*
    **Null Funde sind hier der Normalfall**, sobald die 52 Trailer einmal
    stehen: Der Lauf sieht danach nur noch Filme, zu denen KinoCheck nichts
    hat. `leerIstOk` trennt das von „die Quelle antwortet nicht mehr" —
    dieselbe Unterscheidung, die `motn:changes` am 27.08.2026 gekostet hat.
  */
  recordSource('trailer', ausKc + ausKanal, undefined, dran.length, true)
  log(`${ausKc} über KinoCheck, ${ausKanal} über den Kanalindex · ${Object.keys(bestand).length} Trailer insgesamt`)
}

await main()
