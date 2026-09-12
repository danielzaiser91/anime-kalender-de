/**
 * **Trailer zu Anime-Filmen — deutsch, wo es einen gibt.**
 *
 * Daniel am 12.09.2026: „pack für anime filme trailer von diesem kanal" — und
 * einen Prompt später, nachdem der zweite Kanal aufgetaucht war: „finde selbst
 * heraus wo alle anime kinofilm trailer erscheinen, bzw finde entsprechende
 * trailer in deutscher sprache … falls suche keine treffer zu einem kinofilm
 * findet, dann entsprechenden hinweis anbinden auf der webseite, zB bei
 * trailer button sagen ‚trailer in <sprache> - einen deutschen trailer haben
 * wir noch nicht gefunden'."
 *
 * **Drei Wege, in dieser Reihenfolge — und die Reihenfolge ist gemessen.**
 *
 * 1. **Der Kanalindex.** KinoCheck betreibt zwei deutsche Kanäle, und welcher
 *    Film wohin geht, folgt keiner Regel: „A New Dawn" liegt auf dem
 *    Hauptkanal, „All You Need Is Kill" auf dem Anime-Kanal (beide von Daniel
 *    belegt). Beide Uploads-Playlists zusammen sind rund 8.500 Videos — 171
 *    Aufrufe à eine Kontingenteinheit, gegen 100 Einheiten für eine einzige
 *    `search.list`. Der Abgleich läuft danach lokal und kostet nichts.
 * 2. **KinoChecks offizielle API** über die TMDB-Kennung — eine Zuordnung ohne
 *    Namensvergleich. Sie kennt aber längst nicht jeden Film: Für „A New Dawn"
 *    (TMDB 900438) antwortet sie „movie not found", obwohl der Trailer auf
 *    ihrem Kanal liegt.
 * 3. **TMDBs eigene Videoliste.** Sie führt je Film alle Trailer mit
 *    Sprachcode — und dort stehen deutsche, die auf keinem KinoCheck-Kanal
 *    liegen (gemessen an „Demon Slayer: Infinity Castle" und einem zweiten
 *    Film, beide mit `de/Trailer/YouTube`). Findet sich kein deutscher, nimmt
 *    der Lauf den englischen, sonst den japanischen — und schreibt die Sprache
 *    dazu, damit die Seite es sagen kann.
 *
 * **Der Namensabgleich in Weg 1 hat drei Riegel**, und der dritte hat sofort
 * getragen: Der Videotitel muss vor dem Wort „Trailer" genau unseren Filmnamen
 * tragen, er muss „German" oder „Deutsch" nennen, und sein Jahr muss in ein
 * Fenster von einem Jahr vor bis drei Jahre nach der japanischen Ausstrahlung
 * fallen. Ohne das Fenster fing „Elysium" (unser Anime von 2003) den
 * gleichnamigen Sci-Fi-Film von 2013.
 *
 * **Wiedervorlage statt Endgültigkeit.** Ein Film ohne deutschen Trailer wird
 * bei jedem Lauf erneut gesucht — ein Trailer erscheint Wochen vor dem
 * Kinostart, und ein Eintrag, der einmal „nichts gefunden" sagt, verhindert
 * sonst seine eigene Überprüfung (dieselbe Falle wie bei jeder Warteschlange,
 * die sich aus „schon beantwortet" bildet). Ein **deutscher** Fund ist dagegen
 * fertig und wird nur noch auf Erreichbarkeit geprüft.
 *
 * **Und die Adressen veralten.** Daniel: „links müssen regelmäßig geprüft
 * werden ob sie noch existieren, weil es sein kann das die videos nach einer
 * zeit entfernt werden." `videos.list` beantwortet das für 50 Kennungen auf
 * einmal, also für den ganzen Bestand mit zwei Einheiten. Was YouTube nicht
 * mehr kennt, fliegt raus und steht beim nächsten Lauf wieder zur Suche an.
 *
 * Aufruf: `tsx pipeline/fetch-trailer.ts [--limit N]`
 * Ergebnis: `data/trailer.json`
 */
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

/**
 * **Die Kanäle, in dieser Reihenfolge.**
 *
 * YouTube bildet die Uploads-Playlist aus der Kanalkennung, indem es das
 * zweite Zeichen von `C` auf `U` setzt. Der Anime-Kanal steht vorn: Er ist
 * klein und trifft genauer, der Hauptkanal führt das ganze Kinoprogramm.
 */
