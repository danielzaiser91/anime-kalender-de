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
import type { NewsArt, NewsEintrag, Release, Title } from '../../shared/types.ts'
import { addDays, todayIso } from '../../shared/time.ts'

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
  const roh: (Omit<NewsEintrag, 'am'> & { schluessel: string; fallback: string })[] = []

  const kopf = (t: Title) => ({
    titelId: t.id,
    titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
    slug: t.slug,
    cover: t.coverImage,
  })

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
      anbieter,
    })
  }

  /* 2. Neue deutsche Folgen — je Serie und Tag eine Meldung, nicht je Folge. */
  const jeSerieUndTag = new Map<string, { serie: string; tag: string; nummern: number[] }>()
  for (const f of crNeu) {
    if (!f.serieId || f.gesehenAm < grenze) continue
    const schluessel = `${f.serieId}|${f.gesehenAm}`
    const eintrag = jeSerieUndTag.get(schluessel) ?? { serie: f.serie, tag: f.gesehenAm, nummern: [] }
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
      anbieter: 'crunchyroll',
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
      const art: NewsArt = r.releaseType === 'disc' ? 'disc' : r.releaseType === 'movie' ? 'kino' : 'angekuendigt'
      roh.push({
        schluessel: `${art}:${r.slug}:${datum}`,
        fallback: datum > heute ? heute : datum,
        art,
        ...kopf(t),
        anbieter: r.platform,
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
        anbieter: r.platform,
        datum: v.erwartetAm,
        von: Number(nummer),
        release: r.slug,
        /* Was inzwischen daraus wurde — leer, solange die Folge aussteht. */
        nachgereichtAm: v.erschienenAm,
      })
    }
  }

  /* Das Datum: beim ersten Mal gemerkt, danach unverändert. */
  const eintraege: NewsEintrag[] = []
  for (const r of roh) {
    const { schluessel, fallback, ...rest } = r
    const zuerst = historie.zuerst[schluessel] ?? (fallback > heute ? heute : fallback)
    historie.zuerst[schluessel] = zuerst
    if (zuerst < grenze) continue
    eintraege.push({ ...rest, am: zuerst })
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
  return eintraege
    .sort((a, b) => b.am.localeCompare(a.am) || rang[a.art] - rang[b.art] || a.titel.localeCompare(b.titel, 'de'))
    .slice(0, HOECHSTENS)
}
