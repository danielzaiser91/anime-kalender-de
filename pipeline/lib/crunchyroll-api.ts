/**
 * Crunchyrolls eigene Content-API — die Quelle, aus der sich die Serienseite
 * selbst bedient.
 *
 * **Warum es diese Datei gibt:** Bis zum 21.08.2026 las
 * `scrape-crunchyroll-dub.ts` die gerenderte Seite und wartete dabei bis zu
 * zwanzig Sekunden auf eine Textzeile („Audio: Deutsch"). Gemessen am selben
 * Tag: 17 bis 23 Sekunden je Serie, hochgerechnet über 560 offene Adressen mehr
 * als zweieinhalb Stunden — bei einem Timeout von 180 Minuten. Dieselbe
 * Auskunft liegt strukturiert in dieser Schnittstelle, und zwar in 70 bis 250
 * Millisekunden.
 *
 * Genauer ist sie obendrein: Die Textzeile sagt „irgendwo auf dieser Seite gibt
 * es Deutsch", das Feld `versions` sagt es **je Folge**.
 *
 * ## Der Regelweg seit dem 22.08.2026: die beta-api mit Zugangspaket
 *
 * Bis dahin lief der Abruf über `www.crunchyroll.com` im Browser-Kontext — und
 * damit über die IP des Rechners, auf dem er lief. GitHub-Runner stehen in den
 * USA, also las jeder Lauf den **US-Katalog**: 1.655 geprüfte Folgen mit
 * `eligible_region: "US"`, für „Fairy Tail" durchgehend `ja-JP, en-US`, während
 * Daniel in Deutschland 277 deutsche Folgen sieht.
 *
 * `CrunchyrollCms` geht stattdessen über `beta-api.crunchyroll.com/cms/v2` und
 * legt ein **Zugangspaket** vor, das an einer deutschen Leitung entstanden ist
 * (`tools/cr-zugang-holen.mjs`). Drei Eigenschaften tragen diesen Weg, jede
 * gemessen (`docs/messung-crunchyroll-region.md`):
 *
 *  1. Die CloudFront-Signatur enthält **nur eine Zeitbedingung, keine
 *     IP-Bindung** — ein Paket aus Deutschland gilt deshalb auch von einem
 *     Rechner in den USA.
 *  2. `beta-api.crunchyroll.com` hat **keine Bot-Sperre**. Derselbe Aufruf gegen
 *     `www.crunchyroll.com` endet in Cloudflares „Just a moment…" (HTTP 403).
 *     Ein gewöhnlicher `fetch` genügt, kein Playwright.
 *  3. Das **Bearer-Token braucht der CMS-Pfad nicht**; die Signatur allein
 *     genügt, und sie gilt 24 Stunden statt einer.
 *
 * ## Die Rückfallebene: `CrunchyrollApi` im Browser
 *
 * Der alte Weg bleibt, falls das Paket fehlt oder Crunchyroll den CMS-Pfad
 * ändert. Er liest den Katalog der Region, in der der Rechner steht, und meldet
 * deshalb **kein** `katalog` — was er nicht belegen kann, behauptet er nicht.
 *
 * `robots.txt` erlaubt `/content/` und `/auth/` — geprüft am 21.08.2026.
 *
 * ## Was hier bewusst **nicht** benutzt wird
 *
 * `is_dubbed` und `is_subbed` stehen auf `true`, sobald es **irgendeine**
 * Synchronfassung gibt. Bei „Mushoku Tensei" Staffel 3 tragen auch die Folgen 4
 * und 5 ein `is_dubbed: true`, obwohl dort nur Englisch, Italienisch, Spanisch
 * und Portugiesisch vorliegen. Wer danach ginge, hielte jede Folge für deutsch
 * synchronisiert. Dasselbe gilt für `audio_locale` auf Staffelebene: Das nennt
 * nur die Originalsprache.
 *
 * **Maßgeblich ist ausschließlich `de-DE` in `versions`.**
 */
import type { Browser, Page } from 'playwright'
import type { CrDeutscheFolge } from './crunchyroll-dub.ts'
import { sleep, warn } from './util.ts'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

/** Irgendeine Serienseite; sie dient nur dazu, ein Token einzusammeln. */
const AUFWAERM_SEITE = 'https://www.crunchyroll.com/de/series/GRDV0019R'

/**
 * Crunchyroll antwortet nicht mehr — der Lauf endet hier, er wird nicht
 * fortgesetzt.
 *
 * Eigener Fehlertyp, damit der Aufrufer ihn von „diese eine Serie ging schief"
 * unterscheiden kann. Weiterzumachen hieße, gegen eine geschlossene Tür zu
 * laufen, und zwar einmal je verbleibender Adresse.
 */
export class CrunchyrollGesperrt extends Error {}

