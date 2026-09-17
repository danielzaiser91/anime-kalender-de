/**
 * **Welche Tonspuren ein Anbieter führt — laut JustWatch.**
 *
 * Gefunden am 07.09.2026 auf Daniels Auftrag, das Autonomie-Ziel erneut zu
 * prüfen. JustWatchs GraphQL-Schnittstelle nennt zu jedem Angebot
 * `audioLanguages` und `subtitleLanguages`, ohne Token, und die `robots.txt`
 * sperrt **nichts** und nennt keinen Agenten namentlich.
 *
 * Damit antwortet sie genau dort, wo dieses Projekt sonst schweigt: Für die 33
 * offenen Prime-Verweise und die Kanal-Angebote (aniverse, ADN-Kanal,
 * Crunchyroll-Kanal) gibt es keine andere maschinelle Quelle — Amazon duldet
 * keinen Agenten, und aniverse hat keine eigene Schnittstelle.
 *
 * **Was hier entsteht, sind Kandidaten — keine Urteile.** Drei gemessene
 * Gründe, und jeder für sich genügt:
 *
 * 1. **Die Angabe gilt der Serie, nicht der Folge.** Bei „Kill Blue" meldet
 *    JustWatch `de` für alle zwölf Folgen; belegt sind acht (Daniels Messung
 *    vom 07.09.2026). Dieselbe Trennung wie beim deutschen Crunchyroll-Katalog
 *    — und dieselbe Falle, die bei Bofuri ein falsches Ja erzeugt hätte.
 * 2. **Ein fehlendes `de` belegt nichts.** Netflix und ADN-direkt melden für
 *    Kill Blue gar keine Tonspur (`audio: —`), obwohl beide sie führen.
 * 3. **Es ist eine Fremdangabe.** Was ein Mensch in `dub-confirmed.yaml`
 *    geprüft hat, schlägt sie ausnahmslos.
 *
 * **Die Gegenprobe, ohne die der Fund nichts wert wäre:** „Chiikawa" hat 120
 * deutsche Folgen, alle untertitelt, keine synchronisiert — der Prüfstein
 * dieses Projekts. JustWatch meldet dort `audio: ja`, `sub: de`. Die Quelle
 * unterscheidet Synchro von Untertitel; sie sagt nicht überall „de".
 *
 * **Zugeordnet wird über die TMDB-Kennung, nie über den Namen.** JustWatch
 * liefert sie zu jedem Treffer (`externalIds.tmdbId`), und
 * `data/tmdb-titles.json` führt sie je AniList-Titel. Ein Namensabgleich hat
 * am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch gemacht; hier ist es
 * ein Zahlenvergleich.
 *
 * Aufruf:
 *
 *     npx tsx pipeline/fetch-justwatch-audio.ts [--limit 50] [--alter 28]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { todayIso } from '../shared/time.ts'
import type { Title } from '../shared/types.ts'

const ENDPUNKT = 'https://apis.justwatch.com/graphql'
const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
/** Eine Sekunde zwischen zwei Abrufen — die Schnittstelle nennt kein Limit, also wird zurückhaltend gefragt. */
const PAUSE_MS = 1000
const DATEI = 'data/justwatch-audio.json'

interface Angebot {
  anbieter: string
  art: string
  audio: string[]
  untertitel: string[]
  url?: string
}

interface Befund {
  geprueftAm: string
  jwId?: string
  tmdbId?: number
  jwPfad?: string
  angebote: Angebot[]
  /** Kein Treffer bei JustWatch — festgehalten, damit der Titel nicht täglich neu gesucht wird. */
  ohneTreffer?: boolean
  /** Erste Antwort von JustWatch zu diesem Titel (seit 17.09.2026) — siehe `jwFrisch()`. */
  erstAm?: string
  /** Die letzte Suche fand den Titel nicht; die Angebote stammen von der Antwort davor. */
  verfehltAm?: string
}

const SUCHE = `
query Suche($q: String!, $country: Country!, $language: Language!) {
  popularTitles(country: $country, first: 5, filter: { searchQuery: $q }) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          fullPath
          externalIds { tmdbId }
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          audioLanguages
          subtitleLanguages
          standardWebURL
          package { clearName }
        }
      }
    }
  }
}`

