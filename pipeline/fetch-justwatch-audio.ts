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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { fetchJson, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { istUnplausibel } from './lib/justwatch-plausibel.ts'
import { abweisungsZeile, nimmTreffer } from './lib/jw-kennung-fremd.ts'
import { besterNamensTreffer, type NamensTreffer } from './lib/jw-namenstreffer.ts'
import { todayIso } from '../shared/time.ts'
import type { Title } from '../shared/types.ts'
import { STAFFELN_ABFRAGE, staffelnVon, type Staffel, type StaffelRoh } from './lib/jw-staffeln.ts'
import { warteschlange } from './lib/jw-schlange.ts'
import { ladeFrische } from './lib/jw-frische.ts'
import { ANBIETERLISTEN, listenVorrangAbrufen, seiteVonJustWatch } from './lib/jw-anbieterliste.ts'
import { bekannteTmdbKennungen, namensSchlange, suchNamen, waehleKnoten } from './lib/jw-namenssuche.ts'

const ENDPUNKT = 'https://apis.justwatch.com/graphql'
const UA = 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)'
/** Eine Sekunde zwischen zwei Abrufen — die Schnittstelle nennt kein Limit, also wird zurückhaltend gefragt. */
const PAUSE_MS = 1000
/** So viele Titel hintereinander gesperrt (nach Backoff) — dann ist die Sperre keine Laune mehr. */
const SPERREN_BIS_ABBRUCH = 3
const DATEI = 'data/justwatch-audio.json'
/** Titel ohne TMDB-Kennung kommen nach 21 Tagen wieder dran; der Bau liest Befunde nur bis 28 Tage (`BEFUND_MAX_TAGE`). */
const NAMEN_ALTER_TAGE = 21

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
  /**
   * Altersangabe von JustWatch (DE), roh wie geliefert („12", „16", auch ""). Fehlt das Feld, wurde noch
   * nicht danach gefragt; `null` = JustWatch nennt keine. Anbieter-Einstufung, keine FSK-Freigabe (08.10.2026).
   */
  altersangabe?: string | null
  /** Ton und Adresse je Staffel (Serien, seit 11.10.2026) — nur gesammelt, `lib/jw-staffeln.ts`. */
  staffeln?: Staffel[]
  angebote: Angebot[]
  /** Kein Treffer bei JustWatch — festgehalten, damit der Titel nicht täglich neu gesucht wird. */
  ohneTreffer?: boolean
  /** Erste Antwort von JustWatch zu diesem Titel (seit 17.09.2026) — siehe `jwFrisch()`. */
  erstAm?: string
  /** Die letzte Suche fand den Titel nicht; die Angebote stammen von der Antwort davor. */
  verfehltAm?: string
  /** Nur bei `ohneTreffer`: bester Namenstreffer mit abweichender TMDB-Kennung — gespeichert, nie zugeordnet (`lib/jw-namenstreffer.ts`). */
  namenTreffer?: NamensTreffer
  /** Zugeordnet über Namen, Jahr und Art statt über eine TMDB-Kennung unserer Seite (`lib/jw-namenssuche.ts`, seit 06.11.2026). */
  ueberName?: boolean
}

const SUCHE = `
query Suche($q: String!, $country: Country!, $language: Language!) {
  popularTitles(country: $country, first: 20, filter: { searchQuery: $q }) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          fullPath
          ageCertification
          externalIds { tmdbId }
        }
        offers(country: $country, platform: WEB) {
          monetizationType
          audioLanguages
          subtitleLanguages
          standardWebURL
          package { clearName }
        }${STAFFELN_ABFRAGE}
      }
    }
  }
}`

interface JwKnoten {
  id: string
  objectType: string
  content: { title: string; originalReleaseYear?: number | null; fullPath: string; ageCertification?: string | null; externalIds?: { tmdbId?: number | null } | null }
  offers?:
    | {
        monetizationType: string
        audioLanguages?: string[] | null
        subtitleLanguages?: string[] | null
        standardWebURL?: string | null
        package?: { clearName?: string } | null
      }[]
    | null
  seasons?: StaffelRoh[] | null
}

