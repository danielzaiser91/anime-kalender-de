/**
 * Liest den Veröffentlichungskalender von ADN (Animation Digital Network).
 *
 * Warum das die zweitbeste Quelle nach Crunchyroll ist: ADN betreibt eine
 * öffentliche JSON-Schnittstelle, die je Folge **Datum, Uhrzeit und
 * Sprachfassung** nennt. Der Sprachcode ist dabei das Entscheidende:
 *
 *   vde — deutsche Synchronfassung · vostde — japanischer Ton mit Untertiteln
 *
 * Damit beantwortet ADN von sich aus genau die Frage, für die es sonst keine
 * maschinenlesbare Antwort gibt: Gibt es eine deutsche Synchro, und wann läuft
 * sie? Kein Schätzen, kein Ableiten. Alles ohne `vde` ignorieren wir. Ein Aufruf
 * je Tag, mit Pause dazwischen; dieselbe Schnittstelle benutzt auch die
 * Webseite, ein Schlüssel ist nicht nötig.
 *
 * Aufruf: npx tsx pipeline/fetch-adn.ts [--from -30] [--to 60]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { addDays, diffDays, todayIso } from '../shared/time.ts'
import { log, readJson, ROOT, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { episodeAus, katalogShowAus, sortiereFolgen, toBerlin, type AdnListenEintrag, type AdnVideo } from './lib/adn-folgen.ts'
import { holeAdnNews } from './lib/adn-news.ts'
import { type KatalogAuskunft, katalogBilanzZeile, mitUngepruftenAlten, riegelBilanz, schreibeArchiv, verwirfFranzoesische, verworfen } from './lib/adn-sprachriegel.ts'
import { aelteste, mitTitelAusAntwort, standOhneKopf, warteschlangeZeile } from './lib/adn-katalog-warteschlange.ts'
import { fragNeuzugaenge, katalogMitNeuen } from './lib/adn-neuzugaenge.ts'
import { ordneKatalogZuAnisearch } from './lib/adn-zuordnung-lauf.ts'
import {
  bestimmeRhythmus,
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
const UA = 'anime-kalender.de/1.0 (+https://anime-kalender.de; kontakt@anime-kalender.de)'
/**
 * `Accept-Language: de` entscheidet über die **Sprache der Titel**.
 *
 * `X-Target-Distribution: de` allein bestimmt nur den Katalog — welche Serien
 * hier überhaupt laufen und welche Tonspuren sie tragen. Die Titel kommen
 * damit weiterhin auf Englisch:
 *
 *     ohne Accept-Language:  "Hero Without a Class: Who Even Needs Skills?!"
 *     mit Accept-Language:   "Der Held ohne Klasse: Der Aufstieg eines Talentlosen"
 *
 * Aufgefallen am 24.08.2026, weil Daniel den Titel im Kalender nicht fand: Der
 * Anime **stand** darin (AniList 169969, mit ADN-Verweis), aber unter seinem
 * japanischen Namen. Für einen deutschen Anime-Kalender ist das der Fehler mit
 * der größten Wirkung — wer den deutschen Namen kennt, findet nichts.
 */
const HEADERS = {
  'User-Agent': UA,
  'X-Target-Distribution': 'de',
  'Accept-Language': 'de',
  Accept: 'application/json',
}

const args = process.argv.slice(2)
const numberArg = (name: string, fallback: number) => {
  const index = args.indexOf(name)
  return index >= 0 ? Number(args[index + 1]) : fallback
}
const FROM = numberArg('--from', -45)
const TO = numberArg('--to', 75)

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

