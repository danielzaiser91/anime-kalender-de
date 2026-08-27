/**
 * Täglicher Blick auf das, was bei Netflix, Prime Video und Disney+ neu ist.
 *
 * ## Warum neben `fetch-motn.ts`
 *
 * Der große Lauf holt **Bestand**: den deutschen Katalog eines Anbieters,
 * seitenweise, einmal im Monat. Das ist richtig für die Frage „welche unserer
 * 2.700 Titel laufen wo" — und falsch für die Frage, die ein *Kalender*
 * beantworten muss.
 *
 * Daniel am 23.08.2026: „wir brauchen die beste quelle, schnellster weg
 * aktuelle infos für die webseite beschaffen, nicht erst tage später."
 * Ein Bestandslauf am 2. jedes Monats sieht eine Staffel, die am 3. startet,
 * dreißig Tage später.
 *
 * Dieser Lauf holt stattdessen **Änderungen** über `/changes` — 25 je Seite,
 * nach Datum sortiert, mit `from` als Zeitfenster. Ein Tag Rückstand kostet
 * ein bis zwei Anfragen statt eines halben Monatskontingents.
 *
 * ## Was gemessen wurde, bevor das hier entstand (23.08.2026)
 *
 * - **`change_type=upcoming` ist für Anime nutzlos.** Ein Abruf über alle drei
 *   Anbieter ergab **12 künftige Serien für ganz Deutschland, keinen einzigen
 *   Anime** — Reality, Drama, Crime. Dieselbe Falle wie bei JustWatch im
 *   Juli (siehe `ai_agent_learnings.md`): Ein Feld namens `upcoming` heißt
 *   nicht, dass es gefüllt ist. Deshalb fragt dieser Lauf `new` ab.
 * - **`change_type=new` bringt Anime**, mit Tonspur: „Beelzebub" bei Netflix
 *   mit `audios: [deu, jpn]`, dazu „The Dangers in My Heart" und „GTO (2026)".
 * - **Die Zuordnung geht über `imdbId` und `tmdbId`**, die im Show-Objekt
 *   mitkommen — kein Titelraten nötig.
 *
 * ## Was dieser Lauf ausdrücklich **nicht** tut
 *
 * Er schreibt **kein `dub: false`**. Die Quelle belegt, was da ist, nie was
 * fehlt — dieselbe Grenze wie beim großen Lauf, begründet in `lib/motn.ts`.
 * Ein Titel, den sie nicht nennt, bleibt offen.
 *
 * Aufruf: npm run data:motn:changes [-- --tage 3] [-- --budget 6]
 */
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { ROOT, loadEnv, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

loadEnv()

const BASIS = 'https://api.movieofthenight.com/v4'
const SCHLUESSEL = process.env.STREAMING_API_KEY
const ARCHIV = resolve(ROOT, 'data/motn-raw')

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

/**
 * Wie weit zurück gefragt wird.
 *
 * Drei Tage statt einem: Ein ausgefallener Lauf soll keine Lücke hinterlassen,
 * und dreifach gesehene Änderungen kosten nichts — sie werden ohnehin gegen den
 * Bestand abgeglichen.
 */
const TAGE = zahl('--tage', 3)
/** Harte Grenze, keine Empfehlung — dasselbe Kontingent wie der große Lauf. */
const BUDGET = zahl('--budget', 6)

/**
 * Die Anbieter, für die sich die Frage lohnt — **Crunchyroll gehört nicht dazu.**
 *
 * Am 23.08.2026 kurz aufgenommen und nach Daniels Prüfung wieder gestrichen.
 * Für „Lycoris Recoil" meldet die Quelle auf Serienebene `crunchyroll: deu`,
 * auf Folgenebene bei allen 13 Folgen `jpn` — und richtig ist keines von
 * beidem: Staffel 1 läuft dort auf Deutsch, Staffel 2 (die die Quelle gar
 * nicht kennt) nicht.
 *
 * Das ist kein Einzelfall, sondern stand längst in unserer eigenen
 * Kontrollmessung: `data/motn-messung.md` zählt für Crunchyroll **96 von 99
 * Vergleichen als „Quelle schweigt"**. Für Crunchyroll ist deren eigene
 * Content-API zuständig, die stündlich läuft und die Fassung je Folge kennt.
 */
const KATALOGE = 'netflix,prime.subscription,disney'

interface Aenderung {
  changeType: string
  itemType: string
  showId: string
  timestamp?: number
  service?: { id?: string }
}

interface MotnShow {
  id: string
  imdbId?: string
  tmdbId?: string
  title?: string
  originalTitle?: string
  showType?: string
  firstAirYear?: number
  streamingOptions?: Record<string, { service?: { id?: string }; type?: string; audios?: { language?: string }[] }[]>
}

interface Antwort {
  changes?: Aenderung[]
  shows?: Record<string, MotnShow>
  hasMore?: boolean
  nextCursor?: string
}

interface Bestand {
  fetchedAt?: string
  /** Verbrauchte Anfragen je Monat — dieselbe Buchhaltung wie der große Lauf. */
  verbrauch?: Record<string, number>
  /** Zuletzt gesehene Änderungen, damit ein Bericht sagen kann, was neu ist. */
  gesehen?: Record<
    string,
    {
      art?: 'new' | 'removed'
      titel?: string
      originalTitel?: string
      imdbId?: string
      tmdbId?: string
      dienst?: string
      am?: string
      deutsch?: boolean
    }
  >
}

async function hole(pfad: string): Promise<Antwort | undefined> {
  const res = await fetch(`${BASIS}${pfad}`, { headers: { 'X-API-Key': SCHLUESSEL as string } })
  if (res.status === 429) {
    warn('Kontingent erschöpft (429) — der Lauf endet hier.')
    return undefined
  }
  if (!res.ok) {
    warn(`HTTP ${res.status} bei ${pfad.slice(0, 60)}`)
    return undefined
  }
  const rest = Number(res.headers.get('x-quota-granted')) - Number(res.headers.get('x-quota-used'))
  if (Number.isFinite(rest)) log(`  Kontingent übrig: ${rest}`)
  return (await res.json()) as Antwort
}

/** Führt eine Antwort ins Archiv — eine zweite Auswertung kostet dann nichts. */
function archiviere(name: string, daten: unknown): void {
  if (!existsSync(ARCHIV)) mkdirSync(ARCHIV, { recursive: true })
  writeFileSync(resolve(ARCHIV, `${name}.json.gz`), gzipSync(JSON.stringify(daten)))
}

async function main(): Promise<void> {
  if (!SCHLUESSEL) {
    warn('STREAMING_API_KEY fehlt — der Lauf tut nichts. Schlüssel siehe my_secrets.md.')
    return
  }
  const pfad = resolve(ROOT, 'data/motn-changes.json')
  const bestand = readJson<Bestand>(pfad, {})
  const monat = new Date().toISOString().slice(0, 7)
  bestand.verbrauch ??= {}
  bestand.gesehen ??= {}

  const von = Math.floor(Date.now() / 1000) - TAGE * 86_400
  let anfragen = 0
  let neue = 0
  let mitDeutsch = 0
  let verschwunden = 0

  /**
   * Zwei Änderungsarten — aber nur eine davon darf etwas bewirken.
   *
   * `new` findet, was dazukommt: brauchbar, mit Tonspur.
   *
   * **`removed` ist unbrauchbar für automatische Änderungen — an vier von vier
   * Fällen widerlegt (Daniel, 23.08.2026).** Die Quelle meldete am 18.08. vier
   * Anime als bei Prime Video entfernt; alle vier lagen dort weiterhin im Abo:
   *
   * | Titel | Quelle | Daniels Blick ins eigene Konto |
   * |---|---|---|
   * | Digimon Tamers | entfernt | enthalten, Folge 1–51 auf Deutsch |
   * | Gankutsuou | entfernt | enthalten |
   * | Mayonaka no Occult Koumuin | entfernt | enthalten |
   * | Mahoutsukai no Yakusoku | entfernt | enthalten (ohne Deutsch) |
   *
   * Was „removed" wirklich bedeutet, ist damit offen — vermutlich der Wegfall
   * **einer** Katalogzuordnung (Kanal, Ausgabe, Staffel), nicht der Serie.
   * Bis das geklärt ist, wird der Befund **nur gesammelt**, nie angewandt:
   * Ein falsch entfernter Verweis fällt niemandem auf, er ist einfach weg.
   *
   * Die vorherige Fassung dieses Kommentars nannte den Befund „belegt" und
   * berief sich auf eine Gegenprobe mit „Dragonball Z". Die war wertlos: Dort
   * war das Ergebnis vorher bekannt. **Eine Gegenprobe, deren Ausgang man schon
   * kennt, prüft nichts.**
   */
  /**
   * Das Budget wird geteilt, nicht der Reihe nach verbraucht.
   *
   * Beim ersten Testlauf am 23.08.2026 fraß `new` alle vier Anfragen (die
   * Liste hat `hasMore: true`), und `removed` kam gar nicht mehr dran — die
   * Meldung sagte „0 Entfernungen", obwohl eine einzelne Handabfrage kurz
   * zuvor fünf gefunden hatte. Ein Zähler, der nur deshalb null ist, weil das
   * Budget vorher alle war, ist schlimmer als gar keiner: Er sieht aus wie ein
   * Befund.
   */
  const budgetJeArt = Math.max(1, Math.floor(BUDGET / 2))

  for (const art of ['new', 'removed'] as const) {
    let cursor: string | undefined
    const grenze = anfragen + budgetJeArt
    while (anfragen < grenze) {
      /**
       * `series_granularity: episode` ist hier kein Feinschliff, sondern
       * Bedingung — sonst ist die Tonspur-Angabe eine Serien-Auskunft und
       * damit für eine laufende Serie schlicht falsch.
       *
       * Daniel am 23.08.2026 zu „Lycoris Recoil": „1. staffel auf deutsch,
       * 2. staffel läuft (neuste folge ist ep6), aber keine einzige auf
       * deutsch." Die Quelle meldete ohne diesen Parameter `audios: [deu]` —
       * wahr für Staffel 1, falsch für alles, was gerade läuft. Und genau die
       * laufenden Staffeln sind das, wofür es diesen Lauf gibt.
       */
      const query = new URLSearchParams({
        country: 'de',
        change_type: art,
        item_type: 'show',
        show_type: 'series',
        series_granularity: 'episode',
        catalogs: KATALOGE,
        from: String(von),
        order_direction: 'desc',
      })
      if (cursor) query.set('cursor', cursor)

      const antwort = await hole(`/changes?${query}`)
      anfragen++
      bestand.verbrauch[monat] = (bestand.verbrauch[monat] ?? 0) + 1
      if (!antwort) break
      archiviere(`changes-${art}-${monat}-${anfragen}`, antwort)

      for (const c of antwort.changes ?? []) {
        const show = antwort.shows?.[c.showId]
        if (!show) continue
        const optionen = show.streamingOptions?.de ?? []
        const deutsch = optionen.some((o) => (o.audios ?? []).some((a) => a.language === 'deu'))
        const schluessel = `${art}:${c.showId}:${c.service?.id ?? '?'}`
        if (!bestand.gesehen[schluessel]) {
          neue++
          if (art === 'removed') verschwunden++
        }
        if (deutsch && art === 'new') mitDeutsch++
        bestand.gesehen[schluessel] = {
          art,
          titel: show.title,
          originalTitel: show.originalTitle,
          imdbId: show.imdbId,
          tmdbId: show.tmdbId,
          dienst: c.service?.id,
          am: c.timestamp ? new Date(c.timestamp * 1000).toISOString().slice(0, 10) : undefined,
          deutsch,
        }
      }

      if (!antwort.hasMore || !antwort.nextCursor) break
      cursor = antwort.nextCursor
      await sleep(400)
    }
  }

  bestand.fetchedAt = new Date().toISOString()
  writeJson(pfad, bestand, true)
  /*
    Die dritte Zahl ist der Punkt: Ein Änderungsabruf, der Seiten geholt und
    keine Änderung gefunden hat, war erfolgreich. Ohne sie galt „null neue
    Titel" als Schweigen, und der tägliche Lauf wurde davon rot.
  */
  recordSource('motn-changes', neue, anfragen ? undefined : 'keine Anfrage abgesetzt', anfragen)

  /**
   * Betrifft uns überhaupt etwas davon?
   *
   * Der Lauf meldete bisher nur seine eigenen Zahlen — „152 Einträge, 55 mit
   * deutscher Tonspur" liest sich nach Ertrag, sagt aber nichts darüber, ob
   * einer davon in diesem Kalender vorkommt. Gemessen am 24.08.2026: 11 der
   * 152 sind einem unserer Titel zuzuordnen, 5 tragen deutschen Ton, und alle
   * 5 standen längst im Bestand. Der Ertrag war null.
   *
   * Zugeordnet wird über die TMDB-Kennung, und die beiden Seiten schreiben sie
   * verschieden: `data/tmdb-titles.json` führt `tmdbId: 30991` mit `kind:
   * 'tv'`, die Änderungsquelle `tmdbId: 'tv/331650'`. Wer das übersieht,
   * misst sauber null Treffer und hält die Quelle für wertlos.
   */
  const tmdbTitel = readJson<Record<string, { tmdbId?: number; kind?: string }>>('data/tmdb-titles.json', {})
  const unsere = new Set<string>()
  for (const v of Object.values(tmdbTitel)) {
    if (v?.tmdbId) unsere.add(`${v.kind ?? 'tv'}/${v.tmdbId}`)
  }
  const motnBestand = readJson<{ shows?: Record<string, unknown> }>('data/motn.json', {})
  let unsereTreffer = 0
  let unsereMitDeutsch = 0
  let unsereNeu = 0
  for (const e of Object.values(bestand.gesehen)) {
    if (!e.tmdbId || !unsere.has(e.tmdbId)) continue
    unsereTreffer++
    if (!e.deutsch) continue
    unsereMitDeutsch++
    if (!e.imdbId || !motnBestand.shows?.[e.imdbId]) unsereNeu++
  }
  log(
    `Davon in unserem Kalender: ${unsereTreffer} zuzuordnen, ${unsereMitDeutsch} mit deutscher ` +
      `Tonspur, ${unsereNeu} noch nicht im MOTN-Bestand`,
  )
  if (unsereNeu > 0) {
    // Die Zeile, wegen der dieser Lauf existiert. Sie kam seit dem 23.08.2026
    // kein einziges Mal — wenn sie kommt, gehört der Titel in den nächsten
    // Folgenabruf.
    warn(`${unsereNeu} Titel aus der Änderungsquelle fehlen im MOTN-Bestand — Folgenabruf lohnt`)
  }
  log(`${anfragen} Anfragen, ${neue} neue Einträge (${mitDeutsch} mit deutscher Tonspur, ${verschwunden} Entfernungen).`)
  log(`Verbrauch ${monat}: ${bestand.verbrauch[monat]} (dieser Lauf) — der Monatslauf zählt eigene.`)
}

void main()
