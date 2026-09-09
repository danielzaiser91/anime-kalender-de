/**
 * **Die Crunchyroll-Verweise ohne Sprachurteil auflösen — über die Kennung, nicht den Namen.**
 *
 * Daniel am 07.09.2026 zur „Wo sehen?"-Liste: „39 Fragezeichen? wir haben
 * crunchyroll automatisiert, es sollte 0 fragezeichen geben, wieso funktioniert
 * unser automatismus nicht perfekt..."
 *
 * Gemessen am 09.09.2026: 34 Verweise ohne Urteil, und sie zerfallen nach dem,
 * was ihre **Adresse** hergibt:
 *
 *     7   tragen eine Kennung (`/watch/<ID>` oder `/series/<ID>`)
 *     27  tragen nur einen Slug (`crunchyroll.com/de/kaguya-sama-love-is-war`)
 *
 * Für die erste Gruppe beantwortet Crunchyroll die Frage direkt. Für die zweite
 * muss die Serie erst gefunden werden — und genau dort liegt die Falle, an der
 * jeder Namensvergleich in diesem Projekt bisher gescheitert ist.
 *
 * ## Was dieser Lauf **nicht** tut
 *
 * Er ordnet nicht über den Namen zu. Ein Namensteil trifft immer den
 * Reihenkopf: „Free! the Final Stroke" träfe „Free! - Iwatobi Swim Club", die
 * Chunibyo-OVA ihre Serie, „The Promised Neverland Staffel 2" die erste. Fünf
 * der 27 zeigen sogar wörtlich auf die Serienadresse ihrer Reihe. Ein Treffer
 * zählt deshalb nur, wenn **Name und Folgenzahl** zusammenpassen — dieselbe
 * Regel, die `fetch-cr-katalog.mjs` seit dem 29.08.2026 anwendet, und aus
 * demselben Anlass.
 *
 * ## Und was ein Nein sein darf
 *
 * `de-DE` an einer Videofassung ist ein sicheres **Ja**. Ein fehlendes `de-DE`
 * ist **kein** Nein: Die deutsche Fassung hat bei Crunchyroll eine eigene
 * Videokennung, und dass wir sie nicht kennen, sagt nichts über sie (die 975
 * Falschangaben vom 15.08.2026 stammen genau aus dieser Verwechslung). Ein Nein
 * entsteht hier nur, wenn der **Serieneintrag im deutschen Katalog** ebenfalls
 * kein `de-DE` führt — dann haben zwei Stellen unabhängig geschwiegen.
 *
 * Ein HTTP 404 sagt nichts über die Tonspur und viel über den Verweis: Die
 * Videokennung ist abgelaufen, die Adresse führt ins Leere.
 *
 * ## Ergebnis
 *
 * `data/crunchyroll-offene.json` — je Adresse ein Befund mit seiner Herkunft.
 * `build.ts` liest ihn in der Anbieterrunde; was hier kein Urteil bekommt,
 * bleibt „🇩🇪 ?" und damit die ehrliche Antwort.
 *
 * Aufruf: npx tsx pipeline/fetch-crunchyroll-offene.ts [--limit 40] [--trocken]
 */
import type { Title } from '../shared/types.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const DATEI = 'data/crunchyroll-offene.json'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const LIMIT = zahl('--limit', 0)
const TROCKEN = args.includes('--trocken')

interface Befund {
  /** Woher das Urteil stammt — für den Leser wichtiger als das Urteil selbst. */
  herkunft: 'video' | 'katalog' | 'tot' | 'offen'
  dub?: boolean
  /** Die Serienkennung, sofern eine gefunden wurde. */
  seriesId?: string
  /** Was Crunchyroll dort führt — zum Nachlesen, wenn eine Zuordnung strittig ist. */
  titel?: string
  audio?: string[]
  grund?: string
  geprueftAm: string
}

const heute = () => new Date().toISOString().slice(0, 10)

/** Vergleichbare Form eines Titels: ohne Satzzeichen, klein, Wörter durch ein Leerzeichen. */
const norm = (s: string | undefined | null): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

