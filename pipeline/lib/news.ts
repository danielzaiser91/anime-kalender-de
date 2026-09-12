/**
 * **Die Nachrichten der Seite — aus dem, was ohnehin dasteht.**
 *
 * Daniel am 12.09.2026: „think about a news section for the website, where all
 * our news regarding dubs (ankündigungen und releases) are published in a
 * bite-sized format (short and simple)", dazu ausdrücklich „Verschiebungen,
 * Verspätungen, nicht erschienen trotz ankündigung … (wir haben es gemerkt)".
 *
 * **Kein neuer Abruf.** Jede Meldung entsteht aus einer Angabe, die der Bau
 * schon hat:
 *
 * | Art | Quelle |
 * |---|---|
 * | `neu` | `synchro-historie.json` — der Tag, an dem ein Titel erstmals belegte Synchro hatte |
 * | `folgen` | `crunchyroll-neu.json` — neue deutsche Folgen, je Serie und Tag |
 * | `angekuendigt` | ein Release mit deutschem Termin, das wir zum ersten Mal sehen |
 * | `disc`, `kino` | dasselbe für Disc- und Kinotermine |
 * | `verspaetet` | `schedule.verpasst` — ein angekündigter Termin verstrich, ohne dass etwas erschien |
 *
 * **Das Datum einer Meldung ist der Tag, an dem sie zum ersten Mal wahr war.**
 * Ohne Gedächtnis würde jede Meldung bei jedem Bau nach oben rutschen und die
 * Seite behauptete, alles sei von heute. `data/news-historie.json` hält je
 * Meldung fest, wann sie zuerst dastand; danach ändert sich ihr Datum nie
 * wieder.
 */
import type { NewsArt, NewsEintrag, NewsMeldung, Release, Title } from '../../shared/types.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { eindeutschenStaffel } from '../../shared/titles.ts'

/** Wie lange eine Meldung auf der Seite steht. */
const FENSTER_TAGE = 120
/** Obergrenze, damit die Datei klein bleibt — sie wird bei jedem Seitenaufruf geladen. */
const HOECHSTENS = 400

export interface NewsHistorie {
  /** Meldungsschlüssel → Tag, an dem die Meldung zum ersten Mal dastand. */
  zuerst: Record<string, string>
}

interface NeuerTitel {
  id: number
  seit: string
}

interface CrNeueFolge {
  serieId: string
  serie: string
  nummer?: number
  /**
   * **Crunchyrolls eigenes Datum für die deutsche Fassung.**
   *
   * `premium_available_date` an der deutschen Folge — für die
   * Lord-of-Mysteries-Specials der 10.09.2026, auf den Tag Daniels Angabe.
   * Ohne dieses Feld datierte die Meldung auf unseren Fundtag, und der ist
   * bei einem täglichen Lauf bis zu einen Tag daneben, beim ersten Lauf über
   * ein Fenster von 120 Tagen beliebig weit.
   */
  verfuegbarAb?: string
  gesehenAm: string
}

/**
 * Baut die Meldungen. `historie` wird dabei **ergänzt** — der Aufrufer schreibt
 * sie zurück, damit das Datum einer Meldung beim nächsten Bau dasselbe bleibt.
 */
