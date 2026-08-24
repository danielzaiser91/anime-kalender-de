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
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { addDays, diffDays, todayIso } from '../shared/time.ts'
import { log, readJson, ROOT, sleep, warn, writeJson } from './lib/util.ts'
import { searchMedia } from './lib/anilist.ts'
import { recordSource } from './lib/health.ts'
import {
  bestimmeRhythmus,
  bewerteTreffer,
  passtZuSerie,
  volltreffer,
  type AdnData,
  type AdnEpisode,
  type AdnShow,
} from './lib/adn.ts'

// Weiterhin von hier aus verfügbar — die Typen wanderten nach `lib/adn.ts`,
// weil `build.ts` sie braucht, diese Datei aber beim Laden ihr `main()` startet.
export type { AdnData, AdnEpisode, AdnShow } from './lib/adn.ts'

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
  title?: string | null
  /** Folgentitel, oft französisch oder leer. */
  name?: string | null
  number: string | null
  shortNumber: string | null
  /** Staffel, wie ADN sie zählt: "1", "2", "3". */
  season?: string | null
  /** Kennung samt Staffel und Folge: "swordartonline_tv3_0047". */
  reference?: string | null
  /** Laufende Nummer über die gesamte Serie hinweg. */
  order?: number | null
  /** "EPS" (Folge), "OAV", "FLM" … */
  type?: string | null
  /** Laufzeit in Sekunden. */
  duration?: number | null
  image?: string | null
  releaseDate: string
  languages: string[]
  url: string
  show: { id: number; title: string; originalTitle: string | null; age: string | null; url?: string }
}

/**
 * Baut aus einem ADN-Video unseren Folgeneintrag — an einer Stelle, damit
 * Kalender- und Katalogweg nicht auseinanderlaufen.
 *
 * Genau das war vorher der Fall: Beide Wege bauten das Objekt von Hand, und
 * beide vergaßen dieselben Felder.
 */
