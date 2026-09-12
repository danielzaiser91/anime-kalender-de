/**
 * **Was heute neu auf Deutsch bei Crunchyroll steht.**
 *
 * Der Anlass, und er ist der teuerste Einzelfall seit langem: Am 10.09.2026
 * erschienen die drei Specials zu „Lord of Mysteries" auf Deutsch. Unser
 * Prüflauf hatte die Serie am **09.09.** angesehen, und die Wiedervorlage steht
 * bei jungen Titeln auf Tagen bis Wochen — beim nächsten Blick wäre es der
 * 07.10. gewesen. Auf der Seite stand in der Zwischenzeit: kein Special, keine
 * deutsche Fassung, nichts. Daniel am 12.09.2026: „thats a huge flaw of the
 * website … wir müssen die vertrauenswürdigste Quelle für alles rund um
 * deutsche Synchros sein."
 *
 * **Die Antwort ist kein kürzeres Intervall, sondern eine andere Frage.** Statt
 * 1.100 Serien reihum abzuklappern und zu hoffen, dass man die richtige am
 * richtigen Tag erwischt, fragt dieser Lauf, was Crunchyroll selbst als
 * **neu hinzugefügt** führt — und liest dabei je Folge die Tonspur mit:
 *
 *     GET /content/v2/discover/browse?type=episode&sort_by=newly_added&n=100&start=…
 *     → data[].episode_metadata.audio_locale === 'de-DE'
 *
 * Gemessen am 12.09.2026: In den 400 jüngsten Folgen stehen 41 deutsche aus 20
 * Serien, darunter die drei Lord-of-Mysteries-Specials. Ein Lauf kostet vier
 * Abrufe und wenige Sekunden; er kann deshalb täglich laufen.
 *
 * **Der Filter `audio_locales` der Schnittstelle wird ignoriert** — mit und
 * ohne kommt dieselbe Liste (gemessen, drei Varianten). Gefiltert wird hier.
 *
 * **Was der Lauf nicht tut:** urteilen. Er schreibt eine Wiedervorlage-Liste;
 * ob eine Serie wirklich eine deutsche Fassung hat und welche Folgen, entscheidet
 * `scrape-crunchyroll-dub.ts` mit dem deutschen Zugangspaket. Sammeln und
 * beurteilen sind zwei Läufe (CLAUDE.md).
 *
 * Aufruf: `npm run data:cr-neu` (optional `--seiten 10`)
 */
import { todayIso } from '../shared/time.ts'
import { recordSource } from './lib/health.ts'
import { log, readJson, writeJson } from './lib/util.ts'

const BETA_API = 'https://beta-api.crunchyroll.com'
/** Dieselbe öffentliche Kennung wie im Browser — sie holt ein anonymes Token. */
const BASIC = 'noaihdevm_6iyg0a8l0q:'
const DEUTSCH = 'de-DE'
const DATEI = 'data/crunchyroll-neu.json'
/** Wie lange ein Fund in der Liste bleibt — lange genug für die Nachrichten, kurz genug fürs Gedächtnis. */
const HALTBAR_TAGE = 120

const argSeiten = Number(process.argv[process.argv.indexOf('--seiten') + 1])
const SEITEN = Number.isFinite(argSeiten) && argSeiten > 0 ? argSeiten : 6

export interface NeueFolge {
  /** Kennung der Folge in ihrer **deutschen** Fassung. */
  guid: string
  serieId: string
  serie: string
  serienTitel?: string
  staffelId?: string
  staffel?: string
  nummer?: number
  titel?: string
  /** Japanische bzw. originale Erstausstrahlung, wie Crunchyroll sie führt. */
  ausstrahlung?: string
  /**
   * Der Tag, an dem **wir** die deutsche Fassung zum ersten Mal gesehen haben.
   *
   * Crunchyroll nennt kein Datum für „seit wann gibt es die deutsche Tonspur";
   * `premium_available_date` trägt den Termin der Originalfassung (bei den
   * Lord-of-Mysteries-Specials der 19.06.2026, deutsch kamen sie am 10.09.).
   * Wer täglich nachsieht, hat den Tag auf den Tag genau — und das ist die
   * Angabe, um die es auf dieser Seite geht.
   */
  gesehenAm: string
}