const ARCHIV_DIR = resolve(ROOT, 'data/adn-raw')
/** Wann welche Serie zuletzt im Katalog-Durchgang gefragt wurde (Warteschlange nach Alter, im Repo statt im Dateisystem). */
const KATALOG_STAND = 'data/adn-katalog-stand.json'
const KATALOG_DATEI = 'data/adn-catalog.json'

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
function archiviereSerie(showId: number, videos: AdnVideo[]): boolean {
  return schreibeArchiv(ARCHIV_DIR, showId, videos)
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
      // Nur 404/410 auf der ersten Seite verneinen („in Deutschland nicht im Angebot"); 429, 403, 5xx und jeder Fehler ab Seite 2 sind Nichtauskunft.
      const verneint = offset === 0 && (res.status === 404 || res.status === 410)
      return { videos, abbruch: verneint ? undefined : String(res.status) }
    }
    const seite = ((await res.json()) as { videos?: AdnVideo[] }).videos ?? []
    videos.push(...seite)
    if (seite.length < SEITE) break
    await sleep(700)
  }
  // Französische Sicht ist keine Auskunft: wie ein Abbruch behandeln, damit Archiv, Katalog und Stand unberührt bleiben und die Serie wieder drankommt.
  if (verwirfFranzoesische(showId, videos)) return { videos: [], abbruch: 'franzoesisch' }
  return { videos }
}

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
async function sammleSerienliste(): Promise<Map<number, AdnListenEintrag>> {
  const nachId = new Map<number, AdnListenEintrag>()
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
  return nachId
}

async function fetchCatalog(): Promise<{ shows: AdnShow[]; auskunft: KatalogAuskunft }> {
  const nachId = await sammleSerienliste()
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

  /**
   * **Die ältesten zuerst, und nur so viele wie erlaubt.**
   *
   * Bis zum 29.08.2026 prüfte dieser Lauf **jede** Serie bei jedem Durchgang neu
   * — rund 2.600 Abfragen à 700 ms. Der Kommentar im Workflow sprach von „rund
   * 580 Abfragen"; gemessen waren es an dem Tag **42 Minuten** an einem
   * einzigen Schritt, in einem Lauf mit 61 Schritten und einer Zeitgrenze von
   * 150 Minuten.
   *
   * Eine Serienseite bei ADN ändert sich selten. Was sich ändert, sind die
   * Folgen laufender Serien — und dafür gibt es `--laufende`, das alle sechs
   * Stunden läuft. Dieser Lauf hier sucht **neue** Serien und Nachzügler; ihn
   * über das Alter des Archivs zu staffeln kostet nichts und macht ihn planbar.
   *
   * Ohne `--limit` bleibt alles wie bisher: Wer den vollen Durchgang will,
   * bekommt ihn.
   */
  const KATALOG_LIMIT = Number(args[args.indexOf('--limit') + 1]) || 0
  /*
    **Das Alter steht im Repo, nicht im Dateisystem** (05.10.2026): Nach einem frischen Checkout tragen alle Archivdateien die Checkout-Zeit, die Sortierung blieb
    stabil bei der Reihenfolge der Liste, und jede Woche kamen dieselben 600 dran. Jetzt merkt `data/adn-katalog-stand.json`, wann welche Serie zuletzt gefragt wurde;
    wer noch nie dran war, kommt zuerst.
  */
  const stand = readJson<Record<string, string>>(KATALOG_STAND, {})
  const bekannt = new Set([...nachId.keys(), ...zusaetzlich.keys()])
  const vorLimit = [...nachId.values(), ...zusaetzlich.values(), ...standOhneKopf(stand, bekannt)]
  const alle = aelteste(vorLimit, stand, KATALOG_LIMIT)
  log(warteschlangeZeile(alle.length, vorLimit.length))
  log(
    `ADN-Katalog: ${alle.length} Serien in der Warteschlange (${nachId.size} aus der aktuellen Liste, ` +
      `${zusaetzlich.size} aus früheren Läufen${KATALOG_LIMIT ? `, begrenzt auf ${KATALOG_LIMIT}` : ''}), ` +
      'wird je Serie auf deutsche Synchro geprüft…',
  )

  const out: AdnShow[] = []
  const auskunft: KatalogAuskunft = { gefragt: new Set(), entschieden: new Set() }
  let geprueft = 0
  let fehlerInFolge = 0
  for (const eintrag of alle) {
    geprueft++
    auskunft.gefragt.add(eintrag.id)
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
      auskunft.entschieden.add(eintrag.id)
      stand[String(eintrag.id)] = new Date().toISOString()
      const videos = antwort.videos
      if (videos.length) archiviereSerie(eintrag.id, videos)
      const mitTitel = mitTitelAusAntwort(eintrag, videos)
      const show = mitTitel.title ? katalogShowAus(mitTitel, videos) : undefined
      if (show) out.push(show)
    } catch (err) {
      warn(`ADN-Katalog ${eintrag.id}: ${(err as Error).message}`)
    }
    await sleep(700)
  }
  writeJson(KATALOG_STAND, stand)

  // Zuordnung zu aniSearch aus der Titelliste im Cache (`lib/adn-anisearch.ts`): keine Abfrage je Serie, bei Mehrdeutigkeit bleibt die Serie offen.
  await ordneKatalogZuAnisearch(out, readJson<AdnData>('data/adn-catalog.json', { scrapedAt: '', window: { from: '', to: '' }, shows: [] }).shows)
  return { shows: out, auskunft }
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

