/**
 * Liest den Veröffentlichungskalender von ADN (Animation Digital Network).
 *
 * Warum das die zweitbeste Quelle nach Crunchyroll ist: ADN betreibt eine
 * öffentliche JSON-Schnittstelle, die je Folge **Datum, Uhrzeit und
 * Sprachfassung** nennt. Der Sprachcode ist dabei das Entscheidende:
 *
 *   vde    — deutsche Synchronfassung
 *   vostde — japanischer Ton mit deutschen Untertiteln
 *
 * Damit beantwortet ADN von sich aus genau die Frage, für die es sonst keine
 * maschinenlesbare Antwort gibt: Gibt es eine deutsche Synchro, und wann läuft
 * sie? Kein Schätzen, kein Ableiten. Alles ohne `vde` ignorieren wir.
 *
 * Ein Aufruf je Tag, mit Pause dazwischen. Die Schnittstelle ist dieselbe, die
 * auch die Webseite benutzt; ein Schlüssel ist nicht nötig.
 *
 * Aufruf: npx tsx pipeline/fetch-adn.ts [--from -30] [--to 60]
 */
import { addDays, diffDays, todayIso } from '../shared/time.ts'
import { log, sleep, warn, writeJson } from './lib/util.ts'
import { searchMedia, type AniListMedia } from './lib/anilist.ts'
import { recordSource } from './lib/health.ts'

const BASE = 'https://gw.api.animationdigitalnetwork.com'
const API = `${BASE}/video/calendar`
/** Der Katalog aller Serien — anders als der Kalender zeitunabhängig. */
const SHOWS_API = `${BASE}/show`

/**
 * Wir sagen, wer wir sind.
 *
 * Hier stand bis zum 11.08.2026 eine Chrome-Kennung. Das war aus demselben
 * Grund falsch wie bei aniSearch, wo es eine IP-Sperre einbrachte: Eine
 * gefälschte Browser-Kennung nimmt dem Betreiber die Möglichkeit, den
 * Verursacher anzuschreiben, statt ihn auszusperren. Nötig war sie ohnehin nie
 * — mit ehrlicher Kennung antwortet dieselbe Schnittstelle mit 200.
 */
const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)'
const HEADERS = { 'User-Agent': UA, 'X-Target-Distribution': 'de', Accept: 'application/json' }

const args = process.argv.slice(2)
const numberArg = (name: string, fallback: number) => {
  const index = args.indexOf(name)
  return index >= 0 ? Number(args[index + 1]) : fallback
}
const FROM = numberArg('--from', -45)
const TO = numberArg('--to', 75)

interface AdnVideo {
  id: number
  number: string | null
  shortNumber: string | null
  releaseDate: string
  languages: string[]
  url: string
  show: { id: number; title: string; originalTitle: string | null; age: string | null; url?: string }
}

export interface AdnEpisode {
  /** ISO-Datum in Europe/Berlin. */
  date: string
  /** "HH:MM" in Europe/Berlin. */
  time: string
  episode?: number
  url: string
}

export interface AdnShow {
  showId: number
  title: string
  originalTitle?: string
  /** Altersfreigabe, wie ADN sie schreibt ("12+"). */
  age?: string
  url: string
  episodes: AdnEpisode[]
  /**
   * true, wenn alle bekannten Folgen auf denselben Termin fallen — ADN
   * veröffentlicht Katalogtitel als Komplettabwurf, Simulcasts wöchentlich.
   */
  batch: boolean
  /**
   * true, wenn der Eintrag aus dem Katalogdurchlauf stammt statt aus dem
   * Kalender.
   *
   * Der Unterschied zählt beim Bauen: Der Katalog-Endpunkt führt den
   * **französischen** Bestand — der Ton ist deutsch (sonst stünde der Titel
   * hier gar nicht), aber der Name ist es oft nicht: „One Piece Film 3 • Le
   * Royaume de Chopper" heißt auf Deutsch „One Piece – Chopper auf der Insel
   * der seltsamen Tiere". Deshalb wird für Katalogtitel der Name aus dem
   * zugeordneten Anime-Eintrag genommen, nicht der von ADN.
   */
  fromCatalog?: boolean
  /**
   * AniList-Kennung, im Katalog-Lauf über den Originaltitel nachgeschlagen.
   *
   * Nötig, weil der Namensabgleich beim Bauen an Schreibweisen scheitert:
   * ADN schreibt „One Piece Movie 3 : Chinjuu Shima no Chopper Oukoku“,
   * AniList „One Piece Movie 3: Chinjuu-jima no Chopper Oukoku“. Acht Filme
   * mit belegter deutscher Synchro fielen deswegen aus dem Datensatz — ein
   * Verlust, den die Suche für 35 Anfragen abwendet.
   */
  anilistId?: number
}