function angeboteVon(offers: JwKnoten['offers']): Angebot[] {
  return (offers ?? [])
    .map((o) => ({
      anbieter: o.package?.clearName ?? '?',
      art: o.monetizationType,
      audio: o.audioLanguages ?? [],
      untertitel: o.subtitleLanguages ?? [],
      url: o.standardWebURL ?? undefined,
    }))
    /* Dasselbe Angebot kommt regelmäßig doppelt — je Auflösung eine Zeile. */
    .filter((a, i, alle) => alle.findIndex((b) => b.anbieter === a.anbieter && b.art === a.art) === i)
}

/** Naht für Tests: der Abruf und die Pause zwischen zwei Abrufen; Standard ist der echte Weg. */
export interface Welt {
  abruf: typeof fetchJson
  pause: () => Promise<void>
}

const ECHTE_WELT: Welt = { abruf: fetchJson, pause: () => sleep(PAUSE_MS) }

/** Eine Sperre wartet `fetchJson` mit Backoff ab; erst danach kommt sie hier als Fehler an. */
async function suche(begriff: string, w: Welt): Promise<JwKnoten[]> {
  const j = await w.abruf<{
    errors?: { message: string }[]
    data?: { popularTitles?: { edges?: { node: JwKnoten }[] } }
  }>(ENDPUNKT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ query: SUCHE, variables: { q: begriff, country: 'DE', language: 'de' } }),
  })
  if (j.errors?.length) throw new Error(j.errors[0].message)
  return (j.data?.popularTitles?.edges ?? []).map((e) => e.node)
}

/**
 * **Alle drei Namen und 20 Treffer, nicht nur der erste Name und fünf** (27.09.2026). Stichprobe über
 * 30 von 420 Titeln „ohne Treffer": 27 führt JustWatch gar nicht, drei nur unter dem japanischen
 * Namen oder jenseits von Rang 5 (Clannad: Der Film, Baki 2, Digimon: Der Film). Bestätigt wird
 * weiter allein über die TMDB-Kennung — als Zeichenkette, JustWatch liefert sie als String.
 */
async function sucheUeberNamen(t: Title, erwartet: number | string, w: Welt): Promise<{ treffer?: JwKnoten; naeherung?: NamensTreffer }> {
  const namen = [...new Set([t.titleDe, t.titleRomaji, t.titleEn].filter((n): n is string => Boolean(n)))]
  const alle: JwKnoten[] = []
  for (const [i, name] of namen.entries()) {
    if (i) await w.pause()
    const liste = await suche(name, w)
    const treffer = liste.find((k) => String(k.content.externalIds?.tmdbId ?? '') === String(erwartet))
    if (treffer) return { treffer }
    alle.push(...liste)
  }
  return { naeherung: besterNamensTreffer(namen, alle, erwartet) }
}

/** Titel mit frischem Kino- oder Disc-Termin aus den veröffentlichten Terminen (`jw-frische.ts`). */
function frischeAusTermine(): Set<number> {
  return ladeFrische('public/data/releases.json', todayIso())
}

/**
 * Verbucht einen Titel ohne Treffer; `true` = alte Antwort behalten (verfehlt), `false` = neu als `ohneTreffer` geschrieben.
 *
 * **Eine verfehlte Suche löscht keine gute Antwort** (17.09.2026). Die Suche geht über den Namen, und ihre Trefferliste
 * schwankt; ohne diesen Zweig verlor ein Titel bei einem Fehlgriff alle Angebote — und mit ihnen seine Wege im Kalender.
 */