async function holeToken(): Promise<string> {
  const r = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_id',
  })
  const j = (await r.json()) as { access_token?: string; country?: string }
  /*
    **Ohne deutsche Leitung wird abgebrochen, nicht ausgewichen.**

    Crunchyroll leitet die Region aus der IP ab. Ein Lauf aus den USA liest
    einen anderen Katalog und meldet für „Fairy Tail" `ja-JP, en-US`, wo hier
    `de-DE` steht — ein Urteil daraus wäre systematisch falsch (CLAUDE.md,
    22.08.2026).
  */
  if (j.country !== 'DE') {
    warn(`Abbruch: Der Abruf kommt aus „${j.country}", nicht aus DE — der Katalog wäre der falsche.`)
    process.exit(1)
  }
  if (!j.access_token) {
    warn('Abbruch: kein Token bekommen.')
    process.exit(1)
  }
  return j.access_token
}

export async function main(): Promise<void> {
  const token = await holeToken()
  const hol = async (u: string): Promise<{ status: number; body: unknown }> => {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA } })
    return { status: r.status, body: await r.json().catch(() => null) }
  }

  const roh = readJson<Title[] | Record<string, Title>>('public/data/titles.json', [])
  const titles = (Array.isArray(roh) ? roh : Object.values(roh)) as Title[]
  const katalog =
    readJson<{
      eintraege?: { id: string; titel: string; typ?: string; slug?: string | null; audio?: string[]; folgen?: number | null }[]
    }>('data/cr-katalog-de.json', {}).eintraege ?? []
  const katalogNachId = new Map(katalog.map((e) => [e.id, e]))
  /**
   * **Der Slug aus unserer Adresse führt zur Serienkennung.**
   *
   * Bis zum 09.09.2026 gab es zwei Wege: die Kennung in der Adresse
   * (`/series/G…`) oder eine Namenssuche. Der erste greift bei alten Adressen
   * nicht, der zweite scheitert an Crunchyrolls Kurznamen — von 23 Film-,
   * OVA- und Special-Verweisen war über den Titel genau **einer** zuzuordnen.
   *
   * Der Slug steht in beidem: in unserer Adresse (`/de/fruits-basket`,
   * `/mobile-suit-gundam-wing-endless-waltz/…`) und im Katalog (`slug_title`).
   * Gemessen am selben Tag ordnet er 9 der 33 offenen Verweise zu, ohne einen
   * einzigen Namensvergleich.
   */
  /**
   * **Gleich geschrieben ist nicht gleich geschrieben.**
   *
   * Unsere Adresse trägt `free-iwatobi-swim-club`, der Katalog führt
   * `free---iwatobi-swim-club` — dieselbe Serie, drei Bindestriche
   * Unterschied. Und `-prelude-` trägt sie am Anfang und am Ende. Normalisiert
   * wird deshalb auf beiden Seiten gleich: mehrfache Bindestriche zu einem,
   * Ränder weg.
   */
  const slugKern = (s: string): string =>
    String(s).toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')
  /* Die aniSearch-Zuordnung — sie kennt zu manchen Werken eine Adresse mit Kennung. */
  const anisearch = readJson<Record<string, unknown>>('data/anisearch.json', {})
  const katalogNachSlug = new Map(katalog.filter((e) => e.slug).map((e) => [slugKern(String(e.slug)), e]))
  log(`Katalog: ${katalog.length} Einträge, davon ${katalogNachSlug.size} mit Slug.`)

  /* Die offenen Verweise — Adresse, Werk und was wir über das Werk wissen. */
  const offen: { url: string; titel: Title }[] = []
  for (const t of titles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'crunchyroll') continue
      if (s.dub === true || s.dub === false) continue
      offen.push({ url: s.url, titel: t })
    }
  }
  log(`${offen.length} Crunchyroll-Verweise ohne Sprachurteil.`)

  const bestand = readJson<Record<string, Befund>>(DATEI, {})
  const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen

  const zaehler = { video: 0, katalog: 0, tot: 0, offen: 0 }
  for (const { url, titel } of arbeit) {
    const befund = await beurteile(url, titel)
    bestand[url] = befund
    zaehler[befund.herkunft]++
    const zeichen = befund.herkunft === 'tot' ? '✕' : befund.dub === true ? '✓' : befund.dub === false ? '–' : '?'
    log(
      `  ${zeichen} ${String(titel.id).padEnd(7)} ${(titel.titleEn ?? titel.titleRomaji ?? '').slice(0, 34).padEnd(34)} ${befund.herkunft}${befund.grund ? ` — ${befund.grund}` : ''}`,
    )
    await sleep(700)
  }

  log('')
  log(
    `Ergebnis: ${zaehler.video} über die Videokennung, ${zaehler.katalog} über den Katalog, ` +
      `${zaehler.tot} tote Adressen, ${zaehler.offen} bleiben offen.`,
  )

  if (TROCKEN) {
    log('Trockenlauf — nichts geschrieben.')
    return
  }
  writeJson(DATEI, bestand)
  recordSource('crunchyroll-offene', arbeit.length, undefined, undefined, true)

  /**
   * Beurteilt einen Verweis über den kürzesten belastbaren Weg, den seine
   * Adresse zulässt.
   */
  async function beurteile(url: string, werk: Title): Promise<Befund> {
    const videoId = /\/watch\/([A-Z0-9]+)/i.exec(url)?.[1]
    if (videoId) {
      const { status, body } = await hol(
        `https://beta-api.crunchyroll.com/content/v2/cms/objects/${videoId}?locale=de-DE`,
      )
      if (status === 404) {
        return { herkunft: 'tot', geprueftAm: heute(), grund: `Videokennung ${videoId} gibt es nicht mehr` }
      }
      const o = (body as { data?: Record<string, never>[] })?.data?.[0] as
        | { title?: string; episode_metadata?: { audio_locale?: string; series_id?: string } }
        | undefined
      const md = o?.episode_metadata
      if (md?.audio_locale === 'de-DE') {
        return { herkunft: 'video', dub: true, titel: o?.title, seriesId: md.series_id, geprueftAm: heute() }
      }
      /*
        Kein Deutsch an **diesem** Video — das ist kein Nein. Gefragt wird
        deshalb der Serieneintrag: Führt auch er kein `de-DE`, haben zwei
        Stellen unabhängig geschwiegen, und daraus wird ein Nein.
      */
      const serie = md?.series_id ? katalogNachId.get(md.series_id) : undefined
      if (serie && !(serie.audio ?? []).includes('de-DE')) {
        return {
          herkunft: 'katalog',
          dub: false,
          titel: serie.titel,
          seriesId: md?.series_id,
          audio: serie.audio,
          geprueftAm: heute(),
          grund: `Video ${md?.audio_locale ?? '—'}, Serie „${serie.titel}" ohne de-DE`,
        }
      }
      return {
        herkunft: 'offen',
        seriesId: md?.series_id,
        geprueftAm: heute(),
        grund: serie
          ? `Video ${md?.audio_locale ?? '—'}, aber die Serie führt Deutsch — eine andere Fassung kann es geben`
          : `Video ${md?.audio_locale ?? '—'}, Serie ${md?.series_id ?? '?'} nicht im deutschen Katalog`,
      }
    }

    /**
     * **aniSearch kennt zu manchen Werken die bessere Adresse — mit Kennung.**
     *
     * Unser Bestand führt „Sound! Euphonium" unter einem alten Slug
     * (`crunchyroll.com/de/sound-euphonium`), aniSearch unter
     * `series/GRDQNQW9Y`. Eine Kennung schlägt jeden Slug: Sie führt ohne
     * Umweg in den Katalog und von dort in die Staffelliste.
     *
     * Gelesen wird nur, was schon im Haus liegt — dieselbe Datei, aus der der
     * Bau seit dem 06.09.2026 fehlende Anbieter ergänzt. Das ist die Klasse
     * Fehler, die CLAUDE.md als „Eine Datei zu schreiben ist nicht dasselbe wie
     * sie zu benutzen" führt: fünf Fälle an zwei Tagen.
     */
    const ausAnisearch = (() => {
      try {
        const e = anisearch[String(werk.id)] as { streams?: { url?: string }[] } | undefined
        for (const s of e?.streams ?? []) {
          const treffer = /crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]{6,})/i.exec(String(s?.url ?? ''))
          if (treffer) return treffer[1]
        }
      } catch {
        /* Ohne aniSearch-Eintrag bleibt es bei der eigenen Adresse. */
      }
      return undefined
    })()
    const serieId = /\/series\/([A-Z0-9]+)/i.exec(url)?.[1] ?? ausAnisearch
    /*
      **Der Slug steht in der Adresse — er wird gelesen, bevor gesucht wird.**

      Reihenfolge nach Verlässlichkeit: die Kennung in der Adresse, dann ihr
      Slug, dann die Namenssuche. Die Slug-Teile sind alles, was kein Pfadwort
      und keine Kennung ist; `/de/fruits-basket` liefert `fruits-basket`,
      `/mobile-suit-gundam-wing-endless-waltz/…-732801` beide Teile.
    */
    const slugTeile = (() => {
      try {
        const pfad = new URL(url).pathname.replace(/^\/(de|de-DE)\//, '/')
        const raus = new Set(['watch', 'series', 'de'])
        return pfad
          .split('/')
          .filter(Boolean)
          .filter((t) => !raus.has(t) && !/^G[A-Z0-9]{6,}$/.test(t))
          .map((t) => slugKern(t))
      } catch {
        return []
      }
    })()
    const ausSlug = slugTeile.map((s) => katalogNachSlug.get(s)).find(Boolean)
    const kandidat = serieId ? katalogNachId.get(serieId) : (ausSlug ?? (await sucheSerie(werk)))
    if (!kandidat) {
      return { herkunft: 'offen', geprueftAm: heute(), grund: 'keine Kennung in der Adresse, kein sicherer Treffer' }
    }
    /*
      **Die Serie ist gefunden — das Werk ist damit noch nicht beurteilt.**

      Bei einem Film oder einer OVA sagt der Serieneintrag nichts: Die Serie
      vererbt ihre Sprache nicht an ihre Nebenausgaben (fünf „Free!"-Filme
      zeigen auf die Serienadresse). Ein Urteil gibt es deshalb nur, wenn das
      Werk selbst eine Serie ist.
    */
    /**
     * **Es sei denn, der Treffer ist selbst ein Film.**
     *
     * Seit dem 09.09.2026 holt der Katalogsammler auch `type=movie_listing`
     * (69 Filme, 44 mit deutschem Ton) und merkt sich den Durchlauf als `typ`.
     * Zeigt der Slug unserer Adresse auf einen **Filmeintrag**, ist das nicht
     * die Reihe, sondern das Werk — und seine Tonspuren gelten unmittelbar.
     *
     * Der Riegel darunter bleibt für alles andere: Fünf „Free!"-Filme zeigen auf
     * den Slug ihrer **Serie**, und die vererbt ihre Sprache nicht.
     */
    if (werk.format === 'MOVIE' && kandidat.typ === 'film') {
      const deutschImFilm = (kandidat.audio ?? []).includes('de-DE')
      return {
        herkunft: 'katalog',
        dub: deutschImFilm,
        seriesId: kandidat.id,
        titel: kandidat.titel,
        audio: kandidat.audio ?? [],
        geprueftAm: heute(),
        grund: `Filmeintrag „${kandidat.titel}" im deutschen Katalog${deutschImFilm ? ' mit' : ' ohne'} de-DE`,
      }
    }
    if (werk.format !== 'TV' && werk.format !== 'ONA') {
      return {
        herkunft: 'offen',
        seriesId: kandidat.id,
        titel: kandidat.titel,
        geprueftAm: heute(),
        grund: `„${kandidat.titel}" ist die Reihe, ${werk.format} ist eine eigene Ausgabe`,
      }
    }
    /**
     * **Und beurteilt wird die Staffel, nicht die Serie.**
     *
     * Der Serieneintrag im Katalog bündelt, was AniList trennt: „Kaguya-sama"
     * steht dort mit 43 Folgen für fünf Staffeln, „Fruits Basket" mit 63 für
     * drei. Ein Vergleich auf Serienebene kann deshalb **nie** aufgehen — im
     * ersten Anlauf am 09.09.2026 fiel jede der elf Serien mit „Folgenzahl
     * weicht ab (12 gegen 43)" durch.
     *
     * Die Staffelliste beantwortet dieselbe Frage sauber, und sie
     * unterscheidet, worauf es ankommt (gemessen am selben Tag):
     *
     *     seq 1 | 12 Fg | Kaguya-sama: Love is War   | ja, es, pt, en, fr
     *     seq 2 | 12 Fg | Kaguya-sama: Love is War?  | ja, en, es, pt, fr, de-DE
     *
     * Staffel 1 ohne Deutsch, Staffel 2 mit — auf Serienebene wäre beides ein
     * „die Serie führt Deutsch" gewesen, und für Staffel 1 falsch.
     */
    const staffeln = await holeStaffeln(kandidat.id)
    if (!staffeln.length) {
      return {
        herkunft: 'offen',
        seriesId: kandidat.id,
        titel: kandidat.titel,
        geprueftAm: heute(),
        grund: `„${kandidat.titel}" gibt keine Staffelliste heraus`,
      }
    }
    /*
      **Name und Folgenzahl müssen beide treffen, und der Treffer muss eindeutig sein.**

      Kaguya-sama Staffel 1 und 2 haben beide zwölf Folgen; sie unterscheiden
      sich nur im Namen („Love is War" gegen „Love is War?"). Umgekehrt tragen
      manche Staffeln bei Crunchyroll einen anderen Namen als bei uns — dann
      entscheidet die Folgenzahl allein, aber nur, wenn keine zweite Staffel
      dieselbe hat. Bleiben zwei übrig, gibt es kein Urteil.
    */
    /*
      **Erst wörtlich, dann normalisiert — sonst frisst die Normalisierung das
      unterscheidende Zeichen.**

      Crunchyroll trennt „Kaguya-sama: Love is War" (Staffel 1) und
      „Kaguya-sama: Love is War**?**" (Staffel 2) allein durch das Fragezeichen,
      und beide haben zwölf Folgen. `norm()` streicht Satzzeichen — damit trafen
      beide Werke beide Staffeln, und keines bekam ein Urteil (gemessen
      09.09.2026: „2 über den Namen, 2 über die Zahl von 5").

      Der wörtliche Vergleich ignoriert nur Groß- und Kleinschreibung und
      Leerraum. Trifft er genau eine Staffel, ist die Sache entschieden; sonst
      geht es wie bisher weiter.
    */
    const rohNamen = [werk.titleDe, werk.titleEn, werk.titleRomaji]
      .filter(Boolean)
      .map((n) => String(n).trim().toLowerCase())
    const woertlich = staffeln.filter((s) => rohNamen.includes(s.titel.trim().toLowerCase()))
    const namen = [werk.titleDe, werk.titleEn, werk.titleRomaji].filter(Boolean).map((n) => norm(n as string))
    const nachName = woertlich.length === 1 ? woertlich : staffeln.filter((s) => namen.includes(norm(s.titel)))
    const nachZahl = staffeln.filter((s) => werk.episodes != null && s.folgen === werk.episodes)
    const treffer =
      nachName.length === 1 && (nachZahl.length === 0 || nachZahl.some((s) => s.id === nachName[0]!.id))
        ? nachName[0]
        : nachZahl.length === 1
          ? nachZahl[0]
          : undefined
    if (!treffer) {
      /**
       * **Sagen alle Staffeln dasselbe, braucht es keine Zuordnung.**
       *
       * „Meine Wiedergeburt als Schleim" führt sechs Staffeln, **jede** mit
       * deutscher Fassung. Welche unser Eintrag meint, ist dann gleichgültig:
       * Das Urteil fällt für jede gleich aus. Drei unserer Verweise hingen am
       * 09.09.2026 allein daran, dass die Folgenzahlen nicht aufgingen (24, 12
       * und 12 gegen 25, 25, 26, 21, 5, 3).
       *
       * **Nur bei Einstimmigkeit**, und nur mit mehr als einer Staffel — sonst
       * ist es der gewöhnliche Serienvergleich, den dieses Projekt aus gutem
       * Grund nicht macht. Ein einstimmiges **Nein** zählt ebenso: Es kommt aus
       * dem deutschen Katalog, und dort ist ein fehlendes `de-DE` ein Beleg.
       */
      const alleDeutsch = staffeln.length > 1 && staffeln.every((s) => s.audio.includes('de-DE'))
      const keineDeutsch = staffeln.length > 1 && staffeln.every((s) => !s.audio.includes('de-DE'))
      if (alleDeutsch || keineDeutsch) {
        return {
          herkunft: 'katalog',
          dub: alleDeutsch,
          seriesId: kandidat.id,
          titel: kandidat.titel,
          audio: alleDeutsch ? ['de-DE'] : [],
          geprueftAm: heute(),
          grund: `alle ${staffeln.length} Staffeln von „${kandidat.titel}" ${alleDeutsch ? 'führen' : 'führen kein'} Deutsch — die Zuordnung ändert daran nichts`,
        }
      }
      return {
        herkunft: 'offen',
        seriesId: kandidat.id,
        titel: kandidat.titel,
        geprueftAm: heute(),
        grund:
          `kein eindeutiger Staffeltreffer (${werk.episodes ?? '?'} Fg.; ` +
          `${nachName.length} über den Namen, ${nachZahl.length} über die Zahl von ${staffeln.length})`,
      }
    }
    const deutsch = treffer.audio.includes('de-DE')
    return {
      herkunft: 'katalog',
      dub: deutsch,
      seriesId: kandidat.id,
      titel: treffer.titel,
      audio: treffer.audio,
      geprueftAm: heute(),
      grund: `Staffel „${treffer.titel}" mit ${treffer.folgen ?? '?'} Folgen`,
    }
  }

  /** Die Staffeln einer Serie mit ihren Tonspuren — je Staffel, nicht je Serie. */
  async function holeStaffeln(
    serieId: string,
  ): Promise<{ id: string; titel: string; folgen: number | null; audio: string[] }[]> {
    const { body } = await hol(`https://beta-api.crunchyroll.com/content/v2/cms/series/${serieId}/seasons?locale=de-DE`)
    const daten =
      (
        body as {
          data?: {
            id: string
            title?: string
            number_of_episodes?: number
            audio_locale?: string
            versions?: { audio_locale?: string }[]
          }[]
        }
      )?.data ?? []
    return daten.map((s) => ({
      id: s.id,
      titel: s.title ?? '',
      folgen: s.number_of_episodes ?? null,
      /*
        `versions` nennt alle Fassungen dieser Staffel; `audio_locale` nur die
        des Blocks, den wir gerade in der Hand haben. Wo es beides gibt, zählt
        die Liste — sonst hinge das Urteil daran, welchen Block Crunchyroll
        zuerst ausliefert.
      */
      audio: [...new Set((s.versions ?? []).map((v) => v.audio_locale).filter(Boolean) as string[])].length
        ? [...new Set((s.versions ?? []).map((v) => v.audio_locale).filter(Boolean) as string[])]
        : s.audio_locale
          ? [s.audio_locale]
          : [],
    }))
  }

  /**
   * Sucht die Serie im **deutschen** Katalog — und nimmt nur einen Treffer, der
   * im Namen übereinstimmt.
   *
   * Gesucht wird über `discover/search`, denselben Weg, der am 25.08.2026 die
   * Detektiv-Conan-Lücke gelöst hat: Unser Bestand führte den englischen Block
   * (`case-closed`, 33 Folgen, kein Deutsch), die deutsche Serie liegt unter
   * einer anderen Kennung mit 405 deutschen Folgen.
   */
  async function sucheSerie(
    werk: Title,
  ): Promise<{ id: string; titel: string; typ?: string; audio?: string[]; folgen?: number | null } | undefined> {
    /*
      **Auch der Reihenname wird gesucht — die Staffel entscheidet danach.**

      Unser Bestand führt „The Promised Neverland Season 2", der Katalog „THE
      PROMISED NEVERLAND" mit zwei Staffeln. Ein Suchabgleich, der
      Namensgleichheit verlangt, findet die Serie deshalb nie — und ohne Serie
      gibt es keine Staffelliste (gemessen 09.09.2026: fünf Werke fielen so
      durch, darunter drei Slime-Staffeln).
    */
    const ohneStaffel = (n: string) =>
      n
        .replace(/\s*[:\-–]?\s*(season|staffel|s)\s*\d+\s*$/i, '')
        .replace(/\s+\d+(st|nd|rd|th)?\s+season\s*$/i, '')
        .trim()
    const namen = [
      ...new Set(
        [werk.titleDe, werk.titleEn, werk.titleRomaji]
          .filter(Boolean)
          .flatMap((n) => [String(n), ohneStaffel(String(n))])
          .filter((n) => n.length >= 3),
      ),
    ]
    for (const name of namen) {
      const { body } = await hol(
        `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(name)}&n=8&type=series&locale=de-DE`,
      )
      const gruppen = (body as { data?: { items?: { id: string; title: string }[] }[] })?.data ?? []
      for (const g of gruppen) {
        for (const it of g.items ?? []) {
          if (norm(it.title) !== norm(name)) continue
          /* Der Katalog kennt die Tonspuren; die Suche nennt sie nicht vollständig. */
          const ausKatalog = katalogNachId.get(it.id)
          if (ausKatalog) return ausKatalog
        }
      }
      await sleep(700)
    }
    return undefined
  }
}

await main()
