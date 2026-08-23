/**
 * Holt deutsche Tonspuren von der Streaming Availability API (Movie of the
 * Night) — der einzigen Quelle, die Netflix' Sprachfassung überhaupt nennt.
 *
 * Warum es das gibt: 532 Netflix-Verweise, 214 bei Prime Video und 38 bei
 * Disney+ standen dauerhaft auf „🇩🇪 ?", weil keiner dieser Anbieter eine
 * öffentliche Auskunft gibt und Netflix das Auslesen seiner Seiten in der
 * robots.txt ausdrücklich untersagt. Von Hand nachzusehen heißt: 532 Mal
 * einloggen, Titel suchen, Tonspur aufklappen.
 *
 * Was diese Datei über die Quelle weiß, steht in `lib/motn.ts` — vier gemessene
 * Grenzen, jede mit einer Zeile Code als Folge. Die wichtigste davon hier:
 * **Aus dieser Quelle entsteht nie ein `dub: false`.** Sie hinkt mindestens
 * zwei Tage hinterher (Folge 7 von „Thunderbolt Fantasy" lag am 21.08.2026 auf
 * Netflix, die API kannte sie nicht), also ist ihr Schweigen kein Nein.
 *
 * ## Das Kontingent ist die eigentliche Randbedingung
 *
 * 1.000 Anfragen im **Monat**, Reset am Monatsersten. Eine Anfrage je Titel
 * wären allein für Netflix 532 — der halbe Monat für einen einzigen Durchlauf.
 * Deshalb zwei Phasen in dieser Reihenfolge:
 *
 *  1. **Katalog.** `/shows/search/filters` liefert den deutschen Netflix-Katalog
 *     seitenweise über einen Cursor, 15 bis 20 Serien je Anfrage — und zwar
 *     samt Episodendaten. Der Cursor wird gespeichert; ein abgebrochener
 *     Durchlauf setzt beim nächsten Lauf fort, statt von vorn zu beginnen.
 *  2. **Titelsuche.** Nur für unsere Titel, die der Katalog nicht getroffen hat.
 *     Gesucht wird mit dem **Serientitel ohne Staffelzusatz**: Die Quelle zählt
 *     Staffeln anders als wir, und „JUJUTSU KAISEN Season 2" findet dort
 *     nichts (Daniels Vormessung, 21.08.2026: fünf von zwanzig Fehlschlägen,
 *     fast alle mit Staffelzusatz).
 *
 * Jede Anfrage wird gezählt, der Verbrauch je Monat steht in `data/motn.json`,
 * und `--budget` ist eine harte Grenze, keine Empfehlung. Jede Rohantwort landet
 * gzip-komprimiert in `data/motn-raw/` — eine zweite Auswertung kostet danach
 * kein Kontingent mehr, sie ist eine Änderung am Parser.
 *
 * Aufruf: npm run data:motn [-- --budget 120] [-- --alter 60] [-- --nur-katalog]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { loadEnv, log, readJson, ROOT, sleep, slugify, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { bestandAus, besterShow, LEER, suchName, type MotnDaten, type MotnShow } from './lib/motn.ts'
import { bewerteTreffer, passtZuSerie, staffelnDesFranchise, volltreffer } from './lib/adn.ts'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { beurteile, type CrDubData } from './lib/crunchyroll-dub.ts'
import { addDays, todayIso } from '../shared/time.ts'
import type { Title } from '../shared/types.ts'

/**
 * Ohne diesen Aufruf war der Lauf lokal nie ausführbar (bemerkt 23.08.2026).
 * Im CI kommt der Schlüssel als echte Umgebungsvariable aus den Secrets, also
 * fiel es dort nicht auf — wer ihn hier von Hand prüfen wollte, bekam nur
 * „STREAMING_API_KEY fehlt".
 */
loadEnv()

const BASIS = 'https://api.movieofthenight.com/v4'
const ARCHIV_DIR = resolve(ROOT, 'data/motn-raw')

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

/**
 * Harte Obergrenze an Anfragen für **diesen** Lauf.
 *
 * 120 je Woche sind rund 520 im Monat — gut die Hälfte des Kontingents, damit
 * ein Lauf von Hand und ein verpatzter Versuch noch hineinpassen. Der Monat
 * gehört nicht diesem Skript allein.
 */