const KANAELE = [
  { name: 'KinoCheck Anime', uploads: 'UUDzr05xghFB7lhSJqUVPPlg' },
  { name: 'KinoCheck', uploads: 'UUOL10n-as9dXO2qtjjFUQbQ' },
]
const KINOCHECK = 'https://api.kinocheck.de'
const TMDB = 'https://api.themoviedb.org/3'
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

interface Video {
  video: string
  titel: string
  am: string
  kanal: string
}

export interface TrailerEintrag {
  /** Die YouTube-Kennung — alles, was die Oberfläche zum Einbetten braucht. */
  video: string
  /** Der Titel des Videos, damit im Dialog steht, was dort läuft. */
  titel: string
  /**
   * **Die Sprache des Trailers.**
   *
   * `de` ist das Ziel; `en` und `ja` sind der Rückfall, und dann sagt die
   * Seite es dem Leser, statt einen fremdsprachigen Trailer als das
   * auszugeben, was er nicht ist.
   */
  sprache: 'de' | 'en' | 'ja'
  /** Woher die Zuordnung stammt — `kanal`, `kinocheck` (TMDB-Kennung) oder `tmdb`. */
  herkunft: 'kanal' | 'kinocheck' | 'tmdb'
  gefundenAm: string
  /** Wann die Adresse zuletzt erreichbar war. */
  geprueftAm?: string
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

function heute(): string {
  return new Date().toISOString().slice(0, 10)
}

async function holeJson(url: string): Promise<unknown> {
  const antwort = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!antwort.ok) return null
  return antwort.json()
}