interface JwKnoten {
  id: string
  objectType: string
  content: { title: string; fullPath: string; externalIds?: { tmdbId?: number | null } | null }
  offers?:
    | {
        monetizationType: string
        audioLanguages?: string[] | null
        subtitleLanguages?: string[] | null
        standardWebURL?: string | null
        package?: { clearName?: string } | null
      }[]
    | null
}

async function suche(begriff: string): Promise<JwKnoten[]> {
  const r = await fetch(ENDPUNKT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ query: SUCHE, variables: { q: begriff, country: 'DE', language: 'de' } }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = (await r.json()) as {
    errors?: { message: string }[]
    data?: { popularTitles?: { edges?: { node: JwKnoten }[] } }
  }
  if (j.errors?.length) throw new Error(j.errors[0].message)
  return (j.data?.popularTitles?.edges ?? []).map((e) => e.node)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const zahl = (name: string, vorgabe: number): number => {
    const i = args.indexOf(name)
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : vorgabe
  }
  const limit = zahl('--limit', 40)
  const alterTage = zahl('--alter', 28)

  /*
    **Cartoons fragen mit** (16.09.2026): TMDB nennt dort nur den Dienst, keine
    Adresse — die Prime-Pille von „The Mighty Nein" führte deshalb ins Leere.
    JustWatch kennt die Seite beim Anbieter; zugeordnet wird wie immer über die
    TMDB-Kennung, die Cartoons selbst tragen. `--nur-cartoons` holt nur sie.
  */
  const nurCartoons = args.includes('--nur-cartoons')
  const cartoons = readJson<Title[]>('public/data/cartoons.json', [])
  const titles = nurCartoons ? cartoons : [...readJson<Title[]>('public/data/titles.json', []), ...cartoons]
  const tmdb = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-titles.json', {})
  const bestand = readJson<Record<string, Befund>>(DATEI, {})

  const grenze = new Date(Date.now() - alterTage * 86_400_000).toISOString().slice(0, 10)

  /*
    **Die Warteschlange bildet sich nach dem Alter, nicht nach „schon gefragt".**

    Sonst kann ein einmal leeres Ergebnis nie mehr besser werden — genau der
    Fehler, den `CLAUDE.md` unter „Ein Abruf, der nur ergänzt, veraltet
    zwangsläufig" beschreibt. Ein Anbieter nimmt eine deutsche Fassung auch
    **auf**, und dann muss die Frage neu gestellt werden dürfen.
  */
  /*
    **Zwei Sorten Lücke, eine Quelle.**

    Die zweite ist die größere und war beim ersten Bau nicht mitgedacht: **243
    Titel im Hauptbestand haben gar keinen Bezugsweg** (gemessen 07.09.2026),
    133 davon mit TMDB-Kennung. Für sie beantwortet JustWatch nicht die
    Sprachfrage, sondern die davor — „wo gibt es das überhaupt?", also Punkt 4
    des Projektziels („Nicht nur wann, auch wo").

    Ein Titel im Hauptbestand hat per Definition eine belegte deutsche Synchro.
    Ein Angebot, das JustWatch dort nennt, ist deshalb ein Weg, den wir zeigen
    dürfen — die Sprachfrage bleibt davon unberührt.
  */
  /*
    **Dritter Grund, hier zu fragen: ein Weg ohne Ziel.**

    Wo TMDB Anbieter nennt, aber keinen Deeplink liefert, trägt der Bezugsweg
    seit jeher die TMDB-Übersichtsseite — die Pille „maxdome" öffnete also
    themoviedb.org statt store.maxdome.de (Daniel, 16.09.2026). JustWatch nennt
    je Angebot die Adresse beim Anbieter selbst; gemessen sind das 1.187 Wege auf
    364 Titeln, und bei den zehn schon gefragten ließen sich 16 von 20 ersetzen.

    Diese Titel haben einen Weg und fielen deshalb durch beide Bedingungen
    darüber — „hat einen Weg" heißt hier eben nicht „hat ein Ziel".
  */
  /*
    **Seit dem 17.09.2026 fragt der Lauf reihum alle Titel** (Daniel: „JustWatch
    künftig zu allen Titeln fragen"). Gefragt wurden bis dahin nur die drei Lücken
    darüber — 1.641 von 2.772 Titeln. Ein neues Angebot bei einem Titel, dessen Wege
    alle beurteilt sind, kam so nie an (Apple TV, maxdome …). Die drei Lücken stehen
    weiter vorn in der Schlange; ohne TMDB-Kennung wird gar nicht erst gefragt.
  */
  const dringend = (t: Title) =>
    (t.streams ?? []).some((s) => s.dub === undefined) ||
    (!(t.streams ?? []).length && !(t.watchLinks ?? []).length) ||
    (t.watchLinks ?? []).some((w) => /themoviedb.org/.test(w.url ?? ''))
  /*
    **Eine berichtigte TMDB-Zuordnung macht den alten Befund wertlos.** Gesucht wird
    gegen die Kennung; stand dort gestern ein anderer Film, sagt das Ergebnis nichts
    über diesen. Solche Titel gehen sofort wieder in die Schlange, ohne die Frist
    abzuwarten (17.09.2026).
  */
  const kennungGewechselt = (t: Title) => {
    const e = bestand[String(t.id)]
    const jetzt = (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
    return Boolean(e?.tmdbId && jetzt && e.tmdbId !== jetzt)
  }
  const offen = titles
    .filter((t) => (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId)
    .filter((t) => (bestand[String(t.id)]?.geprueftAm ?? '') < grenze || kennungGewechselt(t))
    .sort(
      (a, b) =>
        Number(kennungGewechselt(b)) - Number(kennungGewechselt(a)) ||
        Number(dringend(b)) - Number(dringend(a)) ||
        (bestand[String(a.id)]?.geprueftAm ?? '').localeCompare(bestand[String(b.id)]?.geprueftAm ?? ''),
    )

  if (!offen.length) {
    log('JustWatch: keine offenen Verweise zur Wiedervorlage.')
    recordSource('justwatch-audio', 0)
    return
  }

  log(`JustWatch: ${offen.length} Titel mit offenem Verweis, davon werden ${Math.min(limit, offen.length)} geholt.`)

  let getroffen = 0
  let mitDeutsch = 0
  let fehler = 0
  let leer = 0
  let verfehlt = 0
  let ohneTrefferNeu = 0

  for (const t of offen.slice(0, limit)) {
    const erwartet = (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
    const name = t.titleDe || t.titleRomaji || t.titleEn
    if (!name) continue
    try {
      const knoten = await suche(name)
      /*
        **Der Treffer wird über die TMDB-Kennung bestätigt, nicht über den Namen.**

        Ohne Kennung auf unserer Seite gibt es keinen Treffer — lieber keine
        Angabe als eine über den falschen Titel. „To Love-Ru" gegen „To Love-Ru
        Darkness" ist der belegte Fall, an dem ein Namensabgleich scheitert.
      */
      /*
        **Verglichen wird als Zeichenkette.** JustWatch liefert `tmdbId` als
        String (`"35790"`), `data/tmdb-titles.json` führt sie als Zahl. Ein
        `===` sagt dann bei jedem Titel „kein Treffer", und der Lauf meldet
        sauber „0 zugeordnet, 0 Fehler" — der erste Probelauf am 07.09.2026 tat
        genau das, an fünf Titeln, deren Treffer JustWatch alle kannte.
      */
      const treffer = erwartet
        ? knoten.find((k) => String(k.content.externalIds?.tmdbId ?? '') === String(erwartet))
        : undefined
      const vorher = bestand[String(t.id)]
      if (!treffer) {
        /*
          **Eine verfehlte Suche löscht keine gute Antwort** (17.09.2026). Die Suche geht über
          den Namen, und ihre Trefferliste schwankt; ohne diesen Zweig verlor ein Titel bei
          einem Fehlgriff alle Angebote — und mit ihnen seine Wege im Kalender.
        */
        if (vorher && !vorher.ohneTreffer && vorher.jwId) {
          bestand[String(t.id)] = { ...vorher, geprueftAm: todayIso(), verfehltAm: todayIso() }
          verfehlt++
        } else {
          /*
            Die Kennung gehört auch an den Fehlschlag: Wird die TMDB-Zuordnung später
            berichtigt, ist dieser Befund hinfällig und die Warteschlange erkennt es
            daran (Your Name, 17.09.2026 — gesucht wurde gegen „Call Me by Your Name").
          */
          bestand[String(t.id)] = {
            geprueftAm: todayIso(),
            angebote: [],
            ohneTreffer: true,
            tmdbId: erwartet,
            erstAm: vorher?.erstAm ?? todayIso(),
          }
          ohneTrefferNeu++
        }
        continue
      }
      const angebote: Angebot[] = (treffer.offers ?? [])
        .map((o) => ({
          anbieter: o.package?.clearName ?? '?',
          art: o.monetizationType,
          audio: o.audioLanguages ?? [],
          untertitel: o.subtitleLanguages ?? [],
          url: o.standardWebURL ?? undefined,
        }))
        /* Dasselbe Angebot kommt regelmäßig doppelt — je Auflösung eine Zeile. */
        .filter((a, i, alle) => alle.findIndex((b) => b.anbieter === a.anbieter && b.art === a.art) === i)
      if (!angebote.length) leer++
      bestand[String(t.id)] = {
        geprueftAm: todayIso(),
        /* Eine Antwort vor dem Umbau gilt als bewährt und bekommt kein Datum. */
        ...(vorher && !vorher.ohneTreffer && !vorher.erstAm ? {} : { erstAm: vorher?.erstAm ?? todayIso() }),
        jwId: treffer.id,
        tmdbId: erwartet,
        jwPfad: treffer.content.fullPath,
        angebote,
      }
      getroffen++
      if (angebote.some((a) => a.audio.includes('de'))) mitDeutsch++
    } catch (e) {
      fehler++
      warn(`JustWatch: ${name} — ${(e as Error).message}`)
    }
    await sleep(PAUSE_MS)
  }

  log(
    `JustWatch: ${getroffen} Titel zugeordnet (${leer} ohne Angebot), ${mitDeutsch} davon mit deutscher Tonspur, ` +
      `${ohneTrefferNeu} ohne Treffer, ${verfehlt} verfehlt (alte Antwort behalten), ${fehler} Fehler.`,
  )
  /*
    **Plausibilität vor dem Schreiben** (17.09.2026). Gemessen am Bestand vor dem Umbau:
    2 % der Treffer ohne Angebot, 23 % der Suchen ohne Treffer. Ändert JustWatch seine
    Schnittstelle, sähe das aus wie „überall keine Angebote" — und der Bau nähme den Titeln
    ohne eigenen Verweis ihre Wege. Dann wird nichts geschrieben; die alte Datei bleibt.
  */
  const gefragt = getroffen + ohneTrefferNeu + verfehlt
  if (gefragt >= 50 && (leer / Math.max(getroffen, 1) > 0.25 || (ohneTrefferNeu + verfehlt) / gefragt > 0.7)) {
    warn(`JustWatch: Ergebnis unplausibel (${leer} von ${getroffen} Treffern ohne Angebot, ${ohneTrefferNeu + verfehlt} von ${gefragt} ohne Treffer) — nichts geschrieben.`)
    recordSource('justwatch-audio', 0)
    return
  }
  writeJson(DATEI, bestand)
  recordSource('justwatch-audio', getroffen)
  liste(titles, bestand)
}

/**
 * **Die Arbeitsliste entsteht im selben Lauf — nicht in einem zweiten.**
 *
 * Am 07.09.2026 stellte sich heraus, dass `data:report` in keinem Workflow
 * stand und deshalb nie lief: Die Anime2You-Vorschläge wurden ein Jahr lang
 * geholt und nie angesehen. Ein Bericht, den man getrennt starten muss, wird
 * vergessen — dieser hier hängt am Abruf und kann es nicht.
 *
 * Sie beantwortet genau eine Frage: **Zu welchem offenen Verweis sagt
 * JustWatch etwas?** Nicht mehr — das Urteil bleibt bei Daniel oder bei einer
 * Quelle, die je Folge antwortet.
 */
function liste(titles: Title[], bestand: Record<string, Befund>): void {
  /* JustWatchs Anbietername → unsere Kennung. Nur was eindeutig ist. */
  const NAMEN: [RegExp, string][] = [
    [/^crunchyroll$/i, 'crunchyroll'],
    [/^netflix/i, 'netflix'],
    [/^amazon prime video/i, 'primevideo'],
    [/^animation digital network$/i, 'adn'],
    [/^wow$|^rtl\+|^joyn/i, 'sonstige'],
  ]
  const zeilen: string[] = []
  let mitAussage = 0
  for (const t of titles) {
    const b = bestand[String(t.id)]
    if (!b || b.ohneTreffer || !b.angebote.length) continue
    for (const s of t.streams ?? []) {
      if (s.dub !== undefined) continue
      const passend = b.angebote.filter((a) => NAMEN.find(([re]) => re.test(a.anbieter))?.[1] === s.platform)
      if (!passend.length) continue
      const audio = [...new Set(passend.flatMap((a) => a.audio))]
      const unter = [...new Set(passend.flatMap((a) => a.untertitel))]
      if (!audio.length) continue
      const urteil = audio.includes('de')
        ? '🇩🇪 **Deutsch dabei**'
        : unter.includes('de')
          ? 'nur Untertitel deutsch'
          : 'kein Deutsch'
      zeilen.push(
        `| [${t.titleDe ?? t.titleRomaji}](https://anime-kalender.de/#/datenbank?t=${t.id}) | ${s.platform} | ${urteil} | \`${audio.join(', ')}\` | [JustWatch](https://www.justwatch.com${b.jwPfad}) |`,
      )
      mitAussage++
    }
  }
  /*
    **Zweiter Abschnitt: Titel ganz ohne Bezugsweg.**

    243 Titel im Hauptbestand haben keinen einzigen Weg (07.09.2026) — für sie
    beantwortet der Kalender Punkt 4 des Projektziels gar nicht („Nicht nur
    wann, auch wo"). Wo JustWatch ein Angebot kennt, steht hier die Adresse.
  */
  const ohneWeg: string[] = []
  for (const t of titles) {
    if ((t.streams ?? []).length || (t.watchLinks ?? []).length) continue
    const b = bestand[String(t.id)]
    if (!b || b.ohneTreffer || !b.angebote.length) continue
    /*
      **„JustWatch TV" ist kein Anbieter, sondern die Eigenwerbung des Dienstes.**
      Der Verweis führt zurück auf justwatch.com und beantwortet die Frage „wo
      kann ich das sehen" nicht (gemessen am 07.09.2026 an „Familie Robinson").
    */
    const beste = b.angebote.filter((a) => a.url && !/^justwatch/i.test(a.anbieter)).slice(0, 4)
    if (!beste.length) continue
    ohneWeg.push(
      `| [${t.titleDe ?? t.titleRomaji}](https://anime-kalender.de/#/datenbank?t=${t.id}) | ${beste
        .map((a) => `[${a.anbieter}](${a.url})${a.audio.includes('de') ? ' 🇩🇪' : ''}`)
        .join(', ')} |`,
    )
  }

  const kopf = [
    '# Was JustWatch zu offenen Verweisen sagt',
    '',
    `Stand: ${todayIso()}. Erzeugt von \`npm run data:justwatch\`.`,
    '',
    '**Das sind Kandidaten, keine Belege.** Die Angabe gilt der **Serie**, nicht der',
    'einzelnen Folge — bei „Kill Blue" meldet JustWatch `de` für alle zwölf, belegt',
    'sind acht. Und ein fehlendes `de` belegt nichts: Netflix meldet dort gar keine',
    'Tonspur. Was hier steht, sagt, **wo sich das Nachsehen lohnt**.',
    '',
    `${mitAussage} offene Verweise, zu denen JustWatch eine Tonspur nennt.`,
    '',
    '| Titel | Anbieter | JustWatch sagt | Tonspuren | Quelle |',
    '|---|---|---|---|---|',
  ]
  mkdirSync('daniel-zum-abarbeiten', { recursive: true })
  const zweiter = ohneWeg.length
    ? [
        '',
        '## Titel ganz ohne Bezugsweg',
        '',
        `${ohneWeg.length} Titel im Hauptbestand haben keinen einzigen Weg — hier nennt JustWatch einen.`,
        'Ein Titel im Hauptbestand hat per Definition eine belegte deutsche Synchro; das 🇩🇪 sagt,',
        'dass JustWatch für dieses Angebot auch eine deutsche Tonspur kennt.',
        '',
        '| Titel | Angebote laut JustWatch |',
        '|---|---|',
        ...ohneWeg,
      ]
    : []
  writeFileSync(
    'daniel-zum-abarbeiten/16-justwatch-tonspuren.md',
    `${[...kopf, ...zeilen, ...zweiter].join('\n')}\n`,
  )
  log(`JustWatch: ${mitAussage} offene Verweise mit Tonspur-Angabe → daniel-zum-abarbeiten/16-justwatch-tonspuren.md`)
}

await main()