const BUDGET = zahl('--budget', 120)
/** Ab wann eine gelesene Serie erneut drankommt. */
const WIEDERVORLAGE_TAGE = zahl('--alter', 60)
const NUR_KATALOG = args.includes('--nur-katalog')
const NUR_TITEL = args.includes('--nur-titel')
/**
 * Der Katalogdurchlauf ist seit der ersten echten Messung **abgewählt**, nicht
 * gelöscht: 10 Serien je Anfrage über den gesamten deutschen Netflix-Katalog
 * (21.08.2026, siehe `nachTmdb`). Wer ihn braucht, schaltet ihn eigens ein.
 */
const KATALOG = args.includes('--katalog') || NUR_KATALOG
/** Ignoriert den gespeicherten Cursor und beginnt den Katalog von vorn. */
const KATALOG_NEU = args.includes('--katalog-neu')

const SCHLUESSEL = process.env.STREAMING_API_KEY
const heute = todayIso()
const monat = heute.slice(0, 7)

const daten: MotnDaten = { ...LEER, ...readJson<MotnDaten>('data/motn.json', LEER) }
daten.shows ??= {}
daten.gesucht ??= {}
daten.tmdb ??= {}
daten.verbrauch ??= {}

let anfragen = 0
/** Was die Quelle selbst als Rest des Monatskontingents meldet. */
let uebrig = Number.POSITIVE_INFINITY

/**
 * Ein Abruf — und der einzige Ort, an dem das Kontingent belastet wird.
 *
 * Der Zähler steht **vor** dem `fetch`, nicht danach: Eine Anfrage, die in
 * einem Fehler endet, ist trotzdem verbraucht. Ihn erst bei Erfolg zu erhöhen
 * hieße, sich das Kontingent schönzurechnen — und genau davon hat niemand
 * etwas, wenn die Quelle am 20. des Monats stumm schaltet.
 */
type Antwort<T> =
  /** Die Quelle hat geantwortet. */
  | { art: 'ok'; wert: T }
  /** Sie kennt diesen Eintrag nicht — für **diese** Anfrage, nicht für den Lauf. */
  | { art: 'nichts' }
  /** Kontingent oder Budget am Ende: Der Lauf hört auf zu fragen. */
  | { art: 'ende' }

async function hole<T>(pfad: string, archivName: string): Promise<Antwort<T>> {
  if (anfragen >= BUDGET) return { art: 'ende' }
  anfragen++
  daten.verbrauch[monat] = (daten.verbrauch[monat] ?? 0) + 1
  const res = await fetch(`${BASIS}${pfad}`, {
    headers: { 'X-API-Key': SCHLUESSEL as string },
  })
  /**
   * Der Rest des Monats, direkt von der Quelle.
   *
   * Unser eigener Zähler in `verbrauch` ist eine Buchhaltung, kein Messwert: Er
   * kennt nur die Läufe, die er selbst gesehen hat. Der Kopfzeilenwert ist die
   * Wahrheit, und mit ihm hört der Lauf von selbst auf, bevor er gegen die Wand
   * läuft — statt hinterher zu erfahren, dass er sie schon getroffen hat.
   */
  const rest = Number(res.headers.get('x-quota-granted')) - Number(res.headers.get('x-quota-used'))
  if (Number.isFinite(rest)) uebrig = rest
  if (res.status === 429) {
    warn('Kontingent erschöpft (429) — der Lauf endet hier, der Bestand bleibt erhalten.')
    return { art: 'ende' }
  }
  /**
   * Ein 404 gilt der Anfrage, nicht der Quelle.
   *
   * Vorher brach der Lauf bei jedem `!res.ok` ab. Beim Katalog war das richtig —
   * dort ist eine fehlende Seite das Ende des Durchlaufs. Beim Abruf je Titel
   * wäre es fatal: Eine Serie, die diese Quelle nicht führt, beendete sonst den
   * ganzen Lauf, und die Anfragen dahinter wären für nichts verbraucht.
   */
  if (res.status === 404) return { art: 'nichts' }
  if (!res.ok) {
    warn(`${res.status} ${res.statusText} bei ${pfad.slice(0, 80)}`)
    return { art: 'ende' }
  }
  const text = await res.text()
  archiviere(archivName, text)
  return { art: 'ok', wert: JSON.parse(text) as T }
}