/**
 * Ohne gültiges Zugangspaket wird gar nicht erst abgerufen.
 *
 * Der Lauf bricht dann ab, statt still auf den US-Katalog auszuweichen: Ein
 * Lauf, der unbemerkt die falsche Region liest, ist schlimmer als keiner — er
 * schreibt Befunde in den Datensatz, die für Deutschland nichts belegen, und
 * niemand sieht es der Datei an.
 */
export class ZugangspaketFehlt extends Error {}

/** Die Tonspur, um die es geht. Steht als Zeichenkette in `versions`. */
export const DEUTSCH = 'de-DE'

/**
 * Das Zugangspaket, wie `tools/cr-zugang-holen.mjs` es ablegt.
 *
 * `bucket` ist der signierte Pfad (`/DE/M2/-`) — Land, Altersfreigabe, Kanal.
 * Er ist die eigentliche Auskunft über die Region: `land` steht daneben, aber
 * unterschrieben ist der Bucket.
 */
export interface CrZugang {
  land: string
  bucket: string
  policy: string
  signature: string
  key_pair_id: string
  /** ISO-Zeitpunkt in UTC; die Signatur gilt 24 Stunden. */
  gueltig_bis: string
}

/** Das Land aus dem signierten Bucket-Pfad, etwa `DE` aus `/DE/M2/-`. */
export function bucketLand(bucket: string): string | undefined {
  return /^\/([A-Za-z]{2})\//.exec(bucket)?.[1]?.toUpperCase()
}

/**
 * Liest das Zugangspaket aus der Umgebung — oder bricht mit klarer Ansage ab.
 *
 * Geprüft wird auch das Ablaufdatum, und zwar **vor** dem ersten Abruf. Sonst
 * liefe der Lauf in eine Reihe von 403ern, die aussehen wie eine Bot-Sperre und
 * eine abgelaufene Unterschrift sind — dieselbe Auskunft, zwei völlig
 * verschiedene Gegenmaßnahmen.
 */
export function ladeZugang(roh = process.env.CR_ZUGANG): CrZugang {
  const erneuern = 'mit `node tools/cr-zugang-holen.mjs --secret` erneuern (muss in Deutschland laufen).'
  if (!roh?.trim()) {
    throw new ZugangspaketFehlt(`Kein Zugangspaket in CR_ZUGANG — ${erneuern}`)
  }
  let paket: Partial<CrZugang>
  try {
    paket = JSON.parse(roh) as Partial<CrZugang>
  } catch {
    throw new ZugangspaketFehlt(`CR_ZUGANG ist kein JSON — ${erneuern}`)
  }
  const felder = ['land', 'bucket', 'policy', 'signature', 'key_pair_id', 'gueltig_bis'] as const
  const fehlend = felder.filter((f) => !paket[f])
  if (fehlend.length) {
    throw new ZugangspaketFehlt(`CR_ZUGANG unvollständig, es fehlt ${fehlend.join(', ')} — ${erneuern}`)
  }
  const bis = Date.parse(paket.gueltig_bis as string)
  if (!Number.isFinite(bis)) {
    throw new ZugangspaketFehlt(`CR_ZUGANG trägt kein lesbares gueltig_bis („${paket.gueltig_bis}") — ${erneuern}`)
  }
  if (bis <= Date.now()) {
    throw new ZugangspaketFehlt(`Zugangspaket abgelaufen (galt bis ${paket.gueltig_bis}), ${erneuern}`)
  }
  return paket as CrZugang
}

/**
 * Die Serienkennung aus der Adresse, auf der ein Seitenaufruf gelandet ist.
 *
 * Eigene Funktion, weil hier der teuerste Fehler dieses Abrufs saß und eine
 * Zusicherung ihn festhalten können muss (`check-logic.ts`): Schlägt
 * `page.goto` fehl, wechselt der Browser die Seite **nicht**, und `page.url()`
 * liefert die Adresse der vorherigen. Am 21.08.2026 stand dort nach
 * Crunchyrolls Bot-Sperre die Aufwärmseite, und 91 fremde Adressen bekamen die
 * Staffelliste von „Jujutsu Kaisen" zugeschrieben.
 *
 * Zwei Adressen sind deshalb ausdrücklich kein Ergebnis: `about:blank` (dorthin
 * wird vor jedem Aufruf geräumt) und die Aufwärmseite selbst. Der echte Verweis
 * auf dieselbe Serie trägt den Slug und bleibt gültig.
 */
export function kennungAusZiel(ziel: string): string | undefined {
  if (!ziel.startsWith('https://www.crunchyroll.com/')) return undefined
  if (ziel === AUFWAERM_SEITE) return undefined
  return /\/series\/([A-Z0-9]+)/i.exec(ziel)?.[1]
}

/**
 * Was über eine einzelne Folge zu sagen ist.
 *
 * Dieselben drei Werte wie beim Lesen der Folgenkacheln, damit beide Wege
 * dasselbe zählen und vergleichbar bleiben.
 */
export type Tonspur = 'deutsch' | 'fremd' | 'keine'