function verbucheFehlschlag(bestand: Record<string, Befund>, schluessel: string, erwartet: number | undefined, naeherung?: NamensTreffer): boolean {
  const vorher = bestand[schluessel]
  if (vorher && !vorher.ohneTreffer && vorher.jwId) {
    bestand[schluessel] = { ...vorher, geprueftAm: todayIso(), verfehltAm: todayIso() }
    return true
  }
  /*
    Die Kennung gehört auch an den Fehlschlag: Wird die TMDB-Zuordnung später
    berichtigt, ist dieser Befund hinfällig und die Warteschlange erkennt es
    daran (Your Name, 17.09.2026 — gesucht wurde gegen „Call Me by Your Name").
  */
  bestand[schluessel] = {
    geprueftAm: todayIso(),
    angebote: [],
    ohneTreffer: true,
    tmdbId: erwartet,
    erstAm: vorher?.erstAm ?? todayIso(),
    ...(naeherung ? { namenTreffer: naeherung } : {}),
  }
  return false
}

/** Die Eingaben des Laufs: Titel (Hauptbestand, Cartoons, Titel mit Hand-Kennung), TMDB-Zuordnung und der bisherige JustWatch-Bestand. */
function ladeEingaben(nurCartoons: boolean): { titles: Title[]; cartoons: Title[]; tmdb: Record<string, { tmdbId?: number }>; bestand: Record<string, Befund> } {
  /*
    **Cartoons fragen mit** (16.09.2026): TMDB nennt dort nur den Dienst, keine
    Adresse — die Prime-Pille von „The Mighty Nein" führte deshalb ins Leere.
    JustWatch kennt die Seite beim Anbieter; zugeordnet wird wie immer über die
    TMDB-Kennung, die Cartoons selbst tragen. `--nur-cartoons` holt nur sie.
  */
  const cartoons = readJson<Title[]>('public/data/cartoons.json', [])
  /*
    **Wer von Hand eine TMDB-Kennung bekommen hat, wird auch gefragt** (23.09.2026).

    Titel ohne belegte deutsche Synchro liegen hinter dem Toggle (`ohne-synchro.json`, über
    15.000 Stück) und stehen zu Recht nicht in der Warteschlange — für sie ist JustWatch
    keine Sprachquelle, sondern eine Suche ins Blaue. Anders bei den wenigen, denen jemand
    von Hand eine TMDB-Kennung gegeben hat: Genau dort lautet die offene Frage „gibt es das
    irgendwo auf Deutsch?", und genau die beantwortet JustWatch. Anlass ist „Super Dragon
    Ball Heroes" aus Daniels Dragon-Ball-Recherche.
  */
  const handKennungen = new Set(
    ((yaml.load(readFileSync('data/tmdb-von-hand.yaml', 'utf8')) as { anilistId: number }[] | null) ?? []).map(
      (e) => e.anilistId,
    ),
  )
  const ausDemToggle = readJson<Title[]>('public/data/ohne-synchro.json', []).filter((t) => handKennungen.has(t.id))
  const titles = nurCartoons
    ? cartoons
    : [...readJson<Title[]>('public/data/titles.json', []), ...cartoons, ...ausDemToggle]
  const tmdb = readJson<Record<string, { tmdbId?: number }>>('data/tmdb-titles.json', {})
  const bestand = readJson<Record<string, Befund>>(DATEI, {})
  return { titles, cartoons, tmdb, bestand }
}

/** Der Befund eines über den Namen gefundenen Titels; die TMDB-Kennung ist die von JustWatch (nicht unsere), `ueberName` kennzeichnet den Weg. */
function befundVonNamenstreffer(vorher: Befund | undefined, treffer: JwKnoten, tmdbId: number | undefined): Befund {
  return {
    geprueftAm: todayIso(),
    ...(vorher && !vorher.ohneTreffer && !vorher.erstAm ? {} : { erstAm: vorher?.erstAm ?? todayIso() }),
    jwId: treffer.id,
    tmdbId,
    jwPfad: treffer.content.fullPath,
    altersangabe: treffer.content.ageCertification ?? null,
    staffeln: staffelnVon(treffer.seasons),
    angebote: angeboteVon(treffer.offers),
    ueberName: true,
  }
}