export interface AdnData {
  scrapedAt: string
  window: { from: string; to: string }
  shows: AdnShow[]
}

const berlin = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function toBerlin(iso: string): { date: string; time: string } | undefined {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return undefined
  const parts = berlin.formatToParts(dt)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

async function fetchDay(date: string): Promise<AdnVideo[]> {
  const res = await fetch(`${API}?date=${date}`, {
    headers: HEADERS,
  })
  if (!res.ok) {
    warn(`ADN ${date}: HTTP ${res.status}`)
    return []
  }
  const body = (await res.json()) as { videos?: AdnVideo[] }
  return body.videos ?? []
}

/**
 * Geht den gesamten ADN-Katalog durch, statt nur den Kalender.
 *
 * Warum das nötig ist: Der Kalender zeigt nur, was in einem Zeitfenster **neu**
 * erscheint. Eine Serie, die vollständig im Angebot liegt und keine neue Folge
 * mehr bekommt, taucht dort nie auf — sie fehlte damit dauerhaft, obwohl es
 * eine deutsche Synchro gibt. Für das Projektziel „Gesamtüberblick" ist das
 * genau die falsche Lücke.
 *
 * Warum es trotzdem nicht im Nachtlauf steht: Der Katalog-Endpunkt liefert nur
 * den **französischen** Bestand samt französischer Sprachcodes; welche Serie
 * eine deutsche Fassung hat, verrät erst eine Abfrage je Serie. Das sind rund
 * 580 Anfragen — vertretbar als seltener Lauf, nicht als täglicher.
 *
 * Ertrag laut Stichprobe vom 11.08.2026: etwa drei Prozent der Serien haben
 * `vde`; die meisten des französischen Katalogs sind in Deutschland gar nicht
 * verfügbar (die Folgenliste kommt dann leer zurück).
 */
/**
 * Suchbegriffe für einen ADN-Titel, vom vollständigsten zum knappsten.
 *
 * ADN und AniList benennen dieselben Filme unterschiedlich: „One Piece Movie 3
 * : Chinjuu Shima no Chopper Oukoku" gegenüber „ONE PIECE: Chinjuu-jima no
 * Chopper Oukoku". Zwei Dinge brechen die Suche — die Zählung „Movie 3", die
 * AniList gar nicht führt, und der Teil vor dem Doppelpunkt. Mit dem vollen
 * String findet man nichts, mit dem Namensteil dahinter sofort den richtigen
 * Film. Deshalb nacheinander probieren statt einmal raten.
 */
function sucheVarianten(...titel: (string | undefined)[]): string[] {
  const varianten: string[] = []
  for (const t of titel) {
    if (!t) continue
    varianten.push(t)
    // Ohne Diakritika: ADN schreibt „Kyôkai no Kanata" und „Haikyū!!", AniList
    // „Kyoukai no Kanata" und „Haikyuu!!". Ein Zirkumflex genügt, damit die
    // Suche ins Leere greift.
    const schlicht = t.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (schlicht !== t) varianten.push(schlicht)
    // Alles nach dem letzten Doppelpunkt — dort steht der eigentliche Name.
    const nachDoppelpunkt = t.split(/\s*:\s*/).slice(1).join(': ').trim()
    if (nachDoppelpunkt.length > 4) varianten.push(nachDoppelpunkt)
    // Ohne die Zählung („Movie 3", „Film 3", „OVA 2").
    const ohneZaehlung = t.replace(/\b(movie|film|ova|special)\s*\d+\b/gi, '').replace(/\s{2,}/g, ' ').trim()
    if (ohneZaehlung.length > 4 && ohneZaehlung !== t) varianten.push(ohneZaehlung)
    // Zuletzt nur der Namenskern: die letzten drei, dann zwei Wörter. Eine
    // einzelne abweichende Silbe reicht sonst für einen Fehlschlag — ADN
    // schreibt „Chinjuu Shima no Chopper Oukoku", AniList „Chinjuu-jima…";
    // „Chopper Oukoku" trifft dagegen sofort. Unter zwei Wörtern wird nicht
    // gekürzt, sonst passt irgendwann jedes „Season 2".
    const woerter = ohneZaehlung.split(/\s+/).filter(Boolean)
    for (const n of [3, 2]) {
      if (woerter.length > n) varianten.push(woerter.slice(-n).join(' '))
    }
  }
  return [...new Set(varianten)]
}

/**
 * Gegenprobe für einen Suchtreffer — greift die kurzen Varianten ab.
 *
 * Die Kürzung auf den Namenskern rettet Fälle wie „Chinjuu Shima" gegen
 * „Chinjuu-jima", trifft mit zwei Wörtern aber auch beliebiges: „no Bouken"
 * fand „The Enchanted Journey", „to Kaizoku Tachi" fand „Galactic Pirates" —
 * beides keine One-Piece-Filme. Ein falsch zugeordneter Titel ist schlimmer
 * als ein fehlender: Er bringt Cover, Beschreibung und Genres eines fremden
 * Werks mit.
 *
 * Deshalb muss der Treffer ein aussagekräftiges Wort mit dem ADN-Titel teilen.
 * Kurze Füllwörter zählen nicht — sonst genügte „no" oder „the".
 */
function passtZuSerie(show: { title: string; originalTitle?: string }, media: AniListMedia): boolean {
  const woerterVon = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    )
  const unsere = new Set([...woerterVon(show.title), ...woerterVon(show.originalTitle ?? '')])
  const ihre = woerterVon(
    [media.title.romaji, media.title.english, media.title.native].filter(Boolean).join(' '),
  )
  for (const wort of unsere) if (ihre.has(wort)) return true
  return false
}