/** Eine Tonspur-Fassung eines Objekts. */
export interface CrVersion {
  audio_locale: string
  guid: string
  original?: boolean
}

export interface CrApiStaffel {
  id: string
  title: string
  /** Nur der ältere CMS-Pfad führt ihn — dort steckt `-german-dub` drin. */
  slug_title?: string
  /** Die Tonspur **dieses Blocks**, nicht die der Serie. */
  audio_locale?: string
  season_number?: number
  season_display_number?: string
  number_of_episodes?: number
  is_complete?: boolean
  versions?: CrVersion[]
}

export interface CrApiFolge {
  id: string
  title?: string
  episode?: string
  episode_number?: number | null
  sequence_number?: number
  premium_available_date?: string
  episode_air_date?: string
  versions?: CrVersion[]
}

/** Ein Objekt aus `/objects` — hier immer eine einzelne Folgenfassung. */
export interface CrApiObjekt {
  id: string
  episode_metadata?: {
    episode_number?: number | null
    audio_locale?: string
    premium_available_date?: string
    episode_air_date?: string
    season_id?: string
    series_id?: string
  }
}

/**
 * Beide Wege antworten in derselben Hülle — nur heißt die Liste anders.
 *
 * `/content/v2` nennt sie `data`, der ältere CMS-Pfad `items`. `total` steht in
 * beiden und ist die Gegenprobe darauf, dass nichts fehlt.
 */
interface Antwort<T> {
  data?: T[]
  items?: T[]
  total?: number
}

/**
 * Was ein Abrufweg über eine Serie zu sagen hat.
 *
 * Zwei Umsetzungen: `CrunchyrollCms` über die beta-api mit Zugangspaket (der
 * Regelweg, kennt seine Region) und `CrunchyrollApi` über den Browser (die
 * Rückfallebene, kennt sie nicht).
 */
export interface CrQuelle {
  /**
   * Aus welchem Länderkatalog die Antworten kommen — kleingeschrieben, `de`.
   *
   * `undefined` heißt **nicht belegt**, nicht „irgendein Land". An diesem
   * Unterschied hängt, ob aus einem fehlenden `de-DE` ein `dub: false` werden
   * darf (`beurteile()` in `crunchyroll-dub.ts`).
   */
  readonly katalog?: string
  /**
   * Diese Quelle liest ein Archiv und ruft nichts ab.
   *
   * Wichtig für `serieLesen`: Ein Lauf gegen das Archiv darf das Archiv nicht
   * überschreiben. Sonst prüfte man den Parser gegen Daten, die er beim letzten
   * Prüflauf selbst geschrieben hat.
   */
  readonly ausArchiv?: boolean
  staffeln(seriesId: string): Promise<{ roh: string; data: CrApiStaffel[] } | undefined>
  folgen(staffelId: string): Promise<{ roh: string; data: CrApiFolge[] } | undefined>
  objekte(guids: string[]): Promise<{ roh: string; data: CrApiObjekt[] } | undefined>
}

/**
 * Wie viele Kennungen in einen Sammelabruf dürfen.
 *
 * Geprüft am 21.08.2026 an „One Piece": 50, 100 und 200 Kennungen lieferten
 * alle vollständig (HTTP 200, 200 Objekte in 1.326 ms). Eine Obergrenze wurde
 * damit **nicht** gefunden — 50 ist trotzdem die gewählte Größe, weil ein
 * einzelner Fehlschlag dann höchstens fünfzig Folgen kostet und die
 * Adresslänge unter tausend Zeichen bleibt.
 */
export const BUENDEL = 50

/** Wo der ältere CMS-Pfad liegt — und wo Cloudflare **nicht** dazwischensteht. */
const BETA_API = 'https://beta-api.crunchyroll.com'

/**
 * Der Regelweg: `beta-api.crunchyroll.com/cms/v2<bucket>` mit Signatur.
 *
 * Kein Browser, kein Token, kein Aufwärmen — drei Parameter an der Adresse, und
 * die Antwort kommt aus dem Katalog des Landes, das im Bucket steht. Der Rest
 * dieser Klasse ist die Buchhaltung darum herum: Wiederholungen, Taktung und
 * die Unterscheidung zwischen „gibt es nicht" (404) und „gerade keine Auskunft".
 *
 * ## Was hier anders ist als bei `/content/v2`
 *
 * Der ältere Pfad führt **je Tonspur eine eigene Staffel**: „Fairy Tail" hat
 * dort fünf Blöcke statt drei, weil die deutsche Fassung der ersten beiden
 * Staffeln je einen eigenen trägt. Übernommen werden dürfen sie so nicht —
 * `beurteile()` rechnet Blocksummen gegen unsere Staffeln, und doppelt geführte
 * Folgen machten daraus doppelte Summen. `hauptStaffeln()` legt sie deshalb
 * wieder zusammen, und zwar über das Feld, das die Schnittstelle selbst dafür
 * mitliefert.
 */
