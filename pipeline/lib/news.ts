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
import type { NewsArt, NewsBeleg, NewsEintrag, NewsMeldung, Release, Title } from '../../shared/types.ts'
import { pflegeTerminverlauf, type DatiertNews, type TerminGedaechtnis } from './news-verlauf.ts'
import { addDays, todayIso } from '../../shared/time.ts'
import { eindeutschenStaffel } from '../../shared/titles.ts'
import { hostVon } from '../../shared/quelle.ts'

/** Wie lange eine Meldung auf der Seite steht. */
const FENSTER_TAGE = 120
/** Obergrenze, damit die Datei klein bleibt — sie wird bei jedem Seitenaufruf geladen. */
const HOECHSTENS = 400

export interface NewsHistorie extends TerminGedaechtnis {
  /** Meldungsschlüssel → Tag, an dem die Meldung zum ersten Mal dastand. */
  zuerst: Record<string, string>
  /**
   * **Titel und Anbieter mit belegter Synchro → Tag, an dem wir das zuerst sahen**
   * (18.09.2026). Getrennt von `zuerst`, weil es nicht altern darf: Fiele ein Eintrag
   * nach 400 Tagen heraus, meldete der nächste Bau den Anbieter als neu. Beim ersten
   * Bau mit diesem Feld wird der ganze Bestand als alt eingetragen (`'0000-00-00'`),
   * sonst stünden an einem Tag zweitausend „neue" Anbieter auf der Seite.
   */
  anbieter?: Record<string, string>
}

interface NeuerTitel {
  id: number
  seit: string
}

/**
 * **Die Quelle eines Termins — eine Seite zum Nachsehen, kein Endpunkt** (29.09.2026).
 *
 * Daniel am 28.09.2026 zu den Neuigkeiten im Newsletter: „inkl Link zur Quelle". Die Quelle ist
 * nicht unsere Titelseite, sondern die Stelle, an der wir gelesen haben: meist ein Artikel
 * (anime2you.de, anisearch.de), bei ADN der Kalender-Endpunkt. Der wird nur genommen, wenn nichts
 * Lesbares dasteht — ein Link auf `gw.api.…` erklärt niemandem etwas.
 */
function quelleVonRelease(r: Release): string | undefined {
  /*
    **Die geltende Quelle zuerst** (01.10.2026). `quellen` führt die Historie mit,
    und dort stand die falsche aniSearch-Seite (Spin-off) noch als
    „vermutlich-überholt" an erster Stelle — der Link ging dorthin. `sources` ist
    die gehegte Liste des Termins (kuratiert, dann Ankündigung) und damit der
    bessere erste Griff.
  */
  const aktuelle = (r.quellen ?? []).filter((q) => q.stand === 'aktuell')
  return (
    r.sources?.find((u) => !u.includes('//gw.api.')) ??
    aktuelle.find((q) => !q.url.includes('//gw.api.'))?.url ??
    r.sources?.[0] ??
    (r.quellen ?? []).find((q) => !q.url.includes('//gw.api.'))?.url ??
    (r.quellen ?? [])[0]?.url
  )
}

/**
 * **Die Belege eines Termins — je Dokument einer** (01.10.2026).
 *
 * Daniel am 01.10.2026: gezählt wird **nach Artikel-Adresse**. Ein zweimal gelesener oder später
 * aktualisierter Artikel bleibt **eine** Quelle; nur ein weiteres Dokument kommt dazu. Deshalb
 * wird hier über die Adresse dedupliziert, nicht über die Lesung.
 *
 * Überholte Quellen zählen nicht mit: Sie belegen den geltenden Stand nicht mehr.
 */
export function belegeVonRelease(r: Release): NewsBeleg[] | undefined {
  const nachUrl = new Map<string, NewsBeleg>()
  for (const q of r.quellen ?? []) {
    if (q.stand && q.stand !== 'aktuell') continue
    if (!nachUrl.has(q.url)) nachUrl.set(q.url, { url: q.url, name: q.name, gelesenAm: q.gesehenAm })
  }
  /* Kuratierte Termine tragen nackte Adressen in `sources` — sie sind ebenso Belege. */
  for (const u of r.sources ?? []) if (!nachUrl.has(u)) nachUrl.set(u, { url: u, name: hostVon(u) })
  return nachUrl.size ? [...nachUrl.values()] : undefined
}