/** Der Index beider Kanäle, einmal am Tag geholt. */
async function kanalIndex(schluessel: string): Promise<Video[]> {
  const cache = readJson<{ geholtAm?: string; videos?: Video[] }>('data/cache/kinocheck-kanal.json', {})
  if (cache.geholtAm === heute() && cache.videos?.length) {
    log(`${cache.videos.length} Kanalvideos aus dem Zwischenspeicher`)
    return cache.videos
  }

  const videos: Video[] = []
  for (const kanal of KANAELE) {
    let seite: string | undefined
    let gezaehlt = 0
    do {
      const url =
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50` +
        `&playlistId=${kanal.uploads}&key=${schluessel}${seite ? `&pageToken=${seite}` : ''}`
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
            kanal: kanal.name,
          })
          gezaehlt++
        }
      }
      seite = daten.nextPageToken
      /* Das Kontingent ist großzügig, die Höflichkeit kostet nichts. */
      await sleep(120)
    } while (seite)
    log(`  ${kanal.name}: ${gezaehlt} Videos`)
  }

  writeJson('data/cache/kinocheck-kanal.json', { geholtAm: heute(), videos })
  log(`${videos.length} Videos im Kanalindex`)
  return videos
}

/**
 * **Weg 1 — der Index, mit drei Riegeln.**
 *
 * Verglichen wird gegen **jede** Schreibweise unseres Titels: KinoCheck nimmt
 * den international gebräuchlichen Namen, und der ist mal unser deutscher, mal
 * unser englischer.
 */
function ausIndex(titel: Titel, index: Video[]): TrailerEintrag | null {
  const namen = new Set([titel.titleDe, titel.titleEn, titel.titleRomaji].filter(Boolean).map((n) => normal(n!)))
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
  const juengster = treffer.sort((a, b) => b.am.localeCompare(a.am))[0]!
  return { video: juengster.video, titel: juengster.titel, sprache: 'de', herkunft: 'kanal', gefundenAm: heute() }
}

/**
 * **Weg 2 — KinoCheck über die TMDB-Kennung.**
 *
 * Der Endpunkt antwortet mit HTTP 404 und `movie not found`, wenn er den Film
 * nicht führt. Das ist keine Auskunft über den Trailer, sondern über die
 * Zuordnung; der Aufrufer geht dann weiter.
 */
async function ausKinocheck(tmdbId: number, art: string): Promise<TrailerEintrag | null> {
  const pfad = art === 'movie' ? 'movies' : 'shows'
  const daten = (await holeJson(`${KINOCHECK}/${pfad}?tmdb_id=${tmdbId}&language=de&categories=Trailer`)) as {
    trailer?: { youtube_video_id?: string; title?: string }
  } | null
  const video = daten?.trailer?.youtube_video_id
  if (!video) return null
  return { video, titel: daten?.trailer?.title ?? '', sprache: 'de', herkunft: 'kinocheck', gefundenAm: heute() }
}

/**
 * **Weg 3 — TMDBs Videoliste, deutsch zuerst.**
 *
 * Sie führt je Film alle Trailer mit Sprachcode. Genommen wird ein `Trailer`
 * oder `Teaser` auf YouTube, in der Reihenfolge `de`, `en`, `ja` — und nur
 * daraus entsteht ein fremdsprachiger Eintrag, denn nur hier ist die Sprache
 * belegt statt aus einem Videotitel geraten.
 *
 * Ein Teaser zählt mit: Er beantwortet dieselbe Frage wie ein Trailer — worum
 * geht es. `Featurette`, `Clip` und `Behind the Scenes` nicht; die setzen
 * voraus, dass man den Film schon kennt.
 */
async function ausTmdb(tmdbId: number, art: string, schluessel: string): Promise<TrailerEintrag | null> {
  const pfad = art === 'movie' ? 'movie' : 'tv'
  const daten = (await holeJson(`${TMDB}/${pfad}/${tmdbId}/videos?api_key=${schluessel}`)) as {
    results?: { key?: string; name?: string; site?: string; type?: string; iso_639_1?: string; published_at?: string }[]
  } | null
  const brauchbar = (daten?.results ?? []).filter(
    (v) => v.site === 'YouTube' && v.key && (v.type === 'Trailer' || v.type === 'Teaser'),
  )
  for (const sprache of ['de', 'en', 'ja'] as const) {
    const passend = brauchbar
      .filter((v) => v.iso_639_1 === sprache)
      /* Der jüngste zuerst — er zeigt den fertigen Film, nicht die erste Ankündigung. */
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    const fund = passend[0]
    if (fund?.key) return { video: fund.key, titel: fund.name ?? '', sprache, herkunft: 'tmdb', gefundenAm: heute() }
  }
  return null
}

/**
 * **Was YouTube nicht mehr kennt, fliegt raus.**
 *
 * `videos.list` nimmt 50 Kennungen auf einmal und kostet eine Einheit; der
 * ganze Bestand ist damit in zwei Aufrufen geprüft. Wer fehlt, wurde entfernt
 * oder auf privat gestellt — der Eintrag verschwindet und der Film steht beim
 * nächsten Lauf wieder zur Suche an, statt auf eine tote Adresse zu zeigen.
 */
async function pruefeAdressen(bestand: Record<string, TrailerEintrag>, schluessel: string): Promise<number> {
  const ids = [...new Set(Object.values(bestand).map((e) => e.video))]
  if (!ids.length) return 0
  const lebt = new Set<string>()
  for (let i = 0; i < ids.length; i += 50) {
    const teil = ids.slice(i, i + 50)
    const daten = (await holeJson(
      `https://www.googleapis.com/youtube/v3/videos?part=id&id=${teil.join(',')}&key=${schluessel}`,
    )) as { items?: { id?: string }[] } | null
    /*
      **Keine Antwort ist kein Befund.** Fällt der Abruf aus, gälten sonst alle
      50 als tot und der Bestand wäre weg — dieselbe Unterscheidung wie
      zwischen `dub: false` und `dub: undefined`.
    */
    if (!daten) return 0
    for (const eintrag of daten.items ?? []) if (eintrag.id) lebt.add(eintrag.id)
    await sleep(120)
  }
  let weg = 0
  for (const [id, eintrag] of Object.entries(bestand)) {
    if (lebt.has(eintrag.video)) {
      eintrag.geprueftAm = heute()
    } else {
      delete bestand[id]
      weg++
      log(`  Trailer zu ${id} ist bei YouTube weg — Eintrag entfernt`)
    }
  }
  return weg
}