export class CrunchyrollCms implements CrQuelle {
  readonly katalog: string
  private readonly basis: string
  private readonly signatur: Record<string, string>

  constructor(
    private zugang: CrZugang,
    private pauseMs = 400,
  ) {
    this.basis = `${BETA_API}/cms/v2${zugang.bucket}`
    // Der Bucket ist unterschrieben, `land` steht nur daneben — im Zweifel
    // gilt, was in der Signatur steht.
    this.katalog = (bucketLand(zugang.bucket) ?? zugang.land).toLowerCase()
    this.signatur = { Policy: zugang.policy, Signature: zugang.signature, 'Key-Pair-Id': zugang.key_pair_id }
  }

  /**
   * Ein Abruf mit Signatur.
   *
   * **403 ist hier zweideutig, und die beiden Bedeutungen sind zu trennen:**
   * Entweder ist die Unterschrift abgelaufen — dann hilft ein neues Paket und
   * kein Wiederholen —, oder Crunchyroll hat dichtgemacht. Deshalb wird bei
   * einem 403 zuerst die Uhr befragt und erst danach wiederholt.
   */
  private async hole(pfad: string, params: Record<string, string>, versuch = 0): Promise<{ status: number; text: string }> {
    const q = new URLSearchParams({ locale: 'de-DE', ...params, ...this.signatur })
    const antwort = await fetch(`${this.basis}${pfad}?${q}`, { headers: { 'user-agent': CHROME } })
      .then(async (r) => ({ status: r.status, text: await r.text() }))
      .catch((err: Error) => ({ status: 0, text: err.message }))
    await sleep(this.pauseMs)

    if (antwort.status === 403 && Date.parse(this.zugang.gueltig_bis) <= Date.now()) {
      throw new ZugangspaketFehlt(
        `Zugangspaket mitten im Lauf abgelaufen (galt bis ${this.zugang.gueltig_bis}), ` +
          'mit `node tools/cr-zugang-holen.mjs --secret` erneuern (muss in Deutschland laufen).',
      )
    }
    if (antwort.status === 200 || antwort.status === 404) return antwort
    if (versuch >= 3) {
      /**
       * Ein dauerhaftes 403 bei gültiger Unterschrift ist die Sperre.
       *
       * Weiterzumachen hieße, gegen eine geschlossene Tür zu laufen — einmal je
       * verbleibender Serie. Alles andere (500er, abgerissene Verbindung) bleibt
       * eine Nichtauskunft zu **dieser** Serie und beendet den Lauf nicht.
       */
      if (antwort.status === 403) {
        throw new CrunchyrollGesperrt(`beta-api antwortet dauerhaft mit 403 bei ${pfad} — Zugang gesperrt`)
      }
      warn(`Crunchyroll-CMS ${antwort.status} bei ${pfad} — aufgegeben`)
      return antwort
    }
    warn(`Crunchyroll-CMS ${antwort.status} bei ${pfad} — Versuch ${versuch + 2}`)
    await sleep(2 ** versuch * 2000)
    return this.hole(pfad, params, versuch + 1)
  }

  private async liste<T>(pfad: string, params: Record<string, string>): Promise<{ roh: string; data: T[] } | undefined> {
    const antwort = await this.hole(pfad, params)
    if (antwort.status === 404) return { roh: antwort.text, data: [] }
    if (antwort.status !== 200) return undefined
    try {
      const j = JSON.parse(antwort.text) as Antwort<T>
      const data = j.items ?? j.data ?? []
      /**
       * Die Gegenprobe gegen stillen Datenverlust.
       *
       * Bei ADN hat genau das 99 von 199 Folgen gekostet, weil eine paginierte
       * Schnittstelle unpaginiert abgefragt wurde (`CLAUDE.md`). Der CMS-Pfad
       * liefert bislang immer alles — geprüft am 22.08.2026 an einem Block mit
       * 175 Folgen, `n` und `start` ignoriert er. Falls sich das ändert, steht
       * es hier im Protokoll und nicht erst in einer falschen Zahl.
       */
      if (typeof j.total === 'number' && j.total > data.length) {
        warn(`Crunchyroll-CMS ${pfad}: ${data.length} von ${j.total} Einträgen — die Antwort ist unvollständig`)
        return undefined
      }
      return { roh: antwort.text, data }
    } catch {
      return undefined
    }
  }

  staffeln(seriesId: string): Promise<{ roh: string; data: CrApiStaffel[] } | undefined> {
    return this.liste<CrApiStaffel>('/seasons', { series_id: seriesId })
  }

  folgen(staffelId: string): Promise<{ roh: string; data: CrApiFolge[] } | undefined> {
    return this.liste<CrApiFolge>('/episodes', { season_id: staffelId })
  }