/**
 * **Die Termine als Meldungen** — angekündigt, auf Disc, im Kino, verschoben.
 *
 * Am 29.09.2026 aus `baueNews` herausgelöst (Längengrenze); dabei trägt jede Meldung ihre
 * **Quelle** — die Stelle, an der wir den Termin gelesen haben.
 */
function terminMeldungen(
  releases: Release[],
  nachId: Map<number, Title>,
  heute: string,
): (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] {
  const raus: (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] = []
  for (const r of releases) {
    const t = nachId.get(r.titleId)
    if (!t) continue
    const quelle = quelleVonRelease(r)
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
        r.releaseType === 'disc' ? 'disc' : r.platform === 'kino' ? 'kino' : 'angekuendigt'
      raus.push({
        schluessel: `${art}:${r.slug}:${datum}`,
        fallback: datum > heute ? heute : datum,
        art,
        titel: t,
        platform: r.platform,
        datum,
        release: r.slug,
        quelle, belege: belegeVonRelease(r), ...(r.schedule?.estimated ? { geschaetzt: true } : {}),
        /* Eine angekündigte Staffel trägt ihre Einordnung im Satz (Simuldub-Vermutung). */
        ...(art === 'angekuendigt' && r.schedule?.estimated && r.note ? { hinweis: r.note } : {}),
      })
    }
    for (const [nummer, v] of Object.entries(r.schedule?.verpasst ?? {})) {
      if (!v?.erwartetAm) continue
      raus.push({
        schluessel: `verspaetet:${r.slug}:${nummer}:${v.erwartetAm}`,
        fallback: v.erwartetAm,
        art: 'verspaetet',
        titel: t,
        platform: r.platform,
        /*
          Nur das Datum: Der Vermerk führt Zeitstempel, die Meldung ein Datum.
          Durchgereicht stand „06T15:00:00.000Z.09.2026" auf der News-Seite
          (Daniel, 15.09.2026).
        */
        datum: v.erwartetAm.slice(0, 10),
        von: Number(nummer),
        release: r.slug,
        /* Was inzwischen daraus wurde — leer, solange die Folge aussteht. */
        nachgereichtAm: v.erschienenAm?.slice(0, 10),
        quelle, belege: belegeVonRelease(r),
      })
    }
  }
  return raus
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
 * **Eine Quelle, eine Meldung** (Daniel, 02.10.2026).
 *
 * Am Overgeared-Panel standen zwei Einträge am selben Tag aus derselben Quelle: „Neu auf Deutsch ·
 * Erstmals mit deutscher Synchro bei Crunchyroll" und „Neue Folgen · Folge 1 auf Deutsch bei
 * Crunchyroll". Beides ist **dieselbe Aussage** — Daniel: „1 quelle = 1 news eintrag → beides muss
 * gebündelt werden".
 *
 * Gebündelt wird deshalb, wenn am **selben Tag**, beim **selben Titel und Anbieter**, aus
 * **derselben Quelle** eine `folgen`-Meldung neben einer `neu`-Meldung steht. Die Folgen-Angabe
 * geht nicht verloren: Sie wandert in den Vermerk (`hinweis`), der in der Oberfläche als leisere
 * Zeile unter dem Satz steht — die Hauptaussage bleibt kurz.
 *
 * **Noch nicht gebaut** (dafür fehlen die Lesungen): der zweite Teil von Daniels Ansage — wird ein
 * Artikel später **aktualisiert** und bringt neue Angaben, soll die Meldung mit **neuem**
 * Datumsstempel dastehen und das **alte Datum im Kleingedruckten** behalten. Das ist der
 * Lesungs-/Belegteil (Stufe 4 des Datenbank-Plans).
 */