async function fetchCatalog(): Promise<AdnShow[]> {
  /**
   * Die Serienliste einsammeln — nach eindeutigen Kennungen, nicht nach `total`.
   *
   * Der Endpunkt paginiert unzuverlässig: Die Reihenfolge ist nicht sortiert,
   * `offset=200` bricht nach 46 Einträgen ab, und `total` meldet trotzdem
   * weiter 580 — das ist die Größe des **französischen** Katalogs, während mit
   * deutschem Regionskopf nur ein Teil davon ausgeliefert wird. Wer `total` als
   * Abbruchbedingung nimmt, sammelt Wiederholungen ein und hält am Ende
   * dieselbe Serie mehrfach in der Hand (real: 12 Doubletten unter 47 Treffern).
   *
   * Deshalb: nach Kennung entdoppeln und abbrechen, wenn zwei Seiten in Folge
   * nichts Neues mehr bringen.
   */
  const nachId = new Map<number, { id: number; title: string; originalTitle?: string; age?: string }>()
  let leerlauf = 0
  for (let offset = 0; offset < 2000 && leerlauf < 2; offset += 100) {
    const res = await fetch(`${SHOWS_API}?limit=100&offset=${offset}`, { headers: HEADERS })
    if (!res.ok) {
      warn(`ADN-Katalog: HTTP ${res.status} bei offset ${offset}`)
      break
    }
    const body = (await res.json()) as { shows?: { id: number; title: string }[] }
    const seite = body.shows ?? []
    if (!seite.length) break
    const vorher = nachId.size
    for (const s of seite) if (!nachId.has(s.id)) nachId.set(s.id, s as never)
    leerlauf = nachId.size === vorher ? leerlauf + 1 : 0
    await sleep(400)
  }
  const alle = [...nachId.values()]
  log(`ADN-Katalog: ${alle.length} Serien gelistet, wird je Serie auf deutsche Synchro geprüft…`)

  const out: AdnShow[] = []
  let geprueft = 0
  let fehlerInFolge = 0
  for (const eintrag of alle) {
    geprueft++
    if (geprueft % 100 === 0) log(`  ${geprueft}/${alle.length} — ${out.length} mit Synchro`)
    try {
      // 100 ist das Maximum der Schnittstelle; sie nennt es selbst in ihrer
      // Fehlermeldung. Ein zu großer Wert liefert 400 — und weil ein 400 hier
      // zunächst wie „nicht verfügbar" behandelt wurde, meldete der erste Lauf
      // seelenruhig „0 Serien mit deutscher Synchro" für alle 580. Deshalb
      // unterscheidet die Schleife unten strikt: 404 ist eine Antwort, 400 ist
      // ein Fehler im eigenen Aufruf und muss auffallen.
      const res = await fetch(`${BASE}/video/show/${eintrag.id}?limit=100`, { headers: HEADERS })
      if (res.status === 400) {
        warn(`ADN-Katalog: Anfrage abgelehnt (400) bei Serie ${eintrag.id} — Aufruf prüfen.`)
        if (++fehlerInFolge >= 5) {
          warn('Fünf abgelehnte Anfragen in Folge — Lauf wird beendet.')
          break
        }
        await sleep(700)
        continue
      }
      if (!res.ok) {
        // 404 heißt hier schlicht „in Deutschland nicht im Angebot".
        if (res.status >= 500 && ++fehlerInFolge >= 5) {
          warn('ADN-Katalog: fünf Serverfehler in Folge — Lauf wird beendet.')
          break
        }
        await sleep(700)
        continue
      }
      fehlerInFolge = 0
      const videos = ((await res.json()) as { videos?: AdnVideo[] }).videos ?? []
      const deutsch = videos.filter((v) => v.languages?.includes('vde'))
      if (deutsch.length) {
        const episodes: AdnEpisode[] = []
        for (const v of deutsch) {
          const when = toBerlin(v.releaseDate)
          if (!when) continue
          const number = Number(v.shortNumber ?? v.number?.replace(/\D+/g, ''))
          episodes.push({
            date: when.date,
            time: when.time,
            episode: Number.isFinite(number) && number > 0 ? number : undefined,
            url: v.url,
          })
        }
        if (episodes.length) {
          episodes.sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
          const dates = new Set(episodes.map((e) => e.date))
          out.push({
            showId: eintrag.id,
            title: eintrag.title,
            originalTitle: eintrag.originalTitle ?? undefined,
            age: eintrag.age ?? undefined,
            url: `https://animationdigitalnetwork.com/de/video/${eintrag.id}`,
            episodes,
            batch: dates.size === 1 && episodes.length > 1,
            fromCatalog: true,
          })
        }
      }
    } catch (err) {
      warn(`ADN-Katalog ${eintrag.id}: ${(err as Error).message}`)
    }
    await sleep(700)
  }

  // Zuordnung nachschlagen, solange wir online sind.
  //
  // Der Namensabgleich beim Bauen scheitert an Schreibweisen — ADN schreibt
  // „One Piece Movie 3 : Chinjuu Shima no Chopper Oukoku", AniList
  // „Chinjuu-jima". Acht Filme mit belegter deutscher Synchro fielen deshalb
  // heraus. Die Suche kostet eine Anfrage je Treffer und rettet sie.
  log(`ADN-Katalog: ${out.length} Treffer, Zuordnung wird nachgeschlagen…`)
  for (const show of out) {
    try {
      // Beide Namen anbieten: Der Originaltitel trägt oft Makra und
      // Zirkumflexe, der Anzeigename ist die schlichtere Schreibweise —
      // „Haikyū!!" gegen „Haikyu!!". Welcher trifft, weiß man vorher nicht.
      for (const begriff of sucheVarianten(show.originalTitle, show.title)) {
        const media = await searchMedia(begriff)
        if (media?.id && passtZuSerie(show, media)) {
          show.anilistId = media.id
          break
        }
      }
    } catch (err) {
      warn(`ADN-Katalog: Suche für "${show.title}" fehlgeschlagen: ${(err as Error).message}`)
    }
  }
  const zugeordnet = out.filter((s) => s.anilistId).length
  log(`ADN-Katalog: ${zugeordnet} von ${out.length} einem Anime zugeordnet`)
  return out
}

