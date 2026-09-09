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
  const katalog = readJson<{ eintraege?: { id: string; titel: string; audio?: string[]; folgen?: number | null }[] }>(
    'data/cr-katalog-de.json',
    {},
  ).eintraege ?? []
  const katalogNachId = new Map(katalog.map((e) => [e.id, e]))

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

    const serieId = /\/series\/([A-Z0-9]+)/i.exec(url)?.[1]
    const kandidat = serieId ? katalogNachId.get(serieId) : await sucheSerie(werk)
    if (!kandidat) {
      return { herkunft: 'offen', geprueftAm: heute(), grund: 'keine Kennung in der Adresse, kein sicherer Treffer' }
    }
    /*
      **Die Serie ist gefunden — das Werk ist damit noch nicht beurteilt.**

      Bei einem Film oder einer OVA sagt der Serieneintrag nichts: Die Serie
      vererbt ihre Sprache nicht an ihre Nebenausgaben (fünf „Free!"-Filme
      zeigen auf die Serienadresse). Ein Urteil gibt es deshalb nur, wenn das
      Werk selbst eine Serie ist **und** die Folgenzahl zusammenpasst.
    */
    if (werk.format !== 'TV' && werk.format !== 'ONA') {
      return {
        herkunft: 'offen',
        seriesId: kandidat.id,
        titel: kandidat.titel,
        geprueftAm: heute(),
        grund: `„${kandidat.titel}" ist die Reihe, ${werk.format} ist eine eigene Ausgabe`,
      }
    }
    const passt = werk.episodes != null && kandidat.folgen != null && werk.episodes === kandidat.folgen
    if (!passt) {
      return {
        herkunft: 'offen',
        seriesId: kandidat.id,
        titel: kandidat.titel,
        geprueftAm: heute(),
        grund: `Folgenzahl weicht ab (${werk.episodes ?? '?'} gegen ${kandidat.folgen ?? '?'})`,
      }
    }
    const deutsch = (kandidat.audio ?? []).includes('de-DE')
    return {
      herkunft: 'katalog',
      dub: deutsch,
      seriesId: kandidat.id,
      titel: kandidat.titel,
      audio: kandidat.audio,
      geprueftAm: heute(),
      grund: `Name und Folgenzahl treffen (${werk.episodes})`,
    }
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
  ): Promise<{ id: string; titel: string; audio?: string[]; folgen?: number | null } | undefined> {
    const namen = [werk.titleDe, werk.titleEn, werk.titleRomaji].filter(Boolean) as string[]
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