/**
 * Legt eine Rohantwort ab.
 *
 * Eine Datei je Antwort, unverändert nicht neu geschrieben — Git speichert
 * binäre Dateien vollständig neu, ein Sammelarchiv landete sonst bei jedem Lauf
 * in voller Größe in der Historie. Dieselbe Bauweise wie `data/adn-raw/`.
 */
function archiviere(name: string, text: string): void {
  if (!existsSync(ARCHIV_DIR)) mkdirSync(ARCHIV_DIR, { recursive: true })
  const pfad = `${ARCHIV_DIR}/${name}.json.gz`
  const neu = gzipSync(text, { level: 9 })
  if (existsSync(pfad) && readFileSync(pfad).equals(neu)) return
  writeFileSync(pfad, neu)
}

/** Übernimmt eine Serie der Quelle in den Bestand. */
function merken(show: MotnShow) {
  const bestand = bestandAus(show, heute)
  if (!bestand) return undefined
  daten.shows[bestand.imdbId] = bestand
  return bestand
}

interface SuchAntwort {
  shows?: MotnShow[]
  hasMore?: boolean
  nextCursor?: string
}

/**
 * Phase 0 — Direktabruf über die TMDB-Kennung. Der Hauptweg.
 *
 * **Warum nicht der Katalog, wie ursprünglich geplant.** Am 21.08.2026 mit dem
 * echten Schlüssel gemessen: Eine Katalogseite mit `series_granularity=episode`
 * liefert **10 Serien** (436 KB), nicht die veranschlagten 15 bis 20. Der
 * deutsche Netflix-Katalog wären damit einige hundert Anfragen für einen
 * Durchlauf, von denen der allergrößte Teil auf Serien entfiele, die uns nichts
 * angehen — „Mercy for None" stand als erster Treffer da. Das gesamte
 * Monatskontingent für einen Katalog, in dem unsere 549 Titel eine Minderheit
 * sind.
 *
 * Der Direktabruf kostet dagegen **eine** Anfrage je Serie, und zwar genau für
 * die, die wir wissen wollen. `/shows/tv/209867` liefert dieselben Episodendaten
 * wie der Katalog (geprüft an „Frieren": 39 Folgen, 28 davon bei Netflix, alle
 * mit `deu`).
 *
 * **Und er ist der genauere Weg.** Die Titelsuche liefert Namen, die verglichen
 * werden müssen; die Kennung ist eine Kennung. Geprüft wird trotzdem weiter —
 * `data/tmdb-titles.json` ist selbst über eine Namenssuche entstanden.
 */
async function nachTmdb(schluessel: string[]): Promise<number> {
  const grenze = addDays(heute, -WIEDERVORLAGE_TAGE)
  const warteschlange = schluessel.filter((k) => {
    const bekannt = daten.tmdb[k]
    return !bekannt || bekannt.geprueftAm < grenze
  })
  log(`Direktabruf: ${warteschlange.length} von ${schluessel.length} Kennungen fällig, ${BUDGET - anfragen} Anfragen übrig`)

  let gefunden = 0
  for (const key of warteschlange) {
    if (anfragen >= BUDGET || uebrig <= 0) break
    const res = await hole<MotnShow>(
      `/shows/${key}?country=de&series_granularity=episode`,
      `tmdb-${key.replace('/', '-')}`,
    )
    if (res.art === 'ende') break
    const bestand = res.art === 'ok' ? merken(res.wert) : undefined
    // Auch das „nichts gefunden" wird festgehalten — aber mit Datum, damit die
    // Frist es wieder in die Warteschlange holt. Ein `null` ohne Datum wäre eine
    // Antwort, die ihre eigene Überprüfung verhindert.
    daten.tmdb[key] = { imdbId: bestand?.imdbId ?? null, geprueftAm: heute }
    if (bestand) gefunden++
    if (anfragen % 25 === 0) log(`  ${anfragen}/${BUDGET} Anfragen, ${gefunden} Serien, Rest im Monat: ${uebrig}`)
    await sleep(250)
  }
  return gefunden
}