export function verschmelzeGleicheQuelle(datiert: DatiertNews[]): DatiertNews[] {
  const neuJeSchluessel = new Map<string, DatiertNews>()
  for (const m of datiert) {
    if (m.art !== 'neu' || !m.quelle) continue
    neuJeSchluessel.set([m.titel.id, m.am, m.platform, m.quelle].join('|'), m)
  }
  const raus: DatiertNews[] = []
  for (const m of datiert) {
    if (m.art === 'folgen' && m.quelle) {
      const neu = neuJeSchluessel.get([m.titel.id, m.am, m.platform, m.quelle].join('|'))
      if (neu) {
        const spanne = m.bis !== undefined && m.bis !== m.von ? `Folgen ${m.von}–${m.bis}` : `Folge ${m.von ?? 1}`
        neu.hinweis = `${spanne} auf Deutsch bei ${m.platform === 'crunchyroll' ? 'Crunchyroll' : m.platform}`
        continue
      }
    }
    raus.push(m)
  }
  return raus
}

/**
 * **Steht der deutsche Start desselben Anbieters noch aus?** Dann ist es „angekündigt", nicht
 * „neu" (Daniel am 02.10.2026 an der Apothekerin S3: Der 03.09.-Eintrag hieß „Neu auf Deutsch ·
 * Erstmals mit deutscher Synchro bei Crunchyroll", „das muss heißen angekündigt und zum 02.10.").
 *
 * Die Regel vom 19.09.2026 — „neu auf Deutsch" nur, wenn die Synchro *an dem Tag zu sehen* ist —
 * kannte nur den erreichten Termin. Ein **künftiger** Termin desselben Anbieters ist der Beweis
 * für das Gegenteil: Es ist angekündigt. Steht er noch aus, fällt die Meldung dem
 * `angekuendigt`-Eintrag zu, der denselben Termin ohnehin trägt.
 *
 * **Gemessen am Tag der Meldung, nicht an heute** (02.10.2026): Der Bau am 02.10. fand den Termin
 * vom 02.10. bereits „erreicht" und ließ die 03.09.-Meldung stehen. Gefragt ist, ob Deutsch **an
 * dem Tag zu sehen war, an dem die Meldung entstand** — deshalb `n.seit`.
 *
 * **Gemessen am Anbieter, nicht am Titel:** Der erste Entwurf nahm „irgendein erreichter Termin"
 * als Ausnahme — beim Apothekerin-Titel war das der **Disc**-Termin vom 04.09., und die falsche
 * „Neu auf Deutsch"-Meldung blieb stehen. Ein Disc-Termin sagt nichts darüber, ob bei Crunchyroll
 * zu sehen ist; nur die Termine **desselben Anbieters** zählen.
 */