  objekte(guids: string[]): Promise<{ roh: string; data: CrApiObjekt[] } | undefined> {
    return this.liste<CrApiObjekt>(`/objects/${guids.join(',')}`, {})
  }
}

/**
 * Legt die je Tonspur getrennten Blöcke wieder zusammen.
 *
 * Der ältere CMS-Pfad führt „Fairy Tail (German Dub)" und „Fairy Tail" als zwei
 * Staffeln — dieselben Folgen, zweimal gezählt. Welche zusammengehören, sagt die
 * Schnittstelle selbst: In `versions` steht je Block die Liste aller Fassungen
 * mit Kennung, und genau eine davon trägt `original: true`.
 *
 * Genommen wird der **Originalblock**, nicht der deutsche. Das ist kein
 * Geschmacksurteil: Der deutsche Block enthält nur die Folgen, die es deutsch
 * gibt — er wäre immer zu 100 Prozent deutsch, und „15 von 17" ließe sich daran
 * nicht mehr ablesen. Am Originalblock hängt die vollständige Folgenliste, und
 * jede Folge nennt in ihrem eigenen `versions`, ob es sie deutsch gibt.
 *
 * Fehlt der Originalblock im Katalog (Sonderfall: nur die Synchronfassung ist
 * hier abrufbar), bleibt der Block stehen, wie er ist.
 */
export function hauptStaffeln<T extends { id: string; versions?: CrVersion[] }>(staffeln: T[]): T[] {
  const nachId = new Map(staffeln.map((s) => [s.id, s]))
  const gewaehlt = new Map<string, T>()
  for (const s of staffeln) {
    const original = (s.versions ?? []).find((v) => v.original)?.guid
    const schluessel = original && nachId.has(original) ? original : s.id
    if (!gewaehlt.has(schluessel)) gewaehlt.set(schluessel, nachId.get(schluessel) ?? s)
  }
  return [...gewaehlt.values()]
}

/**
 * Nennt dieser Staffelname die deutsche Fassung?
 *
 * Die **Kontrolle** zu `versions`, nicht der Beleg: Crunchyroll schreibt die
 * Fassung in den Titel („Fairy Tail (German Dub)", Slug `-german-dub`).
 * Widersprechen sich beide, gewinnt `versions` — ein Name ist Redaktion, eine
 * Fassungsliste ist Bestand.
 */
export function nameNenntDeutsch(...texte: (string | undefined)[]): boolean {
  return texte.some((t) => /\b(german|deutsch)/i.test(t ?? ''))
}

/**
 * Ein Browserfenster auf crunchyroll.com — für das, was keine API hergibt.
 *
 * Zwei Dinge stehen nur auf der Seite: die Serienkennung hinter einer
 * Slug-Adresse (die Weiterleitung verrät sie) und Crunchyrolls eigene Ansage,
 * dass es eine Serie nicht mehr gibt. Beides ist unabhängig von der Frage nach
 * der Tonspur, und beides braucht deshalb **keinen** Katalog und kein
 * Zugangspaket.
 *
 * Eigene Klasse, seit der Regelweg über die beta-api läuft: Der Browser kostet
 * beim Start mehrere Sekunden und wird jetzt nur noch angeworfen, wenn eine
 * Adresse ihn wirklich braucht.
 */
export class CrunchyrollSeiten {
  protected page!: Page
  /** Zwischen zwei Aufrufen; die Taktung bleibt rücksichtsvoll. */
  constructor(
    protected browser: Browser,
    protected pauseMs = 250,
  ) {}

  async oeffnen(): Promise<void> {
    this.page = await this.browser.newPage({
      userAgent: CHROME,
      locale: 'de-DE',
      viewport: { width: 1280, height: 900 },
    })
  }