/**
 * Phase 1 — der deutsche Netflix-Katalog, seitenweise.
 *
 * Warum überhaupt ein Katalog statt einer Suche je Titel: 532 Titel wären 532
 * Anfragen, der Katalog sind ein bis zwei Dutzend. Der Cursor liegt zwischen
 * den Läufen im Bestand, damit ein Durchlauf über mehrere Wochen laufen kann,
 * ohne je von vorn anzufangen.
 *
 * `series_granularity=episode` ist nicht optional: Die Serienebene widerspricht
 * bei „Frieren" ihrer eigenen Episodenebene (siehe `lib/motn.ts`, Grenze 2).
 */
async function katalog(): Promise<number> {
  let cursor = KATALOG_NEU ? undefined : (daten.katalogCursor ?? undefined)
  let neu = 0
  for (let seite = 0; anfragen < BUDGET; seite++) {
    /**
     * Nur Animation, dafür alle drei Anbieter — gemessen am 23.08.2026.
     *
     * Vorher holte dieser Lauf den **kompletten deutschen Netflix-Serienkatalog**
     * ohne Genre-Einschränkung, um darin unsere paar hundert Anime zu finden.
     * Bei 20 Serien je Anfrage und einem Kontingent von 1.000 im Monat ist das
     * der Grund, warum der Bestand nach einem Monat erst zur Hälfte stand.
     *
     * `genres=animation` schneidet den Katalog auf den Teil zu, der uns angeht;
     * die Messung ergab 15 von 20 Serien je Seite mit deutscher Tonspur statt
     * eines Katalogs voller Reality-Formate. „Animation" ist nicht „Anime" —
     * koreanische Zeichentrickserien kommen mit —, aber der Filter kostet nichts
     * und die Zuordnung zu unseren Titeln wirft den Rest ohnehin weg.
     *
     * `catalogs` nimmt mehrere Dienste in **einer** Anfrage. Prime Video und
     * Disney+ standen bisher gar nicht im Katalogweg; ihre 600 bzw. 40 offenen
     * Verweise mussten alle über die teurere Titelsuche laufen.
     */
    const query = new URLSearchParams({
      country: 'de',
      catalogs: 'netflix,prime.subscription,disney',
      genres: 'animation',
      show_type: 'series',
      series_granularity: 'episode',
      order_by: 'original_title',
    })
    if (cursor) query.set('cursor', cursor)
    /**
     * Der Archivname kommt aus dem Cursor, nicht aus der Seitennummer.
     *
     * Ein Durchlauf läuft über mehrere Wochen; „Seite 3" wäre beim nächsten Lauf
     * eine andere Seite und überschriebe die alte. Der Cursor selbst ist
     * undurchsichtig und beliebig lang — gekürzt wäre er nicht mehr eindeutig,
     * also steht sein Prüfwert da.
     */
    const name = cursor ? `katalog-anime-${createHash('sha1').update(cursor).digest('hex').slice(0, 12)}` : 'katalog-anime-start'
    const res = await hole<SuchAntwort>(`/shows/search/filters?${query}`, name)
    if (res.art !== 'ok') break
    const antwort = res.wert
    for (const show of antwort.shows ?? []) if (merken(show)) neu++
    log(`  Katalog Seite ${seite + 1}: ${antwort.shows?.length ?? 0} Serien (${anfragen}/${BUDGET} Anfragen)`)
    if (!antwort.hasMore || !antwort.nextCursor) {
      // Durchgelaufen: Beim nächsten Mal wieder von vorn — der Katalog ändert
      // sich, und eine Warteschlange, die nur vorwärts geht, veraltet.
      daten.katalogCursor = null
      break
    }
    cursor = antwort.nextCursor
    daten.katalogCursor = cursor
    await sleep(400)
  }
  return neu
}

/**
 * Phase 2 — gezielte Titelsuche für das, was der Katalog nicht getroffen hat.
 *
 * Die Warteschlange läuft über das **Alter** der letzten Suche, nicht über
 * „noch nie gesucht". Das ist die Regel, an der dieses Projekt schon dreimal
 * gescheitert ist (CLAUDE.md): Ein Filter der Form „hole, was fehlt" macht
 * jede Antwort endgültig — auch das `null` für „nichts gefunden".
 */