/**
 * Titel ohne TMDB-Kennung: Namenssuche (`lib/jw-namenssuche.ts`), höchstens `anzahl` je Lauf, die ältesten Befunde zuerst. Der Bau liest nur Befunde
 * der letzten 28 Tage (`BEFUND_MAX_TAGE`), darum kommt jeder Titel nach 21 Tagen wieder dran. Gespeichert wird nur ein plausibler Lauf (Kopie, kein Teilstand).
 */
async function sucheOhneTmdb(titles: Title[], tmdb: Record<string, { tmdbId?: number }>, bestand: Record<string, Befund>, anzahl: number, w: Welt): Promise<void> {
  const tmdbVon = (t: Title) => (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
  const grenze = new Date(Date.now() - NAMEN_ALTER_TAGE * 86_400_000).toISOString().slice(0, 10)
  const alle = namensSchlange({ titles, bestand, tmdbVon, grenze })
  const bekannte = bekannteTmdbKennungen(titles, tmdbVon)
  const neu = structuredClone(bestand)
  log(`JustWatch (Namenssuche): ${alle.length} Titel ohne TMDB-Kennung fällig, davon werden ${Math.min(anzahl, alle.length)} gefragt.`)
  const z = { getroffen: 0, leer: 0, verfehlt: 0, keiner: 0, fehler: 0, mehrdeutig: [] as string[], fremd: [] as string[], abgewiesen: [] as string[] }
  let sperrenInFolge = 0
  for (const t of alle.slice(0, anzahl)) {
    const name = t.titleDe || t.titleRomaji || t.titleEn
    try {
      const knoten: JwKnoten[] = []
      for (const [i, begriff] of suchNamen(t).entries()) {
        if (i) await w.pause()
        knoten.push(...(await suche(begriff, w)))
      }
      sperrenInFolge = 0
      const u = waehleKnoten(t, knoten, bekannte)
      if (u.art === 'mehrdeutig') z.mehrdeutig.push(`${name} (${t.id}, ${u.anzahl} Treffer)`)
      if (u.art === 'fremd') z.fremd.push(`${name} (${t.id}, TMDB ${u.tmdbId})`)
      const tmdbId = u.art === 'treffer' ? Number(u.knoten.content.externalIds?.tmdbId) || undefined : undefined
      const { treffer, halter } = nimmTreffer(neu, String(t.id), u.art === 'treffer' ? u.knoten : undefined, tmdbId)
      if (halter) z.abgewiesen.push(`${name} (${t.id}, Halter ${halter})`)
      if (treffer) {
        neu[String(t.id)] = befundVonNamenstreffer(neu[String(t.id)], treffer, tmdbId)
        z.getroffen++
        if (!neu[String(t.id)].angebote.length) z.leer++
      } else if (verbucheFehlschlag(neu, String(t.id), undefined)) z.verfehlt++
      else {
        neu[String(t.id)].ueberName = true
        z.keiner++
      }
    } catch (e) {
      z.fehler++
      warn(`JustWatch (Namenssuche): ${name} — ${(e as Error).message}`)
      if (/^429 /.test((e as Error).message) && ++sperrenInFolge >= SPERREN_BIS_ABBRUCH) {
        warn(`JustWatch (Namenssuche): ${SPERREN_BIS_ABBRUCH} Sperren in Folge — der Lauf endet hier, das Erreichte wird geschrieben.`)
        break
      }
    }
    await w.pause()
  }
  log(`JustWatch (Namenssuche): ${z.getroffen} zugeordnet (${z.leer} ohne Angebot), ${z.keiner} ohne Treffer, ${z.mehrdeutig.length} mehrdeutig, ${z.fremd.length} fremd, ${z.abgewiesen.length} abgewiesen, ${z.verfehlt} verfehlt, ${z.fehler} Fehler.`)
  for (const [art, liste] of [['mehrdeutig', z.mehrdeutig], ['fremd (Kennung gehört schon einem anderen Titel)', z.fremd], ['abgewiesen', z.abgewiesen]] as const)
    if (liste.length) log(`JustWatch (Namenssuche) ${art}, nichts übernommen: ${liste.join('; ')}`)
  if (istUnplausibel(z)) return warn('JustWatch (Namenssuche): Ergebnis unplausibel — nichts geschrieben.')
  Object.assign(bestand, neu)
  writeJson(DATEI, bestand)
}

/** Zähler der Hauptschleife — `main()` meldet sie und entscheidet über das Schreiben. */
interface Zaehler { getroffen: number; mitDeutsch: number; fehler: number; leer: number; verfehlt: number; ohneTrefferNeu: number; abgewiesen: string[] }

/** Die Hauptschleife: die ersten `limit` offenen Titel über die TMDB-Kennung bei JustWatch suchen und in `bestand` verbuchen. */
async function frageOffene(offen: Title[], limit: number, tmdb: Record<string, { tmdbId?: number }>, bestand: Record<string, Befund>, w: Welt): Promise<Zaehler> {
  const z: Zaehler = { getroffen: 0, mitDeutsch: 0, fehler: 0, leer: 0, verfehlt: 0, ohneTrefferNeu: 0, abgewiesen: [] }
  let sperrenInFolge = 0

  for (const t of offen.slice(0, limit)) {
    const erwartet = (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
    if (!(t.titleDe || t.titleRomaji || t.titleEn)) continue
    try {
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
      const { treffer: gefunden, naeherung } = erwartet ? await sucheUeberNamen(t, erwartet, w) : { treffer: undefined, naeherung: undefined }
      /* Eine Kennung, die schon eine andere TMDB-Reihe hält, ist ein Fehlgriff von JustWatch (Spin-off auf Hauptserie). */
      const { treffer, halter } = nimmTreffer(bestand, String(t.id), gefunden, erwartet)
      if (halter) z.abgewiesen.push(`${t.titleDe || t.titleRomaji || t.titleEn} (${t.id}, Halter ${halter})`)
      sperrenInFolge = 0
      const vorher = bestand[String(t.id)]
      if (!treffer) {
        if (verbucheFehlschlag(bestand, String(t.id), erwartet, naeherung)) z.verfehlt++
        else z.ohneTrefferNeu++
        continue
      }
      const angebote = angeboteVon(treffer.offers)
      if (!angebote.length) z.leer++
      bestand[String(t.id)] = {
        geprueftAm: todayIso(),
        /* Eine Antwort vor dem Umbau gilt als bewährt und bekommt kein Datum. */
        ...(vorher && !vorher.ohneTreffer && !vorher.erstAm ? {} : { erstAm: vorher?.erstAm ?? todayIso() }),
        jwId: treffer.id,
        tmdbId: erwartet,
        jwPfad: treffer.content.fullPath,
        altersangabe: treffer.content.ageCertification ?? null,
        staffeln: staffelnVon(treffer.seasons),
        angebote,
      }
      z.getroffen++
      if (angebote.some((a) => a.audio.includes('de'))) z.mitDeutsch++
    } catch (e) {
      z.fehler++
      warn(`JustWatch: ${t.titleDe || t.titleRomaji || t.titleEn} — ${(e as Error).message}`)
      if (/^429 /.test((e as Error).message) && ++sperrenInFolge >= SPERREN_BIS_ABBRUCH) {
        warn(`JustWatch: ${SPERREN_BIS_ABBRUCH} Sperren in Folge — der Lauf endet hier, das Erreichte wird geschrieben.`)
        break
      }
    }
    await w.pause()
  }
  return z
}

export async function main(args: string[] = process.argv.slice(2), welt: Welt = ECHTE_WELT): Promise<void> {
  const zahl = (name: string, vorgabe: number): number => {
    const i = args.indexOf(name)
    return i >= 0 && args[i + 1] ? Number(args[i + 1]) : vorgabe
  }
  const limit = zahl('--limit', 40)
  const alterTage = zahl('--alter', 28)

  const nurCartoons = args.includes('--nur-cartoons')
  const { titles, cartoons, tmdb, bestand } = ladeEingaben(nurCartoons)

  const grenze = new Date(Date.now() - alterTage * 86_400_000).toISOString().slice(0, 10)
  /* Titel ohne TMDB-Kennung (`--namen N`, vorgabe 0 = aus): zuerst, damit der frühe Ausstieg „nichts fällig“ unten sie nicht übergeht. */
  if (!nurCartoons && zahl('--namen', 0) > 0) await sucheOhneTmdb(titles, tmdb, bestand, zahl('--namen', 0), welt)

  /*
    **Die Warteschlange bildet sich nach dem Alter, nicht nach „schon gefragt".**

    Sonst kann ein einmal leeres Ergebnis nie mehr besser werden — genau der
    Fehler, den `CLAUDE.md` unter „Ein Abruf, der nur ergänzt, veraltet
    zwangsläufig" beschreibt. Ein Anbieter nimmt eine deutsche Fassung auch
    **auf**, und dann muss die Frage neu gestellt werden dürfen.
  */
  /*
    Der Lauf fragt reihum alle Titel mit TMDB-Kennung (seit 17.09.2026); vorn stehen drei Lücken: Wege ohne
    Sprachurteil, Titel ganz ohne Weg (243 im Hauptbestand, 07.09.2026) und Wege, die nur auf die TMDB-Übersicht
    zeigen statt zum Anbieter (1.187 auf 364 Titeln, 16.09.2026).
  */
  const tmdbVon = (t: Title) => (t as Title & { tmdbId?: number }).tmdbId ?? tmdb[String(t.id)]?.tmdbId
  const listen = await listenVorrangAbrufen(ANBIETERLISTEN, seiteVonJustWatch(ENDPUNKT, UA, welt.abruf), welt.pause, titles, bestand, tmdbVon, todayIso())
  log(`JustWatch: ${listen.vorrang.size} Titel aus Anbieter-Listen vorgezogen (${listen.abrufe} Listenabrufe).`)
  const offen = warteschlange({ titles, bestand, tmdb, grenze, heute: todayIso(), frisch: frischeAusTermine(), listenVorrang: listen.vorrang, cartoonIds: new Set(cartoons.map((t) => t.id)) })

  if (!offen.length) {
    log('JustWatch: keine offenen Verweise zur Wiedervorlage.')
    recordSource('justwatch-audio', 0)
    return
  }

  log(`JustWatch: ${offen.length} Titel mit offenem Verweis, davon werden ${Math.min(limit, offen.length)} geholt.`)

  const { getroffen, mitDeutsch, fehler, leer, verfehlt, ohneTrefferNeu, abgewiesen } = await frageOffene(offen, limit, tmdb, bestand, welt)

  log(
    `JustWatch: ${getroffen} Titel zugeordnet (${leer} ohne Angebot), ${mitDeutsch} davon mit deutscher Tonspur, ` +
      `${ohneTrefferNeu} ohne Treffer, ${verfehlt} verfehlt (alte Antwort behalten), ${fehler} Fehler.`,
  )
  if (abgewiesen.length) warn(abweisungsZeile(abgewiesen))
  if (istUnplausibel({ getroffen, leer, verfehlt })) {
    warn(`JustWatch: Ergebnis unplausibel (${leer} von ${getroffen} Treffern ohne Angebot, ${verfehlt} früher gefundene jetzt verfehlt) — nichts geschrieben.`)
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
  mkdirSync('daniel-zum-abarbeiten/listen', { recursive: true })
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
    'daniel-zum-abarbeiten/listen/16-justwatch-tonspuren.md',
    `${[...kopf, ...zeilen, ...zweiter].join('\n')}\n`,
  )
  log(`JustWatch: ${mitAussage} offene Verweise mit Tonspur-Angabe → daniel-zum-abarbeiten/listen/16-justwatch-tonspuren.md`)
}

/* `?nur-laden` am Import-Pfad: Tests holen `main` und rufen es selbst mit ihrer Welt auf. */
if (!import.meta.url.endsWith('?nur-laden')) await main()