  /**
   * Ruft eine Seite auf und sagt, was dort steht.
   *
   * Zwei Zwecke in einem Aufruf, weil beide dieselbe Seite brauchen:
   *
   *  1. **Die Serienkennung.** `/de/<slug>` trägt keine; der Aufruf leitet im
   *     Browser auf `/de/series/<id>/<slug>` um, und dort steht sie
   *     (gemessen 21.08.2026: rund 370 ms). Das Ergebnis wird in
   *     `data/crunchyroll-series-ids.json` festgehalten, damit der Aufruf
   *     einmalig bleibt.
   *  2. **Der zweite Beleg für „gibt es nicht mehr".** Aus einer leeren
   *     Antwort der Content-API allein wird kein `nichtVerfuegbar` — das
   *     entfernt Verweise aus dem Datensatz, und ein zerstörender Schluss
   *     braucht einen zweiten Beleg (`CLAUDE.md`). Crunchyrolls eigene
   *     Fehlerseiten sind dieser Beleg.
   *
   * `art` ist `undefined`, wenn die Seite weder Kennung noch Fehlermeldung
   * hergibt — das ist eine Nichtauskunft und ausdrücklich kein Befund.
   */
  async seitenBefund(
    url: string,
    /**
     * Auch dann nach einer Fehlermeldung sehen, wenn die Kennung schon dasteht.
     *
     * Der Regelfall ist `false`: Wer nur die Kennung sucht, hat sie mit der
     * Weiterleitung, und weiterzuwarten kostet Sekunden für nichts. Beim
     * Gegenprüfen einer leeren Staffelliste ist es umgekehrt — dort steht die
     * Kennung immer, und gesucht wird gerade die Meldung.
     */
    aufMeldungWarten = false,
  ): Promise<{ seriesId?: string; ziel: string; art?: 'weg' | 'fehlt'; zeile?: string }> {
    /**
     * Erst leerräumen, dann laden.
     *
     * `goto` schlägt fehl, ohne die Seite zu wechseln — steht dann noch die
     * **vorherige** Seite im Browser, liefert `page.url()` deren Adresse, und
     * aus der wird prompt eine Serienkennung gelesen. Am 21.08.2026 war das
     * kein Gedankenspiel: Crunchyroll zog nach rund 300 Serien die Bot-Sperre,
     * jeder weitere Aufruf scheiterte, und im Browser stand die Aufwärmseite —
     * „Jujutsu Kaisen". **91 fremde Adressen bekamen dessen Staffelliste
     * zugeschrieben**, „sing-a-bit-of-harmony" mitsamt „JUJUTSU KAISEN: 24/24".
     *
     * `about:blank` macht aus dem Fehlschlag wieder eine Nichtauskunft: Es gibt
     * dann keine Adresse mehr, aus der sich etwas herauslesen ließe.
     */
    await this.page.goto('about:blank').catch(() => undefined)
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => undefined)
    const ziel = this.page.url()
    const seriesId = kennungAusZiel(ziel)
    if (seriesId && !aufMeldungWarten) {
      await sleep(this.pauseMs)
      return { seriesId, ziel }
    }
    /**
     * Eine Folgenseite ist keine Fehlerseite — hier ist nichts abzuwarten.
     *
     * Landet die Adresse auf `/watch/<guid>`, steht die Auskunft schon da: Die
     * Folgenkennung führt über `objects` zur Serie. Die fünf Sekunden unten
     * wären fünf Sekunden Warten auf eine Meldung, die auf einer funktionierenden
     * Seite nie erscheint — bei 39 Folgenverweisen und jedem Lauf.
     */
    if (!aufMeldungWarten && /\/watch\/[A-Z0-9]+/i.test(ziel)) {
      await sleep(this.pauseMs)
      return { ziel }
    }
    /**
     * Fünf Sekunden, nicht zwanzig.
     *
     * Die Fehlerseite ist kein React-Aufbau — sie steht nach einem Bruchteil
     * einer Sekunde da (fünf Stichproben am 21.08.2026: immer 1.508 Zeichen).
     * Wer hier lange wartet, wartet auf eine Seite, die es nicht gibt.
     */
    const befund = await this.page
      .waitForFunction(
        () => {
          const text = document.body.innerText
          const weg = text.match(/^.*nicht mehr verfügbar.*$/m)
          if (weg) return { art: 'weg' as const, zeile: weg[0] }
          const fehlt = text.match(/^404 - Seite nicht gefunden.*$/m)
          if (fehlt) return { art: 'fehlt' as const, zeile: fehlt[0] }
          return null
        },
        undefined,
        { timeout: 5000 },
      )
      .then((h) => h.jsonValue())
      .catch(() => null)
    await sleep(this.pauseMs)
    return { seriesId, ziel, art: befund?.art, zeile: befund?.zeile.trim() }
  }

  async schliessen(): Promise<void> {
    await this.page?.close().catch(() => undefined)
  }
}

/**
 * Die Rückfallebene: ein aufgewärmter Zugang zur Content-API im Browser.
 *
 * **Sie kennt ihre Region nicht** und meldet deshalb kein `katalog` — sie liest
 * den Katalog des Landes, in dem der Rechner steht. Auf einem GitHub-Runner ist
 * das die USA, und dort belegt ein fehlendes `de-DE` nichts.
 *
 * Das Token kommt aus dem Netzwerkverkehr einer geladenen Seite und hält nicht
 * ewig (`expires_in`, in der Messung fünf Minuten). Ein Lauf über 959 Serien
 * dauert länger als das — deshalb wärmt `hole()` selbsttätig nach, sowohl vor
 * Ablauf als auch nach einem 401. Ohne das bräche der Lauf nach den ersten
 * Minuten reihenweise ab, und zwar mit einer Meldung, die wie „keine Auskunft"
 * aussieht statt wie „Token abgelaufen".
 */
export class CrunchyrollApi extends CrunchyrollSeiten implements CrQuelle {
  private token = ''
  private gueltigBis = 0

