/**
 * **Aus TMDB-Einträgen werden Titel wie alle anderen.**
 *
 * Daniel hat am 12.09.2026 entschieden, alle 906 westlichen Animationsserien
 * aufzunehmen und sie **immer** zu zeigen — ausblenden kann sie, wer will,
 * über die Einstellungen. Damit müssen sie durch dieselben Ansichten laufen
 * wie der Anime-Bestand, und dafür brauchen sie dieselbe Form.
 *
 * Zwei Felder tun hier etwas anderes, als ihr Name sagt, und das ist die
 * bewusste Abwägung gegen eine zweite Datenstruktur:
 *
 * - **`jpYear`** trägt das Erscheinungsjahr. Für eine US-Serie gibt es keine
 *   japanische Ausstrahlung; die Ansichten sortieren und beschriften aber
 *   danach. Ein zweites Feld einzuführen hieße, jede Ansicht anzufassen.
 * - **`dubConfidence: 'low'`** heißt hier nicht „schwach belegt", sondern „die
 *   Frage stellt sich anders": Eine deutsche Fassung ist bei diesen Serien der
 *   Normalfall, und belegt haben wir sie trotzdem nicht.
 *
 * `westlich: true` ist das Feld, an dem die Oberfläche beide Sorten
 * unterscheidet — und an dem der Schalter in den Einstellungen hängt.
 */
import type { PlatformId, StreamLink, Title } from '../../shared/types.ts'

export interface CartoonEintrag {
  id: number
  tmdbId: number
  titleDe?: string
  titleEn: string
  jahr?: number
  start?: string
  episodes?: number
  genres: string[]
  cover?: string
  anbieterDe: string[]
  netzwerk?: string
  beschreibungDe?: string
  land: string[]
  geholtAm: string
}

/**
 * **Wie TMDB die Anbieter nennt, und wie wir sie nennen.**
 *
 * Die Liste deckt, was in der Messung vom 12.09.2026 wirklich vorkam. Was
 * nicht darin steht, wird **weggelassen** statt geraten: Ein falsch
 * zugeordneter Anbieter führt zu einem Verweis, der ins Leere zeigt — und ein
 * fehlender Verweis ist die ehrlichere Auskunft.
 *
 * Die Varianten mit Werbung („Netflix Standard with Ads") meinen denselben
 * Dienst; sie fallen über den Präfixvergleich unten zusammen.
 */
const ANBIETER: [string, PlatformId][] = [
  ['Netflix', 'netflix'],
  ['Amazon Prime Video', 'primevideo'],
  ['Disney Plus', 'disneyplus'],
  ['Crunchyroll', 'crunchyroll'],
  ['WOW', 'wow'],
  ['Joyn', 'joyn'],
  ['RTL+', 'rtlplus'],
  ['YouTube', 'youtube'],
]

export function plattformVon(name: string): PlatformId | undefined {
  return ANBIETER.find(([n]) => name.startsWith(n))?.[1]
}

/** Ein Kürzel als Adresse — Leerzeichen und Satzzeichen fliegen raus. */
function slugVon(name: string, id: number): string {
  const kern = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return kern ? `${kern}-${Math.abs(id)}` : String(Math.abs(id))
}

export function alsTitel(e: CartoonEintrag): Title {
  const streams: StreamLink[] = []
  const gesehen = new Set<PlatformId>()
  for (const name of e.anbieterDe) {
    const platform = plattformVon(name)
    if (!platform || gesehen.has(platform)) continue
    gesehen.add(platform)
    /*
      **`url: ''` statt einer geratenen Adresse.** TMDB nennt den Dienst, nicht
      die Seite des Titels dort. Die Oberfläche zeigt die Pille dann ohne
      Verweis — „läuft bei Netflix" beantwortet die Frage zur Hälfte, eine
      erfundene Adresse beantwortete sie falsch.

      `dub` bleibt offen: Eine deutsche Fassung ist bei diesen Serien der
      Normalfall, belegt haben wir sie trotzdem nicht — und ein unbelegtes
      `true` wäre genau das, was dieses Projekt sonst überall vermeidet.
    */
    streams.push({ platform, url: '' })
  }

  const anzeige = e.titleDe ?? e.titleEn
  return {
    id: e.id,
    slug: slugVon(anzeige, e.id),
    titleDe: e.titleDe,
    titleEn: e.titleEn,
    format: 'TV',
    jpYear: e.jahr,
    jpStart: e.start,
    episodes: e.episodes,
    genres: e.genres,
    coverImage: e.cover ? `https://image.tmdb.org/t/p/w342${e.cover}` : undefined,
    synopsis: undefined,
    keywords: [],
    streams,
    dubConfidence: 'low',
    westlich: true,
    tmdbId: e.tmdbId,
    /* Der Sender, für den produziert wurde — bei Anime steht dort das Studio. */
    studios: e.netzwerk ? [e.netzwerk] : undefined,
  }
}