export function baueNews(
  titles: Title[],
  releases: Release[],
  neuMitSynchro: NeuerTitel[],
  crNeu: CrNeueFolge[],
  historie: NewsHistorie,
): NewsEintrag[] {
  const heute = todayIso()
  const grenze = addDays(heute, -FENSTER_TAGE)
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const roh: (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] = []

  const kopf = (t: Title) => ({ titel: t })

  /* 1. Erstmals mit deutscher Synchro. */
  for (const n of neuMitSynchro) {
    const t = nachId.get(n.id)
    if (!t) continue
    const anbieter = t.streams.find((s) => s.dub === true)?.platform
    roh.push({
      schluessel: `neu:${t.id}`,
      fallback: n.seit,
      art: 'neu',
      ...kopf(t),
      platform: anbieter,
    })
  }

  /* 2. Neue deutsche Folgen — je Serie und Tag eine Meldung, nicht je Folge. */
  const jeSerieUndTag = new Map<string, { serie: string; tag: string; nummern: number[] }>()
  for (const f of crNeu) {
    /* Crunchyrolls eigenes Datum, sonst unser Fundtag. */
    const tag = (f.verfuegbarAb ?? f.gesehenAm).slice(0, 10)
    if (!f.serieId || tag < grenze) continue
    const schluessel = `${f.serieId}|${tag}`
    const eintrag = jeSerieUndTag.get(schluessel) ?? { serie: f.serie, tag, nummern: [] }
    if (typeof f.nummer === 'number') eintrag.nummern.push(f.nummer)
    jeSerieUndTag.set(schluessel, eintrag)
  }
  /*
    Die Zuordnung läuft über die Crunchyroll-Adresse: Der Fund nennt die
    Serienkennung, unsere Verweise tragen sie in der Adresse. Ohne Treffer gibt
    es keine Meldung — ein Name allein ist keine Zuordnung (CLAUDE.md).
  */
  const nachSerienId = new Map<string, Title>()
  for (const t of titles) {
    for (const s of t.streams) {
      const id = /crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]+)/i.exec(s.url)?.[1]
      if (id && !nachSerienId.has(id)) nachSerienId.set(id, t)
    }
  }
  for (const [schluessel, eintrag] of jeSerieUndTag) {
    const t = nachSerienId.get(schluessel.split('|')[0]!)
    if (!t) continue
    const nummern = [...new Set(eintrag.nummern)].sort((a, b) => a - b)
    roh.push({
      schluessel: `folgen:${schluessel}`,
      fallback: eintrag.tag,
      art: 'folgen',
      ...kopf(t),
      platform: 'crunchyroll',
      von: nummern[0],
      bis: nummern[nummern.length - 1],
      anzahl: nummern.length || undefined,
    })
  }

  /* 3. Termine: angekündigt, auf Disc, im Kino — und die, die niemand eingehalten hat. */
  for (const r of releases) {
    const t = nachId.get(r.titleId)
    if (!t) continue
    const datum = r.schedule?.firstEpisodeDate
    if (datum) {
      /*
        **„Im Kino" sagt die Plattform, nicht die Art des Werks.**

        `releaseType: 'movie'` heißt „das hier ist ein Film" — und daraus wurde
        „Im Kino". Für „Mononoke – The Movie: Chapter III" stand deshalb „ab
        29.09.2026 · Im Kino" in den Nachrichten; das Release trägt
        `platform: 'netflix'` und die Netflix-Adresse als Quelle (Daniel,
        12.09.2026: „woher kommt dieser news eintrag mit ab 29.09.2026 im kino?
        … wo genau steht diese info, und woher kommt das?").

        Ein Film, der bei einem Streamingdienst erscheint, ist keine
        Kinopremiere. Entschieden wird deshalb an `platform === 'kino'` — dem
        Feld, das genau das bedeutet.
      */
      const art: NewsArt =
        r.releaseType === 'disc'
          ? 'disc'
          : r.platform === 'kino'
            ? 'kino'
            : 'angekuendigt'
      roh.push({
        schluessel: `${art}:${r.slug}:${datum}`,
        fallback: datum > heute ? heute : datum,
        art,
        ...kopf(t),
        platform: r.platform,
        datum,
        release: r.slug,
      })
    }
    for (const [nummer, v] of Object.entries(r.schedule?.verpasst ?? {})) {
      if (!v?.erwartetAm) continue
      roh.push({
        schluessel: `verspaetet:${r.slug}:${nummer}:${v.erwartetAm}`,
        fallback: v.erwartetAm,
        art: 'verspaetet',
        ...kopf(t),
        platform: r.platform,
        datum: v.erwartetAm,
        von: Number(nummer),
        release: r.slug,
        /* Was inzwischen daraus wurde — leer, solange die Folge aussteht. */
        nachgereichtAm: v.erschienenAm,
      })
    }
  }

  /* Das Datum: beim ersten Mal gemerkt, danach unverändert. */
  const datiert: (NewsMeldung & { am: string; titel: Title })[] = []
  for (const r of roh) {
    const { schluessel, fallback, ...rest } = r
    const zuerst = historie.zuerst[schluessel] ?? (fallback > heute ? heute : fallback)
    historie.zuerst[schluessel] = zuerst
    if (zuerst < grenze) continue
    datiert.push({ ...rest, am: zuerst })
  }

  /* Alte Schlüssel aus dem Gedächtnis werfen — sonst wächst es ohne Ende. */
  for (const [k, v] of Object.entries(historie.zuerst)) {
    if (v < addDays(heute, -400)) delete historie.zuerst[k]
  }

  const rang: Record<NewsArt, number> = {
    neu: 0,
    angekuendigt: 1,
    verspaetet: 2,
    kino: 3,
    disc: 4,
    folgen: 5,
  }
  /*
    **Dieselbe Schreibweise wie überall sonst.** Ohne die Eindeutschung stand im
    Chip „Staffel 3 - Cour 1" neben einem „Staffel 3 - Teil 2" aus derselben
    Reihe — die Vereinheitlichung von „Cour"/„Part" lebt in `shared/titles.ts`
    und wurde hier bisher nicht gerufen.
  */
  const name = (t: Title) => eindeutschenStaffel(t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id))

  /*
    **Der Kopf der Gruppe ist die Reihe, nicht der Teil.**

    Bevorzugt der Titel, dessen Kennung die Reihe selbst ist; gibt es ihn im
    Bestand nicht (die Reihe hängt dann an einem Teil), entscheidet der Teil mit
    den meisten Meldungen an diesem Tag. Das Cover wird geliehen, wo der Kopf
    keines hat — eine Zeile ohne Bild fällt in einer Liste auf.
  */
  const wurzelVon = (t: Title) => t.franchiseId ?? t.id
  const kopfTitel = new Map<number, Title>()
  for (const t of titles) if (wurzelVon(t) === t.id) kopfTitel.set(t.id, t)

  const gruppen = new Map<string, { am: string; wurzel: number; teile: typeof datiert }>()
  for (const m of datiert) {
    const schluessel = `${m.am}|${wurzelVon(m.titel)}`
    const g = gruppen.get(schluessel) ?? { am: m.am, wurzel: wurzelVon(m.titel), teile: [] }
    g.teile.push(m)
    gruppen.set(schluessel, g)
  }

  /*
    **Der Teil nennt, was ihn von der Reihe unterscheidet — nicht die Reihe.**

    Unter „Lord of Mysteries" stand „bei Crunchyroll · Lord of Mysteries
    Specials", blass und hinter dem Anbieter (Daniel, 12.09.2026: „heb besser
    hervor das es sich bei dem neuzugang nur um die Specials handelt, nicht um
    die hauptserie. so wie es aktuell dort steht ist es verwirrend"). Der
    Reihenname steht eine Zeile höher; hier bleibt „Specials".
  */
  const teilName = (teil: Title, kopf: string) => {
    const voll = name(teil)
    const rest = voll.toLowerCase().startsWith(kopf.toLowerCase())
      ? voll.slice(kopf.length).replace(/^[\s:–—-]+/, '').trim()
      : voll
    return rest || voll
  }

  const eintraege: NewsEintrag[] = []
  for (const g of gruppen.values()) {
    const jeTeil = new Map<number, number>()
    for (const m of g.teile) jeTeil.set(m.titel.id, (jeTeil.get(m.titel.id) ?? 0) + 1)
    const haeufigster = [...jeTeil.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    const kopfT =
      kopfTitel.get(g.wurzel) ?? g.teile.find((m) => m.titel.id === haeufigster)!.titel
    const kopf = name(kopfT)
    const meldungen: NewsMeldung[] = g.teile
      .slice()
      .sort((a, b) => rang[a.art] - rang[b.art] || (a.datum ?? '').localeCompare(b.datum ?? ''))
      .map((m) => {
        const { am: _am, titel: teil, ...rest } = m
        return teil.id === kopfT.id ? rest : { ...rest, teil: teilName(teil, kopf), teilId: teil.id }
      })
    eintraege.push({
      am: g.am,
      titelId: kopfT.id,
      titel: kopf,
      slug: kopfT.slug,
      cover: kopfT.coverImage ?? g.teile.find((m) => m.titel.coverImage)?.titel.coverImage,
      meldungen,
    })
  }

  /*
    **Sortiert wird nach Tag, dann nach der wichtigsten Meldung des Eintrags.**
    Ein Anime, der heute erstmals deutsch ist, steht über einem, der eine
    weitere Folge bekommen hat — auch wenn er daneben noch drei Termine trägt.
  */
  return eintraege
    .sort(
      (a, b) =>
        b.am.localeCompare(a.am) ||
        rang[a.meldungen[0]!.art] - rang[b.meldungen[0]!.art] ||
        a.titel.localeCompare(b.titel, 'de'),
    )
    .slice(0, HOECHSTENS)
}