/** Kennungen aller Serien im Archiv (`data/adn-raw`) — auch die ohne deutsche Folge. */
function archivKennungen(): number[] {
  if (!existsSync(ARCHIV_DIR)) return []
  return readdirSync(ARCHIV_DIR)
    .filter((d) => d.endsWith('.json.gz'))
    .map((d) => Number(d.replace('.json.gz', '')))
    .filter(Number.isInteger)
}

/**
 * Serien, die seit dem letzten Katalog-Lauf neu in der ADN-Liste stehen, sofort ins Archiv und in den Katalog (Begründung in
 * `lib/adn-neuzugaenge.ts`). Die Zuordnung zu aniSearch bleibt dem Wochenlauf; Filme finden ihren Titel über den Namen (`filmZurShow`).
 */
async function holeNeueSerien(): Promise<void> {
  const katalog = readJson<AdnData>(KATALOG_DATEI, { scrapedAt: '', window: { from: '', to: '' }, shows: [] })
  const bekannt = new Set([...katalog.shows.map((s) => s.showId), ...archivKennungen()])
  const stand = readJson<Record<string, string>>(KATALOG_STAND, {})
  const lauf = await fragNeuzugaenge(await sammleSerienliste(), bekannt, stand, ladeSerie, () => sleep(700))
  log(`ADN: ${lauf.anzahl} Serien der Liste weder im Katalog noch im Archiv (ohne die, die vor weniger als 24 Stunden ohne Videos antworteten)`)
  if (!lauf.anzahl) return
  const { shows, archiv, offen } = lauf
  for (const [id, videos] of archiv) archiviereSerie(id, videos)
  writeJson(KATALOG_STAND, lauf.stand)
  if (offen.length) warn(`ADN: ${offen.length} neue Serien nicht abrufbar (${offen.join(', ')}) — nächster Lauf versucht es wieder.`)
  if (!shows.length) return
  writeJson(KATALOG_DATEI, { ...katalog, shows: katalogMitNeuen(katalog.shows, shows) } satisfies AdnData, true)
  log(`ADN: ${shows.length} neue Serien mit deutscher Fassung im Katalog: ${shows.map((s) => s.title).join('; ')}`)
}

async function main(): Promise<void> {
  await holeAdnNews()
  if (args.includes('--laufend')) {
    const ids = laufendeSerien()
    if (!ids.length) warn('Keine laufende Serie gefunden — bitte zuerst mit --catalog laufen lassen.')
    log(`ADN: ${ids.length} laufende Serien werden aufgefrischt…`)
    let geaendert = 0
    for (const showId of ids) {
      const { videos, abbruch } = await ladeSerie(showId)
      if (abbruch || !videos.length) {
        warn(`ADN ${showId}: kein Ergebnis (${abbruch ?? 'leer'}) — alter Stand bleibt stehen.`)
        continue
      }
      if (archiviereSerie(showId, videos)) geaendert++
      await sleep(700)
    }
    log(`ADN: ${geaendert} von ${ids.length} laufenden Serien aufgefrischt`)
    await holeNeueSerien()
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
    const alterKatalog = readJson<AdnData>(KATALOG_DATEI, { scrapedAt: '', window: { from: '', to: '' }, shows: [] }).shows
    const frisch = await fetchCatalog()
    const { shows, ...zaehler } = mitUngepruftenAlten(alterKatalog, frisch.shows, frisch.auskunft)
    log(katalogBilanzZeile(zaehler))
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

main()
  .then(() => {
    const bilanz = riegelBilanz(verworfen.length)
    log(bilanz.zeile)
    if (bilanz.rot) process.exitCode = 1
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