export function nurAngekuendigt(releases: Release[], titleId: number, plattform: string | undefined, tag: string): boolean {
  if (!plattform) return false
  const termine = releases
    .filter((r) => r.titleId === titleId && r.platform === plattform)
    .map((r) => r.schedule?.firstEpisodeDate)
    .filter((d): d is string => !!d)
  if (!termine.length) return false
  return !termine.some((d) => d <= tag)
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
  vorherige: NewsEintrag[] = [],
): NewsEintrag[] {
  const heute = todayIso()
  const grenze = addDays(heute, -FENSTER_TAGE)
  const nachId = new Map(titles.map((t) => [t.id, t]))
  const roh: (NewsMeldung & { schluessel: string; fallback: string; titel: Title })[] = []

  const kopf = (t: Title) => ({ titel: t })

  /*
    1. Erstmals mit deutscher Synchro — **aber erst, wenn man sie an dem Tag auch sehen kann**
    (Daniel, 19.09.2026, an „Witch on the Holy Night": „neu auf deutsch … sollten nur titel
    bekommen die an dem tag auch deutsch sind, hier ist es eher eine ankündigung"). Die Synchro
    war belegt, der Kinostart ist aber erst am 26.01.2027 — das sagt die Meldung „Im Kino" schon.
    Sichtbar ist Deutsch mit einem Stream mit deutscher Tonspur oder mit einem erreichten Termin
    (Kino, Disc, TV); die Meldung trägt dann dieses Datum, nicht den Tag, an dem wir die Synchro
    fanden.
  */
  for (const n of neuMitSynchro) {
    const t = nachId.get(n.id)
    if (!t) continue
    const anbieter = t.streams.find((s) => s.dub === true)?.platform
    const erreichtRelease = releases
      .filter((r) => r.titleId === t.id && r.schedule?.firstEpisodeDate && r.schedule.firstEpisodeDate <= heute)
      .sort((a, b) => a.schedule!.firstEpisodeDate!.localeCompare(b.schedule!.firstEpisodeDate!))[0]
    const erreicht = erreichtRelease?.schedule?.firstEpisodeDate
    if ((!anbieter && !erreicht) || nurAngekuendigt(releases, t.id, anbieter, n.seit)) continue
    roh.push({
      schluessel: `neu:${t.id}`,
      fallback: anbieter || !erreicht || erreicht < n.seit ? n.seit : erreicht,
      art: 'neu',
      ...kopf(t),
      platform: anbieter,
      quelle: t.streams.find((s) => s.dub === true && s.platform === anbieter)?.url ?? (erreichtRelease ? quelleVonRelease(erreichtRelease) : undefined),
      belege: (erreichtRelease && belegeVonRelease(erreichtRelease)) || undefined,
    })
  }

  /*
    1b. **Jetzt auch bei einem weiteren Anbieter auf Deutsch** (18.09.2026,
    Feature-Vergleich: JustWatch-Watchlist-Alerts). „Wo läuft es" ist bei den meisten
    Titeln die eigentliche Frage; ein neuer Weg zur Synchro ist deshalb eine Nachricht.
    Gemeldet wird nur ein **weiterer** Anbieter — der erste ist schon Meldung 1.
    YouTube bleibt draußen: Dort ist es oft ein einzelnes Probevideo, keine Serie.
  */
  const saeen = historie.anbieter === undefined
  const anbieterSeit = (historie.anbieter ??= {})
  for (const t of titles) {
    const wege = new Set(
      t.streams.filter((s) => s.dub === true && s.platform !== 'youtube').map((s) => s.platform),
    )
    for (const p of wege) {
      const k = `${t.id}:${p}`
      if (!(k in anbieterSeit)) anbieterSeit[k] = saeen ? '0000-00-00' : heute
    }
    for (const p of wege) {
      const seit = anbieterSeit[`${t.id}:${p}`]!
      if (seit < grenze) continue
      const frueher = [...wege].some((q) => q !== p && anbieterSeit[`${t.id}:${q}`]! < seit)
      if (!frueher) continue
      roh.push({
        schluessel: `anbieter:${t.id}:${p}`,
        fallback: seit,
        art: 'neu',
        ...kopf(t),
        platform: p,
        weiterer: true,
        quelle: t.streams.find((s) => s.dub === true && s.platform === p)?.url,
      })
    }
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
    const serienId = schluessel.split('|')[0]!
    const t = nachSerienId.get(serienId)
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
      /* Die Seite, auf der die deutschen Folgen stehen — dieselbe Adresse, über die zugeordnet wurde. */
      quelle: t.streams.find((s) => s.url.includes(serienId))?.url,
    })
  }

  /* 3. Termine: angekündigt, auf Disc, im Kino — und die, die niemand eingehalten hat. */
  roh.push(...terminMeldungen(releases, nachId, heute))
  /* Das Datum: beim ersten Mal gemerkt, danach unverändert. */
  let datiert: DatiertNews[] = []
  for (const r of roh) {
    const { schluessel, fallback, ...rest } = r
    const zuerst = historie.zuerst[schluessel] ?? (fallback > heute ? heute : fallback)
    historie.zuerst[schluessel] = zuerst
    if (zuerst < grenze) continue
    datiert.push({ ...rest, am: zuerst, schluessel })
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

  datiert = verschmelzeGleicheQuelle(datiert)
  datiert.push(...pflegeTerminverlauf({ datiert, nachId, historie, vorherige, name, wurzel: wurzelVon, grenze, heute }))

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
        const { am: _am, titel: teil, schluessel: _s, ...rest } = m
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