async function titelsuche(titles: Title[], offen: Title[]): Promise<number> {
  const grenze = addDays(heute, -WIEDERVORLAGE_TAGE)
  const warteschlange = offen
    .filter((t) => {
      const bekannt = daten.gesucht[String(t.id)]
      return !bekannt || bekannt.geprueftAm < grenze
    })
    .sort((a, b) => {
      const av = daten.gesucht[String(a.id)]?.geprueftAm ?? ''
      const bv = daten.gesucht[String(b.id)]?.geprueftAm ?? ''
      return av.localeCompare(bv) || (b.episodes ?? 0) - (a.episodes ?? 0)
    })

  log(`Titelsuche: ${warteschlange.length} Titel in der Warteschlange, ${BUDGET - anfragen} Anfragen übrig`)
  let gefunden = 0
  const gesucht = new Set<string>()

  for (const title of warteschlange) {
    if (anfragen >= BUDGET) break
    const reihe = title.franchiseId ? staffelnDesFranchise(titles, title.franchiseId) : []
    const name = suchName(reihe[0] ?? title)
    if (!name) continue
    // Eine Reihe wird einmal gesucht, nicht je Staffel: Die Quelle führt sie
    // ohnehin als einen Eintrag, und jede Wiederholung kostet Kontingent.
    if (gesucht.has(name.toLowerCase())) continue
    gesucht.add(name.toLowerCase())

    const query = new URLSearchParams({
      title: name,
      country: 'de',
      show_type: 'series',
      series_granularity: 'episode',
    })
    const res = await hole<MotnShow[] | SuchAntwort>(
      `/shows/search/title?${query}`,
      `titel-${slugify(name) || String(title.id)}`,
    )
    if (res.art === 'ende') break
    const antwort = res.art === 'ok' ? res.wert : []
    const shows = Array.isArray(antwort) ? antwort : (antwort.shows ?? [])
    const kandidaten = shows.map(merken).filter((b): b is NonNullable<typeof b> => !!b)

    /**
     * Was hier festgehalten wird, ist die **Warteschlange**, nicht das
     * Ergebnis: nur, ob diese Suche etwas gefunden hat und wann sie lief. Die
     * eigentliche Zuordnung entsteht später in `ordneShowsZu` neu — sonst wäre
     * ein einmal falscher Treffer für immer festgeschrieben.
     */
    const treffer = besterShow(name, (reihe[0] ?? title).jpYear, kandidaten, {
      passtZuSerie,
      bewerteTreffer,
      volltreffer,
    })
    daten.gesucht[String(title.id)] = { imdbId: treffer?.kandidat.imdbId ?? null, geprueftAm: heute }
    if (treffer) gefunden++
    log(`  ${title.id} „${name}" → ${treffer?.kandidat.imdbId ?? 'nichts'} (${anfragen}/${BUDGET})`)
    await sleep(400)
  }
  return gefunden
}

/**
 * Titel, für die wir **unabhängig** von dieser Quelle wissen, ob es eine
 * deutsche Fassung gibt — die Prüfsteine der Kontrollmessung.
 *
 * Dieselben zwei Quellen wie in `check-motn.ts`, und aus demselben Grund
 * dieselben: eine Handprüfung aus `data/dub-confirmed.yaml` oder eine
 * Crunchyroll-Serienseite mit ausgezählten Tonspuren. ADN fehlt, weil diese
 * Quelle ADN nicht führt.
 */
function kontrollmenge(titles: Title[]): Set<number> {
  const ids = new Set<number>()
  for (const check of loadDubChecks()) if (typeof check.dub === 'boolean') ids.add(check.anilistId)

  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  const nachUrl = new Map<string, Title[]>()
  for (const title of titles) {
    for (const stream of title.streams) {
      if (stream.platform !== 'crunchyroll') continue
      const liste = nachUrl.get(stream.url) ?? []
      liste.push(title)
      nachUrl.set(stream.url, liste)
    }
  }
  for (const serie of crDub.serien) {
    for (const urteil of beurteile(serie, nachUrl.get(serie.url) ?? [])) ids.add(urteil.titleId)
  }
  return ids
}