async function main(): Promise<void> {
  const schluessel = process.env.YOUTUBE_API_KEY
  const tmdbSchluessel = process.env.TMDB_API_KEY
  const titles = readJson<Titel[]>('public/data/titles.json', [])
  const tmdb = readJson<Record<string, TmdbEintrag>>('data/tmdb-titles.json', {})
  const bestand = readJson<Record<string, TrailerEintrag>>('data/trailer.json', {})

  /*
    **Nur Filme** (Daniel: „für anime filme trailer"). KinoCheck ist ein
    Kinokanal; zu einer Fernsehstaffel gibt es dort in aller Regel nichts.
  */
  const filme = titles.filter((t) => t.format === 'MOVIE')

  /* Zuerst aufräumen: Ein toter Eintrag soll in derselben Runde neu gesucht werden. */
  const weg = schluessel ? await pruefeAdressen(bestand, schluessel) : 0

  /*
    **Wiedervorlage:** Wer keinen **deutschen** Trailer hat, kommt wieder dran.
    Das schließt die Filme mit fremdsprachigem Rückfall ein — erscheint später
    ein deutscher, ersetzt er ihn.
  */
  const offen = filme.filter((t) => bestand[String(t.id)]?.sprache !== 'de')
  const dran = GRENZE > 0 ? offen.slice(0, GRENZE) : offen
  log(`${filme.length} Filme · ${weg} tote Adressen entfernt · ${dran.length} ohne deutschen Trailer`)
  if (!dran.length) {
    recordSource('trailer', 0, undefined, filme.length, true)
    writeJson('data/trailer.json', bestand)
    return
  }

  let ausKanal = 0
  let ausKc = 0
  let ausTmdbDe = 0
  let fremd = 0

  const index = schluessel ? await kanalIndex(schluessel) : []
  if (!schluessel) warn('Kein YOUTUBE_API_KEY — kein Kanalindex und keine Adressprüfung.')

  for (const titel of dran) {
    const fund = ausIndex(titel, index)
    if (fund) {
      bestand[String(titel.id)] = fund
      ausKanal++
    }
  }

  /*
    **Die beiden Schnittstellen nur für das, was übrig bleibt — und nur, wo es
    etwas geben kann.** KinoCheck begleitet das Kinoprogramm; zu einem Film von
    1998 gibt es dort nichts. TMDB dagegen führt auch alte Filme, wird also
    ohne Jahresgrenze gefragt.
  */
  const nochOffen = dran.filter((t) => bestand[String(t.id)]?.sprache !== 'de')
  for (const titel of nochOffen) {
    const eintrag = tmdb[String(titel.id)]
    if (!eintrag?.tmdbId) continue

    if ((titel.jpYear ?? 0) >= 2012) {
      const vonKc = await ausKinocheck(eintrag.tmdbId, eintrag.kind ?? 'movie')
      await sleep(250)
      if (vonKc) {
        bestand[String(titel.id)] = vonKc
        ausKc++
        continue
      }
    }

    if (!tmdbSchluessel) continue
    const vonTmdb = await ausTmdb(eintrag.tmdbId, eintrag.kind ?? 'movie', tmdbSchluessel)
    await sleep(120)
    if (!vonTmdb) continue
    /*
      Ein fremdsprachiger Fund überschreibt keinen anderen fremdsprachigen —
      sonst wechselte die Sprache bei jedem Lauf, je nachdem, was TMDB gerade
      zuerst nennt. Ein deutscher überschreibt immer.
    */
    const bisher = bestand[String(titel.id)]
    if (vonTmdb.sprache === 'de') {
      bestand[String(titel.id)] = vonTmdb
      ausTmdbDe++
    } else if (!bisher) {
      bestand[String(titel.id)] = vonTmdb
      fremd++
    }
  }

  writeJson('data/trailer.json', bestand)
  const deutsche = Object.values(bestand).filter((e) => e.sprache === 'de').length
  /*
    **Null Funde sind hier der Normalfall**, sobald der Bestand steht: Der Lauf
    sieht danach nur noch Filme, zu denen es nichts gibt. `leerIstOk` trennt
    das von „die Quelle antwortet nicht mehr" — dieselbe Unterscheidung, die
    `motn:changes` am 27.08.2026 gekostet hat.
  */
  recordSource('trailer', ausKanal + ausKc + ausTmdbDe + fremd, undefined, dran.length, true)
  log(
    `${ausKanal} über den Kanalindex, ${ausKc} über KinoCheck, ${ausTmdbDe} deutsche über TMDB, ` +
      `${fremd} fremdsprachig · ${deutsche} deutsche von ${Object.keys(bestand).length} Trailern`,
  )
}

await main()