function episodeAus(video: AdnVideo, when: { date: string; time: string }): AdnEpisode {
  const nummer = Number(video.shortNumber ?? video.number?.replace(/\D+/g, ''))
  return {
    date: when.date,
    time: when.time,
    episode: Number.isFinite(nummer) && nummer > 0 ? nummer : undefined,
    url: video.url,
    season: video.season ?? undefined,
    // Die Folgennummer am Ende abschneiden: "swordartonline_tv3_0047" →
    // "swordartonline_tv3".
    seasonReference: video.reference?.replace(/_\d+$/, '') || undefined,
    order: typeof video.order === 'number' ? video.order : undefined,
    type: video.type ?? undefined,
    duration: typeof video.duration === 'number' ? video.duration : undefined,
    title: video.name || video.title || undefined,
    image: video.image ?? undefined,
  }
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


/** Ordnet Folgen nach Staffel, dann Nummer, dann Termin. */
function sortiereFolgen(episodes: AdnEpisode[]): void {
  episodes.sort(
    (a, b) =>
      (a.season ?? '').localeCompare(b.season ?? '') ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.date.localeCompare(b.date) ||
      (a.episode ?? 0) - (b.episode ?? 0),
  )
}

/** Wohin die Rohantworten je Serie wandern. */
const ARCHIV_DIR = resolve(ROOT, 'data/adn-raw')

/**
 * Legt die vollständige Antwort einer Serie gzip-komprimiert ab.
 *
 * Aus demselben Grund wie beim aniSearch-Archiv, und aus einem zusätzlichen,
 * der am 12.08.2026 real geworden ist: Der Abruf hatte `season`, `reference`,
 * `order`, `type` und `duration` von Anfang an in der Hand und warf sie weg.
 * Als die Staffelangabe gebraucht wurde, war der einzige Weg dorthin ein
 * kompletter zweiter Lauf über alle Serien — Last auf einem fremden Server für
 * Daten, die längst über die Leitung gegangen waren.
 *
 * Eine Datei je Serie, unverändert nicht neu geschrieben: Git speichert binäre
 * Dateien komplett neu, ein Sammelarchiv landete sonst bei jedem Lauf in voller
 * Größe in der Historie.
 */
function archiviereSerie(showId: number, videos: AdnVideo[]): void {
  if (!existsSync(ARCHIV_DIR)) mkdirSync(ARCHIV_DIR, { recursive: true })
  const pfad = `${ARCHIV_DIR}/${showId}.json.gz`
  const neu = gzipSync(JSON.stringify({ showId, videos }), { level: 9 })
  if (existsSync(pfad) && readFileSync(pfad).equals(neu)) return
  writeFileSync(pfad, neu)
}

/**
 * Liest Kennung, Namen und Freigabe einer Serie aus dem Archiv.
 *
 * Die Rohantwort trägt zu jeder Folge den vollständigen `show`-Block. Damit
 * lässt sich eine Serie, die in der aktuellen Liste fehlt, wieder in die
 * Warteschlange stellen — ohne einen einzigen zusätzlichen Abruf.
 */
function archivKopf(showId: number): { id: number; title: string; originalTitle?: string; age?: string } | undefined {
  try {
    const roh = JSON.parse(gunzipSync(readFileSync(`${ARCHIV_DIR}/${showId}.json.gz`)).toString()) as {
      videos?: { show?: { id?: number; title?: string; originalTitle?: string; age?: string } }[]
    }
    const show = roh.videos?.find((v) => v.show?.title)?.show
    if (!show?.title) return undefined
    return { id: showId, title: show.title, originalTitle: show.originalTitle ?? undefined, age: show.age ?? undefined }
  } catch {
    // Kaputte oder fremdformatige Datei — dann eben nicht. Der nächste Lauf
    // schreibt sie neu, sobald die Serie wieder in der Liste auftaucht.
    return undefined
  }
}

/**
 * Holt **alle** Folgen einer Serie — seitenweise.
 *
 * Hier stand `?limit=100` ohne `offset`. Das war kein Limit, sondern stiller
 * Datenverlust, und der schlimmste Teil: Die Schnittstelle liefert die
 * **neuesten** Folgen zuerst, abgeschnitten wurde also der Anfang. Gemessen am
 * 12.08.2026 fehlten dadurch 99 von 199 Folgen bei Sailor Moon, 45 von 145 bei
 * Eyeshield 21 und 31 von 131 bei Dragon Ball Super — und bei Sailor Moon
 * gleich die beiden frühesten Veröffentlichungstermine, weshalb der Datensatz
 * den 23.12.2025 als Start führte statt des richtigen 29.10.2025.
 *
 * 100 ist das Maximum je Seite; die Schnittstelle nennt es selbst in ihrer
 * Fehlermeldung. Ein größerer Wert liefert 400 — und weil ein 400 einmal wie
 * „nicht verfügbar" behandelt wurde, meldete ein früherer Lauf seelenruhig
 * „0 Serien mit deutscher Synchro" für alle 580. Deshalb wird hier strikt
 * unterschieden: 404 ist eine Antwort, 400 ist ein Fehler im eigenen Aufruf.
 */
async function ladeSerie(showId: number): Promise<{ videos: AdnVideo[]; abbruch?: string }> {
  const videos: AdnVideo[] = []
  const SEITE = 100
  for (let offset = 0; offset < 2000; offset += SEITE) {
    const res = await fetch(`${BASE}/video/show/${showId}?limit=${SEITE}&offset=${offset}`, {
      headers: HEADERS,
    })
    if (res.status === 400) {
      warn(`ADN: Anfrage abgelehnt (400) bei Serie ${showId}, offset ${offset} — Aufruf prüfen.`)
      return { videos, abbruch: '400' }
    }
    if (!res.ok) {
      // 404 heißt hier schlicht „in Deutschland nicht im Angebot".
      return { videos, abbruch: res.status >= 500 ? String(res.status) : undefined }
    }
    const seite = ((await res.json()) as { videos?: AdnVideo[] }).videos ?? []
    videos.push(...seite)
    if (seite.length < SEITE) break
    await sleep(700)
  }
  return { videos }
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
  /**
   * Was wir schon einmal gesehen haben, wird wieder gefragt.
   *
   * Die Serienliste von ADN ist **von Lauf zu Lauf verschieden**: Sie ist
   * unsortiert, bricht bei `offset=200` mitten in einer Seite ab, und zwei Läufe
   * am selben Tag liefern verschiedene Teilmengen — am 20.08.2026 einmal 179 und
   * einmal 176 Serien. Wer den Katalog jedes Mal allein aus dem aktuellen Lauf
   * baut, verliert alles, was diesmal zufällig fehlte.
   *
   * Und das war kein kleiner Verlust: 25 Serien mit **belegter** deutscher
   * Synchro lagen bereits im eigenen Archiv und fehlten trotzdem im Katalog —
   * zusammen 762 Folgen, darunter Yu-Gi-Oh! mit 236, Fire Force, Clannad und
   * DAN DA DAN. Aufgefallen ist es, weil Daniel „Sword of the Demon Hunter" bei
   * ADN offen im Angebot fand, während unsere Seite „DE ?" zeigte.
   *
   * Die Warteschlange ist deshalb die **Vereinigung**: aktuelle Liste, letzter
   * Katalog, Archiv. Das ist dieselbe Regel wie überall hier — eine Warteschlange
   * bildet sich nach dem Alter, nicht danach, ob eine Frage schon einmal
   * beantwortet wurde.
   *
   * **Trotzdem wächst der Katalog nicht blind.** Gefragt wird nur, wer schon
   * einmal da war; ob er bleibt, entscheidet allein die frische Antwort. Nimmt
   * ADN eine Serie aus dem Angebot — weil eine Lizenz ausläuft —, liefert der
   * Abruf kein `vde` mehr, und sie fällt heraus.
   */
  const zusaetzlich = new Map<number, { id: number; title: string; originalTitle?: string; age?: string }>()
  for (const s of readJson<AdnData>('data/adn-catalog.json', { scrapedAt: '', window: { from: '', to: '' }, shows: [] }).shows) {
    if (!nachId.has(s.showId)) zusaetzlich.set(s.showId, { id: s.showId, title: s.title, originalTitle: s.originalTitle, age: s.age })
  }
  if (existsSync(ARCHIV_DIR)) {
    for (const datei of readdirSync(ARCHIV_DIR)) {
      if (!datei.endsWith('.json.gz')) continue
      const id = Number(datei.replace('.json.gz', ''))
      if (!Number.isInteger(id) || nachId.has(id) || zusaetzlich.has(id)) continue
      const kopf = archivKopf(id)
      if (kopf) zusaetzlich.set(id, kopf)
    }
  }

  const alle = [...nachId.values(), ...zusaetzlich.values()]
  log(
    `ADN-Katalog: ${alle.length} Serien in der Warteschlange (${nachId.size} aus der aktuellen Liste, ` +
      `${zusaetzlich.size} aus früheren Läufen), wird je Serie auf deutsche Synchro geprüft…`,
  )

  const out: AdnShow[] = []
  let geprueft = 0
  let fehlerInFolge = 0
  for (const eintrag of alle) {
    geprueft++
    if (geprueft % 100 === 0) log(`  ${geprueft}/${alle.length} — ${out.length} mit Synchro`)
    try {
      const antwort = await ladeSerie(eintrag.id)
      if (antwort.abbruch) {
        if (++fehlerInFolge >= 5) {
          warn(`ADN-Katalog: fünf Fehler in Folge (zuletzt ${antwort.abbruch}) — Lauf wird beendet.`)
          break
        }
        await sleep(700)
        continue
      }
      fehlerInFolge = 0
      const videos = antwort.videos
      if (videos.length) archiviereSerie(eintrag.id, videos)
      const deutsch = videos.filter((v) => v.languages?.includes('vde'))
      if (deutsch.length) {
        const episodes: AdnEpisode[] = []
        for (const v of deutsch) {
          const when = toBerlin(v.releaseDate)
          if (!when) continue
          episodes.push(episodeAus(v, when))
        }
        if (episodes.length) {
          sortiereFolgen(episodes)
          out.push({
            showId: eintrag.id,
            title: eintrag.title,
            originalTitle: eintrag.originalTitle ?? undefined,
            age: eintrag.age ?? undefined,
            url: `https://animationdigitalnetwork.com/de/video/${eintrag.id}`,
            episodes,
            batch: bestimmeRhythmus(episodes) !== 'weekly' && episodes.length > 1,
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
  /**
   * Zwei ADN-Serien dürfen nicht denselben Anime beanspruchen.
   *
   * ADN führt „To Love-Ru" unter zwei Kennungen, 217 und 670, beide mit 26
   * Folgen. Die Suche liefert für Fortsetzungen gern den Reihenkopf zurück, und
   * `passtZuSerie` nimmt ihn an, sobald ein Wort geteilt wird — bei „To Love-Ru
   * - Darkness" gegen „To Love Ru" ist das „love". So beanspruchten beide
   * Kennungen AniList 3455, und die Prüfung im Build brach ab: „zusammen 52
   * Folgen bei 26 vorhandenen". Drei Wochenläufe in Folge haben deshalb nichts
   * geschrieben (10.–17.08.2026).
   *
   * Deshalb wird erst **gesammelt** und dann **vergeben**, in zwei Durchgängen.
   *
   * Der erste Anlauf am 17.08.2026 vergab sofort, nach „wer zuerst kommt" — und
   * das ging nach hinten los: „One Piece • Le Film" griff sich AniList 21, also
   * die **Serie**, und die eigentliche One-Piece-Serie verlor daraufhin alle
   * sieben Sagas. Wer zuerst dran ist, entscheidet die Reihenfolge im Katalog,
   * und die sagt nichts über die Passung.
   *
   * Jetzt gewinnt je Anime die Serie mit der höchsten Punktzahl (siehe
   * `bewerteTreffer`); die Unterlegenen weichen auf ihren nächstbesten Kandidaten
   * aus. Bleibt keiner übrig, hat eine Serie eben keine Zuordnung — ein falsch
   * zugeordneter Titel ist schlimmer als ein fehlender.
   *
   * Ein Volltreffer bricht die Suche nach weiteren Schreibweisen ab, sonst
   * kostete das Sammeln fünfmal so viele Abfragen bei AniList.
   */
  const kandidaten = new Map<AdnShow, { id: number; punkte: number }[]>()
  /**
   * Fortschritt melden, sonst schweigt diese Phase.
   *
   * Sie ist die langsamste des ganzen Laufs — bis zu sechs AniList-Abfragen je
   * Serie, gedeckelt auf dessen Ratenlimit — und schrieb bisher nur Warnungen.
   * Am 17.08.2026 waren neun Minuten Stille nicht von einem Hänger zu
   * unterscheiden; nachweisen ließ sich der Betrieb nur über den Zähler in den
   * Antwort-Kopfzeilen von AniList. Eine Zeile je zwanzig Serien genügt.
   */
  let nachgeschlagen = 0
  for (const show of out) {
    if (++nachgeschlagen % 20 === 0)
      log(`  Zuordnung ${nachgeschlagen}/${out.length} — ${kandidaten.size} mit Kandidaten`)
    try {
      const gefunden = new Map<number, number>()
      // Beide Namen anbieten: Der Originaltitel trägt oft Makra und
      // Zirkumflexe, der Anzeigename ist die schlichtere Schreibweise —
      // „Haikyū!!" gegen „Haikyu!!". Welcher trifft, weiß man vorher nicht.
      for (const begriff of sucheVarianten(show.originalTitle, show.title)) {
        const media = await searchMedia(begriff)
        if (!media?.id || !passtZuSerie(show, media)) continue
        gefunden.set(media.id, bewerteTreffer(show, media))
        if (volltreffer(show, media)) break
      }
      if (gefunden.size)
        kandidaten.set(
          show,
          [...gefunden].map(([id, punkte]) => ({ id, punkte })).sort((a, b) => b.punkte - a.punkte),
        )
    } catch (err) {
      warn(`ADN-Katalog: Suche für "${show.title}" fehlgeschlagen: ${(err as Error).message}`)
    }
  }

  /**
   * Vergabe: der beste Bewerber je Anime gewinnt, die anderen weichen aus.
   *
   * Absichtlich schlicht gehalten — keine optimale Zuordnung, sondern eine
   * gierige. Es wird immer das stärkste noch offene Paar genommen; wer dabei
   * leer ausgeht, bekommt seinen nächstbesten Kandidaten. Bei 77 Serien ist der
   * Unterschied zu einer optimalen Lösung nicht zu bemerken, der zum vorherigen
   * „wer zuerst kommt" sehr wohl.
   */
  const vergeben = new Map<number, AdnShow>()
  const offen = new Set(kandidaten.keys())
  // Jede Runde vergibt genau eine Serie, mehr als eine je Bewerber kann es also
  // nicht geben. Die Grenze ist nur ein Riegel gegen eine Endlosschleife.
  let runde = 0
  while (offen.size && runde++ <= kandidaten.size) {
    let beste: { show: AdnShow; id: number; punkte: number } | undefined
    for (const show of offen) {
      const naechster = kandidaten.get(show)!.find((k) => !vergeben.has(k.id))
      if (!naechster) continue
      if (!beste || naechster.punkte > beste.punkte) beste = { show, id: naechster.id, punkte: naechster.punkte }
    }
    if (!beste) break
    vergeben.set(beste.id, beste.show)
    beste.show.anilistId = beste.id
    offen.delete(beste.show)
  }
  for (const show of offen) {
    warn(
      `ADN-Katalog: "${show.title}" (${show.showId}) bleibt ohne Zuordnung — ` +
        `alle ${kandidaten.get(show)!.length} Kandidaten sind an besser passende Serien vergeben.`,
    )
  }

  const zugeordnet = out.filter((s) => s.anilistId).length
  log(`ADN-Katalog: ${zugeordnet} von ${out.length} einem Anime zugeordnet`)
  return out
}

/**
 * Holt die bereits bekannten Katalogserien erneut — ohne den Rundgang über
 * alle 580 Einträge.
 *
 * Der Anlass, aus dem es diesen Modus gibt: Am 12.08.2026 kamen `season`,
 * `reference` und `order` neu in den Datensatz. Gebraucht wurden sie nur für
 * die 35 Serien, die überhaupt eine deutsche Fassung haben — der volle
 * Katalog-Lauf hätte dafür 580 Serien angefragt, also den Server für 545
 * Antworten belastet, die niemand braucht. Dieselbe Lage entsteht bei jeder
 * künftigen Feld-Erweiterung.
 *
 * Neue Serien findet dieser Modus nicht; dafür bleibt `--catalog`.
 */
async function refreshCatalog(): Promise<AdnShow[]> {
  const bestand = readJson<AdnData>('data/adn-catalog.json', {
    scrapedAt: '',
    window: { from: '', to: '' },
    shows: [],
  })
  if (!bestand.shows.length) {
    warn('Kein Katalogbestand vorhanden — bitte zuerst mit --catalog laufen lassen.')
    return []
  }
  log(`ADN-Auffrischung: ${bestand.shows.length} bekannte Serien werden neu geholt…`)
  const out: AdnShow[] = []
  for (const alt of bestand.shows) {
    try {
      const { videos, abbruch } = await ladeSerie(alt.showId)
      if (abbruch) warn(`ADN ${alt.showId}: Abbruch (${abbruch}) — alter Stand bleibt stehen.`)
      if (!videos.length) {
        out.push(alt)
        continue
      }
      archiviereSerie(alt.showId, videos)
      const episodes: AdnEpisode[] = []
      for (const v of videos.filter((v) => v.languages?.includes('vde'))) {
        const when = toBerlin(v.releaseDate)
        if (when) episodes.push(episodeAus(v, when))
      }
      if (!episodes.length) {
        warn(`ADN ${alt.showId} (${alt.title}): keine Folge mehr mit vde — alter Stand bleibt stehen.`)
        out.push(alt)
        continue
      }
      sortiereFolgen(episodes)
      out.push({
        ...alt,
        episodes,
        batch: bestimmeRhythmus(episodes) !== 'weekly' && episodes.length > 1,
      })
      if (episodes.length !== alt.episodes.length) {
        log(`  · ${alt.title}: ${alt.episodes.length} → ${episodes.length} Folgen`)
      }
    } catch (err) {
      warn(`ADN ${alt.showId}: ${(err as Error).message}`)
      out.push(alt)
    }
    await sleep(700)
  }
  return out
}

/**
 * Nur die Serien auffrischen, bei denen sich gerade etwas bewegt.
 *
 * Der volle `--refresh` holt alle 242 bekannten Serien und dauert rund drei
 * Minuten — zu grob für einen Takt von mehrmals täglich, und die allermeisten
 * davon sind abgeschlossen und ändern sich nie wieder.
 *
 * Laufend heißt hier: Die jüngste bekannte Folge ist höchstens zwei Wochen alt.
 * Gemessen am 24.08.2026 trifft das auf **9 von 242** Serien zu; ein Durchgang
 * kostet damit etwa sieben Sekunden statt drei Minuten.
 *
 * ## Warum der Takt überhaupt zählt
 *
 * ADN schaltet die deutsche Synchronfassung **nach** der Untertitelfassung frei,
 * und für diesen zweiten Termin gibt es kein Feld — er zeigt sich nur daran,
 * dass `vde` in `languages` auftaucht. Am 24.08.2026 kannte unser Archiv für
 * „Kill Blue" zwei deutsche Folgen, vier Stunden später waren es vier. Nichts
 * war verschwunden; die Kopie stammte aus dem Wochenlauf und war zu alt.
 *
 * Die zwei Wochen sind bewusst großzügig: Eine Serie, die eine Woche pausiert
 * (Sportübertragung, Feiertag), fiele bei sieben Tagen aus dem Blick und käme
 * nie wieder hinein, weil sie dann keine frische Folge mehr hätte.
 *
 * ## Warum das Archiv und nicht der Katalog
 *
 * `adn-catalog.json` führt je Serie nur die Folgen, die **schon** `vde` tragen —
 * `refreshCatalog()` filtert genau darauf. Aus ihm gelesen ergab diese Funktion
 * am 24.08.2026 **eine** laufende Serie statt neun: Serien, die noch auf ihre
 * Synchronfassung warten, haben dort gar keine Folgen. Das sind aber genau die,
 * deren Freischaltung wir mitbekommen wollen — der Katalog blendet die Frage
 * aus, die gestellt wird.
 *
 * `data/adn-raw/` hält dagegen jede Folge mit ihrem `releaseDate`, unabhängig
 * von der Sprache.
 */
function laufendeSerien(): number[] {
  if (!existsSync(ARCHIV_DIR)) return []
  const GRENZE = 14 * 86400_000
  const jetzt = Date.now()
  const ids: number[] = []
  for (const datei of readdirSync(ARCHIV_DIR)) {
    if (!datei.endsWith('.json.gz')) continue
    let roh: { showId?: number; videos?: AdnVideo[] }
    try {
      roh = JSON.parse(gunzipSync(readFileSync(`${ARCHIV_DIR}/${datei}`)).toString())
    } catch {
      continue
    }
    const showId = roh.showId ?? Number(datei.replace('.json.gz', ''))
    if (!Number.isFinite(showId)) continue
    const videos = roh.videos ?? []
    if (!videos.length) continue

    const termine = videos
      .map((v) => new Date(v.releaseDate ?? 0).getTime())
      .filter((t) => Number.isFinite(t) && t > 0)
    // Auch künftige Termine zählen: Eine Serie, die morgen weitergeht, läuft.
    const frisch = termine.length && jetzt - Math.max(...termine) < GRENZE

    /**
     * Die Synchronfassung wird **nachgereicht**, oft lange nach der letzten
     * Untertitelfolge. „Kill Blue" lief bis zum 27.06.2026, die deutschen Folgen
     * erschienen erst ab dem 24.08. — nach dem Zeitfenster oben wäre die Serie
     * längst aus dem Blick gewesen, genau als es interessant wurde.
     *
     * Eine Serie, bei der ein Teil der Folgen `vde` trägt und ein Teil nicht,
     * ist mitten in ihrer Vertonung. Sie bleibt in Beobachtung, bis beides nicht
     * mehr gilt: vollständig vertont oder gar nicht.
     */
    const mitVde = videos.filter((v) => (v.languages ?? []).includes('vde')).length
    const vertonungLaeuft = mitVde > 0 && mitVde < videos.length

    if (frisch || vertonungLaeuft) ids.push(showId)
  }
  return ids
}

async function main(): Promise<void> {
  if (args.includes('--laufend')) {
    const ids = laufendeSerien()
    if (!ids.length) {
      warn('Keine laufende Serie gefunden — bitte zuerst mit --catalog laufen lassen.')
      return
    }
    log(`ADN: ${ids.length} laufende Serien werden aufgefrischt…`)
    let geaendert = 0
    for (const showId of ids) {
      const { videos, abbruch } = await ladeSerie(showId)
      if (abbruch || !videos.length) {
        warn(`ADN ${showId}: kein Ergebnis (${abbruch ?? 'leer'}) — alter Stand bleibt stehen.`)
        continue
      }
      archiviereSerie(showId, videos)
      geaendert++
      await sleep(700)
    }
    log(`ADN: ${geaendert} von ${ids.length} laufenden Serien aufgefrischt`)
    return
  }
  if (args.includes('--refresh')) {
    const shows = await refreshCatalog()
    if (!shows.length) return
    writeJson(
      'data/adn-catalog.json',
      { scrapedAt: new Date().toISOString(), window: { from: '', to: '' }, shows } satisfies AdnData,
      true,
    )
    log(`ADN-Auffrischung: ${shows.length} Serien aktualisiert`)
    return
  }
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
      show.episodes.push(episodeAus(video, when))
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
    sortiereFolgen(show.episodes)
    return { ...show, batch: bestimmeRhythmus(show.episodes) !== 'weekly' && show.episodes.length > 1 }
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