async function main(): Promise<void> {
  if (args.includes('--catalog')) {
    const shows = await fetchCatalog()
    writeJson(
      'data/adn-catalog.json',
      { scrapedAt: new Date().toISOString(), window: { from: '', to: '' }, shows } satisfies AdnData,
      true,
    )
    recordSource('adn-catalog', shows.length, shows.length ? undefined : 'keine Serie mit vde')
    log(`ADN-Katalog: ${shows.length} Serien mit deutscher Synchro`)
    for (const show of shows) {
      log(`  · ${show.title} — ${show.episodes.length} Folgen ab ${show.episodes[0].date}`)
    }
    return
  }

  const today = todayIso()
  const from = addDays(today, FROM)
  const to = addDays(today, TO)

  const byShow = new Map<number, AdnShow>()
  let days = 0
  let dubbed = 0

  for (let date = from; date <= to; date = addDays(date, 1)) {
    let videos: AdnVideo[]
    try {
      videos = await fetchDay(date)
    } catch (err) {
      warn(`ADN ${date}: ${(err as Error).message}`)
      continue
    }
    days++

    for (const video of videos) {
      // Nur die deutsche Synchronfassung. Untertitel sind für diesen Kalender
      // keine deutsche Veröffentlichung.
      if (!video.languages?.includes('vde')) continue
      dubbed++
      const when = toBerlin(video.releaseDate)
      if (!when) continue

      const show = byShow.get(video.show.id) ?? {
        showId: video.show.id,
        title: video.show.title,
        originalTitle: video.show.originalTitle ?? undefined,
        age: video.show.age ?? undefined,
        url: `https://animationdigitalnetwork.com/de/video/${video.show.id}`,
        episodes: [],
        batch: false,
      }
      const number = Number(video.shortNumber ?? video.number?.replace(/\D+/g, ''))
      show.episodes.push({
        date: when.date,
        time: when.time,
        episode: Number.isFinite(number) && number > 0 ? number : undefined,
        url: video.url,
      })
      byShow.set(video.show.id, show)
    }
    await sleep(220)
  }

  if (!days) {
    recordSource('adn', 0, 'kein einziger Tag abrufbar')
    warn('ADN nicht erreichbar — Bestand bleibt unangetastet.')
    return
  }
  recordSource('adn', byShow.size, byShow.size ? undefined : 'keine Folge mit vde gefunden')

  const shows = [...byShow.values()].map((show) => {
    show.episodes.sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
    const dates = new Set(show.episodes.map((e) => e.date))
    return { ...show, batch: dates.size === 1 && show.episodes.length > 1 }
  })

  writeJson('data/adn.json', { scrapedAt: new Date().toISOString(), window: { from, to }, shows } satisfies AdnData, true)

  log(`ADN: ${days} Tage geprüft, ${dubbed} Folgen mit deutscher Synchro, ${shows.length} Serien`)
  for (const show of shows) {
    const first = show.episodes[0]
    const span = show.episodes.length > 1 ? diffDays(first.date, show.episodes.at(-1)!.date) : 0
    log(
      `  · ${show.title} — ${show.batch ? 'Komplettabwurf' : 'wöchentlich'}, ` +
        `ab ${first.date} ${first.time}, ${show.episodes.length} Folgen${span ? ` über ${span} Tage` : ''}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