  override async oeffnen(): Promise<void> {
    await super.oeffnen()
    this.page.on('response', (res) => {
      if (!res.url().includes('/auth/v1/token')) return
      void res
        .json()
        .then((j: { access_token?: string; expires_in?: number }) => {
          if (!j.access_token) return
          this.token = j.access_token
          // Eine Minute Sicherheitsabstand: Ein Aufruf, der auf halbem Weg
          // abläuft, kostet einen Fehlversuch für nichts.
          this.gueltigBis = Date.now() + Math.max(60, (j.expires_in ?? 300) - 60) * 1000
        })
        .catch(() => undefined)
    })
    await this.aufwaermen()
  }

  /**
   * Holt ein Token — und erkennt, wenn Crunchyroll dichtgemacht hat.
   *
   * Gemessen am 21.08.2026: Nach rund 300 Serien in 25 Minuten antwortete die
   * Content-API mit 403, und die Aufwärmseite lieferte kein Token mehr. Das ist
   * die Bot-Sperre, und sie ist der Grund, warum hier zurückgewichen statt
   * weitergemacht wird: Der Lauf davor hat nach der Sperre noch 200 Adressen
   * angefragt — jede vergeblich, jede zusätzliche Last auf einem Server, der
   * gerade „nein" gesagt hat.
   *
   * Erst zwei Pausen von einer und zwei Minuten, dann Schluss. Was bis dahin
   * gelesen ist, bleibt; der Rest kommt beim nächsten Lauf dran.
   */
  private async aufwaermen(versuch = 0): Promise<void> {
    this.token = ''
    await this.page.goto('about:blank').catch(() => undefined)
    await this.page.goto(AUFWAERM_SEITE, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => undefined)
    for (let i = 0; i < 40 && !this.token; i++) await this.page.waitForTimeout(250)
    if (this.token) return
    if (versuch >= 2) {
      throw new CrunchyrollGesperrt(
        'kein Zugangstoken aus dem Netzwerkverkehr — entweder die Bot-Sperre oder ein geänderter Weg',
      )
    }
    warn(`Crunchyroll liefert kein Zugangstoken — ${versuch + 1}. Versuch, Pause ${(versuch + 1) * 60} s`)
    await sleep((versuch + 1) * 60000)
    return this.aufwaermen(versuch + 1)
  }

  /**
   * Ein Aufruf im Browser-Kontext.
   *
   * Der Status kommt mit zurück, und zwar immer. Der Unterschied zwischen „404
   * — diese Kennung gibt es nicht" und „gerade keine Auskunft" ist genau der
   * zwischen einem Befund und einer Nichtauskunft, und wer ihn einebnet, macht
   * aus einer Störung eine Aussage über den Inhalt.
   *
   * **Wiederholt wird alles außer 404.** Am 21.08.2026 fielen im ersten
   * Volllauf 59 von 510 Serien mit „hat nicht geantwortet" aus — darunter
   * „Goblin Slayer" und „Rent-a-Girlfriend", also unzweifelhaft vorhandene
   * Serien, und zwar verstreut zwischen gelungenen Abrufen. Eine einmalige
   * Störung darf keine Serie für vier Wochen als unbeantwortet zurücklassen.
   */
  private async hole(pfad: string, versuch = 0): Promise<{ status: number; text: string }> {
    if (!this.token || Date.now() > this.gueltigBis) await this.aufwaermen()
    /**
     * Der Aufruf läuft im Kontext der geladenen Seite — die muss deshalb auf
     * crunchyroll.com stehen.
     *
     * `seitenBefund()` folgt Weiterleitungen, und unter unseren
     * Crunchyroll-Verweisen steckte eine Amazon-Adresse. Von dort aus ist
     * derselbe `fetch` plötzlich ein fremder Ursprung, und der Browser bricht
     * ihn ab, bevor Crunchyroll ihn je sieht.
     */
    if (!this.page.url().startsWith('https://www.crunchyroll.com')) await this.aufwaermen()
    const antwort = await this.page
      .evaluate(
        async ([p, tok]) => {
          const r = await fetch(`https://www.crunchyroll.com${p}`, { headers: { authorization: `Bearer ${tok}` } })
          return { status: r.status, text: await r.text() }
        },
        [pfad, this.token] as const,
      )
      .catch((err: Error) => ({ status: 0, text: err.message }))
    await sleep(this.pauseMs)

    if (antwort.status === 200 || antwort.status === 404 || versuch >= 3) {
      if (antwort.status !== 200 && antwort.status !== 404) {
        warn(`Crunchyroll-API ${antwort.status} bei ${pfad.slice(0, 70)} — aufgegeben`)
      }
      return antwort
    }
    warn(`Crunchyroll-API ${antwort.status} bei ${pfad.slice(0, 70)} — Versuch ${versuch + 2}`)
    // Ein abgelaufenes Token ist der häufigste Grund; ein neues kostet zwei
    // Sekunden und heilt auch die Fälle, in denen der Browser-Kontext hakt.
    await sleep(2 ** versuch * 2000)
    await this.aufwaermen()
    return this.hole(pfad, versuch + 1)
  }