interface Bestand {
  geholtAm: string
  folgen: NeueFolge[]
}

async function token(): Promise<string> {
  const antwort = await fetch(`${BETA_API}/auth/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(BASIC).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0',
    },
    body: 'grant_type=client_id',
  })
  if (!antwort.ok) throw new Error(`Token abgelehnt: HTTP ${antwort.status}`)
  const daten = (await antwort.json()) as { access_token: string; country?: string }
  log(`Anonymes Token, Katalog ${daten.country ?? '?'}`)
  return daten.access_token
}

async function seite(bearer: string, start: number): Promise<Record<string, unknown>[]> {
  const url =
    `${BETA_API}/content/v2/discover/browse?n=100&start=${start}` +
    `&sort_by=newly_added&locale=de-DE&type=episode`
  const antwort = await fetch(url, { headers: { Authorization: `Bearer ${bearer}`, 'User-Agent': 'Mozilla/5.0' } })
  if (!antwort.ok) throw new Error(`Browse abgelehnt: HTTP ${antwort.status}`)
  const daten = (await antwort.json()) as { data?: Record<string, unknown>[] }
  return daten.data ?? []
}

async function main(): Promise<void> {
  const bearer = await token()
  const heute = todayIso()
  const alt = readJson<Bestand>(DATEI, { geholtAm: '', folgen: [] })
  const bekannt = new Map(alt.folgen.map((f) => [f.guid, f]))
  const neu: NeueFolge[] = []
  let gelesen = 0

  for (let start = 0; start < SEITEN * 100; start += 100) {
    const daten = await seite(bearer, start)
    if (!daten.length) break
    gelesen += daten.length
    for (const eintrag of daten) {
      const m = (eintrag.episode_metadata ?? {}) as Record<string, unknown>
      if (m.audio_locale !== DEUTSCH) continue
      const guid = String(eintrag.id ?? '')
      if (!guid || bekannt.has(guid)) continue
      const folge: NeueFolge = {
        guid,
        serieId: String(m.series_id ?? ''),
        serie: String(m.series_title ?? ''),
        staffelId: m.season_id ? String(m.season_id) : undefined,
        staffel: m.season_title ? String(m.season_title) : undefined,
        nummer: typeof m.episode_number === 'number' ? m.episode_number : undefined,
        titel: typeof eintrag.title === 'string' ? eintrag.title : undefined,
        ausstrahlung: typeof m.episode_air_date === 'string' ? m.episode_air_date : undefined,
        gesehenAm: heute,
      }
      bekannt.set(guid, folge)
      neu.push(folge)
    }
  }

  /* Alte Funde fallen nach der Haltbarkeit heraus — die Datei ist ein Fenster, kein Archiv. */
  const grenze = new Date(Date.now() - HALTBAR_TAGE * 86400000).toISOString().slice(0, 10)
  const folgen = [...bekannt.values()]
    .filter((f) => f.gesehenAm >= grenze)
    .sort((a, b) => (a.gesehenAm === b.gesehenAm ? a.serie.localeCompare(b.serie) : b.gesehenAm.localeCompare(a.gesehenAm)))
  writeJson(DATEI, { geholtAm: new Date().toISOString(), folgen } satisfies Bestand)

  /* Leer ist der Normalfall an einem ruhigen Tag — die Quelle hat trotzdem gearbeitet. */
  recordSource('crunchyroll-neu', folgen.length, undefined, undefined, true)
  const serien = new Set(neu.map((f) => f.serie))
  log(`${gelesen} Folgen gelesen, ${neu.length} neue deutsche aus ${serien.size} Serien`)
  for (const s of [...serien].slice(0, 15)) log(`  neu auf Deutsch: ${s}`)
  log(`${folgen.length} Funde im Fenster der letzten ${HALTBAR_TAGE} Tage`)
}

await main()