async function main(): Promise<void> {
  if (!SCHLUESSEL) {
    // Kein Abbruch mit Fehlercode: In einem Lauf ohne hinterlegten Schlüssel
    // ist das kein Defekt, sondern eine fehlende Konfiguration. Der Bestand
    // bleibt unangetastet, und der Build kommt ohne diese Quelle aus.
    warn('STREAMING_API_KEY fehlt — kein Abruf. Der vorhandene Bestand bleibt unverändert.')
    return
  }

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdbTitel = readJson<Record<string, { tmdbId?: number; kind?: string }>>('data/tmdb-titles.json', {})
  const tmdbKey = (t: Title): string | undefined => {
    const e = tmdbTitel[String(t.id)]
    return e?.tmdbId && e.kind ? `${e.kind}/${e.tmdbId}` : undefined
  }

  /**
   * Wen wir überhaupt fragen: Titel mit einem Verweis auf einen der Dienste,
   * deren Sprachfassung wir noch nicht kennen.
   *
   * Nach `dub === undefined` **und** nach Alter — der Alterfilter steckt in
   * `titelsuche` und `nachTmdb`. Hier steht nur, wen die Quelle beantworten
   * könnte.
   */
  const offen = titles.filter((t) =>
    t.streams.some((s) => s.dub === undefined && (s.platform === 'netflix' || s.platform === 'primevideo' || s.platform === 'disneyplus')),
  )
  log(`${offen.length} Titel mit offener Sprachangabe bei Netflix, Prime Video oder Disney+`)

  /**
   * Die Kontrollmenge kommt **vor** dem Rest in die Warteschlange.
   *
   * Sie ist der Grund, warum überhaupt etwas übernommen werden darf: Ohne
   * Serien, für die wir unabhängig wissen, ob es eine deutsche Fassung gibt,
   * misst `check-motn.ts` nichts. Stünde sie hinten, entschiede das Budget
   * darüber, ob die Messung stattfindet — und ein Lauf ohne Messung ist ein Lauf
   * ohne Erlaubnis.
   */
  const kontrolle = kontrollmenge(titles)
  log(`Kontrollmenge: ${kontrolle.size} Titel mit unabhängigem Beleg`)

  const nutzen = (t: Title) => (kontrolle.has(t.id) ? 1_000_000 : 0) + (t.episodes ?? 0)
  const schluessel: string[] = []
  const gesehen = new Set<string>()
  for (const t of [...titles].filter((t) => kontrolle.has(t.id) || offen.includes(t)).sort((a, b) => nutzen(b) - nutzen(a))) {
    const key = tmdbKey(t)
    if (!key || gesehen.has(key)) continue
    gesehen.add(key)
    schluessel.push(key)
  }

  let ausTmdb = 0
  if (!NUR_TITEL && !NUR_KATALOG) {
    log('Phase 0 — Direktabruf über die TMDB-Kennung')
    ausTmdb = await nachTmdb(schluessel)
  }
  let ausKatalog = 0
  if (KATALOG) {
    log('Phase 1 — deutscher Netflix-Katalog')
    ausKatalog = await katalog()
  }
  let ausSuche = 0
  if (!NUR_KATALOG && anfragen < BUDGET) {
    log('Phase 2 — Titelsuche für Titel ohne TMDB-Kennung')
    ausSuche = await titelsuche(
      titles,
      offen.filter((t) => !tmdbKey(t)),
    )
  }

  daten.fetchedAt = new Date().toISOString()
  writeJson('data/motn.json', daten, true)
  recordSource('motn', Object.keys(daten.shows).length, anfragen ? undefined : 'keine Anfrage abgesetzt')

  log(
    `Fertig. ${Object.keys(daten.shows).length} Serien im Bestand ` +
      `(${ausTmdb} über die TMDB-Kennung, ${ausKatalog} aus dem Katalog, ${ausSuche} über die Titelsuche).`,
  )
  log(`Verbrauch: ${anfragen} Anfragen in diesem Lauf, ${daten.verbrauch[monat]} im Monat ${monat} von 1.000.`)
  if (Number.isFinite(uebrig)) log(`Die Quelle selbst meldet ${uebrig} Anfragen als Rest des Monats.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