  /**
   * Rohantwort und ausgewertete Liste — die Rohantwort wandert ins Archiv.
   *
   * `undefined` heißt **Nichtauskunft**, `data: []` heißt „die Schnittstelle
   * kennt dazu nichts". Der Aufrufer muss beides auseinanderhalten.
   */
  private async liste<T>(pfad: string): Promise<{ roh: string; data: T[] } | undefined> {
    const antwort = await this.hole(pfad)
    if (antwort.status === 404) return { roh: antwort.text, data: [] }
    if (antwort.status !== 200) return undefined
    try {
      const j = JSON.parse(antwort.text) as Antwort<T>
      return { roh: antwort.text, data: j.data ?? [] }
    } catch {
      return undefined
    }
  }

  staffeln(seriesId: string): Promise<{ roh: string; data: CrApiStaffel[] } | undefined> {
    return this.liste<CrApiStaffel>(`/content/v2/cms/series/${seriesId}/seasons?locale=de-DE`)
  }

  folgen(staffelId: string): Promise<{ roh: string; data: CrApiFolge[] } | undefined> {
    return this.liste<CrApiFolge>(`/content/v2/cms/seasons/${staffelId}/episodes?locale=de-DE`)
  }

  /**
   * Mehrere Folgenfassungen auf einen Streich.
   *
   * Das ist der Aufruf, der aus der Terminfrage eine bezahlbare macht: Die
   * `episodes`-Antwort liefert immer die Daten der **Originalstaffel**, auch
   * wenn man die Kennung der deutschen einsetzt. Der deutsche Termin steht
   * ausschließlich am Objekt der deutschen Fassung. Einzeln abgefragt wären das
   * über zehntausend Aufrufe; gebündelt sind es ein paar hundert.
   */
  objekte(guids: string[]): Promise<{ roh: string; data: CrApiObjekt[] } | undefined> {
    return this.liste<CrApiObjekt>(`/content/v2/cms/objects/${guids.join(',')}?locale=de-DE`)
  }

}

/**
 * Zählt aus, wie viele deutsche Folgen eine Staffel hat.
 *
 * Je Folgennummer nur einmal — Crunchyroll führt dieselbe Folge mehrfach auf.
 * Eine deutsche Fassung schlägt dabei eine fremde: Steht dieselbe Nummer
 * zweimal da, einmal mit und einmal ohne deutsche Tonspur, gibt es sie deutsch.
 * Das ist dieselbe Regel wie bei der Kachelauswertung; sie stammt aus Daniels
 * Befund vom 12.08.2026, dass es sogar zwei Wähler-Einträge zur selben Staffel
 * gibt.
 */
export function staffelAuszaehlen(folgen: { episode_number?: number | null; versions?: { audio_locale: string; guid: string; original?: boolean }[] }[]): {
  jeFolge: Map<string, Tonspur>
  deutscheFolgen: CrDeutscheFolge[]
} {
  const jeFolge = new Map<string, Tonspur>()
  const deutscheFolgen = new Map<string, CrDeutscheFolge>()
  folgen.forEach((f, i) => {
    const nummer = typeof f.episode_number === 'number' ? f.episode_number : undefined
    const schluessel = nummer !== undefined ? `E${nummer}` : `#${i}`
    const ton: Tonspur = hatDeutsch(f.versions) ? 'deutsch' : nurFremdeSynchro(f.versions) ? 'fremd' : 'keine'
    const guid = deutscheKennung(f.versions)
    if (guid) deutscheFolgen.set(guid, { nummer, guid })
    const bisher = jeFolge.get(schluessel)
    if (bisher === 'deutsch') return
    if (bisher === 'fremd' && ton === 'keine') return
    jeFolge.set(schluessel, ton)
  })
  return { jeFolge, deutscheFolgen: [...deutscheFolgen.values()] }
}

/** Trägt dieses Objekt eine deutsche Tonspur? */
export function hatDeutsch(versions: CrVersion[] | undefined): boolean {
  return (versions ?? []).some((v) => v.audio_locale === DEUTSCH)
}

/** Die Kennung der deutschen Fassung — der Schlüssel zum `objects`-Aufruf. */
export function deutscheKennung(versions: CrVersion[] | undefined): string | undefined {
  return (versions ?? []).find((v) => v.audio_locale === DEUTSCH)?.guid
}

/**
 * Gibt es eine Synchronfassung, nur eben keine deutsche?
 *
 * Das entspricht dem „Synchro English" der alten Kachelauswertung: Die Folge
 * ist vertont, aber nicht für uns. Gezählt wird als `fremd`, damit die beiden
 * Wege vergleichbar bleiben.
 */
export function nurFremdeSynchro(versions: CrVersion[] | undefined): boolean {
  const v = versions ?? []
  if (hatDeutsch(v)) return false
  return v.some((x) => x.original !== true)
}
